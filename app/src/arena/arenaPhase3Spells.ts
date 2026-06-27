/**
 * Constellation Pro — effets des 12 nouvelles cartes (Lot 2026-06-12).
 *
 * Séparé de arenaPhase2Spells.ts pour rester sous le cap 400 lignes. Mêmes
 * conventions (board, side, spell?) que les autres handlers ; la dispatch +
 * la table de priorité vivent dans arenaCardEffects.ts.
 *
 * Réverbération n'est PAS ici : elle rejoue le dernier sort via un appel
 * récursif à applyArenaSpell, donc gérée inline dans arenaCardEffects (sinon
 * import circulaire phase3 ↔ cardEffects).
 *
 * Cartes : cf docs/NOUVELLES_CARTES_PRO.md. Art à générer (glyph fallback).
 */

import {
  drawCards, damageHero, healHero, damageCreature, healCreature,
  makeCreature, creatureEffectiveAtk,
} from "./arenaRules";
import {
  getMyCreatureOnLane, getOppCreatureOnLane,
  withMyCreatureOnLane, withOppCreatureOnLane, withSideHero, oppSide,
} from "./arenaSpellHelpers";
import { MANA_CAP, type BoardState, type Creature, type LaneIndex, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import { CARDS } from "../ranked/cards";
import { STRATE_CAP } from "./arenaRules/heroCreature";
import { BALANCE } from "./arenaBalance";
import { alog } from "./arenaLog";

/** Jet de Caillou — 2 dégâts à une créature adverse. Bloqué par Ancre/Logique. */
export function applyJetCaillou(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) {
    alog("spell", `💤 ${side} Jet de Caillou L${spell.lane} ne fait rien : cible vide, ancrée ou immunisée (Spock).`);
    return board;
  }
  return withOppCreatureOnLane(board, side, spell.lane, damageCreature(opp, 2));
}

/** Éboulement (Montagne) — AOE défensif : 2 dégâts à la créature adverse ciblée
 *  + 1 dégât aux créatures adverses des lanes VOISINES. Chaque cible respecte
 *  Ancre/Logique (skip silencieux), comme Jet de Caillou. */
export function applyEboulement(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const lanes: LaneIndex[] = [spell.lane];
  if (spell.lane - 1 >= 0) lanes.push((spell.lane - 1) as LaneIndex);
  if (spell.lane + 1 <= 2) lanes.push((spell.lane + 1) as LaneIndex);
  let b = board;
  for (const l of lanes) {
    const dmg = l === spell.lane ? 2 : 1;
    const opp = getOppCreatureOnLane(b, side, l);
    if (!opp || opp.anchored || opp.spellImmune) continue;
    b = withOppCreatureOnLane(b, side, l, damageCreature(opp, dmg));
  }
  alog("spell", `${side} ÉBOULEMENT L${spell.lane} → 2 dmg cible + 1 aux lanes voisines`);
  return b;
}

/** Strate Vive (Montagne) — ma Pierre ciblée gagne IMMÉDIATEMENT +1 Strate
 *  (voieAtkBonus, le MÊME champ que le gain passif gainStrateIfHeld, clampé
 *  STRATE_CAP). Rock-only : fizzle sur une non-Pierre. */
export function applyStrateVive(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "rock") {
    alog("spell", `💤 ${side} Strate Vive L${spell.lane} ne fait rien : pas de Pierre à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, {
    ...me, voieAtkBonus: Math.min(STRATE_CAP, me.voieAtkBonus + 1),
  });
}

/** Gardien de Pierre (Montagne) — ma Pierre ciblée gagne Riposte (tue son tueur
 *  en combat) ET Ancre (immunisée aux sorts ce tour). PAS de recharge de
 *  Provocation (choix Alex : anti-point-mort). Rock-only. */
export function applyGardienPierre(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "rock") {
    alog("spell", `💤 ${side} Gardien de Pierre L${spell.lane} ne fait rien : pas de Pierre à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, { ...me, ripostePrimed: true, anchored: true });
}

/** Mascarade Enchaînée (Mirage) — mon Lézard ciblé gagne +1 charge d'Esquive
 *  (cap 3). Peuple la ressource Esquive. Lizard-only : fizzle sinon. */
