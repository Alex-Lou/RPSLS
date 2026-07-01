/**
 * Constellation Pro — effets des 6 nouvelles cartes Voie MIRAGE (Lot 2026-06-28).
 *
 * Thèse (Alex) : ne PAS regonfler l'Esquive (déjà bornée) — transformer
 * l'évasion en INITIATIVE. Repositionnement (Dérobade), dépense de charge
 * (Frappe Spectrale), illusion offensive (Faux-Semblant), moteur tempo
 * (Sillage Spectral, aura), closer imblocable (Nuée Spectrale), sauvetage
 * (Éclipse). Toutes ACTIVES (l'Arena n'a pas de concept `kind:"passive"`).
 *
 * Séparé des phases 1-4 pour rester sous le cap 400 lignes/fichier. Mêmes
 * conventions (board, side, spell?) ; la dispatch + la table de priorité vivent
 * dans arenaCardEffects.ts. Effets liés au COMBAT (Nuée bypass, Éclipse lane
 * gelée, Sillage pioche-à-l'esquive) câblés dans arenaCombat + resolver.
 */

import { damageHero, creatureEffectiveAtk, dodgeSave } from "./arenaRules";
import {
  getMyCreatureOnLane, getOppCreatureOnLane,
  withMyCreatureOnLane, withOppCreatureOnLane, withSideHero, oppSide,
} from "./arenaSpellHelpers";
import { type BoardState, type LaneIndex, type PlayedSpell, type Side } from "./arenaTypes";
import { alog } from "./arenaLog";

/** Dérobade (Mirage) — esquive SPATIALE : déplace mon Lézard ciblé sur la 1re
 *  lane vide (≠ source). Évite un counter / va chercher une lane libre, SANS
 *  dépenser de charge d'Esquive. Lizard-only ; fizzle si aucune lane vide. */
export function applyDerobade(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "lizard") {
    alog("spell", `💤 ${side} Dérobade L${spell.lane} ne fait rien : pas de Lézard à toi sur cette lane.`);
    return board;
  }
  const dest = ([0, 1, 2] as LaneIndex[]).find(
    (i) => i !== spell.lane && !getMyCreatureOnLane(board, side, i),
  );
  if (dest === undefined) {
    alog("spell", `💤 ${side} Dérobade L${spell.lane} ne fait rien : aucune lane vide où glisser.`);
    return board;
  }
  let b = withMyCreatureOnLane(board, side, spell.lane, null);
  b = withMyCreatureOnLane(b, side, dest, me);
  alog("spell", `${side} DÉROBADE : Lézard L${spell.lane} → L${dest} (esquive spatiale)`);
  return b;
}

/** Frappe Spectrale (Mirage) — mon Lézard ciblé DÉPENSE 1 charge d'Esquive →
 *  inflige son ATK en dégâts IMBLOCABLES à la créature en face (bypass
 *  Esquive/Aegis) ou au héros adverse si la lane est vide. Rend l'évasion
 *  ACTIVE. Lizard-only avec ≥1 charge ; fizzle sinon. */
export function applyFrappeSpectrale(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "lizard" || me.dodgeCharges <= 0) {
    alog("spell", `💤 ${side} Frappe Spectrale L${spell.lane} ne fait rien : pas de Lézard à toi avec une charge d'Esquive.`);
    return board;
  }
  const atk = creatureEffectiveAtk(me);
  // Dépense 1 charge (dodgeSave : décrément + fait grandir le Lézard si activé).
  let b = withMyCreatureOnLane(board, side, spell.lane, dodgeSave(me));
  const opp = getOppCreatureOnLane(b, side, spell.lane);
  if (opp) {
    // IMBLOCABLE : on bypass Esquive + Aegis → dégât direct sur les PV.
    const newHp = opp.hp - atk;
    const survivor = newHp <= 0 ? null : { ...opp, hp: newHp };
    alog("spell", `${side} FRAPPE SPECTRALE L${spell.lane} → ${atk} imblocable sur ${opp.move} (${survivor ? "survit" : "tué"})`);
    return withOppCreatureOnLane(b, side, spell.lane, survivor);
  }
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? b.a : b.b;
  alog("spell", `${side} FRAPPE SPECTRALE L${spell.lane} → ${atk} imblocable au héros ${oppS} (lane vide)`);
  return withSideHero(b, oppS, damageHero(oppHero, atk));
}

