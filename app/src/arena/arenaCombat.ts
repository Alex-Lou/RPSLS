/**
 * arenaCombat — résolution combat lane par lane.
 *
 * Extracté de arenaRules.ts (qui dépassait 700 lignes) pour respecter le cap
 * <400 lignes/fichier. Contient TOUTE la logique de combat :
 * - resolveLaneCombat : branchement counter A-wins / B-wins / mirror /
 *   undefended, gestion saves (Aegis, Esquive), pursuit hero + deflect via
 *   Pierre Provoc, anti-taunt Paper/Spock.
 * - bluntOnCombat : flag Émoussé sur Ciseaux survivant un combat.
 * - damageCreaturePierce : variante damage qui bypass Aegis (utilisée par
 *   les attaquants Tranchant comme Ciseaux).
 *
 * Le 🔴 bug TDZ (Cannot access 'c' before initialization) qui bloquait les
 * counter A-wins/B-wins est documenté dans resolveLaneCombat — hasAntiTaunt
 * + findDeflector + consumeProvocation déclarés AVANT toute utilisation
 * pour éviter le minifier Vite qui renomme les const en variables courtes
 * et casse l'ordre d'initialisation.
 *
 * KISS : pas d'export de helpers internes (bluntOnCombat / findDeflector /
 * consumeProvocation / hasAntiTaunt) — ils ne sont utilisés que par
 * resolveLaneCombat, donc privés au module.
 */

import { alog, csnap } from "./arenaLog";
import { creatureEffectiveAtk, damageCreature, damageHero } from "./arenaRules";
import { moveCountersMove } from "./arenaTypes";
import type {
  BoardState,
  Creature,
  LaneIndex,
  LaneState,
  Side,
} from "./arenaTypes";

/** Set combatBlunted on a surviving Scissors. Idempotent — re-flagging an
 *  already-blunted creature is a no-op (combatBlunted stays true). */
function bluntOnCombat(c: Creature): Creature {
  if (c.move !== "scissors") return c;
  if (c.combatBlunted) return c;
  return { ...c, combatBlunted: true };
}

/** Variant used by Tranchant (Scissors) attackers — bypasses divineShield.
 *  Returns null if the creature dies. */
function damageCreaturePierce(c: Creature, dmg: number): Creature | null {
  if (c.dodgeCharge) return { ...c, dodgeCharge: false };
  const newHp = c.hp - dmg;
  if (newHp <= 0) return null;
  return { ...c, hp: newHp };
}

/** Run combat on a SINGLE lane — exported so the UI can sequence the
 *  3-lane combat phase one lane at a time (better readability + per-lane
 *  shake/death anim cues). The full-board resolver below just chains this. */
export function resolveLaneCombatAt(board: BoardState, laneIdx: LaneIndex): BoardState {
  return resolveLaneCombat(board, laneIdx);
}

/** Run combat across all 3 lanes. Damage is applied SIMULTANEOUSLY (both
 *  creatures' new HP computed from the original state of the lane). Empty
 *  lane → attacker hits the opposing hero for its effective ATK.
 *  Exported for UI sequencing. */
export function resolveCombat(board: BoardState): BoardState {
  let b = board;
  for (let i = 0; i < b.lanes.length; i++) {
    b = resolveLaneCombat(b, i as LaneIndex);
    if (b.a.hp <= 0 || b.b.hp <= 0) break; // short-circuit on lethal
  }
  return b;
}

