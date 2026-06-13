/**
 * Constellation Pro — cartes « À LA PIOCHE » (Cast When Drawn).
 *
 * Alex 2026-06-13 : « garder les cartes actuelles ET ajouter de nouvelles qui
 * s'activent DIRECT, au moment de la tirer du deck ». Mécanique façon
 * Hearthstone « Casts When Drawn » : la carte ne va PAS en main — elle résout
 * son effet IMMÉDIATEMENT au tirage. Le sel = on ne contrôle pas QUAND on la
 * pioche → ça peut sauver pile au bon moment, ou tomber à plat (variance fun).
 *
 * ── Architecture (DRY + SOLID) ──
 *  - Spécifications DÉCLARATIVES (CAST_ON_DRAW) : data pure, zéro logique React.
 *  - resolveCastOnDraw() : fonction PURE sur HeroState → { hero, event, extraDraws }.
 *    Les `extraDraws` (pioche bonus) sont rendus au DRAW (arenaRules.drawCards),
 *    PAS exécutés ici → aucune dépendance circulaire avec le moteur de pioche.
 *  - Le déclenchement vit dans arenaRules.drawCards (chokepoint des pioches
 *    VIVES) ; les pioches de SETUP (main de départ, mulligan) excluent ces
 *    cartes via CAST_ON_DRAW_IDS dans `avoid` → elles ne s'activent qu'EN JEU.
 *
 * Effets bornés à l'ÉTAT HÉROS (mana/PV/main) → résolvables dans drawCards sans
 * accès au plateau. Les variantes plateau (buff créature, dégâts héros adverse)
 * demanderaient un autre hook → réservées à une v2.
 */

import { MANA_CAP, type CastFxKind, type CastOnDrawEvent, type HeroState } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

interface CastSpec {
  /** Teinte/animation jouée par ArenaCastOnDrawFX. */
  fxKind: CastFxKind;
  /** +mana DISPONIBLE ce tour (plafonné MANA_CAP). */
  manaNow?: number;
  /** +mana MAX permanent (et +autant dispo ce tour). */
  maxManaUp?: number;
  /** +PV héros (plafonné maxHp). */
  heal?: number;
  /** Soin CLUTCH : `low` si PV ≤ threshold (urgence), sinon `high`. Honore le
   *  « sauve sous conditions » d'Alex sans carte morte en main. */
  clutchHeal?: { threshold: number; low: number; high: number };
  /** −PV héros (risque) — PLANCHER 1 : une carte tirée ne peut jamais te tuer
   *  toute seule (zéro agence au tirage → mort interdite, mais frisson réel). */
  selfDamage?: number;
  /** Pioche N cartes de plus (rendu en extraDraws au moteur de pioche). */
  drawN?: number;
  /** Défausse N cartes AU HASARD de la main. */
  discardN?: number;
  /** Pile ou Face : 50/50 entre +mana (pile) et défausse (face). */
  coin?: { headsManaNow: number; tailsDiscardN: number };
}

/** Registre DÉCLARATIF des 9 cartes à la pioche. */
export const CAST_ON_DRAW: Partial<Record<CardId, CastSpec>> = {
  "coup-de-bol":   { fxKind: "mana", manaNow: 2 },
  "bouffee-air":   { fxKind: "heal", heal: 3 },
  "eclair-genie":  { fxKind: "draw", drawN: 2 },
  "trefle-chance": { fxKind: "mana", maxManaUp: 1 },
  "patate-chaude": { fxKind: "risk", drawN: 2, selfDamage: 2 },
  "pile-ou-face":  { fxKind: "chaos", coin: { headsManaNow: 3, tailsDiscardN: 1 } },
  sursaut:         { fxKind: "heal", clutchHeal: { threshold: 5, low: 5, high: 2 }, drawN: 1 },
  cafeine:         { fxKind: "mana", manaNow: 1, drawN: 1 },
  tuile:           { fxKind: "risk", discardN: 1 },
};