/** Faux-Semblant (Mirage) — ILLUSION OFFENSIVE : la créature adverse en face de
 *  mon Lézard prend l'apparence d'une Feuille (que le Lézard CONTRE) → mon
 *  Lézard la tue au combat. Pas de Lézard en face → fizzle DOUX : la cible perd
 *  2 ATK. Bloqué par Ancre/Logique (Spock). */
export function applyFauxSemblant(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) {
    alog("spell", `💤 ${side} Faux-Semblant L${spell.lane} ne fait rien : cible vide, ancrée ou immunisée (Spock).`);
    return board;
  }
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "lizard") {
    alog("spell", `${side} FAUX-SEMBLANT L${spell.lane} (sans Lézard) → fizzle doux : −2 ATK à ${opp.move}`);
    return withOppCreatureOnLane(board, side, spell.lane, { ...opp, atkBuff: opp.atkBuff - 2 });
  }
  // Le Lézard CONTRE la Feuille (RPSLS) → counter-kill au combat.
  alog("spell", `${side} FAUX-SEMBLANT L${spell.lane} : ${opp.move} déguisé en Feuille → ton Lézard le contre`);
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, move: "paper" });
}

/** Sillage Spectral (Mirage) — AURA : pose un moteur permanent sur le héros. La
 *  1re fois qu'un de mes Lézards esquive CHAQUE tour → je pioche 1 (cf.
 *  arenaCombat pose le flag, endOfTurnCleanup pioche). Convertit l'évasion en
 *  TEMPO sans regonfler les dégâts. Re-cast = no-op (déjà actif). */
export function applySillageSpectral(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  if (hero.sillageActive) {
    alog("spell", `💤 ${side} Sillage Spectral déjà actif (aura permanente).`);
    return board;
  }
  alog("spell", `${side} SILLAGE SPECTRAL → aura : 1re esquive de Lézard par tour = pioche 1`);
  return withSideHero(board, side, { ...hero, sillageActive: true });
}

/** Nuée Spectrale (Mirage, LÉGENDAIRE) — CLOSER : CE TOUR, tous mes Lézards
 *  deviennent IMBLOCABLES — ils ignorent le RPSLS-lock (ne meurent pas),
 *  bypassent leur lane et frappent le héros adverse de leur ATK (cf.
 *  arenaCombat). Flag consommé en fin de tour. */
export function applyNueeSpectrale(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  alog("spell", `${side} NUÉE SPECTRALE → tes Lézards imblocables ce tour (bypass lane + frappe héros)`);
  return withSideHero(board, side, { ...hero, nueeActive: true });
}

/** Éclipse (Mirage) — DISPARITION : mon Lézard ciblé passe EN PHASE ce tour —
 *  intouchable (sa lane est gelée : il survit à tout) MAIS ne peut pas attaquer.
 *  Sauvetage d'un Lézard buffé d'une mort certaine. Lizard-only. */
export function applyEclipse(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "lizard") {
    alog("spell", `💤 ${side} Éclipse L${spell.lane} ne fait rien : pas de Lézard à toi sur cette lane.`);
    return board;
  }
  alog("spell", `${side} ÉCLIPSE L${spell.lane} : Lézard en phase ce tour (intouchable total : combat + sorts + AoE, n'attaque pas)`);
  // N2 (Alex 2026-06-28) — VRAIE intangibilité : phasedOut bloque combat + AoE
  // (cf. damageCreature) ; anchored bloque les sorts CIBLÉS (Jet, Toxine, Curse,
  // Rappel… qui testent anchored). Cohérent avec l'Esquive qui bloque déjà tout.
  return withMyCreatureOnLane(board, side, spell.lane, { ...me, phasedOut: true, cannotAttack: true, anchored: true });
}
