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
  if (c.dodgeCharges > 0) return { ...c, dodgeCharges: c.dodgeCharges - 1 };
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
    // Toile Gluante (2026-06-12) : une créature englutée (cannotAttack) NE
    // GAGNE PAS son counter — elle ne peut pas attaquer. Combiné à l'ATK
    // effectif 0 (creatureEffectiveAtk), elle est neutralisée mais survit.
    const counterAB = !ca.cannotAttack && moveCountersMove(ca.move, cb.move);
    const counterBA = !cb.cannotAttack && moveCountersMove(cb.move, ca.move);
    alog("combat", `L${laneIdx} BOTH-PRESENT counterAB=${counterAB} counterBA=${counterBA}`);

    if (counterAB && !counterBA) {
      alog("combat", `L${laneIdx} branch=A-wins`);
      const winnerA = bluntOnCombat(ca);
      alog("combat", `L${laneIdx} step=bluntDone winnerA=${winnerA.move}`);
      const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
      // Lot D-bis Round 10 — LAME Finisher : si a a lameActive ET ca est
      // scissors, pierce TOUT (Esquive + Aegis + anti-taunt) — l'ultime
      // burst de la Voie Ciseau.
      const aLamePierce = board.a.lameActive && ca.move === "scissors";
      if (cb.dodgeCharges > 0 && !aLamePierce) {
        alog("combat", `L${laneIdx} A wins → ESQUIVE save B (charge ${cb.dodgeCharges} → ${cb.dodgeCharges - 1})`);
        lanes[laneIdx] = { a: winnerA, b: { ...cb, dodgeCharges: cb.dodgeCharges - 1 } };
        return { ...board, lanes };
      }
      if (cb.divineShield && !aLamePierce) {
        // Tranchant : ne perce que si charge non encore consummée.
        const canPierce = ca.pierces && !ca.pierceUsed;
        if (!canPierce) {
          alog("combat", `L${laneIdx} A wins → AEGIS save B (shield consumed${ca.pierces ? ", Tranchant déjà épuisé" : ""})`);
          lanes[laneIdx] = { a: winnerA, b: { ...cb, divineShield: false } };
          return { ...board, lanes };
        }
        // Tranchant frais : perce + consume la charge sur le Ciseau.
        alog("combat", `L${laneIdx} A wins → TRANCHANT pierce 🛡 (charge consummée)`);
        const piercedWinner: Creature = { ...winnerA, pierceUsed: true };
        lanes[laneIdx] = { a: piercedWinner, b: null };
        const updatedBoard = { ...board, lanes, a: { ...board.a, killBonusPending: true } };
        // Splash damage (Alex 2026-06-11) : HP du défenseur tué absorbe l'ATK
        // du tueur. Le résidu = splash → hero. Pierre 3 HP devient un vrai mur.
        const atkA = creatureEffectiveAtk(ca);
        const splash = Math.max(0, atkA - cb.hp);
        if (splash === 0) {
          alog("combat", `L${laneIdx} A wins → B die. Splash absorbé (atk ${atkA} ≤ hp ${cb.hp}) — hero b 0 dmg`);
          return updatedBoard;
        }
        const deflect = findDeflector(updatedBoard, "b");
        if (deflect) {
          alog("combat", `L${laneIdx} A wins → B die. Splash ${splash} → DEFLECTED par Pierre L${deflect.lane}`);
          return consumeProvocation(updatedBoard, deflect);
        }
        alog("combat", `L${laneIdx} A wins → B die. Splash ${splash} (atk ${atkA} − hp ${cb.hp}) → hero b`);
        return { ...updatedBoard, b: damageHero(updatedBoard.b, splash) };
      }
      if (aLamePierce) alog("combat", `L${laneIdx} A wins → LAME pierce TOUT (no save)`);
      alog("combat", `L${laneIdx} step=noSave killing-B`);
      // RIPOSTE — contrat carte : "si ta créature meurt au combat, son tueur
      // meurt aussi". S'applique AUSSI au counter-kill (pas seulement au
      // mirror trade). Le tueur tombe avec sa proie : pas de poursuite héros,
      // kill bonus des DEUX côtés (même règle que la destruction mutuelle).
      if (cb.ripostePrimed) {
        lanes[laneIdx] = { a: null, b: null };
        alog("combat", `L${laneIdx} A wins → B die + RIPOSTE → A meurt aussi (pas de poursuite)`);
        return {
          ...board,
          lanes,
          a: { ...board.a, killBonusPending: true },
          b: { ...board.b, killBonusPending: true },
        };
      }
      lanes[laneIdx] = { a: winnerA, b: null };
      const updatedBoard = { ...board, lanes, a: { ...board.a, killBonusPending: true } };
      alog("combat", `L${laneIdx} step=updatedBoardBuilt`);
      // LAME Finisher : la poursuite perce aussi la Provoc (deflect skip).
      const deflect = aLamePierce ? null : findDeflector(updatedBoard, "b");
      alog("combat", `L${laneIdx} step=deflectCheck deflect=${deflect ? `L${deflect.lane}/${deflect.side}` : aLamePierce ? "LAME-pierce" : "null"}`);
      // Splash damage (Alex 2026-06-11) : HP du défenseur tué absorbe l'ATK
      // du tueur. Le hero ne prend que le résidu. Pierre 3 HP = vrai mur.
      // Émoussé ne mord qu'APRÈS ce combat : la poursuite frappe à l'ATK
      // pré-blunt (on lit ca, pas winnerA déjà flaggé).
      const atkA = creatureEffectiveAtk(ca);
      const splashA = Math.max(0, atkA - cb.hp);
      alog("combat", `L${laneIdx} step=atkComputed atkA=${atkA} hpB=${cb.hp} splash=${splashA}`);
      if (splashA === 0) {
        alog("combat", `L${laneIdx} A wins → B die. Splash absorbé — hero b 0 dmg`);
        return updatedBoard;
      }
      if (deflect) {
        alog("combat", `L${laneIdx} A wins → B die. Splash ${splashA} → DEFLECTED par Pierre L${deflect.lane}`);
        return consumeProvocation(updatedBoard, deflect);
      }
      alog("combat", `L${laneIdx} A wins → B die. Splash ${splashA} → hero b`);
      const finalBoard = { ...updatedBoard, b: damageHero(updatedBoard.b, splashA) };
      alog("combat", `L${laneIdx} step=finalBoardReturn b.hp=${finalBoard.b.hp}`);
      return finalBoard;
    }
    if (counterBA && !counterAB) {
      alog("combat", `L${laneIdx} branch=B-wins (counterBA && !counterAB)`);
      const winnerB = bluntOnCombat(cb);
      const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
      // Lot D-bis Round 10 — LAME Finisher pour b côté.
      const bLamePierce = board.b.lameActive && cb.move === "scissors";
      if (ca.dodgeCharges > 0 && !bLamePierce) {
        alog("combat", `L${laneIdx} B wins → ESQUIVE save A (charge ${ca.dodgeCharges} → ${ca.dodgeCharges - 1})`);
        lanes[laneIdx] = { a: { ...ca, dodgeCharges: ca.dodgeCharges - 1 }, b: winnerB };
        return { ...board, lanes };
      }
      if (ca.divineShield && !bLamePierce) {
        const canPierce = cb.pierces && !cb.pierceUsed;
        if (!canPierce) {
          alog("combat", `L${laneIdx} B wins → AEGIS save A (shield consumed${cb.pierces ? ", Tranchant déjà épuisé" : ""})`);
          lanes[laneIdx] = { a: { ...ca, divineShield: false }, b: winnerB };
          return { ...board, lanes };
        }
        alog("combat", `L${laneIdx} B wins → TRANCHANT pierce 🛡 (charge consummée)`);
        const piercedWinner: Creature = { ...winnerB, pierceUsed: true };
        lanes[laneIdx] = { a: null, b: piercedWinner };
        const updatedBoard = { ...board, lanes, b: { ...board.b, killBonusPending: true } };
        // Splash damage : HP du défenseur tué absorbe l'ATK du tueur.
        const atkB = creatureEffectiveAtk(cb);
        const splashB = Math.max(0, atkB - ca.hp);
        if (splashB === 0) {
          alog("combat", `L${laneIdx} B wins → A die. Splash absorbé (atk ${atkB} ≤ hp ${ca.hp}) — hero a 0 dmg`);
          return updatedBoard;
        }
        const deflect = findDeflector(updatedBoard, "a");
        if (deflect) {
          alog("combat", `L${laneIdx} B wins → A die. Splash ${splashB} → DEFLECTED par Pierre L${deflect.lane}`);
          return consumeProvocation(updatedBoard, deflect);
        }
        alog("combat", `L${laneIdx} B wins → A die. Splash ${splashB} (atk ${atkB} − hp ${ca.hp}) → hero a`);
        return { ...updatedBoard, a: damageHero(updatedBoard.a, splashB) };
      }
      if (bLamePierce) alog("combat", `L${laneIdx} B wins → LAME pierce TOUT (no save)`);
      // RIPOSTE — symétrique du branch A-wins : la créature A mourante
      // emporte son tueur. Kill bonus des deux côtés, pas de poursuite.
      if (ca.ripostePrimed) {
        lanes[laneIdx] = { a: null, b: null };
        alog("combat", `L${laneIdx} B wins → A die + RIPOSTE → B meurt aussi (pas de poursuite)`);
        return {
          ...board,
          lanes,
          a: { ...board.a, killBonusPending: true },
          b: { ...board.b, killBonusPending: true },
        };
      }
      lanes[laneIdx] = { a: null, b: winnerB };
      // Alex feedback D : kill bonus pour le côté attaquant (B a tué A).
      const updatedBoard = { ...board, lanes, b: { ...board.b, killBonusPending: true } };
      // Splash damage : HP du défenseur tué absorbe l'ATK du tueur.
      const atkB = creatureEffectiveAtk(cb);
      const splashB = Math.max(0, atkB - ca.hp);
      if (splashB === 0) {
        alog("combat", `L${laneIdx} B wins → A die. Splash absorbé (atk ${atkB} ≤ hp ${ca.hp}) — hero a 0 dmg`);
        return updatedBoard;
      }
      // LAME Finisher : la poursuite perce aussi la Provoc (deflect skip).
      const deflect = bLamePierce ? null : findDeflector(updatedBoard, "a");
      if (deflect) {
        alog("combat", `L${laneIdx} B wins → A die. Splash ${splashB} → DEFLECTED par Pierre L${deflect.lane}`);
        return consumeProvocation(updatedBoard, deflect);
      }
      alog("combat", `L${laneIdx} B wins → A die. Splash ${splashB} (atk ${atkB} − hp ${ca.hp}) → hero a`);
      return { ...updatedBoard, a: damageHero(updatedBoard.a, splashB) };
    }

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
    // LAME Finisher : un Ciseau LAME attaque en voie libre SANS être déviable
    // par la Provoc adverse (pierce documenté : Aegis + Provoc + Esquive).
    const aLame = board.a.lameActive && ca.move === "scissors";
    const wouldDeflectB = findDeflector(board, "b");
    if (aLame && wouldDeflectB) {
      alog("combat", `L${laneIdx} LAME pierce Provoc — Pierre L${wouldDeflectB.lane} ignorée`);
    }
    const deflect = aLame ? null : wouldDeflectB;
    if (deflect) {
      alog("combat", `L${laneIdx} ${csnap(ca)} undefended → hero b DEFLECTED par Pierre L${deflect.lane}`);
      return consumeProvocation(board, deflect);
    }
    const atk = creatureEffectiveAtk(ca);
    alog("combat", `L${laneIdx} ${csnap(ca)} undefended → hero b atk=${atk}`);
    return { ...board, b: damageHero(board.b, atk) };
  }

  if (cb && !ca) {
    const bLame = board.b.lameActive && cb.move === "scissors";
    const wouldDeflectA = findDeflector(board, "a");
    if (bLame && wouldDeflectA) {
      alog("combat", `L${laneIdx} LAME pierce Provoc — Pierre L${wouldDeflectA.lane} ignorée`);
    }
    const deflect = bLame ? null : wouldDeflectA;
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
