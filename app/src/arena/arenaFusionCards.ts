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

import { drawCards, damageHero, healHero, damageCreature, healCreature, makeCreature } from "./arenaRules";
import { STRATE_CAP } from "./arenaRules/heroCreature";
import {
  getMyCreatureOnLane, getOppCreatureOnLane,
  withMyCreatureOnLane, withOppCreatureOnLane, withSideHero, oppSide,
} from "./arenaSpellHelpers";
import type { BoardState, Creature, LaneIndex, LaneState, PlayedSpell, Side } from "./arenaTypes";
import { alog } from "./arenaLog";
import { BALANCE } from "./arenaBalance";
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
  { a: "rempart",     b: "anchor",       result: "bastion" },         // bouclier+ancre+provoc (FIX 2026-06-30 : aegis→rempart, aegis hors deck rock = recette injouable en Montagne, même bug que Cosmos)
  { a: "jet-caillou", b: "jet-caillou",  result: "avalanche" },       // 3 dmg ×2 créatures
  { a: "seve",        b: "second-wind",  result: "source-vitale" },   // +3 créature ET +3 héros
  { a: "oracle",      b: "augur",        result: "omniscience" },     // pioche 3 + main révélée (FIX 2026-06-28 : augur NEUTRE au lieu de coup-oeil voie:spock = recette était injouable)
  { a: "toile-gluante", b: "curse",      result: "cocon" },           // n'attaque pas + −2 ATK
  { a: "supernova",   b: "singularite",  result: "apocalypse" },      // 4 dmg all + 4 héros (FIX 2026-06-28 : singularité NEUTRE au lieu de gravité voie:spock = recette était injouable)
  { a: "heist",       b: "mascarade",    result: "imposteur" },       // vol + main révélée
  // ── Fusions Voie MIRAGE (Alex 2026-06-28) — 2 signatures lizard → résultat lizard, forgeabilité garantie ──
  { a: "mirror",         b: "reflet-echo",      result: "galerie-des-glaces" },   // reflets sur les lanes vides
  { a: "mascarade",      b: "faux-semblant",    result: "mascarade-souveraine" }, // contrôle TOTAL d'une lane
  { a: "nuee-spectrale", b: "coup-dans-lombre", result: "apotheose-spectrale" },  // closer imblocable + burst d'esquives
  // ── Fusions Voie MONTAGNE (Alex 2026-06-30) — ingrédients tous dans SIGNATURE_DECK.rock (forgeabilité garantie) ──
  { a: "rempart",     b: "strate-vive",  result: "citadelle" },       // mur board-wide : +1 Strate + 2 PV à TOUTES mes Pierres
  { a: "eboulis-final", b: "contrefort", result: "cataclysme" },      // closer : gros burst granite (Pierres×3) qui IGNORE le soin
  // ── Fusion Voie TRANCHANT (Alex 2026-06-30) — les 2 ingrédients sont dans SIGNATURE_DECK.scissors ──
  { a: "coup-de-taille", b: "frenesie",  result: "estocade" },        // closer perforant board : tous mes Ciseaux +2 ATK + re-perforation + dé-émoussés
  // ── Fusion Voie FORÊT (Alex 2026-06-30) — les 2 ingrédients sont dans SIGNATURE_DECK.paper ──
  { a: "ronces",      b: "photosynthese", result: "bosquet-epineux" }, // gardien épineux fortifié : riposte + bouclier + croissance (version PREMIUM de Ronces nerfée)
  // ── Fusion Voie COSMOS (Alex 2026-06-30) — les 2 ingrédients sont dans SIGNATURE_DECK.spock (corrige la pire parité fusion : Cosmos en avait 0 forgeable) ──
  { a: "loi-de-causalite", b: "trou-noir", result: "effacement" },    // contrôle total : efface 1 créature adverse + fige tout le reste de son board
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
    provocationCharges: c.move === "rock" ? Math.max(c.provocationCharges, BALANCE.montagne.voieProvocationCharges) : c.provocationCharges,
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

/** Citadelle (Montagne, 2026-06-30) — la citadelle se dresse : TOUTES mes Pierres
 *  gagnent +1 Strate (ATK perm, capé STRATE_CAP) ET +2 PV. Mur board-wide qui
 *  amorce le snowball d'un coup (rempart + strate-vive fusionnés). */
