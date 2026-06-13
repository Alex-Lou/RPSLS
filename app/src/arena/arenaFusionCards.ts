/**
 * arenaFusionCards — ⚗️ la FORGE de Constellation Pro (Alex 2026-06-13).
 *
 * Concept (validé) : une 4e case "Forge" par joueur sur le pad (centre-droite
 * pour toi, centre-gauche pour l'adversaire). Tu y DÉPOSES une carte de ta
 * main (gratuit, visible, reprenable au tap) ; plus tard tu tapes la Forge
 * avec une carte PARTENAIRE sélectionnée → FUSION : les deux ingrédients
 * sont consumés, la carte fusionnée (coût = somme − 1) arrive dans ta main.
 * Aucun tour perdu, aucun mana au dépôt — le mana se paie au CAST de la
 * carte fusionnée, comme n'importe quelle carte.
 *
 * Ce fichier est la SOURCE UNIQUE : recettes, helpers UI (badge ⚗ fusible,
 * partenaire prêt), effets engine des 8 cartes fusionnées, et la taxonomie
 * de TYPES de cartes (soin/buff/défense/…) qui sous-tend les recettes.
 */

import { drawCards, damageHero, healHero, damageCreature, healCreature } from "./arenaRules";
import {
  getMyCreatureOnLane, getOppCreatureOnLane,
  withMyCreatureOnLane, withOppCreatureOnLane, withSideHero, oppSide,
} from "./arenaSpellHelpers";
import type { BoardState, Creature, LaneState, PlayedSpell, Side } from "./arenaTypes";
import { alog } from "./arenaLog";
import type { CardId } from "../ranked/rankedTypes";

/* ───────────────── Taxonomie de TYPES (Alex 2026-06-13) ─────────────────
 * Chaque carte jouable appartient à UNE famille — base des recettes de
 * fusion, des badges UI, et de futures règles par-type (ex: coût croissant
 * à la répétition d'un même type dans le tour — proposition en attente). */
export type ArenaCardType = "soin" | "buff" | "defense" | "degat" | "pioche" | "controle" | "tempo" | "info";

export const ARENA_CARD_TYPE: Partial<Record<CardId, ArenaCardType>> = {
  // soins
  "second-wind": "soin", gaia: "soin", seve: "soin", sangsue: "soin",
  // buffs
  precision: "buff", surge: "buff", tide: "buff", benediction: "buff", rempart: "buff",
  // défenses
  aegis: "defense", anchor: "defense", riposte: "defense",
  // dégâts
  supernova: "degat", "jet-caillou": "degat", gravite: "degat", "trou-noir": "degat",
  paradoxe: "degat", singularite: "degat",
  // pioche
  prescience: "pioche", oracle: "pioche", cascade: "pioche", "marchand-ames": "pioche",
  "coup-oeil": "pioche",
  // contrôle
  curse: "controle", "toile-gluante": "controle", vortex: "controle", permutation: "controle",
  purge: "controle", mascarade: "controle", juge: "controle", genese: "controle",
  // tempo / mana
  sablier: "tempo", offre: "tempo", echappee: "tempo", "roue-destin": "tempo",
  reverberation: "tempo", phenix: "tempo", doppelganger: "tempo", mirror: "tempo", heist: "tempo",
  // info
  augur: "info", "oracle-inverse": "info",
};

/* ───────────────── Recettes (8, validées Alex) ───────────────── */

export interface FusionRecipe {
  a: CardId;
  b: CardId;
  result: CardId;
}

export const FUSION_RECIPES: FusionRecipe[] = [
  { a: "precision",   b: "surge",        result: "frappe-parfaite" }, // +6 ATK
  { a: "aegis",       b: "anchor",       result: "bastion" },         // bouclier+ancre+provoc
  { a: "jet-caillou", b: "jet-caillou",  result: "avalanche" },       // 3 dmg ×2 créatures
  { a: "seve",        b: "second-wind",  result: "source-vitale" },   // +3 créature ET +3 héros
  { a: "oracle",      b: "coup-oeil",    result: "omniscience" },     // pioche 3 + main révélée
  { a: "toile-gluante", b: "curse",      result: "cocon" },           // n'attaque pas + −2 ATK
  { a: "supernova",   b: "gravite",      result: "apocalypse" },      // 4 dmg all + 4 héros
  { a: "heist",       b: "mascarade",    result: "imposteur" },       // vol + main révélée
];

/** Résultat de fusion pour une paire (ordre indifférent), ou null. */
export function findFusionResult(x: CardId, y: CardId): CardId | null {
  for (const r of FUSION_RECIPES) {
    if ((r.a === x && r.b === y) || (r.a === y && r.b === x)) return r.result;
  }
  return null;
}

/** La carte apparaît dans au moins une recette → badge ⚗ dans la main. */
export function isFusible(id: CardId): boolean {
  return FUSION_RECIPES.some((r) => r.a === id || r.b === id);
}

/** Les partenaires de fusion possibles d'une carte (pour fiche/howto). */
export function fusionPartnersOf(id: CardId): FusionRecipe[] {
  return FUSION_RECIPES.filter((r) => r.a === id || r.b === id);
}

