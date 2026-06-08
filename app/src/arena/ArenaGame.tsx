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
import { ArenaMatchEnd } from "./ArenaMatchEnd";
import { ArenaMatchSplash } from "./ArenaMatchSplash";
import { ArenaPlanPhase } from "./ArenaPlanPhase";
import { advanceToNextTurn, makeInitialBoard } from "./arenaRules";
import { cpuArenaDecision } from "./arenaAI";
import {
  HERO_MAX_HP,
  type ArenaTargeting,
  type BoardState,
  type LaneIndex,
  type PlayedSpell,
  type PlannedSummon,
  type TurnIntent,
} from "./arenaTypes";
import { CPU_ARENA_DECK, buildPlayerDeck, removeSpentCards } from "./arenaDecks";
import { runResolverFlow, type ResolveStep } from "./arenaResolverFlow";

const MATCH_FOUND_SPLASH_MS = 1_800;

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
  /** Player intent preview: mirror of oppPreview for OUR side. Set when the
   *  resolver kicks off so the player can read what they themselves locked
   *  in. Cleared when the player starts a new turn. */
  const [playerPreview, setPlayerPreview] = useState<TurnIntent | null>(null);
  /** Current step in the sequenced resolver. Drives the phase banner. */
  const [resolveStep, setResolveStep] = useState<ResolveStep | null>(null);
  /** Active targeting (lifted from ArenaPlanPhase) — when set, tapping a
   *  lane on the BOARD itself commits the spell/summon. Hearthstone-style
   *  direct manipulation instead of separate "Lane 1/2/3" buttons. */
  const [targeting, setTargeting] = useState<ArenaTargeting>(null);
  /** Which lane is CURRENTLY animating its combat exchange — drives the
   *  per-lane "charge → impact → retreat" animation on its creatures.
   *  Only ONE lane is "live" at a time so the player's eye lands on it. */
  const [combatLane, setCombatLane] = useState<LaneIndex | null>(null);
  /** Hero-hit pulse: set briefly when an undefended-lane attack lands on a
   *  hero. Drives the dramatic HP-bar flash on the hit hero strip. Keyed by
   *  side + lane so consecutive hits on the same hero re-trigger the anim. */
  const [heroHit, setHeroHit] = useState<{ side: "you" | "opp"; lane: LaneIndex; key: number } | null>(null);

  /** Route a board-lane tap to the active targeting intent. Called by
   *  ArenaBoard when a lane slot is clicked while targeting is non-null. */
  function handleBoardLaneTap(lane: LaneIndex) {
    if (!targeting) return;
    if (targeting.kind === "summon") {
      hapticTap();
      setIntent((cur) => ({
        ...cur,
        summons: [...cur.summons.filter((s) => s.lane !== lane), { lane, move: targeting.move }],
      }));
      setTargeting(null);
      return;
    }
    if (targeting.kind === "spell" && targeting.targetKind === "lane") {
      hapticTap();
      setIntent((cur) => ({
        ...cur,
        spells: [...cur.spells, { id: targeting.id, kind: "lane", lane }],
      }));
      setTargeting(null);
      return;
    }
  }

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
    if (intentCost(intent) > board.a.mana) return;
    hapticLock();
    setResolving(true);

    const cpuIntent = cpuArenaDecision(board, "b", difficulty);
    // Pre-clean hands so spell cards leave hand BEFORE the spells step shows.
    const startBoard: BoardState = {
      ...board,
      a: { ...board.a, hand: removeSpentCards(board.a.hand, intent) },
      b: { ...board.b, hand: removeSpentCards(board.b.hand, cpuIntent) },
    };

    runResolverFlow({
      startBoard,
      playerIntent: intent,
      cpuIntent,
      setBoard,
      setOppPreview,
      setPlayerPreview,
      setResolveStep,
      setCombatLane,
      setHeroHit,
      onSettle: () => setIntent({ spells: [], summons: [] }),
      onAdvanceTurn: () => {
        setResolving(false);
        setBoard((cur) => advanceToNextTurn(cur));
      },
      onMatchEnd: (winnerIsPlayer) => {
        setResolving(false);
        if (winnerIsPlayer) hapticWin(); else hapticLoss();
      },
    });
  }

  /* ──────────── Render ──────────── */

  if (matchSplash) {
    return <ArenaMatchSplash playerName={player.nickname || "Toi"} playerAvatar={player.avatar} />;
  }

  if (board.phase === "match-end") {
    return (
      <ArenaMatchEnd
        board={board}
        onQuit={onQuit}
        onRematch={() => {
          // Soft reset: rebuild the board fresh and let the lifecycle re-run.
          // The match-end haptic/stat record already fired, so this is purely
          // a re-init. Re-mount via key change is the cleanest path.
          matchEndedRef.current = false;
          setBoard(makeInitialBoard(playerDeck.current, CPU_ARENA_DECK));
          setIntent({ spells: [], summons: [] });
          setOppPreview(null);
          setPlayerPreview(null);
          setResolveStep(null);
          setResolving(false);
          setMatchSplash(true);
        }}
      />
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
          playerPreview={playerPreview}
          resolveStep={resolveStep}
          combatLane={combatLane}
          heroHit={heroHit}
          targeting={targeting}
          onLaneTap={handleBoardLaneTap}
        />
      </ScaleToFit>
      <ArenaPlanPhase
        board={board}
        intent={intent}
        intentCost={intentCost(intent)}
        disabled={resolving}
        targeting={targeting}
        onSetTargeting={setTargeting}
        onAddSpell={addSpell}
        onRemoveSpell={removeSpell}
        onAddSummon={addSummon}
        onRemoveSummon={removeSummon}
        onLock={handleLockTurn}
      />
    </div>
  );
}

// Deck construction + spent-card cleanup live in arenaDecks.ts now.

// Re-export HERO_MAX_HP for callers that need the win-condition constant.
export { HERO_MAX_HP };
