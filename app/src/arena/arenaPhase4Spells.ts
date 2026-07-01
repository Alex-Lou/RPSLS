/**
 * Arena Phase-4 spells — cartes de DÉGÂTS DIRECTS signature par Voie
 * (Alex 2026-06-23 « du degat unique a chaque voie »).
 *
 * Séparé de arenaPhase3Spells.ts pour rester sous le cap 400 lignes/fichier
 * (CLAUDE.md). Mêmes conventions (board, side) que les autres handlers ; la
 * dispatch + la table de priorité vivent dans arenaCardEffects.ts.
 *
 * Principe (vision « le héros atteint À TRAVERS le plateau ») : ces 5 cartes
 * tapent le héros adverse MAIS à la FAÇON de leur Voie — la plupart COUPLÉES au
 * plateau/ressource de la Voie (Pierres, Esquive, Spock), pas du face-burn
 * générique. Anti-abus : couplage borné + cap, et la légendaire (Taillade) est
 * auto-EXILÉE par le moteur (1 usage/partie) — aucune récursion.
 */

import { damageHero, healHero } from "./arenaRules";
import { withSideHero, oppSide } from "./arenaSpellHelpers";
import { type BoardState, type Side } from "./arenaTypes";
import { BALANCE } from "./arenaBalance";
import { alog } from "./arenaLog";

/** Éboulis Final (Montagne) — dégâts au héros adverse = (nombre de mes Pierres
 *  × 2) + (Strates cumulées sur mes Pierres), plafonné à 8. Récompense le mur
 *  établi (Pierres + Strates) SANS le sacrifier. */
export function applyEboulisFinal(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let rocks = 0, strates = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "rock") { rocks += 1; strates += me.voieAtkBonus; }
  }
  const cap = BALANCE.montagne.eboulisCap;
  const dmg = Math.min(cap, rocks * BALANCE.montagne.eboulisPerRock + strates);
  if (dmg <= 0) {
    alog("spell", `💤 ${side} Éboulis Final ne fait rien : aucune Pierre sur ton plateau.`);
    return board;
  }
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} ÉBOULIS FINAL → ${rocks} Pierre(s) + ${strates} Strate(s) = ${dmg} dmg héros ${oppS} (max ${cap})`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}

/** Écrasement Tellurique (Montagne, 2026-06-30) — PERCE-MUR : dégâts au héros
 *  adverse = (mes Pierres × eboulisPerRock) ET le héros adverse ne peut PAS être
 *  soigné ce tour (healLockedThisTurn → coupe la régen Forêt Sève/Verger). Comble
 *  le talon #2 : la Forêt se re-soigne en boucle et annule Éboulis Final. 0 Pierre
 *  = coupe quand même le soin (le rocher écrase), mais 0 dégât. */
export function applyEcrasement(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let rocks = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "rock") rocks += 1;
  }
  const dmg = rocks * BALANCE.montagne.eboulisPerRock;
  const oppHero = oppS === "a" ? board.a : board.b;
  const locked = { ...oppHero, healLockedThisTurn: true };
  alog("spell", `${side} ÉCRASEMENT TELLURIQUE → ${dmg} dmg héros ${oppS} (${rocks} Pierre(s)) + soin coupé ce tour`);
  return withSideHero(board, oppS, damageHero(locked, dmg));
}

/** Drain Vital (Forêt) — drainAmount dégâts au héros adverse PUIS autant de PV
 *  rendus à mon héros (la vie circule ; drainAmount=2 depuis le nerf Forêt).
 *  Priorité tardive (après les dégâts) pour que l'anim soit dégât→soin, comme
 *  Veine de Gaïa / Second Souffle. */
export function applyDrainVital(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const amt = BALANCE.foret.drainAmount;
  const oppHero = oppS === "a" ? board.a : board.b;
  let b = withSideHero(board, oppS, damageHero(oppHero, amt));
  const myHero = side === "a" ? b.a : b.b;
  b = withSideHero(b, side, healHero(myHero, amt));
  alog("spell", `${side} DRAIN VITAL → ${amt} dmg héros ${oppS} + ${amt} PV à moi`);
  return b;
}

/** Coup dans l'Ombre (Mirage) — coup IMBLOCABLE au héros adverse = total des
 *  charges d'Esquive de mes Lézards (plafond coupDansLombreCap=3). Récompense la ressource Esquive
 *  cultivée (Mascarade Enchaînée / Fuite Masquée). */
export function applyCoupDansLombre(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let charges = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "lizard") charges += me.dodgeCharges;
  }
  const cap = BALANCE.mirage.coupDansLombreCap;
  const dmg = Math.min(cap, charges);
  if (dmg <= 0) {
    alog("spell", `💤 ${side} Coup dans l'Ombre ne fait rien : aucune charge d'Esquive sur tes Lézards.`);
    return board;
  }
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} COUP DANS L'OMBRE → ${charges} charge(s) d'Esquive = ${dmg} dmg héros ${oppS} (max ${cap})`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}

/** Intrication Quantique (Cosmos) — 1 dégât au héros adverse par Spock que JE
 *  contrôle (+1 si j'en ai ≥2), plafond intricationCap (=3). Inévitabilité du board
 *  Cosmos (distinct de Singularité qui compte les 2 camps, et de Convergence = mana). */
export function applyIntricationQuantique(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let spocks = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "spock") spocks += 1;
  }
  const cap = BALANCE.cosmos.intricationCap;
  const dmg = Math.min(cap, spocks + (spocks >= 2 ? 1 : 0));
  if (dmg <= 0) {
    alog("spell", `💤 ${side} Intrication Quantique ne fait rien : aucun Spock sur ton plateau.`);
    return board;
  }
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} INTRICATION QUANTIQUE → ${spocks} Spock(s) = ${dmg} dmg héros ${oppS} (max ${cap})`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}

/** Taillade Mortelle (Tranchant) — burst BRUT assumé : 6 dégâts au héros adverse
 *  (+1 si je contrôle ≥1 Ciseau), plafond 7. Légendaire → AUTO-EXILÉE par le
 *  moteur (1 usage/partie) = pas de récursion. C'est le glass-cannon. */
export function applyTailladeMortelle(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let hasScissor = false;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "scissors") { hasScissor = true; break; }
  }
  const dmg = 6 + (hasScissor ? 1 : 0);
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} TAILLADE MORTELLE → ${dmg} dmg héros ${oppS}${hasScissor ? " (+1 Ciseau)" : ""}`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}