function resolveLaneCombat(board: BoardState, laneIdx: LaneIndex): BoardState {
  const lane = board.lanes[laneIdx];
  const ca = lane.a;
  const cb = lane.b;
  alog("combat", `L${laneIdx} ENTER ca=${ca?.move ?? "∅"} cb=${cb?.move ?? "∅"}`);

  // 🔴 BUG FIX 2026-06-09 (TDZ "Cannot access 'c' before initialization") :
  // hasAntiTaunt + findDeflector + consumeProvocation déclarés ICI (top
  // de la fonction) au lieu d'après les counter branches. Le minifier de
  // Vite renomme les const en variables courtes (`c`), et l'appel à
  // findDeflector depuis le branche A-wins/B-wins se faisait AVANT
  // l'initialisation du const hasAntiTaunt → TDZ throw → cascade silencieuse
  // qui bloquait tous les combats des lanes suivantes. Maintenant déclarés
  // AVANT toute utilisation, le hoisting fonctionne pour findDeflector
  // (function declaration) et hasAntiTaunt est dans son scope au moment
  // de la call.
  const hasAntiTaunt = (b: BoardState, side: Side): boolean =>
    b.lanes.some((l) => {
      const c = side === "a" ? l.a : l.b;
      return !!c && (c.move === "paper" || c.move === "spock");
    });
  function findDeflector(b: BoardState, defenderSide: Side): { lane: LaneIndex; side: Side } | null {
    const attackerSide: Side = defenderSide === "a" ? "b" : "a";
    if (hasAntiTaunt(b, attackerSide)) return null;
    for (let i = 0; i < 3; i++) {
      const lane = i as LaneIndex;
      const c = defenderSide === "a" ? b.lanes[lane].a : b.lanes[lane].b;
      if (c && c.taunt && c.provocationCharges > 0) {
        return { lane, side: defenderSide };
      }
    }
    return null;
  }
  function consumeProvocation(board: BoardState, deflector: { lane: LaneIndex; side: Side }): BoardState {
    const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
    const cur = lanes[deflector.lane];
    const rock = deflector.side === "a" ? cur.a : cur.b;
    if (!rock) return board;
    const decremented: Creature = { ...rock, provocationCharges: Math.max(0, rock.provocationCharges - 1) };
    lanes[deflector.lane] = deflector.side === "a" ? { ...cur, a: decremented } : { ...cur, b: decremented };
    return { ...board, lanes };
  }

  if (ca && cb) {
    const counterAB = moveCountersMove(ca.move, cb.move);
    const counterBA = moveCountersMove(cb.move, ca.move);
    alog("combat", `L${laneIdx} BOTH-PRESENT counterAB=${counterAB} counterBA=${counterBA}`);

    if (counterAB && !counterBA) {
      alog("combat", `L${laneIdx} branch=A-wins`);
      const winnerA = bluntOnCombat(ca);
      alog("combat", `L${laneIdx} step=bluntDone winnerA=${winnerA.move}`);
      const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
      if (cb.dodgeCharge) {
        alog("combat", `L${laneIdx} A wins → ESQUIVE save B (dodge consumed)`);
        lanes[laneIdx] = { a: winnerA, b: { ...cb, dodgeCharge: false } };
        return { ...board, lanes };
      }
      if (cb.divineShield && !ca.pierces) {
        alog("combat", `L${laneIdx} A wins → AEGIS save B (shield consumed)`);
        lanes[laneIdx] = { a: winnerA, b: { ...cb, divineShield: false } };
        return { ...board, lanes };
      }
      alog("combat", `L${laneIdx} step=noSave killing-B`);
      lanes[laneIdx] = { a: winnerA, b: null };
      const updatedBoard = { ...board, lanes, a: { ...board.a, killBonusPending: true } };
      alog("combat", `L${laneIdx} step=updatedBoardBuilt`);
      const deflect = findDeflector(updatedBoard, "b");
      alog("combat", `L${laneIdx} step=deflectCheck deflect=${deflect ? `L${deflect.lane}/${deflect.side}` : "null"}`);
      if (deflect) {
        alog("combat", `L${laneIdx} A wins → B die. Poursuite hero b → DEFLECTED par Pierre L${deflect.lane}`);
        return consumeProvocation(updatedBoard, deflect);
      }
      const atkA = creatureEffectiveAtk(winnerA);
      alog("combat", `L${laneIdx} step=atkComputed atkA=${atkA}`);
      alog("combat", `L${laneIdx} A wins → B die. Poursuite hero b atk=${atkA}`);
      const finalBoard = { ...updatedBoard, b: damageHero(updatedBoard.b, atkA) };
      alog("combat", `L${laneIdx} step=finalBoardReturn b.hp=${finalBoard.b.hp}`);
      return finalBoard;
    }
    if (counterBA && !counterAB) {
      alog("combat", `L${laneIdx} branch=B-wins (counterBA && !counterAB)`);
      const winnerB = bluntOnCombat(cb);
      const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
      if (ca.dodgeCharge) {
        alog("combat", `L${laneIdx} B wins → ESQUIVE save A (dodge consumed)`);
        lanes[laneIdx] = { a: { ...ca, dodgeCharge: false }, b: winnerB };
        return { ...board, lanes };
      }
      if (ca.divineShield && !cb.pierces) {
        alog("combat", `L${laneIdx} B wins → AEGIS save A (shield consumed)`);
        lanes[laneIdx] = { a: { ...ca, divineShield: false }, b: winnerB };
        return { ...board, lanes };
      }
      lanes[laneIdx] = { a: null, b: winnerB };
      // Alex feedback D : kill bonus pour le côté attaquant (B a tué A).
      const updatedBoard = { ...board, lanes, b: { ...board.b, killBonusPending: true } };
      const deflect = findDeflector(updatedBoard, "a");
      if (deflect) {
        alog("combat", `L${laneIdx} B wins → A die. Poursuite hero a → DEFLECTED par Pierre L${deflect.lane}`);
        return consumeProvocation(updatedBoard, deflect);
      }
      const atkB = creatureEffectiveAtk(winnerB);
      alog("combat", `L${laneIdx} B wins → A die. Poursuite hero a atk=${atkB}`);
      return { ...updatedBoard, a: damageHero(updatedBoard.a, atkB) };
    }

    // Mirror match (same symbol on both sides) → normal ATK/HP trade.
    // Damage values computed BEFORE either dies so trades are symmetric.
    const atkA = creatureEffectiveAtk(ca);
    const atkB = creatureEffectiveAtk(cb);
    // Tranchant (Scissors) bypasses opp Aegis. The attacker's flag controls
    // what the DEFENDER's shield can do.
    let newA: Creature | null = cb.pierces
      ? damageCreaturePierce(ca, atkB)
      : damageCreature(ca, atkB);
    let newB: Creature | null = ca.pierces
      ? damageCreaturePierce(cb, atkA)
      : damageCreature(cb, atkA);
    // Riposte: if a creature died AND was riposte-primed, its killer dies too.
    if (!newA && ca.ripostePrimed && newB) newB = null;
    if (!newB && cb.ripostePrimed && newA) newA = null;
    // Émoussé — Ciseaux that SURVIVED a combat exchange lose 1 ATK
    // permanently. The flag is consumed: subsequent combats keep it but
    // creatureEffectiveAtk reads it once (−1 cap stays).
    if (newA && newA.move === "scissors" && !newA.combatBlunted) {
      newA = { ...newA, combatBlunted: true };
    }
    if (newB && newB.move === "scissors" && !newB.combatBlunted) {
      newB = { ...newB, combatBlunted: true };
    }
    const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
    lanes[laneIdx] = { a: newA, b: newB };
    // Alex feedback D : mirror trade kill bonus — chaque side qui a tué
    // récupère un bonus. Si A killed B → A gets bonus. Si both died → both
    // bonus (mutual destruction = double récompense, agressivité OK).
    const heroA = !newB ? { ...board.a, killBonusPending: true } : board.a;
    const heroB = !newA ? { ...board.b, killBonusPending: true } : board.b;
    return { ...board, lanes, a: heroA, b: heroB };
  }

  // TAUNT (Provocation) — findDeflector + hasAntiTaunt + consumeProvocation
  // sont déclarés en haut de cette fonction (voir TDZ fix).

  if (ca && !cb) {
    const deflect = findDeflector(board, "b");
    if (deflect) {
      alog("combat", `L${laneIdx} ${csnap(ca)} undefended → hero b DEFLECTED par Pierre L${deflect.lane}`);
      return consumeProvocation(board, deflect);
    }
    const atk = creatureEffectiveAtk(ca);
    alog("combat", `L${laneIdx} ${csnap(ca)} undefended → hero b atk=${atk}`);
    return { ...board, b: damageHero(board.b, atk) };
  }

  if (cb && !ca) {
    const deflect = findDeflector(board, "a");
    if (deflect) {
      alog("combat", `L${laneIdx} ${csnap(cb)} undefended → hero a DEFLECTED par Pierre L${deflect.lane}`);
      return consumeProvocation(board, deflect);
    }
    const atk = creatureEffectiveAtk(cb);
    alog("combat", `L${laneIdx} ${csnap(cb)} undefended → hero a atk=${atk}`);
    return { ...board, a: damageHero(board.a, atk) };
  }

  return board; // both lanes empty
}
