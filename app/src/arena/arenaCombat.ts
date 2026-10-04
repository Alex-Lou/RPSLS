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
 * KISS : les helpers internes (bluntOnCombat / findDeflector /
 * consumeProvocation / hasAntiTaunt) ne sont utilisés que par
 * resolveLaneCombat — non réexportés publiquement.
 *
 * Helpers (Émoussé, perce Tranchant, Provocation, branche miroir) extraits
 * dans arenaCombatHelpers.ts (cap <400 lignes/fichier).
 */

import { alog, csnap } from "./arenaLog";
import { creatureEffectiveAtk, damageCreature, damageHero, dodgeSave } from "./arenaRules";
import { riseEngineOnCounterWin, riseMirageOnDodge } from "./arenaEngines";
import { BALANCE } from "./arenaBalance";
import { moveCountersMove } from "./arenaTypes";
import type {
  BoardState,
  Creature,
  LaneIndex,
  LaneState,
} from "./arenaTypes";
import { bluntOnCombat, findDeflector, consumeProvocation, resolveMirrorTrade } from "./arenaCombatHelpers";

/** Run combat on a SINGLE lane — exported so the UI (arenaResolverFlow) AND the
 *  pure resolver sequence the 3-lane combat phase one lane at a time (better
 *  readability + per-lane shake/death anim cues). Damage is applied
 *  SIMULTANEOUSLY within the lane; empty lane → attacker hits the opposing hero. */
export function resolveLaneCombatAt(board: BoardState, laneIdx: LaneIndex): BoardState {
  return resolveLaneCombat(board, laneIdx);
}