/** Liste des IDs Cast-When-Drawn — ajoutée à l'`avoid` des pioches de SETUP
 *  (main de départ / mulligan) pour qu'elles restent dans le deck et ne se
 *  déclenchent qu'en jeu (jamais à l'ouverture). */
export const CAST_ON_DRAW_IDS = Object.keys(CAST_ON_DRAW) as CardId[];

export function isCastOnDraw(id: CardId): boolean {
  return Object.prototype.hasOwnProperty.call(CAST_ON_DRAW, id);
}

/** Défausse `n` cartes au hasard de `hand`. Retourne le nombre réellement
 *  défaussé (0 si main vide). Deterministe seulement par le RNG du moteur
 *  (même shuffle que arenaRules) — acceptable côté app (pas un workflow). */
function discardRandom(
  hand: CardId[], discard: CardId[], n: number,
): { hand: CardId[]; discard: CardId[]; count: number } {
  const h = hand.slice();
  const d = discard.slice();
  let count = 0;
  for (let k = 0; k < n && h.length > 0; k++) {
    const j = Math.floor(Math.random() * h.length);
    d.push(h[j]);
    h.splice(j, 1);
    count++;
  }
  return { hand: h, discard: d, count };
}

/** Résout une carte à la pioche sur `hero`. Retourne le hero muté, l'événement
 *  (pour l'anim ⚡) et le nombre de pioches BONUS à effectuer côté drawCards.
 *  Retourne null si `id` n'est pas une carte à la pioche. PURE. */
export function resolveCastOnDraw(
  hero: HeroState, id: CardId,
): { hero: HeroState; event: CastOnDrawEvent; extraDraws: number } | null {
  const spec = CAST_ON_DRAW[id];
  if (!spec) return null;
  let h = hero;
  let extraDraws = 0;
  const parts: string[] = [];

  if (spec.manaNow) {
    h = { ...h, mana: Math.min(MANA_CAP, h.mana + spec.manaNow) };
    parts.push(`+${spec.manaNow} MANA`);
  }
  if (spec.maxManaUp) {
    h = {
      ...h,
      maxMana: Math.min(MANA_CAP, h.maxMana + spec.maxManaUp),
      mana: Math.min(MANA_CAP, h.mana + spec.maxManaUp),
    };
    parts.push(`+${spec.maxManaUp} MANA MAX`);
  }
  if (spec.heal) {
    h = { ...h, hp: Math.min(h.maxHp, h.hp + spec.heal) };
    parts.push(`+${spec.heal} PV`);
  }
  if (spec.clutchHeal) {
    const amt = h.hp <= spec.clutchHeal.threshold ? spec.clutchHeal.low : spec.clutchHeal.high;
    h = { ...h, hp: Math.min(h.maxHp, h.hp + amt) };
    parts.push(`+${amt} PV`);
  }
  if (spec.selfDamage) {
    h = { ...h, hp: Math.max(1, h.hp - spec.selfDamage) }; // plancher 1 : jamais létal
    parts.push(`−${spec.selfDamage} PV`);
  }
  if (spec.drawN) {
    extraDraws += spec.drawN;
    parts.push(`PIOCHE ${spec.drawN}`);
  }
  if (spec.discardN) {
    const r = discardRandom(h.hand, h.discard, spec.discardN);
    h = { ...h, hand: r.hand, discard: r.discard };
    if (r.count > 0) parts.push(`DÉFAUSSE ${r.count}`);
  }
  if (spec.coin) {
    const heads = Math.random() < 0.5;
    if (heads) {
      h = { ...h, mana: Math.min(MANA_CAP, h.mana + spec.coin.headsManaNow) };
      parts.push(`PILE → +${spec.coin.headsManaNow} MANA`);
    } else {
      const r = discardRandom(h.hand, h.discard, spec.coin.tailsDiscardN);
      h = { ...h, hand: r.hand, discard: r.discard };
      parts.push(r.count > 0 ? `FACE → DÉFAUSSE ${r.count}` : "FACE → main vide");
    }
  }

  return { hero: h, event: { id, fxKind: spec.fxKind, label: parts.join(" · ") || "⚡" }, extraDraws };
}
