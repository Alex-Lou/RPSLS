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
import { ScaleToFit } from "../match/sharedMatchUI";
import { ArenaBoard } from "./ArenaBoard";
import { ArenaPlanPhase } from "./ArenaPlanPhase";
import {
  advanceToNextTurn,
  applySpellPhase,
  applySummons,
  endOfTurnCleanup,
  makeInitialBoard,
  resolveCombat,
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
/** Sequenced resolver pacing — each step shows for this long before the next
 *  fires. Tuned to read like a real card-game animation while staying snappy
 *  enough that a turn caps around 7-8s total. */
const STEP_REVEAL_MS = 1_500;  // "Adversaire joue" preview
const STEP_SPELLS_MS = 1_200;  // spells fire on both sides
const STEP_SUMMONS_MS = 1_000; // creatures arrive on lanes
const STEP_COMBAT_MS = 1_500;  // creature combat resolves
/** Final pause to read the resulting board before the next turn. */
const RESOLVE_PAUSE_MS = 1_500;

/** Where we are in the sequenced resolver — drives the phase banner so the
 *  player always sees which step is firing. `null` outside the resolver. */
type ResolveStep =
  | "reveal-opp"   // showing CPU intent before any effect
  | "spells"       // both sides' spells just fired
  | "summons"      // new creatures just landed
  | "combat"       // lane combat just resolved
  | "settle";      // post-combat, before next turn

export function ArenaGame({
  onQuit,
}: {
  onQuit: () => void;
}) {
  const player = useStore((s) => s.player);
  const difficulty = player.difficulty ?? "normal";
  const recordArenaMatch = useStore((s) => s.recordArenaMatch);

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
  /** Opp intent preview: set after lock, cleared when the spells step fires.
   *  Drives the "Adversaire joue X / summon Y" banner + ghost previews on
   *  the opp lanes so the player SEES what they committed. */
  const [oppPreview, setOppPreview] = useState<TurnIntent | null>(null);
  /** Current step in the sequenced resolver. Drives the phase banner. */
  const [resolveStep, setResolveStep] = useState<ResolveStep | null>(null);

  useEffect(() => {
    hapticMatchStart();
    const id = window.setTimeout(() => setMatchSplash(false), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Match-end haptic + stat record. Fired once when the phase flips.
  // recordArenaMatch lives in the store and is sync'd to the cloud via the
  // existing playerSync subscriber (fingerprint covers arenaStats now).
  const matchEndedRef = useRef(false);
  useEffect(() => {
    if (board.phase !== "match-end") return;
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    const aDead = board.a.hp <= 0;
    const bDead = board.b.hp <= 0;
    const outcome: "win" | "loss" | "draw" =
      aDead && bDead ? "draw" : bDead ? "win" : "loss";
    if (outcome === "win") hapticMatchWin();
    else if (outcome === "loss") hapticMatchLoss();
    recordArenaMatch(outcome);
  }, [board.phase, board.a.hp, board.b.hp, recordArenaMatch]);

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

    // Pre-clean hands so the player's intent-bound cards leave their hand
    // BEFORE the spells step shows. Same on the CPU side.
    const startBoard = {
      ...board,
      a: { ...board.a, hand: removeSpentCards(board.a.hand, intent) },
      b: { ...board.b, hand: removeSpentCards(board.b.hand, cpuIntent) },
    };

    // ─── Step 0: REVEAL — show the CPU's intent (ghost previews + banner)
    // before any effect fires. The player reads it and bracts.
    setOppPreview(cpuIntent);
    setResolveStep("reveal-opp");

    // ─── Step 1: SPELLS — both sides' spells fire. Buffs, damage, draws all
    // land at once (resolver internally sorts by priority).
    window.setTimeout(() => {
      let b = startBoard;
      b = applySpellPhase(b, intent, "a");
      b = applySpellPhase(b, cpuIntent, "b");
      setBoard(b);
      setOppPreview(null); // ghost previews give way to the actual creatures
      setResolveStep("spells");

      // ─── Step 2: SUMMONS — new creatures land on lanes.
      window.setTimeout(() => {
        b = applySummons(b, intent, "a");
        b = applySummons(b, cpuIntent, "b");
        setBoard(b);
        setResolveStep("summons");

        // ─── Step 3: COMBAT — TWO sub-steps so the player SEES the impact.
        // 3a) Flip the step to "combat" BEFORE running the resolver so the
        //     shake animation in ArenaLaneSlot fires on creatures that are
        //     still alive (pre-combat HP). The board itself is unchanged.
        // 3b) After ~SHAKE_MS the resolver runs, deaths happen, dmg popups
        //     trigger via the new HP values.
        const SHAKE_MS = 450;
        window.setTimeout(() => {
          setResolveStep("combat");

          window.setTimeout(() => {
            b = resolveCombat(b);
            b = endOfTurnCleanup(b);
            if (b.a.hp <= 0 || b.b.hp <= 0) {
              b = { ...b, phase: "match-end" };
            }
            setBoard(b);

            if (b.a.hp <= 0 || b.b.hp <= 0) {
              window.setTimeout(() => {
                if (b.b.hp <= 0 && b.a.hp > 0) hapticWin();
                else hapticLoss();
              }, 200);
            }
          }, SHAKE_MS);

          // ─── Step 4: SETTLE — final pause to read, then advance to next turn.
          window.setTimeout(() => {
            setIntent({ spells: [], summons: [] });
            setResolveStep("settle");
            window.setTimeout(() => {
              setResolving(false);
              setResolveStep(null);
              if (b.phase === "match-end") return;
              setBoard((cur) => advanceToNextTurn(cur));
            }, RESOLVE_PAUSE_MS);
          }, STEP_COMBAT_MS);
        }, STEP_SUMMONS_MS);
      }, STEP_SPELLS_MS);
    }, STEP_REVEAL_MS);
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
      {/* The board area can grow tall (2 hero strips + 2 lane rows + chips +
       *  phase banner) so we wrap it in ScaleToFit: on short viewports it
       *  uniformly scales down to fit, never clipping the opp portrait or
       *  the player HP bar. The plan phase stays shrink-0 below it. */}
      <ScaleToFit align="center">
        <ArenaBoard
          board={board}
          playerSide="a"
          intent={intent}
          oppPreview={oppPreview}
          resolveStep={resolveStep}
        />
      </ScaleToFit>
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