function resolveLaneCombat(boardIn: BoardState, laneIdx: LaneIndex): BoardState {
  // `let` car LE TRACÉ / engines ré-affectent board AVANT les branches (qui le lisent).
  let board = boardIn;
  const lane = board.lanes[laneIdx];
  const ca = lane.a;
  const cb = lane.b;
  alog("combat", `L${laneIdx} ENTER ca=${ca?.move ?? "∅"} cb=${cb?.move ?? "∅"}`);

  // ÉCLIPSE (Mirage 2026-06-28) — une créature EN PHASE gèle sa lane ce tour :
  // ni elle ni l'adverse n'agit ; elle est intouchable (survit) et n'attaque pas.
  if ((ca && ca.phasedOut) || (cb && cb.phasedOut)) {
    alog("combat", `L${laneIdx} ÉCLIPSE — lane gelée (créature en phase, intouchable)`);
    return board;
  }
  // NUÉE SPECTRALE (Mirage 2026-06-28) — mes Lézards imblocables ce tour : ils
  // IGNORENT le RPSLS-lock (ne meurent pas), bypassent leur lane et frappent le
  // héros adverse de leur ATK. Court-circuite le combat de cette lane.
  const aNuee = !!ca && ca.move === "lizard" && !!board.a.nueeActive;
  const bNuee = !!cb && cb.move === "lizard" && !!board.b.nueeActive;
  if (aNuee || bNuee) {
    let out = board;
    if (aNuee && ca) {
      const atk = creatureEffectiveAtk(ca);
      out = { ...out, b: damageHero(out.b, atk) };
      alog("combat", `L${laneIdx} NUÉE a → Lézard imblocable frappe héros b (${atk}), survit`);
    }
    if (bNuee && cb) {
      const atk = creatureEffectiveAtk(cb);
      out = { ...out, a: damageHero(out.a, atk) };
      alog("combat", `L${laneIdx} NUÉE b → Lézard imblocable frappe héros a (${atk}), survit`);
    }
    return out;
  }

  // TAUNT — hasAntiTaunt + findDeflector + consumeProvocation : voir
  // arenaCombatHelpers (bug TDZ 2026-06-09 documenté là-bas).

  if (ca && cb) {
    // Toile Gluante (2026-06-12) : une créature englutée (cannotAttack) NE
    // GAGNE PAS son counter — elle ne peut pas attaquer. Combiné à l'ATK
    // effectif 0 (creatureEffectiveAtk), elle est neutralisée mais survit.
    const counterAB = !ca.cannotAttack && moveCountersMove(ca.move, cb.move);
    const counterBA = !cb.cannotAttack && moveCountersMove(cb.move, ca.move);
    // LE TRACÉ (Alex 2026-06-24) — ta jauge de Voie monte de +1 quand TON symbole
    // d'affinité REMPORTE VRAIMENT le counter de cette lane, c.-à-d. quand le coup
    // ATTERRIT et TUE le défenseur. S'il se DÉROBE (Esquive du Lézard) ou ENCAISSE
    // sur son Aegis, l'échange n'est PAS gagné → aucun progrès (Alex « ma Pierre a
    // frappé le Lézard mais il a esquivé, ça ne doit pas compter »). Les conditions
    // de « dérobade » ci-dessous MIROITENT exactement les saves des branches
    // A-wins/B-wins plus bas (LAME perce tout ; Tranchant frais perce l'Aegis).
    // Lecture seule (ni vainqueur ni PV). Commité par-lane → le cue « ★ » tombe sur
    // la lane gagnante, au moment du combat.
    const bDerobe =
      !(board.a.lameActive && ca.move === "scissors") &&
      (cb.dodgeCharges > 0 || (cb.divineShield && !(ca.pierces && !ca.pierceUsed)));
    const aDerobe =
      !(board.b.lameActive && cb.move === "scissors") &&
      (ca.dodgeCharges > 0 || (ca.divineShield && !(cb.pierces && !cb.pierceUsed)));
    if (counterAB && !counterBA && ca.move === board.a.affinity && !bDerobe) {
      board = { ...board, a: riseEngineOnCounterWin(board.a) };
    }
    if (counterBA && !counterAB && cb.move === board.b.affinity && !aDerobe) {
      board = { ...board, b: riseEngineOnCounterWin(board.b) };
    }
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
        // RIPOSTE D'ESQUIVE (Mirage, win-con) : l'attaquant qui frappe un Lézard
        // esquiveur encaisse l'ATK de ce Lézard. Convertit l'évasion en menace
        // (change l'issue du counter — le seul levier qui marche en RPSLS-lock).
        const riposteB = cb.move === "lizard" && BALANCE.mirage.dodgeRiposte > 0
          ? Math.round(creatureEffectiveAtk(cb) * BALANCE.mirage.dodgeRiposte) : 0;
        const survivorA = riposteB > 0 ? damageCreature(winnerA, riposteB) : winnerA;
        if (riposteB > 0) alog("combat", `L${laneIdx} → RIPOSTE Esquive ${riposteB} sur l'attaquant (${survivorA ? "survit" : "tué"})`);
        lanes[laneIdx] = { a: survivorA, b: dodgeSave(cb) };
        // SILLAGE SPECTRAL (Mirage) : b a esquivé → 1re esquive du tour = pioche (cleanup).
        // ENGINE MIRAGE (2026-06-30) : un Lézard de la Voie qui esquive « gagne
        // l'échange » → sa jauge monte (riseMirageOnDodge), même vs Pierre/Ciseaux.
        const bDodged = cb.move === "lizard"
          ? riseMirageOnDodge({ ...board.b, sillageDodgedThisTurn: true })
          : { ...board.b, sillageDodgedThisTurn: true };
        return { ...board, lanes, b: bDodged };
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
        const updatedBoard = { ...board, lanes };
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
      // mirror trade). Le tueur tombe avec sa proie : pas de poursuite héros
      // (même règle que la destruction mutuelle).
      if (cb.ripostePrimed) {
        lanes[laneIdx] = { a: null, b: null };
        alog("combat", `L${laneIdx} A wins → B die + RIPOSTE → A meurt aussi (pas de poursuite)`);
        return { ...board, lanes };
      }
      lanes[laneIdx] = { a: winnerA, b: null };
      const updatedBoard = { ...board, lanes };
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
        // RIPOSTE D'ESQUIVE (Mirage) — symétrique du branch A-wins.
        const riposteA = ca.move === "lizard" && BALANCE.mirage.dodgeRiposte > 0
          ? Math.round(creatureEffectiveAtk(ca) * BALANCE.mirage.dodgeRiposte) : 0;
        const survivorB = riposteA > 0 ? damageCreature(winnerB, riposteA) : winnerB;
        if (riposteA > 0) alog("combat", `L${laneIdx} → RIPOSTE Esquive ${riposteA} sur l'attaquant (${survivorB ? "survit" : "tué"})`);
        lanes[laneIdx] = { a: dodgeSave(ca), b: survivorB };
        // SILLAGE SPECTRAL (Mirage) : a a esquivé → 1re esquive du tour = pioche (cleanup).
        // ENGINE MIRAGE (2026-06-30) : Lézard de Voie qui esquive → jauge +1 (cf. A-wins).
        const aDodged = ca.move === "lizard"
          ? riseMirageOnDodge({ ...board.a, sillageDodgedThisTurn: true })
          : { ...board.a, sillageDodgedThisTurn: true };
        return { ...board, lanes, a: aDodged };
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
        const updatedBoard = { ...board, lanes };
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
      // emporte son tueur. Pas de poursuite héros.
      if (ca.ripostePrimed) {
        lanes[laneIdx] = { a: null, b: null };
        alog("combat", `L${laneIdx} B wins → A die + RIPOSTE → B meurt aussi (pas de poursuite)`);
        return { ...board, lanes };
      }
      lanes[laneIdx] = { a: null, b: winnerB };
      const updatedBoard = { ...board, lanes };
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

    return resolveMirrorTrade(board, laneIdx, ca, cb);
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