export function applyMascaradeEnchainee(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "lizard") {
    alog("spell", `💤 ${side} Mascarade Enchaînée L${spell.lane} ne fait rien : pas de Lézard à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, { ...me, dodgeCharges: Math.min(BALANCE.mirage.dodgeSpellCap, me.dodgeCharges + 1) });
}

/** Fuite Masquée (Mirage) — mon Lézard ciblé gagne +2 charges d'Esquive (cap 3)
 *  mais −1 ATK ce tour (esquive contre tempo). Lizard-only : fizzle sinon. */
export function applyFuiteMasquee(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "lizard") {
    alog("spell", `💤 ${side} Fuite Masquée L${spell.lane} ne fait rien : pas de Lézard à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, { ...me, dodgeCharges: Math.min(BALANCE.mirage.dodgeSpellCap, me.dodgeCharges + 2), atkBuff: me.atkBuff - 1 });
}

/** Coup de Taille (Tranchant) — mon Ciseau ciblé RÉCUPÈRE sa Perforation
 *  (pierceUsed=false → perce de nouveau le prochain bouclier). Scissors-only. */
export function applyCoupDeTaille(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "scissors") {
    alog("spell", `💤 ${side} Coup de Taille L${spell.lane} ne fait rien : pas de Ciseau à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, { ...me, pierceUsed: false });
}

/** Acuité (Tranchant) — mon Ciseau ciblé annule l'Émoussé (combatBlunted=false)
 *  ET gagne +1 ATK PERMANENT (voieAtkBonus, cap 2). Re-affûtage. Scissors-only. */
export function applyAcuite(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "scissors") {
    alog("spell", `💤 ${side} Acuité L${spell.lane} ne fait rien : pas de Ciseau à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, {
    ...me, combatBlunted: false, voieAtkBonus: Math.min(BALANCE.tranchant.acuiteAtkCap, me.voieAtkBonus + 1),
  });
}

/** Photosynthèse (Forêt) — ma créature ciblée régénère +2 PV (cap PV de base,
 *  sans réduire) ET gagne +1 ATK PERMANENT (voieAtkBonus, le même champ que
 *  Strate Vive, clampé STRATE_CAP). Croissance végétale, toute créature. */
export function applyPhotosynthese(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me) {
    alog("spell", `💤 ${side} Photosynthèse L${spell.lane} ne fait rien : pas de créature à toi sur cette lane.`);
    return board;
  }
  const healed = healCreature(me, BALANCE.foret.photosyntheseHeal);
  return withMyCreatureOnLane(board, side, spell.lane, {
    ...healed, voieAtkBonus: Math.min(STRATE_CAP, healed.voieAtkBonus + 1),
  });
}

/** Ronces (Forêt) — ma créature ciblée gagne Riposte (tue son tueur en combat)
 *  ET un bouclier (divineShield). Représailles épineuses sans verrou (≠ Gardien
 *  de Pierre qui ancre). Toute créature. */
