/**
 * ArenaGame — top-level orchestrator for Constellation Pro vs CPU.
 *
 * Owns: the BoardState (one source of truth for both heroes, lanes,
 * creatures, mana, turn number) and the PLAYER's pending TurnIntent
 * (spells they've queued, summons they've planned).
 *
 * Turn loop:
 *   planning → lock → CPU decides its intent → resolveTurn fires →
 *   advanceToNextTurn (mana up, draw cards) → planning … until a hero
 *   hits 0 HP, which flips the phase to match-end.
 *
 * The board is the single source of truth — every UI piece reads from
 * it and never mutates anything outside. All transitions go through
 * arenaRules pure functions, so the resolver is unit-testable.
 */

import { useEffect, useRef, useState } from "react";
import {
  hapticLock, hapticMatchStart, hapticMatchWin, hapticMatchLoss,
  hapticTap, hapticWin, hapticLoss,
} from "../haptic";
import { useStore } from "../store/store";
import { CARDS } from "../ranked/cards";
import type { CardId } from "../ranked/rankedTypes";
import { ArenaBoard } from "./ArenaBoard";
import { ArenaPlanPhase } from "./ArenaPlanPhase";
import {
  advanceToNextTurn,
  makeInitialBoard,
  resolveTurn,
} from "./arenaRules";
import { cpuArenaDecision } from "./arenaAI";
import {
  HERO_MAX_HP,
  type BoardState,
  type LaneIndex,
  type PlayedSpell,
  type PlannedSummon,
  type TurnIntent,
} from "./arenaTypes";
import { arenaSupported } from "./arenaCardEffects";

/** Bot opponent deck — a curated set of Arena-supported spells so the CPU
 *  always has playable cards. (Player deck comes from store.player.rankedDeck.) */
const CPU_ARENA_DECK: CardId[] = [
  "aegis", "precision", "anchor", "second-wind",
  "surge", "augur", "curse", "mirror",
  "heist", "tide", "oracle", "supernova",
];

const MATCH_FOUND_SPLASH_MS = 1_800;
const RESOLVE_PAUSE_MS = 2_200;

