/**
 * arenaEngines — les ENGINES de Voie (Alex 2026-06-23, pivot « Voie globale »).
 *
 * RÈGLE UNIQUE ET LISIBLE (Alex 2026-06-24 « le trigger est mauvais, le message
 * vient sans que mon signe gagne ») : **chaque fois que ton SYMBOLE de Voie
 * REMPORTE un counter RPSLS en lane, ta jauge monte de +1** (cap 3). Plus la jauge
 * est haute, plus ton CAMP ENTIER est renforcé. On gagne sa Voie en GAGNANT des
 * duels, pas en posant passivement — et le cue « ★ » tombe pile sur la lane gagnante.
 *
 *  - 🪨 MONTAGNE = Strates (déjà sur les créatures via voieAtkBonus — pas ici).
 *  - 🌿 FORÊT     = SÈVE    (seveStack)   : régén héros = Sève PV/tour.
 *  - ✂️ TRANCHANT = TRANCHE (trancheStack): +Tranche ATK à tes créatures EN JEU
 *    (scopé : honnête vs le board réel — Alex 2026-06-23 « trompeur si je perds 2 lanes »).
 *  - 🦎 MIRAGE    = MIRAGE  (mirageStack) : tes Lézards arrivent +Mirage Esquive.
 *  - 🖖 COSMOS    = COSMOS  (cosmosCount)  : chip inévitable = Cosmos dégâts/tour au héros adverse.
 *
 * Robustesse : fonctions PURES, compteurs CAPÉS (3), reset par match (0 au
 * boardInit), additif, lecture seule. ZÉRO réécriture du résolveur.
 */

import { damageHero, healHero } from "./arenaRules/heroCreature";
import type { Move } from "../engine/game";
import type { BoardState, HeroState } from "./arenaTypes";

export const ENGINE_CAP = 3;

/** True si la Voie a une jauge d'engine HÉROS (toutes sauf Montagne, dont
 *  l'engine — les Strates — vit sur les créatures). */
function engineField(affinity: Move | undefined): "rockStack" | "seveStack" | "trancheStack" | "mirageStack" | "cosmosCount" | null {
  switch (affinity) {
    case "rock": return "rockStack"; // jauge = progrès vers Forteresse ; le boost = les Strates sur les Pierres
    case "paper": return "seveStack";
    case "scissors": return "trancheStack";
    case "lizard": return "mirageStack";
    case "spock": return "cosmosCount";
    default: return null;
  }
}

/** LE TRACÉ (Alex 2026-06-24) — MONTÉE : chaque fois que ton SYMBOLE de Voie
 *  REMPORTE un counter RPSLS en lane, ta jauge monte de +1 (cap 3). Appelé par
 *  arenaCombat sur le vainqueur d'un counter dont le move = son affinité (la
 *  victoire est déjà vérifiée par l'appelant → symbol-agnostic ici). Fini la
 *  montée passive « je pose mon symbole » : on gagne sa Voie en GAGNANT. */
export function riseEngineOnCounterWin(hero: HeroState): HeroState {
  const field = engineField(hero.affinity);
  if (!field) return hero;
  const cur = (hero[field] as number | undefined) ?? 0;
  const next = Math.min(ENGINE_CAP, cur + 1);
  return next === cur ? hero : { ...hero, [field]: next };
}

/* ───────────────────────── Effets (lus aux bons points) ───────────────────────── */

/** 🌿 Régén Forêt de fin de tour : Sève PV, ou 2+Sève si Verger actif. */
export function seveHealAmount(hero: HeroState): number {
  if (hero.affinity !== "paper") return 0;
  const seve = hero.seveStack ?? 0;
  return hero.vergerActive ? 2 + seve : seve;
}

/** ✂️ Bonus d'ATK GLOBAL appliqué à chaque créature du camp Tranchant (baseline
 *  atkBuff via endOfTurnReset). 0 hors Tranchant. */
export function trancheAtkBonus(hero: HeroState): number {
  return hero.affinity === "scissors" ? (hero.trancheStack ?? 0) : 0;
}

/** 🦎 Charges d'Esquive bonus accordées à un Lézard fraîchement posé. */
export function mirageDodgeBonus(hero: HeroState): number {
  return hero.affinity === "lizard" ? (hero.mirageStack ?? 0) : 0;
}

/** 🖖 Chip inévitable de fin de tour au héros adverse = Cosmos (0-3). */
export function cosmosChip(hero: HeroState): number {
  return hero.affinity === "spock" ? (hero.cosmosCount ?? 0) : 0;
}

/** Fin de tour : applique les effets PASSIFS (régén Forêt sur SOI, chip Cosmos
 *  sur l'ADVERSE). `heroA/heroB` déjà rafraîchis (constellation). Pur, capé. */
export function applyEnginesEndOfTurn(_board: BoardState, heroA: HeroState, heroB: HeroState): { a: HeroState; b: HeroState } {
  let a = healHero(heroA, seveHealAmount(heroA));
  let b = healHero(heroB, seveHealAmount(heroB));
  const aChip = cosmosChip(a), bChip = cosmosChip(b);
  if (aChip > 0) b = damageHero(b, aChip);
  if (bChip > 0) a = damageHero(a, bChip);
  return { a, b };
}

/* ───────────────────────── Lecture UI (jauge + cue) ───────────────────────── */

/** Valeur d'engine pour la jauge VFX. null = pas de jauge héros (Montagne). */
export function engineGauge(hero: HeroState): { value: number; max: number; active: boolean; label: string } | null {
  const field = engineField(hero.affinity);
  if (!field) return null;
  const value = (hero[field] as number | undefined) ?? 0;
  const labels: Record<string, string> = {
    rockStack: "Montagne", seveStack: "Forêt", trancheStack: "Tranchant", mirageStack: "Mirage", cosmosCount: "Cosmos",
  };
  return { value, max: ENGINE_CAP, active: value >= ENGINE_CAP, label: labels[field] };
}

/** Phrase d'effet pour le CUE de montée (« ce que ça fait »). */
export function engineEffectText(affinity: Move | undefined): string {
  switch (affinity) {
    case "rock":     return "tes Pierres se renforcent";
    case "paper":    return "ton héros se régénère plus fort";
    case "scissors": return "tes créatures en jeu frappent plus fort";
    case "lizard":   return "tes Lézards deviennent insaisissables";
    case "spock":    return "l'inévitable ronge le héros adverse";
    default: return "";
  }
}

/** Jauge d'engine pleine (climax) → le Finisher se débloque. Unifie la condition
 *  d'unlock pour les 5 Voies (remplace l'ancienne « constellation 3⭐ »). */
export function engineMaxed(hero: HeroState): boolean {
  const g = engineGauge(hero);
  return !!g && g.value >= g.max;
}
