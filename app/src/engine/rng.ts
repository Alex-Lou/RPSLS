/**
 * rng — PRNG déterministe seedé (mulberry32), base du lockstep CCG online.
 *
 * `Math.random()` n'est PAS reproductible → deux clients (ou un replay) divergent.
 * `makeRng(seed)` retourne une closure qui produit des flottants [0,1) EXACTEMENT
 * comme Math.random mais **reproductibles** depuis un seed 32-bit : les deux
 * clients rejouent la même partie (même ordre de pioche/défausse/aléa de cartes)
 * en consommant le même seed dans le même ordre.
 *
 * Phase 0 (déterminisme, sans réseau) : le vs-CPU se seede aléatoirement au début
 * du match (`randomSeed()`) → comportement inchangé, mais la résolution devient
 * reproductible (testable par replay). Plus tard, le seed vient du serveur
 * (shared_seed du handshake) pour synchroniser les deux joueurs.
 */

export type Rng = () => number;

/** Paire de PRNG, un par camp (Alex 2026-07, décision lockstep Pro) : chaque
 *  camp consomme SON propre flux dérivé du `shared_seed` → l'ajout d'un effet
 *  aléatoire d'un côté ne décale pas le flux de l'autre (robuste). Cf.
 *  `makeRngPair`. */
export interface RngPair {
  a: Rng;
  b: Rng;
}

/** Le SEUL repli non seedé du moteur Arena : appliqué aux POINTS D'ENTRÉE
 *  publics (makeInitialBoard, resolveTurn, advanceToNextTurn…) quand aucune
 *  paire n'est fournie (vs-CPU, sims). Les fonctions internes EXIGENT un Rng :
 *  un oubli de threading devient une erreur de compilation, plus une désync
 *  silencieuse en ligne. `Math.random` est relu à CHAQUE tirage (pas capturé) :
 *  les sims qui le remplacent et le piège de determinism-check restent actifs. */
export function randomPair(): RngPair {
  return { a: () => Math.random(), b: () => Math.random() };
}

/** Deux PRNG indépendants dérivés d'UNE graine de match — un par camp. Le camp
 *  B décale la graine d'une constante (nombre d'or 32-bit) pour un flux distinct
 *  mais reproductible. Les deux clients construisent la MÊME paire depuis le
 *  `shared_seed` → résolution déterministe identique des deux côtés. */
export function makeRngPair(seed: number): RngPair {
  return { a: makeRng(seed), b: makeRng((seed ^ 0x9e3779b9) >>> 0) };
}

/** PRNG mulberry32 : rapide, déterministe, bon spread pour un usage jeu (pas
 *  crypto). Seed 32-bit → suite reproductible de flottants [0,1). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entier aléatoire 32-bit non-signé — seed de match pour le vs-CPU local
 *  (chaque partie a son propre seed → comportement identique à avant, mais
 *  reproductible). Côté online, le seed viendra du serveur, pas d'ici. */
export function randomSeed(): number {
  return (Math.random() * 0x1_0000_0000) >>> 0;
}

/** Indice entier [0, n) tiré d'un rng — équivalent seedé de
 *  `Math.floor(Math.random() * n)`. */
export function rngInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}