export function applyRonces(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me) {
    alog("spell", `💤 ${side} Ronces L${spell.lane} ne fait rien : pas de créature à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, { ...me, ripostePrimed: true, divineShield: true });
}

/** Loi de Causalité (Cosmos) — STASE : la créature adverse ciblée ne peut pas
 *  attaquer ce tour. Bloquée par Ancre/Logique (skip silencieux), comme Toile
 *  Gluante re-thématisée en contrôle cosmique. */
export function applyLoiCausalite(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) {
    alog("spell", `💤 ${side} Loi de Causalité L${spell.lane} ne fait rien : cible vide, ancrée ou immunisée (Spock).`);
    return board;
  }
  alog("spell", `${side} LOI DE CAUSALITÉ L${spell.lane} : ${opp.move} figé (ne peut pas attaquer ce tour)`);
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, cannotAttack: true });
}

/** Convergence Cosmique (Cosmos) — dégâts directs au héros adverse égaux à MON
 *  mana max actuel, PLAFONNÉS à 6 (anti-burst-éco). Récompense le ramp
 *  Offre/Dilatation/Sablier. Inévitabilité d'éco, distincte de Singularité
 *  (qui scale sur le nombre de créatures). */
export function applyConvergence(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const myHero = side === "a" ? board.a : board.b;
  const oppHero = oppS === "a" ? board.a : board.b;
  const cap = BALANCE.cosmos.convergenceDmgCap;
  const dmg = Math.min(cap, myHero.maxMana);
  alog("spell", `${side} CONVERGENCE COSMIQUE → ${dmg} dmg héros ${oppS} (= mon mana max, max ${cap})`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}

/** Sève — +2 PV à une de mes créatures (cap PV de base, sans réduire). */
export function applySeve(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me) {
    alog("spell", `💤 ${side} Sève L${spell.lane} ne fait rien : pas de créature à toi sur cette lane.`);
    return board;
  }
  return withMyCreatureOnLane(board, side, spell.lane, healCreature(me, 2));
}

/** Coup d'Œil — pioche 1 + révèle 1 tour la carte la plus chère de la main adverse. */
export function applyCoupOeil(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const opp = side === "a" ? board.b : board.a;
  let priciest: typeof opp.hand[number] | null = null;
  let maxCost = -1;
  for (const id of opp.hand) {
    const c = CARDS[id];
    if (c && c.cost > maxCost) { maxCost = c.cost; priciest = id; }
  }
  const reveal = priciest ? [priciest] : [];
  let b = withSideHero(board, side, drawCards(hero, 1));
  // augurRevealedB = ce que A voit de la main de B (même convention qu'Augur).
  b = side === "a"
    ? { ...b, augurRevealedB: reveal, augurTurnsLeftB: 1 }
    : { ...b, augurRevealedA: reveal, augurTurnsLeftA: 1 };
  alog("spell", `${side} COUP D'ŒIL → pioche 1 + révèle ${priciest ?? "(main vide)"}`);
  return b;
}

/** Permutation — échange ma créature et celle d'en face : changement de camp. */
export function applyPermutation(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!me || !opp) {
    alog("spell", `💤 ${side} Permutation L${spell.lane} ne fait rien : il faut une créature DES DEUX côtés.`);
    return board;
  }
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  // L'adverse passe sur MON slot (side flip) ; la mienne passe sur le slot adverse.
  const newMine: Creature = { ...opp, side };
  const newOpp: Creature = { ...me, side: oppSide(side) };
  lanes[spell.lane] = side === "a" ? { a: newMine, b: newOpp } : { a: newOpp, b: newMine };
  alog("spell", `${side} PERMUTATION L${spell.lane} : ${me.move} ↔ ${opp.move} (changement de camp)`);
  return { ...board, lanes };
}

/** Toile Gluante — la créature adverse ne peut pas attaquer ce tour. */
export function applyToileGluante(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) {
    alog("spell", `💤 ${side} Toile Gluante L${spell.lane} ne fait rien : cible vide, ancrée ou immunisée (Spock).`);
    return board;
  }
  alog("spell", `${side} TOILE GLUANTE L${spell.lane} : ${opp.move} ne peut pas attaquer ce tour`);
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, cannotAttack: true });
}

/** Gravité — −1 PV à TOUTES les créatures adverses ; pioche 1 par créature tuée. */
export function applyGravite(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let kills = 0;
  const lanes = board.lanes.map((lane) => {
    const opp = oppS === "a" ? lane.a : lane.b;
    if (!opp) return lane;
    const dmg = damageCreature(opp, 1);
    if (!dmg) kills++;
    return oppS === "a" ? { ...lane, a: dmg } : { ...lane, b: dmg };
  }) as [LaneState, LaneState, LaneState];
  let b: BoardState = { ...board, lanes };
  if (kills > 0) {
    const hero = side === "a" ? b.a : b.b;
    b = withSideHero(b, side, drawCards(hero, kills));
  }
  alog("spell", `${side} GRAVITÉ → −1 PV créatures adverses, ${kills} tuée(s) → pioche ${kills}`);
  return b;
}