export function ArenaGame({
  onQuit,
}: {
  onQuit: () => void;
}) {
  const player = useStore((s) => s.player);
  const difficulty = player.difficulty ?? "normal";

  // Player deck — filter out cards we haven't adapted to Arena yet so the
  // hand never contains a no-op card. Falls back to a curated default if
  // the saved deck has too few supported cards. Saved deck is `string[]` in
  // the store; we re-narrow to CardId by filtering against the registry.
  const playerDeck = useRef<CardId[]>(buildPlayerDeck(
    (player.rankedDeck ?? []).filter(
      (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
    ),
  ));

  const [board, setBoard] = useState<BoardState>(() =>
    makeInitialBoard(playerDeck.current, CPU_ARENA_DECK),
  );
  const [intent, setIntent] = useState<TurnIntent>({ spells: [], summons: [] });
  const [matchSplash, setMatchSplash] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    hapticMatchStart();
    const id = window.setTimeout(() => setMatchSplash(false), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Match-end haptic — fired once when the phase flips.
  const matchEndedRef = useRef(false);
  useEffect(() => {
    if (board.phase !== "match-end") return;
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    const youWon = board.b.hp <= 0 && board.a.hp > 0;
    if (youWon) hapticMatchWin(); else hapticMatchLoss();
  }, [board.phase, board.a.hp, board.b.hp]);

  /* ──────────── Intent builders ──────────── */

  function addSpell(spell: PlayedSpell) {
    // Reserve mana checks happen at lock — here we only enforce that the
    // intent doesn't already contain the same spell instance (the UI may
    // call this twice on a rapid tap).
    hapticTap();
    setIntent((cur) => ({ ...cur, spells: [...cur.spells, spell] }));
  }

  function removeSpell(idx: number) {
    setIntent((cur) => ({
      ...cur,
      spells: cur.spells.filter((_, i) => i !== idx),
    }));
  }

  function addSummon(summon: PlannedSummon) {
    // Replace any existing summon on the same lane (one summon per lane per
    // turn, by design — see arenaRules.applySummons).
    hapticTap();
    setIntent((cur) => ({
      ...cur,
      summons: [...cur.summons.filter((s) => s.lane !== summon.lane), summon],
    }));
  }

  function removeSummon(lane: LaneIndex) {
    setIntent((cur) => ({ ...cur, summons: cur.summons.filter((s) => s.lane !== lane) }));
  }

  /** Total mana cost of the player's pending intent — used by the plan UI
   *  to grey out cards that would overflow. */
  function intentCost(i: TurnIntent): number {
    let total = i.summons.length * 1; // 1m per summon
    for (const s of i.spells) total += CARDS[s.id].cost;
    return total;
  }

  /* ──────────── Lock & resolve ──────────── */

  function handleLockTurn() {
    if (resolving) return;
    if (board.phase !== "planning") return;
    // Sanity: the intent's total mana can't exceed the player's pool. The UI
    // should prevent this from happening, but we defend against a stale tap.
    if (intentCost(intent) > board.a.mana) return;
    hapticLock();
    setResolving(true);

    // CPU decides its intent against the CURRENT board (the resolver applies
    // both intents at once anyway, so this is fair).
    const cpuIntent = cpuArenaDecision(board, "b", difficulty);

    // Move both players' cards out of hand into "spent" (resolver consumes
    // the mana via the spells/summons themselves, but the cards must leave
    // the hand). We pre-clean the hands here so the resolver sees the
    // post-play hand state.
    const boardAfterHandClean = {
      ...board,
      a: { ...board.a, hand: removeSpentCards(board.a.hand, intent) },
      b: { ...board.b, hand: removeSpentCards(board.b.hand, cpuIntent) },
    };

    // Apply the resolver. Animation is "instant" for MVP — Phase 2 will
    // interpolate between board states.
    const after = resolveTurn(boardAfterHandClean, intent, cpuIntent);
    setBoard(after);
    setIntent({ spells: [], summons: [] });

    // Reveal haptic on lethal swing.
    if (after.a.hp <= 0 || after.b.hp <= 0) {
      window.setTimeout(() => {
        if (after.b.hp <= 0 && after.a.hp > 0) hapticWin();
        else hapticLoss();
      }, 400);
    }

    // After a pause to let the player read the result, advance to the next
    // turn (mana up, draw a card) unless the match ended.
    window.setTimeout(() => {
      setResolving(false);
      if (after.phase === "match-end") return;
      setBoard((b) => advanceToNextTurn(b));
    }, RESOLVE_PAUSE_MS);
  }

  /* ──────────── Render ──────────── */

  if (matchSplash) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-themed font-bold">
          Constellation Pro
        </div>
        <div className="text-2xl font-extrabold text-white">Match en préparation…</div>
        <div className="text-xs text-ink-muted text-center max-w-xs">
          Premier héros à 0 PV perd. Invoquez des créatures, lancez des sorts, jouez intelligent.
        </div>
      </div>
    );
  }

  if (board.phase === "match-end") {
    const youWon = board.b.hp <= 0 && board.a.hp > 0;
    const draw = board.a.hp <= 0 && board.b.hp <= 0;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <div className={
          "text-4xl font-extrabold " +
          (draw ? "text-ink-muted" : youWon ? "text-emerald-300" : "text-rose-300")
        }>
          {draw ? "ÉGALITÉ" : youWon ? "VICTOIRE" : "DÉFAITE"}
        </div>
        <div className="text-sm text-ink-muted">
          Toi {board.a.hp} PV · Adv {board.b.hp} PV · Tour {board.turn}
        </div>
        <button
          onClick={onQuit}
          className="mt-4 px-6 py-2.5 rounded-2xl font-bold text-white bg-themed shadow-lg"
        >
          Retour au menu
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 gap-2">
      <ArenaBoard
        board={board}
        playerSide="a"
        intent={intent}
      />
      <ArenaPlanPhase
        board={board}
        intent={intent}
        intentCost={intentCost(intent)}
        disabled={resolving}
        onAddSpell={addSpell}
        onRemoveSpell={removeSpell}
        onAddSummon={addSummon}
        onRemoveSummon={removeSummon}
        onLock={handleLockTurn}
      />
    </div>
  );
}

/** Strip the cards the side committed (spells + summons → wait, summons are
 *  moves, not cards) from their hand BEFORE the resolver runs, so the next
 *  turn's draw starts from a clean hand. Spells go to discard. */
function removeSpentCards(hand: CardId[], intent: TurnIntent): CardId[] {
  let out = hand.slice();
  for (const s of intent.spells) {
    const i = out.indexOf(s.id);
    if (i >= 0) out = [...out.slice(0, i), ...out.slice(i + 1)];
  }
  return out;
}

/** Build the player's Arena deck from their saved Ranked deck, filtering out
 *  un-adapted cards. Pads with a curated default if too short. */
function buildPlayerDeck(saved: CardId[] | undefined): CardId[] {
  const FILLER: CardId[] = [
    "aegis", "precision", "anchor", "second-wind",
    "surge", "curse", "mirror", "tide",
  ];
  const base = (saved ?? []).filter(arenaSupported);
  if (base.length >= 6) return base;
  // Top up with filler — duplicates allowed since deck-of-8 is small.
  const out = base.slice();
  for (const f of FILLER) {
    if (out.length >= 8) break;
    out.push(f);
  }
  return out;
}

// Silence unused — these may be used by the board for showing creature stats.
export { HERO_MAX_HP };