/* ───────────────── Effets engine des 8 cartes fusionnées ─────────────────
 * Mêmes conventions que arenaPhase2/3Spells : (board, side, spell?) → board.
 * Dispatch depuis arenaCardEffects. */

/** Frappe Parfaite — +6 ATK ce tour sur ta créature. Spock Détaché ignore. */
export function applyFrappeParfaite(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || c.move === "spock") return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 6 });
}

/** Bastion — bouclier divin + Ancre + recharge Provocation (Pierre) sur ta
 *  créature. La défense totale en une carte. Spock Détaché ignore. */
export function applyBastion(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || c.move === "spock") return board;
  const fortified: Creature = {
    ...c,
    divineShield: true,
    anchored: true,
    provocationCharges: c.move === "rock" ? Math.max(c.provocationCharges, 2) : c.provocationCharges,
  };
  return withMyCreatureOnLane(board, side, spell.lane, fortified);
}

/** Avalanche — 3 dégâts aux DEUX premières créatures adverses (gauche →
 *  droite). Ancre/Logique protègent (dégâts ciblés). */
export function applyAvalanche(board: BoardState, side: Side): BoardState {
  let b = board;
  let hit = 0;
  for (let i = 0 as 0 | 1 | 2; i < 3 && hit < 2; i = (i + 1) as 0 | 1 | 2) {
    const opp = getOppCreatureOnLane(b, side, i);
    if (!opp || opp.anchored || opp.spellImmune) continue;
    b = withOppCreatureOnLane(b, side, i, damageCreature(opp, 3));
    hit += 1;
  }
  alog("spell", `${side} AVALANCHE → 3 dmg sur ${hit} créature(s) adverse(s)`);
  return b;
}

/** Source Vitale — +3 PV à ta créature ciblée ET +3 PV à ton héros. */
export function applySourceVitale(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  let b = board;
  const c = getMyCreatureOnLane(b, side, spell.lane);
  if (c) b = withMyCreatureOnLane(b, side, spell.lane, healCreature(c, 3));
  const hero = side === "a" ? b.a : b.b;
  return withSideHero(b, side, healHero(hero, 3));
}

/** Omniscience — pioche 3 + la main adverse ENTIÈRE révélée 2 tours. */
export function applyOmniscience(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let b = withSideHero(board, side, drawCards(hero, 3));
  const opp = side === "a" ? b.b : b.a;
  if (side === "a") b = { ...b, augurRevealedB: opp.hand.slice(), augurTurnsLeftB: 2 };
  else b = { ...b, augurRevealedA: opp.hand.slice(), augurTurnsLeftA: 2 };
  return b;
}

/** Cocon — la créature adverse est engluée (n'attaque pas ce tour) ET
 *  affaiblie (−2 ATK persistant). Ancre/Logique protègent. */
export function applyCocon(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) return board;
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, cannotAttack: true, atkBuff: opp.atkBuff - 2 });
}

/** Apocalypse — 4 dégâts à TOUTES les créatures adverses (global : ignore
 *  Ancre, mais Logique de Spock résiste) + 4 dégâts au héros adverse. */
export function applyApocalypse(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const lanes = board.lanes.map((lane) => {
    const c = oppS === "a" ? lane.a : lane.b;
    if (!c || c.spellImmune) return lane;
    const dmg = damageCreature(c, 4);
    return oppS === "a" ? { ...lane, a: dmg } : { ...lane, b: dmg };
  }) as [LaneState, LaneState, LaneState];
  const oppHero = oppS === "a" ? board.a : board.b;
  const after = withSideHero({ ...board, lanes }, oppS, damageHero(oppHero, 4));
  alog("spell", `${side} APOCALYPSE → 4 dmg créatures + héros adverses`);
  return after;
}

/** Imposteur — vole 1 carte au hasard de la main adverse (dans TA main,
 *  cap+1 comme Larcin) ET révèle sa main 1 tour. Main vide : 3 dmg héros. */
export function applyImposteur(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? board.a : board.b;
  let b = board;
  if (oppHero.hand.length === 0) {
    alog("spell", `${side} IMPOSTEUR → main adverse vide, 3 dmg héros ${oppS}`);
    b = withSideHero(b, oppS, damageHero(oppHero, 3));
  } else {
    const idx = Math.floor(Math.random() * oppHero.hand.length);
    const stolen = oppHero.hand[idx];
    const newOppHand = [...oppHero.hand.slice(0, idx), ...oppHero.hand.slice(idx + 1)];
    b = withSideHero(b, oppS, { ...oppHero, hand: newOppHand });
    const mine = side === "a" ? b.a : b.b;
    b = withSideHero(b, side, { ...mine, hand: [...mine.hand, stolen] });
    alog("spell", `${side} IMPOSTEUR → vole [${stolen}] + lit la main adverse`);
  }
  const opp2 = oppS === "a" ? b.a : b.b;
  if (side === "a") return { ...b, augurRevealedB: opp2.hand.slice(), augurTurnsLeftB: 1 };
  return { ...b, augurRevealedA: opp2.hand.slice(), augurTurnsLeftA: 1 };
}
