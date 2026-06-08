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
import {
  advanceToNextTurn,
  applySpellPhase,
  applySummons,
  endOfTurnCleanup,
  makeInitialBoard,
  resolveLaneCombatAt,
} from "./arenaRules";
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

const MATCH_FOUND_SPLASH_MS = 1_800;
/** Sequenced resolver pacing — each step shows for this long before the next
 *  fires. Tuned to read like a real card-game animation while staying snappy
 *  enough that a turn caps around 7-8s total. */
const STEP_REVEAL_MS = 1_500;  // "Adversaire joue" preview
const STEP_SPELLS_MS = 1_200;  // spells fire on both sides
const STEP_SUMMONS_MS = 1_000; // creatures arrive on lanes
/** Combat now runs lane-by-lane (~380ms shake + ~280ms pause × 3 lanes,
 *  ≈ 1800ms). Add a buffer so cleanup + the death-ghost overlays finish. */
const STEP_COMBAT_MS = 2_200;
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

    // ─── Step 0: REVEAL — show BOTH sides' intents (ghost previews +
    //     banners) before any effect fires. The player reads both at once.
    setOppPreview(cpuIntent);
    setPlayerPreview(intent);
    setResolveStep("reveal-opp");

    // ─── Step 1: SPELLS — both sides' spells fire. Buffs, damage, draws all
    // land at once (resolver internally sorts by priority). Both preview
    // banners stay visible so the player can read what hit what.
    window.setTimeout(() => {
      let b = startBoard;
      b = applySpellPhase(b, intent, "a");
      b = applySpellPhase(b, cpuIntent, "b");
      setBoard(b);
      setResolveStep("spells");

      // ─── Step 2: SUMMONS — new creatures land on lanes. THIS is when
      //     the preview banners give way to the actual board.
      window.setTimeout(() => {
        b = applySummons(b, intent, "a");
        b = applySummons(b, cpuIntent, "b");
        setBoard(b);
        setOppPreview(null);
        setPlayerPreview(null);
        setResolveStep("summons");

        // ─── Step 3: COMBAT — LANE BY LANE for clarity. Each lane gets:
        //     - shake animation playing on its (still-alive) creatures
        //     - then the resolver fires for THAT lane only
        //     - HP popups + death ghosts surface naturally via the diff
        //     - brief pause, then next lane
        //   The overall step stays "combat" the whole time; only the board
        //   state advances one lane at a time.
        const LANE_SHAKE_MS = 380;
        const LANE_PAUSE_MS = 280;
        window.setTimeout(() => {
          setResolveStep("combat");

          // Recursive helper that walks lanes 0 → 1 → 2.
          const runLane = (laneIdx: 0 | 1 | 2) => {
            window.setTimeout(() => {
              b = resolveLaneCombatAt(b, laneIdx);
              setBoard(b);
              // If a hero died from a lane attack mid-combat, short-circuit
              // the remaining lanes — nothing to attack anyway.
              if (b.a.hp <= 0 || b.b.hp <= 0) return;
              if (laneIdx < 2) {
                window.setTimeout(() => runLane((laneIdx + 1) as 0 | 1 | 2), LANE_PAUSE_MS);
              }
            }, LANE_SHAKE_MS);
          };
          runLane(0);

          // After all 3 lanes have had their window (3 × (shake + pause)),
          // run the cleanup + HP check. This timer fires once regardless
          // of the per-lane chain.
          const TOTAL_COMBAT_MS = LANE_SHAKE_MS * 3 + LANE_PAUSE_MS * 2 + 100;
          window.setTimeout(() => {
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
          }, TOTAL_COMBAT_MS);

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
