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
 *  - 🌿 FORÊT     = SÈVE    (seveStack)   : régén héros SI un counter Feuille gagné ce tour (sinon la jauge s'érode).
 *  - ✂️ TRANCHANT = TRANCHE (trancheStack): +Tranche ATK à tes créatures EN JEU
 *    (scopé : honnête vs le board réel — Alex 2026-06-23 « trompeur si je perds 2 lanes »).
 *  - 🦎 MIRAGE    = MIRAGE  (mirageStack) : tes Lézards arrivent +Mirage Esquive.
 *  - 🖖 COSMOS    = COSMOS  (cosmosCount)  : chip inévitable = Cosmos dégâts/tour au héros adverse.
 *
 * Robustesse : fonctions PURES, compteurs CAPÉS (3), reset par match (0 au
 * boardInit), additif, lecture seule. ZÉRO réécriture du résolveur.
 */

import { damageHero, healHero } from "./arenaRules/heroCreature";
import { BALANCE } from "./arenaBalance";
import type { Move } from "../engine/game";
import type { BoardState, HeroState } from "./arenaTypes";

/** Défaut historique du cap d'engine (le moteur lit BALANCE.engine.cap, tunable
 *  par le Lab). Conservé comme constante de référence/iso. */
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
  // 🌿 FORÊT — on marque que la Sève a été NOURRIE ce tour (un counter Feuille
  // remporté), AVANT le cap : une Forêt déjà maxée (seve=3) fait un early-return
  // ci-dessous (next===cur) ; sans poser le flag d'abord, elle se ferait éroder
  // à tort alors qu'elle joue parfaitement (cf. decaySeveIfStarved).
  const h = hero.affinity === "paper" && !hero.seveFedThisTurn ? { ...hero, seveFedThisTurn: true } : hero;
  const cur = (h[field] as number | undefined) ?? 0;
  const next = Math.min(BALANCE.engine.cap, cur + BALANCE.engine.risePerCounterWin);
  return next === cur ? h : { ...h, [field]: next };
}

/* ───────────────────────── Effets (lus aux bons points) ───────────────────────── */

/** 🌿 Régén Forêt de fin de tour — « Sève entretenue » (Alex 2026-06-27, refonte
 *  équité : « elle se régénère trop, increvable, revoir bonus/malus »). Le soin
 *  n'est plus un robinet passif : il n'est accordé QUE les tours où la Forêt a
 *  NOURRI sa jauge (un counter Feuille remporté ce tour → seveFedThisTurn, posé
 *  en combat). Turtle passif = 0 PV soigné, ET la jauge s'érode (decaySeveIfStarved)
 *  → le mur inconditionnel infini est mort. Magnitude inchangée pour la Forêt
 *  ACTIVE : min(2, Sève) (ramp 0→2). VERGER (finisher « soin éternel ») = seule
 *  exception : plancher 1 PV/tour GARANTI (ne tarit jamais + gèle l'érosion),
 *  2 si nourri ce tour. Identité grind préservée, équité rétablie. */
export function seveHealAmount(hero: HeroState): number {
  if (hero.affinity !== "paper") return 0;
  const seve = hero.seveStack ?? 0;
  const fed = !!hero.seveFedThisTurn;
  if (hero.vergerActive) return fed ? Math.min(BALANCE.foret.seveHealVerger, seve + 1) : 1;
  return fed ? Math.min(BALANCE.foret.seveHealActive, seve) : 0;
}

/** 🌿 Érosion de la Sève (Alex 2026-06-27) : si la Forêt n'a pas nourri sa jauge
 *  ce tour (aucun counter Feuille remporté) et que Verger n'est pas actif, la
 *  jauge perd 1 cran (plancher 0). Le sustain devient un état à ENTRETENIR :
 *  turtle passif → 3→2→1→0 → le soin s'auto-éteint. Vrai contre-jeu : wiper les
 *  Feuilles coupe le robinet ET déclenche l'érosion. Verger gèle (payoff éternel). */
export function decaySeveIfStarved(hero: HeroState): HeroState {
  if (hero.affinity !== "paper" || hero.vergerActive || hero.seveFedThisTurn) return hero;
  const seve = hero.seveStack ?? 0;
  return seve > 0 ? { ...hero, seveStack: seve - 1 } : hero;
}

/** Reset du flag « Sève nourrie ce tour » (après lecture par le soin + l'érosion),
 *  pour qu'il soit re-gagné au tour suivant. */
function clearSeveFed(hero: HeroState): HeroState {
  return hero.seveFedThisTurn ? { ...hero, seveFedThisTurn: false } : hero;
}

/** ✂️ Bonus d'ATK GLOBAL appliqué à chaque créature du camp Tranchant (baseline
 *  atkBuff via endOfTurnReset). 0 hors Tranchant. */
export function trancheAtkBonus(hero: HeroState): number {
  return hero.affinity === "scissors" ? (hero.trancheStack ?? 0) * BALANCE.engine.trancheAtkPerStack : 0;
}

/** 🦎 Charges d'Esquive bonus accordées à un Lézard fraîchement posé. */
export function mirageDodgeBonus(hero: HeroState): number {
  return hero.affinity === "lizard" ? (hero.mirageStack ?? 0) : 0;
}

/** 🖖 Chip inévitable de fin de tour au héros adverse = Cosmos (0-3). */
export function cosmosChip(hero: HeroState): number {
  return hero.affinity === "spock" ? Math.min(BALANCE.cosmos.chipCap, hero.cosmosCount ?? 0) : 0;
}

/** Fin de tour : applique les effets PASSIFS (régén Forêt sur SOI, chip Cosmos
 *  sur l'ADVERSE), PUIS érode la Sève non nourrie et reset le flag du tour.
 *  `heroA/heroB` déjà rafraîchis (constellation). Pur, capé. */
export function applyEnginesEndOfTurn(_board: BoardState, heroA: HeroState, heroB: HeroState): { a: HeroState; b: HeroState } {
  // Soin Sève conditionnel (lit seveFedThisTurn + seveStack du tour courant).
  let a = healHero(heroA, seveHealAmount(heroA));
  let b = healHero(heroB, seveHealAmount(heroB));
  const aChip = cosmosChip(a), bChip = cosmosChip(b);
  if (aChip > 0) b = damageHero(b, aChip);
  if (bChip > 0) a = damageHero(a, bChip);
  // Érosion de la Sève (jauge non nourrie ce tour) puis reset du flag pour le tour suivant.
  a = clearSeveFed(decaySeveIfStarved(a));
  b = clearSeveFed(decaySeveIfStarved(b));
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
  return { value, max: BALANCE.engine.cap, active: value >= BALANCE.engine.cap, label: labels[field] };
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
