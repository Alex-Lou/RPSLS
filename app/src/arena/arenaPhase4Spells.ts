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
  const dmg = Math.min(8, rocks * 2 + strates);
  if (dmg <= 0) {
    alog("spell", `💤 ${side} Éboulis Final ne fait rien : aucune Pierre sur ton plateau.`);
    return board;
  }
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} ÉBOULIS FINAL → ${rocks} Pierre(s) + ${strates} Strate(s) = ${dmg} dmg héros ${oppS} (max 8)`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}

/** Drain Vital (Forêt) — 4 dégâts au héros adverse PUIS 4 PV rendus à mon héros
 *  (la vie circule). Priorité tardive (après les dégâts) pour que l'anim soit
 *  dégât→soin, comme Veine de Gaïa / Second Souffle. */
const DRAIN_AMOUNT = 4;
export function applyDrainVital(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? board.a : board.b;
  let b = withSideHero(board, oppS, damageHero(oppHero, DRAIN_AMOUNT));
  const myHero = side === "a" ? b.a : b.b;
  b = withSideHero(b, side, healHero(myHero, DRAIN_AMOUNT));
  alog("spell", `${side} DRAIN VITAL → ${DRAIN_AMOUNT} dmg héros ${oppS} + ${DRAIN_AMOUNT} PV à moi`);
  return b;
}

/** Coup dans l'Ombre (Mirage) — coup IMBLOCABLE au héros adverse = total des
 *  charges d'Esquive de mes Lézards (plafond 6). Récompense la ressource Esquive
 *  cultivée (Mascarade Enchaînée / Fuite Masquée). */
export function applyCoupDansLombre(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let charges = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "lizard") charges += me.dodgeCharges;
  }
  const dmg = Math.min(6, charges);
  if (dmg <= 0) {
    alog("spell", `💤 ${side} Coup dans l'Ombre ne fait rien : aucune charge d'Esquive sur tes Lézards.`);
    return board;
  }
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} COUP DANS L'OMBRE → ${charges} charge(s) d'Esquive = ${dmg} dmg héros ${oppS} (max 6)`);
  return withSideHero(board, oppS, damageHero(oppHero, dmg));
}

/** Intrication Quantique (Cosmos) — 1 dégât au héros adverse par Spock que JE
 *  contrôle (+1 si j'en ai ≥2), plafond 6. Inévitabilité du board Cosmos
 *  (distinct de Singularité qui compte les 2 camps, et de Convergence = mana). */
export function applyIntricationQuantique(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let spocks = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "spock") spocks += 1;
  }
  const dmg = Math.min(6, spocks + (spocks >= 2 ? 1 : 0));
  if (dmg <= 0) {
    alog("spell", `💤 ${side} Intrication Quantique ne fait rien : aucun Spock sur ton plateau.`);
    return board;
  }
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} INTRICATION QUANTIQUE → ${spocks} Spock(s) = ${dmg} dmg héros ${oppS} (max 6)`);
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