/** Doppelgänger — copie de ma meilleure créature (ATK+PV) sur ma 1re lane vide. */
export function applyDoppelganger(board: BoardState, side: Side): BoardState {
  let best: Creature | null = null;
  let bestScore = -1;
  for (const lane of board.lanes) {
    const c = side === "a" ? lane.a : lane.b;
    if (c) {
      const score = creatureEffectiveAtk(c) + c.hp;
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  const emptyIdx = board.lanes.findIndex((lane) => !(side === "a" ? lane.a : lane.b));
  if (!best || emptyIdx < 0) {
    alog("spell", `💤 ${side} Doppelgänger ne fait rien : ${!best ? "aucune créature à copier" : "aucune lane vide"}.`);
    return board;
  }
  const aff = side === "a" ? board.a.affinity : board.b.affinity;
  alog("spell", `${side} DOPPELGÄNGER → copie ${best.move} sur L${emptyIdx}`);
  return withMyCreatureOnLane(board, side, emptyIdx as LaneIndex, makeCreature(best.move, side, aff));
}

/** Purge — dissipe buffs ATK+, boucliers, ancres, ripostes des créatures adverses. */
export function applyPurge(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const lanes = board.lanes.map((lane) => {
    const opp = oppS === "a" ? lane.a : lane.b;
    if (!opp) return lane;
    const cleaned: Creature = {
      ...opp,
      atkBuff: Math.min(0, opp.atkBuff), // retire les buffs positifs, garde les malus
      divineShield: false,
      anchored: false,
      ripostePrimed: false,
    };
    return oppS === "a" ? { ...lane, a: cleaned } : { ...lane, b: cleaned };
  }) as [LaneState, LaneState, LaneState];
  alog("spell", `${side} PURGE → buffs/boucliers/ancres adverses dissipés`);
  return { ...board, lanes };
}

/** Roue du Destin — effet aléatoire puissant (5 issues). */
export function applyRoueDestin(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const hero = side === "a" ? board.a : board.b;
  const r = Math.floor(Math.random() * 5);
  switch (r) {
    case 0: {
      const oppHero = oppS === "a" ? board.a : board.b;
      alog("spell", `${side} ROUE DU DESTIN → 6 dégâts héros adverse`);
      return withSideHero(board, oppS, damageHero(oppHero, 6));
    }
    case 1:
      alog("spell", `${side} ROUE DU DESTIN → +8 PV héros`);
      return withSideHero(board, side, healHero(hero, 8));
    case 2:
      alog("spell", `${side} ROUE DU DESTIN → pioche 3`);
      return withSideHero(board, side, drawCards(hero, 3));
    case 3: {
      const occupied = ([0, 1, 2] as LaneIndex[]).filter((i) => !!(oppS === "a" ? board.lanes[i].a : board.lanes[i].b));
      if (occupied.length === 0) {
        alog("spell", `${side} ROUE DU DESTIN → wipe sans cible → +4 PV`);
        return withSideHero(board, side, healHero(hero, 4));
      }
      const lane = occupied[Math.floor(Math.random() * occupied.length)];
      alog("spell", `${side} ROUE DU DESTIN → détruit la créature adverse L${lane}`);
      return withOppCreatureOnLane(board, side, lane, null);
    }
    default: {
      const newMax = Math.min(MANA_CAP, hero.maxMana + 2);
      alog("spell", `${side} ROUE DU DESTIN → +2 mana max`);
      return withSideHero(board, side, { ...hero, maxMana: newMax, mana: Math.min(newMax, hero.mana + 2) });
    }
  }
}

/** Phénix — snapshot mes créatures : celles qui meurent ce tour renaissent à
 *  1 PV en fin de tour (cf. endOfTurnCleanup qui consomme phenixReviveA/B). */
export function applyPhenix(board: BoardState, side: Side): BoardState {
  const snap: { lane: LaneIndex; move: Creature["move"] }[] = [];
  for (let i = 0; i < 3; i++) {
    const c = side === "a" ? board.lanes[i].a : board.lanes[i].b;
    if (c) snap.push({ lane: i as LaneIndex, move: c.move });
  }
  alog("spell", `${side} PHÉNIX armé → ${snap.length} créature(s) renaîtront à 1 PV si elles tombent`);
  return side === "a" ? { ...board, phenixReviveA: snap } : { ...board, phenixReviveB: snap };
}

/** Singularité — 2 dégâts au héros adverse par créature sur le plateau (2 camps). */
export function applySingularite(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let count = 0;
  for (const lane of board.lanes) { if (lane.a) count++; if (lane.b) count++; }
  const dmg = count * 2;
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} SINGULARITÉ → ${count} créatures × 2 = ${dmg} dmg héros ${oppS}`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}
