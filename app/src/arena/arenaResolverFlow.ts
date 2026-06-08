/**
 * Sequenced resolver flow for Constellation Pro.
 *
 * Drives the animated turn resolution: REVEAL → SPELLS → SUMMONS → COMBAT
 * (lane-by-lane) → SETTLE → advance to next turn. All side effects go
 * through the setter callbacks passed in — this file owns the TIMING but
 * not the React state.
 *
 * Extracted from ArenaGame.tsx so that file stays under the 400-line ceiling.
 */

import {
  applySpellPhase,
  applySummons,
  endOfTurnCleanup,
  resolveLaneCombatAt,
} from "./arenaRules";
import type { BoardState, LaneIndex, TurnIntent } from "./arenaTypes";

/** Resolver step labels — kept in sync with ArenaBoard's banner switch. */
export type ResolveStep =
  | "reveal-opp"   // showing CPU intent before any effect
  | "spells"       // both sides' spells just fired
  | "summons"      // new creatures just landed
  | "combat"       // lane combat just resolved
  | "settle";      // post-combat, before next turn

export interface ResolverFlowArgs {
  /** Board AFTER hand-cleanup (spells removed from hand) but BEFORE spell effects fire. */
  startBoard: BoardState;
  playerIntent: TurnIntent;
  cpuIntent: TurnIntent;
  setBoard: (b: BoardState) => void;
  setOppPreview: (i: TurnIntent | null) => void;
  setPlayerPreview: (i: TurnIntent | null) => void;
  setResolveStep: (s: ResolveStep | null) => void;
  setCombatLane: (l: LaneIndex | null) => void;
  setHeroHit: (h: { side: "you" | "opp"; lane: LaneIndex; key: number } | null) => void;
  /** Called BEFORE the resolver advances to the next turn — clears the
   *  player's pending intent and stops the "resolving" lock. */
  onSettle: (finalBoard: BoardState) => void;
  /** Called AFTER the resolver's settle pause — advances board to next turn. */
  onAdvanceTurn: () => void;
  /** Match-end haptics — fired once if either hero hit 0 HP. */
  onMatchEnd?: (winnerIsPlayer: boolean) => void;
}

/** Pacing constants — chosen so a turn caps around 7-8s. */
export const REVEAL_MS = 1_500;
export const SPELLS_MS = 1_200;
export const SUMMONS_MS = 1_000;
export const COMBAT_MS = 3_000;
export const SETTLE_MS = 1_500;
const LANE_CHARGE_MS = 520;
const LANE_PAUSE_MS = 320;

/** Run the sequenced resolver. Schedules a chain of setTimeouts that drive
 *  the visual flow. Returns nothing — the caller's React state is the only
 *  observable side-effect. */
export function runResolverFlow(args: ResolverFlowArgs): void {
  const {
    startBoard, playerIntent, cpuIntent,
    setBoard, setOppPreview, setPlayerPreview, setResolveStep,
    setCombatLane, setHeroHit,
    onSettle, onAdvanceTurn, onMatchEnd,
  } = args;

  // ─── Step 0: REVEAL ───
  setOppPreview(cpuIntent);
  setPlayerPreview(playerIntent);
  setResolveStep("reveal-opp");

  // ─── Step 1: SPELLS ───
  window.setTimeout(() => {
    let b = startBoard;
    b = applySpellPhase(b, playerIntent, "a");
    b = applySpellPhase(b, cpuIntent, "b");
    setBoard(b);
    setResolveStep("spells");

    // ─── Step 2: SUMMONS ───
    window.setTimeout(() => {
      b = applySummons(b, playerIntent, "a");
      b = applySummons(b, cpuIntent, "b");
      setBoard(b);
      setOppPreview(null);
      setPlayerPreview(null);
      setResolveStep("summons");

      // ─── Step 3: COMBAT — lane by lane ───
      window.setTimeout(() => {
        setResolveStep("combat");
        const runLane = (laneIdx: 0 | 1 | 2) => {
          const lane = b.lanes[laneIdx];
          const aHitsB = !!lane.a && !lane.b;
          const bHitsA = !!lane.b && !lane.a;
          setCombatLane(laneIdx);
          // Mid-charge: flash the targeted hero BEFORE damage is committed.
          window.setTimeout(() => {
            if (aHitsB) setHeroHit({ side: "opp", lane: laneIdx, key: Date.now() });
            if (bHitsA) setHeroHit({ side: "you", lane: laneIdx, key: Date.now() + 1 });
          }, LANE_CHARGE_MS * 0.55);
          window.setTimeout(() => {
            b = resolveLaneCombatAt(b, laneIdx);
            setBoard(b);
            if (b.a.hp <= 0 || b.b.hp <= 0) {
              setCombatLane(null);
              return;
            }
            if (laneIdx < 2) {
              window.setTimeout(() => {
                setCombatLane(null);
                window.setTimeout(() => runLane((laneIdx + 1) as 0 | 1 | 2), 50);
              }, LANE_PAUSE_MS);
            } else {
              window.setTimeout(() => setCombatLane(null), LANE_PAUSE_MS);
            }
          }, LANE_CHARGE_MS);
        };
        runLane(0);

        // After all 3 lanes — cleanup + HP check.
        const TOTAL_COMBAT_MS = LANE_CHARGE_MS * 3 + LANE_PAUSE_MS * 2 + 200;
        window.setTimeout(() => {
          b = endOfTurnCleanup(b);
          if (b.a.hp <= 0 || b.b.hp <= 0) {
            b = { ...b, phase: "match-end" };
          }
          setBoard(b);
          if ((b.a.hp <= 0 || b.b.hp <= 0) && onMatchEnd) {
            window.setTimeout(() => {
              onMatchEnd(b.b.hp <= 0 && b.a.hp > 0);
            }, 200);
          }
        }, TOTAL_COMBAT_MS);

        // ─── Step 4: SETTLE ───
        window.setTimeout(() => {
          setResolveStep("settle");
          onSettle(b);
          window.setTimeout(() => {
            setResolveStep(null);
            if (b.phase === "match-end") return;
            onAdvanceTurn();
          }, SETTLE_MS);
        }, COMBAT_MS);
      }, SUMMONS_MS);
    }, SPELLS_MS);
  }, REVEAL_MS);
}
