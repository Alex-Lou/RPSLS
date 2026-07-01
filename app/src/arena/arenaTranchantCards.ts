/**
 * arenaTranchantCards — nouvelles cartes Voie TRANCHANT (scissors, Alex 2026-06-30).
 *
 * Comble les gaps d'audit de l'aggro/course : REACH (atteindre le héros par-dessus
 * un board bloqué), CARD-ADVANTAGE aggro (la main se vide), et PAYOFF Émoussé
 * (transformer la taxe −1 ATK en moteur). Mêmes conventions (board, side, spell?)
 * que les autres handlers ; dispatch + table de priorité dans arenaCardEffects.
 */

import { damageHero, drawCards, creatureEffectiveAtk } from "./arenaRules";
import { getMyCreatureOnLane, withSideHero, oppSide } from "./arenaSpellHelpers";
import { type BoardState, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import { alog } from "./arenaLog";

/** Estafilade (Tranchant) — REACH : mon Ciseau ciblé fend par-dessus le board et
 *  inflige son ATK directement au héros adverse (ignore les bloqueurs/la Provoc).
 *  Donne à l'aggro un moyen NON-finisher de pousser des dégâts face à un mur.
 *  Ciseau-only ; fizzle sinon. */
export function applyEstafilade(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me || me.move !== "scissors") {
    alog("spell", `💤 ${side} Estafilade L${spell.lane} ne fait rien : pas de Ciseau à toi sur cette lane.`);
    return board;
  }
  const atk = creatureEffectiveAtk(me);
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? board.a : board.b;
  alog("spell", `${side} ESTAFILADE L${spell.lane} → ${atk} dmg direct au héros ${oppS} (par-dessus le board)`);
  return withSideHero(board, oppS, damageHero(oppHero, atk));
}

/** Saignée (Tranchant) — CARD-ADVANTAGE aggro : pioche 1 carte, +1 de plus si tu
 *  contrôles ≥2 Ciseaux (un board agressif établi te ravitaille). Comble le trou de
 *  card-disadvantage de l'aggro (la main se vide → essoufflement late). */
export function applySaignee(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let scissors = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "scissors") scissors++;
  }
  const n = 1 + (scissors >= 2 ? 1 : 0);
  alog("spell", `${side} SAIGNÉE → pioche ${n} (${scissors} Ciseau·x)`);
  return withSideHero(board, side, drawCards(hero, n));
}

/** Fureur Émoussée (Tranchant) — PAYOFF Émoussé : tes Ciseaux ÉMOUSSÉS se
 *  RÉ-AFFÛTENT (combatBlunted retiré) et gagnent +2 ATK ce tour. Transforme « j'ai
 *  survécu donc je suis pénalisé » en « mes lames usées repartent à la charge » →
 *  un second souffle aggro pour le mid/late. Sans Ciseau émoussé = fizzle doux. */
export function applyFureurEmoussee(board: BoardState, side: Side): BoardState {
  let count = 0;
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move !== "scissors" || !me.combatBlunted) return lane;
    count++;
    const surged = { ...me, combatBlunted: false, atkBuff: me.atkBuff + 2 };
    return side === "a" ? { ...lane, a: surged } : { ...lane, b: surged };
  }) as [LaneState, LaneState, LaneState];
  alog("spell", `${side} FUREUR ÉMOUSSÉE → ${count} Ciseau·x ré-affûté·s (+2 ATK ce tour, Émoussé retiré)`);
  return { ...board, lanes };
}
