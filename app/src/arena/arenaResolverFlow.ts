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
  applyAllSpells,
  applySummons,
  creatureEffectiveAtk,
  endOfTurnCleanup,
  resolveLaneCombatAt,
} from "./arenaRules";
import { CREATURE_STATS, moveCountersMove, type BoardState, type LaneIndex, type TurnIntent } from "./arenaTypes";
import { alog } from "./arenaLog";

/** Snapshot helper — log compact d'une lane avec flags. Réutilise le même
 *  format que advanceToNextTurn pour cohérence à travers le pipeline. */
function logBoardSnapshot(b: BoardState, tag: string): void {
  alog("state", `--- ${tag} --- a.hp=${b.a.hp} b.hp=${b.b.hp}`);
  const fmt = (c: BoardState["lanes"][number]["a"]): string => {
    if (!c) return "∅";
    const stats = CREATURE_STATS[c.move];
    const atk = creatureEffectiveAtk(c);
    const flags: string[] = [];
    if (c.divineShield) flags.push("🛡");
    if (c.dodgeCharge) flags.push("✨");
    if (c.taunt && c.provocationCharges > 0) flags.push(`P${c.provocationCharges}`);
    if (c.summonedThisTurn && (c.move === "rock" || c.move === "lizard")) flags.push("L");
    if (c.move === "paper" && c.wiltedSteps > 0) flags.push(`F${c.wiltedSteps}`);
    if (c.combatBlunted) flags.push("É");
    return `${c.move}(${c.hp}/${stats.hp},⚔${atk}${flags.length ? "," + flags.join("") : ""})`;
  };
  for (let i = 0; i < 3; i++) {
    alog("state", `${tag} L${i} a:${fmt(b.lanes[i].a)} b:${fmt(b.lanes[i].b)}`);
  }
  // Alex feedback : "ajouter les cartes de chacun dans les logs" → mains
  // visibles côté joueur ET côté CPU pour analyse CCG post-mortem.
  // Format compact : main=[id1,id2,...] deck=N discard=M mana=X/Y.
  alog("hand", `${tag} a hand=[${b.a.hand.join(",")}] deck=${b.a.deck.length} discard=${b.a.discard.length} mana=${b.a.mana}/${b.a.maxMana}${b.a.killBonusPending ? " +K" : ""}${b.a.aegisCastThisMatch ? " [AEGIS-LOCK]" : ""}`);
  alog("hand", `${tag} b hand=[${b.b.hand.join(",")}] deck=${b.b.deck.length} discard=${b.b.discard.length} mana=${b.b.mana}/${b.b.maxMana}${b.b.killBonusPending ? " +K" : ""}${b.b.aegisCastThisMatch ? " [AEGIS-LOCK]" : ""}`);
}

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
  /** Set when an undefended-lane attack is DEFLECTED by a taunt creature.
   *  `defenderSide` owns the taunt. `rockLane` is the lane of the Pierre
   *  that ate the deflection — used by the UI to pull a dotted line from
   *  the attacker's lane to the Pierre + decrement its charge badge. */
  setTauntBlock: (b: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null) => void;
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
    setCombatLane, setHeroHit, setTauntBlock,
    onSettle, onAdvanceTurn, onMatchEnd,
  } = args;

  // ─── Step 0: REVEAL ───
  setOppPreview(cpuIntent);
  setPlayerPreview(playerIntent);
  setResolveStep("reveal-opp");

  // ─── Step 1: SPELLS ─── (fairness fix #1: intercalate sides by priority)
  window.setTimeout(() => {
    let b = startBoard;
    b = applyAllSpells(b, playerIntent, cpuIntent);
    setBoard(b);
    setResolveStep("spells");
    // Snapshot post-spells pour traçage (Alex flag : "je peux pas
    // surveiller assez, faut les logs côté toi"). Voir aussi l'arenaLog
    // qui consomme ce log via la catégorie state.
    logBoardSnapshot(b, "post-spells");

    // ─── Step 2: SUMMONS ───
    window.setTimeout(() => {
      b = applySummons(b, playerIntent, "a");
      b = applySummons(b, cpuIntent, "b");
      setBoard(b);
      setOppPreview(null);
      setPlayerPreview(null);
      setResolveStep("summons");
      logBoardSnapshot(b, "post-summons");

      // ─── Step 3: COMBAT — lane by lane ───
      window.setTimeout(() => {
        setResolveStep("combat");
        const runLane = (laneIdx: 0 | 1 | 2) => {
          const lane = b.lanes[laneIdx];
          const aHitsB = !!lane.a && !lane.b;
          const bHitsA = !!lane.b && !lane.a;
          // RPSLS counter follow-through (2026-06-09): if both creatures
          // are present and one counters the other, the loser dies AND the
          // winner pursues its ATK onto the opp hero (unless dodge or a
          // charged Pierre deflects). Treat that as a hero hit for the
          // anim layer too.
          const bothPresent = !!lane.a && !!lane.b;
          const counterAB = bothPresent && moveCountersMove(lane.a!.move, lane.b!.move);
          const counterBA = bothPresent && moveCountersMove(lane.b!.move, lane.a!.move);
          const aFollowsThroughOnB = bothPresent && counterAB && !counterBA && !lane.b!.dodgeCharge;
          const bFollowsThroughOnA = bothPresent && counterBA && !counterAB && !lane.a!.dodgeCharge;
          // TAUNT DEFLECTION DETECTION — keep in sync with rules.findDeflector:
          //   first ALIVE+CHARGED Pierre on defender's side, EXCEPT if
          //   attacker has Paper/Spock anti-taunt active. Returns the
          //   Pierre's lane so the chip can point a dotted line at it.
          const isAntiTaunt = (c: { move: string } | null | undefined): boolean =>
            !!c && (c.move === "paper" || c.move === "spock");
          const findDeflectorLane = (defenderSide: "a" | "b"): LaneIndex | null => {
            const attackerSide: "a" | "b" = defenderSide === "a" ? "b" : "a";
            const attackerHasAntiTaunt = b.lanes.some((l) =>
              isAntiTaunt(attackerSide === "a" ? l.a : l.b),
            );
            if (attackerHasAntiTaunt) return null;
            for (let i = 0; i < 3; i++) {
              const c = defenderSide === "a" ? b.lanes[i].a : b.lanes[i].b;
              if (c && c.taunt && c.provocationCharges > 0) return i as LaneIndex;
            }
            return null;
          };
          // a hits b's hero when either undefended attack or RPSLS follow-through.
          const aReachesHeroB = aHitsB || aFollowsThroughOnB;
          const bReachesHeroA = bHitsA || bFollowsThroughOnA;
          const bDeflectorLane = aReachesHeroB ? findDeflectorLane("b") : null;
          const aDeflectorLane = bReachesHeroA ? findDeflectorLane("a") : null;
          setCombatLane(laneIdx);
          // Mid-charge: flash the targeted hero BEFORE damage is committed,
          // OR pop the taunt block if the attack will be deflected.
          window.setTimeout(() => {
            if (bDeflectorLane !== null) {
              setTauntBlock({ defenderSide: "b", rockLane: bDeflectorLane, key: Date.now() });
            } else if (aReachesHeroB) {
              setHeroHit({ side: "opp", lane: laneIdx, key: Date.now() });
            }
            if (aDeflectorLane !== null) {
              setTauntBlock({ defenderSide: "a", rockLane: aDeflectorLane, key: Date.now() + 1 });
            } else if (bReachesHeroA) {
              setHeroHit({ side: "you", lane: laneIdx, key: Date.now() + 1 });
            }
          }, LANE_CHARGE_MS * 0.55);
          window.setTimeout(() => {
            const prevB = b;
            // Wrap resolveLaneCombatAt in try-catch. Si le combat throw
            // silencieusement (ce qu'on suspecte pour le bug L2 rock vs
            // scissors qui stop à step=updatedBoardBuilt), on l'attrape et
            // on log l'erreur AU LIEU de laisser l'exception unwind le
            // setTimeout (qui sinon empêchait le kill d'être appliqué).
            try {
              b = resolveLaneCombatAt(b, laneIdx);
            } catch (e) {
              const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
              alog("combat", `L${laneIdx} EXCEPTION: ${msg}`);
              b = prevB;
            }
            if (!b) {
              alog("combat", `L${laneIdx} POST-RESOLVE BUG : board=null !`);
              b = prevB;
            } else if (b === prevB) {
              alog("combat", `L${laneIdx} POST-RESOLVE same-ref (pas de mutation)`);
            }
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
