/**
 * arenaCombatHelpers — helpers purs du combat lane par lane (arenaCombat).
 *
 * - bluntOnCombat / damageCreaturePierce : Émoussé et dégâts Tranchant.
 * - hasAntiTaunt / findDeflector / consumeProvocation : Provocation (Pierre)
 *   et anti-taunt Paper/Spock.
 * - resolveMirrorTrade : branche « miroir » (même symbole des deux côtés).
 *
 * Extraits de arenaCombat.ts (cap <400 lignes/fichier) à l'identique ; usage
 * interne au combat uniquement.
 */

import { alog } from "./arenaLog";
import { creatureEffectiveAtk, damageCreature, damageHero, dodgeSave } from "./arenaRules";
import { riseMirageOnDodge } from "./arenaEngines";
import type {
  BoardState,
  Creature,
  LaneIndex,
  LaneState,
  Side,
} from "./arenaTypes";

/** Set combatBlunted on a surviving Scissors. Idempotent — re-flagging an
 *  already-blunted creature is a no-op (combatBlunted stays true). */
export function bluntOnCombat(c: Creature): Creature {
  if (c.move !== "scissors") return c;
  if (c.combatBlunted) return c;
  return { ...c, combatBlunted: true };
}

/** Variant used by Tranchant (Scissors) attackers — bypasses divineShield.
 *  Returns null if the creature dies. */
export function damageCreaturePierce(c: Creature, dmg: number): Creature | null {
  if (c.dodgeCharges > 0) return dodgeSave(c);
  const newHp = c.hp - dmg;
  if (newHp <= 0) return null;
  return { ...c, hp: newHp };
}

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
// → Désormais déclarés au niveau module (function declarations hoistées,
//   aucune capture de closure) : même comportement, aucun risque de TDZ.
export const hasAntiTaunt = (b: BoardState, side: Side): boolean =>
  b.lanes.some((l) => {
    const c = side === "a" ? l.a : l.b;
    return !!c && (c.move === "paper" || c.move === "spock");
  });
export function findDeflector(b: BoardState, defenderSide: Side): { lane: LaneIndex; side: Side } | null {
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
export function consumeProvocation(board: BoardState, deflector: { lane: LaneIndex; side: Side }): BoardState {
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  const cur = lanes[deflector.lane];
  const rock = deflector.side === "a" ? cur.a : cur.b;
  if (!rock) return board;
  const decremented: Creature = { ...rock, provocationCharges: Math.max(0, rock.provocationCharges - 1) };
  lanes[deflector.lane] = deflector.side === "a" ? { ...cur, a: decremented } : { ...cur, b: decremented };
  return { ...board, lanes };
}

/** Branche MIROIR de resolveLaneCombat (ca et cb présents, aucun counter
 *  unilatéral) — reçoit le board courant (après la montée de jauge du Tracé). */
export function resolveMirrorTrade(board: BoardState, laneIdx: LaneIndex, ca: Creature, cb: Creature): BoardState {
  // Mirror match (same symbol on both sides) → normal ATK/HP trade.
  // Damage values computed BEFORE either dies so trades are symmetric.
  const atkA = creatureEffectiveAtk(ca);
  const atkB = creatureEffectiveAtk(cb);
  // Tranchant (Scissors) pierce Aegis : 1 charge, consummée au 1er bypass.
  // Lame Finisher du hero override : pierce permanent. La charge ne se
  // consume QUE si la cible avait effectivement divineShield à percer.
  const bLameMirror = board.b.lameActive && cb.move === "scissors";
  const aLameMirror = board.a.lameActive && ca.move === "scissors";
  const bCanPierceA = cb.pierces && ca.divineShield && (bLameMirror || !cb.pierceUsed);
  const aCanPierceB = ca.pierces && cb.divineShield && (aLameMirror || !ca.pierceUsed);
  let newA: Creature | null = bCanPierceA
    ? damageCreaturePierce(ca, atkB)
    : damageCreature(ca, atkB);
  let newB: Creature | null = aCanPierceB
    ? damageCreaturePierce(cb, atkA)
    : damageCreature(cb, atkA);
  // Si A a vraiment percé le bouclier de B (et que B est encore vivant),
  // décrément à reprendre côté A. Idem inverse. Lame ne consume pas.
  if (aCanPierceB && !aLameMirror && newA) {
    newA = { ...newA, pierceUsed: true };
  }
  if (bCanPierceA && !bLameMirror && newB) {
    newB = { ...newB, pierceUsed: true };
  }
  // Pour le mirror scissors-vs-scissors classique : aucun des deux n'avait
  // d'Aegis (pas de bouclier à percer), donc damageCreature normal a été
  // utilisé via le path non-pierce ci-dessus. ✓
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
  // SPLASH EN MIROIR (Alex 2026-06-17) : si une créature en TUE une autre avec
  // un SURPLUS d'ATK (atk > PV de la cible — ex. ma Pierre buffée vs sa Pierre),
  // le résidu DÉBORDE sur le héros adverse. Rend le combat miroir COHÉRENT avec
  // la poursuite des counter-kills (qui débordent déjà). Déviable par une Provoc
  // (Pierre) adverse, exactement comme le splash de poursuite.
  let out: BoardState = { ...board, lanes };
  const spA = !newB ? Math.max(0, atkA - cb.hp) : 0; // A a tué B → surplus → héros B
  const spB = !newA ? Math.max(0, atkB - ca.hp) : 0; // B a tué A → surplus → héros A
  if (spA > 0) {
    const d = findDeflector(out, "b");
    out = d ? consumeProvocation(out, d) : { ...out, b: damageHero(out.b, spA) };
    alog("combat", `L${laneIdx} MIROIR A tue B, surplus ${spA} → ${d ? `DÉVIÉ L${d.lane}` : "héros b"}`);
  }
  if (spB > 0) {
    const d = findDeflector(out, "a");
    out = d ? consumeProvocation(out, d) : { ...out, a: damageHero(out.a, spB) };
    alog("combat", `L${laneIdx} MIROIR B tue A, surplus ${spB} → ${d ? `DÉVIÉ L${d.lane}` : "héros a"}`);
  }
  // SILLAGE SPECTRAL (Mirage) : esquive détectée en miroir (charge consommée)
  // → 1re esquive du tour = pioche (résolu en endOfTurnCleanup). ENGINE MIRAGE
  // (2026-06-30) : si le Lézard de Voie a esquivé → jauge +1 (riseMirageOnDodge).
  if (newA && newA.dodgeCharges < ca.dodgeCharges) {
    out = { ...out, a: { ...out.a, sillageDodgedThisTurn: true } };
    if (ca.move === "lizard") out = { ...out, a: riseMirageOnDodge(out.a) };
  }
  if (newB && newB.dodgeCharges < cb.dodgeCharges) {
    out = { ...out, b: { ...out.b, sillageDodgedThisTurn: true } };
    if (cb.move === "lizard") out = { ...out, b: riseMirageOnDodge(out.b) };
  }
  return out;
}
