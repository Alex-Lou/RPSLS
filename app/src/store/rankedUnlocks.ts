import type { MatchRecord } from "../types";

/**
 * Ranked unlocks — checked after every recordMatch, idempotent.
 * Tier thresholds mirror rank.ts (Silver 1100 / Gold 1300 / Platinum 1500).
 * Constellation wins/sweeps are counted from match history.
 */
export function applyRankedUnlocks(
  collection: string[],
  rankLp: number,
  history: MatchRecord[],
): string[] {
  const set = new Set(collection);
  const constellWins = history.filter(
    (h) => h.mode === "constellation" && h.outcome === "win",
  ).length;
  const constellSweeps = history.filter(
    (h) =>
      h.mode === "constellation" &&
      h.outcome === "win" &&
      h.scorePlayer === h.bestOf &&
      h.scoreOpponent === 0,
  ).length;
  if (constellWins >= 5) set.add("riposte");
  if (constellWins >= 10) set.add("curse");
  if (constellSweeps >= 3) set.add("vortex");
  if (rankLp >= 1100) set.add("heist");
  if (rankLp >= 1300) set.add("oracle");
  if (rankLp >= 1500) set.add("supernova");
  // New mechanics cards.
  if (constellWins >= 3) set.add("mirror");   // early rare — anti-counter tool
  if (rankLp >= 1200) set.add("gambit");      // mid-tier high-roll epic
  // Outil de Forge (Arena 2026-06-13) — débloqué tôt pour jouer le bras de fer
  // forge (vole la carte forgée non récupérée de l'adversaire).
  if (constellWins >= 1) set.add("razzia");
  // 6 arts orphelins Pro (2026-06-13) — débloqués dès 1 victoire pour les jouer.
  if (constellWins >= 1) {
    for (const c of ["surcharge", "toxine", "echo", "rappel", "double-mot", "chronomancien"]) set.add(c);
  }
  // ⚡ Cartes « à la pioche » (Cast When Drawn, 2026-06-13) — progression douce :
  // communes dès la 1re victoire, rares à la 2e, épiques à la 4e.
  if (constellWins >= 1) {
    for (const c of ["coup-de-bol", "bouffee-air", "cafeine", "tuile"]) set.add(c);
  }
  if (constellWins >= 2) {
    for (const c of ["eclair-genie", "patate-chaude", "pile-ou-face"]) set.add(c);
  }
  if (constellWins >= 4) {
    for (const c of ["trefle-chance", "sursaut"]) set.add(c);
  }
  return set.size === collection.length ? collection : Array.from(set);
}