export function applyCitadelle(board: BoardState, side: Side): BoardState {
  let count = 0;
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move !== "rock") return lane;
    count += 1;
    const strated: Creature = { ...me, voieAtkBonus: Math.min(STRATE_CAP, me.voieAtkBonus + 1), hp: me.hp + 2 };
    return side === "a" ? { ...lane, a: strated } : { ...lane, b: strated };
  }) as [LaneState, LaneState, LaneState];
  alog("spell", `${side} CITADELLE → +1 Strate + 2 PV à ${count} Pierre(s)`);
  return { ...board, lanes };
}

/** Cataclysme (Montagne, 2026-06-30) — le CLOSER : dégâts au héros adverse =
 *  (mes Pierres × 3 + Strates), plafonné 14, ET le héros adverse ne peut pas être
 *  soigné ce tour (healLockedThisTurn → perce le mur de régen Forêt). Le coup de
 *  grâce que le soin ne rattrape pas (eboulis-final + contrefort fusionnés). */
export function applyCataclysme(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  let rocks = 0, strates = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "rock") { rocks += 1; strates += me.voieAtkBonus; }
  }
  const dmg = Math.min(14, rocks * 3 + strates);
  const oppHero = oppS === "a" ? board.a : board.b;
  const locked = { ...oppHero, healLockedThisTurn: true };
  alog("spell", `${side} CATACLYSME → ${dmg} dmg héros ${oppS} (${rocks} Pierre(s) + ${strates} Strate(s)) + soin coupé`);
  return withSideHero(board, oppS, damageHero(locked, dmg));
}

/** Estocade (Tranchant, 2026-06-30) — closer perforant BOARD-WIDE : TOUS mes
 *  Ciseaux gagnent +2 ATK ce tour, RÉCUPÈRENT leur Perforation (pierceUsed:false →
 *  re-percent l'Aegis) ET se RÉ-AFFÛTENT (combatBlunted retiré). « La lame affûtée
 *  frappe partout et perce tout » — permet de finir la course à travers les murs
 *  (Aegis/Bouclier). Fusion coup-de-taille + frenesie. */
export function applyEstocade(board: BoardState, side: Side): BoardState {
  let count = 0;
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move !== "scissors") return lane;
    count++;
    const sharp: Creature = { ...me, atkBuff: me.atkBuff + 2, pierceUsed: false, combatBlunted: false };
    return side === "a" ? { ...lane, a: sharp } : { ...lane, b: sharp };
  }) as [LaneState, LaneState, LaneState];
  alog("spell", `${side} ESTOCADE → ${count} Ciseau·x : +2 ATK, perforation rechargée, dé-émoussés`);
  return { ...board, lanes };
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

/** Bosquet Épineux (Forêt, 2026-06-30) — fusion ronces+photosynthese. La version
 *  PREMIUM de Ronces (le commun a perdu son bouclier au nerf Forêt) : ma Feuille
 *  ciblée devient un gardien épineux fortifié — Riposte (tue son tueur) + Bouclier
 *  (encaisse un coup) + croissance (+1 ATK perm, plafond Strate) + soin Photosynthèse.
 *  Réactif (punit l'attaquant), SINGLE-TARGET (un gardien, pas le board) → ajoute du
 *  counterplay lisible sans recréer le mur board-wide. */
export function applyBosquetEpineux(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c) return board;
  const guard: Creature = {
    ...healCreature(c, BALANCE.foret.photosyntheseHeal),
    ripostePrimed: true, divineShield: true,
    voieAtkBonus: Math.min(STRATE_CAP, c.voieAtkBonus + 1),
  };
  alog("spell", `${side} BOSQUET ÉPINEUX → Feuille fortifiée (riposte + bouclier + croissance)`);
  return withMyCreatureOnLane(board, side, spell.lane, guard);
}

/** Effacement (Cosmos, 2026-06-30) — fusion loi-de-causalite+trou-noir. CONTRÔLE
 *  TOTAL d'un tour : EFFACE la créature adverse ciblée (comme Trou Noir) ET FIGE
 *  toutes les AUTRES créatures adverses (cannotAttack, comme Loi de Causalité).
 *  Spock immunisé / créature ancrée épargnés (cohérence). Closer de contrôle, zéro
 *  dégât inévitable — identité Cosmos. */
export function applyEffacement(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  let b = board;
  const target = getOppCreatureOnLane(b, side, spell.lane);
  if (target && !target.spellImmune) b = withOppCreatureOnLane(b, side, spell.lane, null);
  for (const l of [0, 1, 2] as LaneIndex[]) {
    if (l === spell.lane) continue;
    const opp = getOppCreatureOnLane(b, side, l);
    if (opp && !opp.anchored && !opp.spellImmune) {
      b = withOppCreatureOnLane(b, side, l, { ...opp, cannotAttack: true });
    }
  }
  alog("spell", `${side} EFFACEMENT L${spell.lane} : créature effacée + board adverse figé`);
  return b;
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
  // turns=2 (PAS 1) — advanceToNextTurn décrémente AUSSITÔT de 1 : 1→0 = la main
  // est effacée avant que tu la voies (bug Alex 2026-06-28). 2→1 = visible pendant
  // ta prochaine planif (= « 1 tour » de révélation réel, comme Augur/Omniscience).
  if (side === "a") return { ...b, augurRevealedB: opp2.hand.slice(), augurTurnsLeftB: 2 };
  return { ...b, augurRevealedA: opp2.hand.slice(), augurTurnsLeftA: 2 };
}

/* ───────────── Fusions Voie MIRAGE (Alex 2026-06-28) ───────────── */

/** Galerie des Glaces (Miroir + Reflet-Écho) — une armée de reflets : un Lézard
 *  apparaît sur CHACUNE de tes lanes vides (Lents au summon, Voie si affinité
 *  lizard). L'illusion qui se démultiplie. */
export function applyGalerieDesGlaces(board: BoardState, side: Side): BoardState {
  const aff = side === "a" ? board.a.affinity : board.b.affinity;
  let b = board;
  let count = 0;
  for (let i = 0 as LaneIndex; i < 3; i = (i + 1) as LaneIndex) {
    if (!getMyCreatureOnLane(b, side, i)) {
      b = withMyCreatureOnLane(b, side, i, makeCreature("lizard", side, aff));
      count += 1;
    }
  }
  alog("spell", `${side} GALERIE DES GLACES → ${count} reflet(s) Lézard sur les lanes vides`);
  return b;
}

/** Mascarade Souveraine (Mascarade + Faux-Semblant) — contrôle TOTAL d'une lane :
 *  TA créature devient un Lézard ET l'adverse une Feuille DÉPOUILLÉE (Esquive +
 *  Aegis retirés) → ton Lézard la CONTRE et la tue à coup sûr. Besoin des deux
 *  créatures. Ancre/Logique (Spock) protègent l'adverse. */
export function applyMascaradeSouveraine(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!me || !opp) {
    alog("spell", `💤 ${side} Mascarade Souveraine L${spell.lane} : il faut une créature DES DEUX côtés.`);
    return board;
  }
  if (opp.anchored || opp.spellImmune) {
    alog("spell", `💤 ${side} Mascarade Souveraine L${spell.lane} : cible ancrée ou immunisée (Spock).`);
    return board;
  }
  // summonedThisTurn:false → un Lézard TRANSFORMÉ n'est pas « fraîchement invoqué »
  // (pas de malus Lente ce tour ; le kill RPSLS marche de toute façon, c'est pour le splash).
  let b = withMyCreatureOnLane(board, side, spell.lane, { ...me, move: "lizard", summonedThisTurn: false });
  b = withOppCreatureOnLane(b, side, spell.lane, { ...opp, move: "paper", dodgeCharges: 0, divineShield: false });
  alog("spell", `${side} MASCARADE SOUVERAINE L${spell.lane} : ta créature → Lézard, l'adverse → Feuille dépouillée (kill garanti)`);
  return b;
}

/** Apothéose Spectrale (Nuée + Coup dans l'Ombre) — l'apex : CE TOUR tes Lézards
 *  deviennent imblocables (cf. arenaCombat nueeActive) ET burst IMMÉDIAT au héros
 *  adverse = total de tes charges d'Esquive. Le « bouton kill » de Mirage. */
export function applyApotheoseSpectrale(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let b = withSideHero(board, side, { ...hero, nueeActive: true });
  let charges = 0;
  for (const lane of b.lanes) {
    const c = side === "a" ? lane.a : lane.b;
    if (c && c.move === "lizard") charges += c.dodgeCharges;
  }
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? b.a : b.b;
  if (charges > 0) b = withSideHero(b, oppS, damageHero(oppHero, charges));
  alog("spell", `${side} APOTHÉOSE SPECTRALE → Lézards imblocables ce tour + burst ${charges} (esquives) au héros ${oppS}`);
  return b;
}
