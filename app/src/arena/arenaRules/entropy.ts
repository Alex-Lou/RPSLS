/**
 * ENTROPIE — passif de Voie COSMOS (PASSE ANTI-SOIN 2026-10, cf. arenaBalance).
 *
 * RÈGLE (une phrase) : face à un héros Cosmos (affinité spock), chaque soin reçu
 * par son adversaire perd BALANCE.cosmos.entropyHealReduction PV, sans jamais
 * descendre sous 1 PV par soin.
 *
 * Pourquoi : le duel Forêt > Cosmos restait structurellement déséquilibré (la
 * Forêt survit par l'accumulation de PETITS soins : Second Souffle, Drain, Sève,
 * Verger, Sangsue…). Une réduction FIXE par soin mord surtout ce robinet
 * goutte-à-goutte et reste quasi neutre contre les Voies qui soignent peu ou par
 * gros paquets.
 *
 * Mise en œuvre : PURE, sans RNG. Le marquage `entropyMarked` est posé une fois
 * au boardInit (l'affinité ne change jamais en cours de match) sur le héros qui
 * fait face au Cosmos ; healHero (le point UNIQUE de tout soin héros : sorts,
 * Sève/Verger, cartes « à la pioche ») appelle entropyCut. Le montant est lu
 * INLINE dans BALANCE (Balance Lab). Les soins de CRÉATURES ne sont pas touchés.
 */
import { BALANCE } from "../arenaBalance";
import type { BoardState, HeroState } from "../arenaTypes";

/** PV retirés à un soin de `amount` reçu par `hero` : 0 si le héros ne fait pas
 *  face au Cosmos ; sinon entropyHealReduction, mais un soin garde TOUJOURS au
 *  moins 1 PV (un soin de 1 est intact, 2 → 1, 3 → 2…). Ce plancher est le
 *  « juste et réglo » : l'Entropie freine la régénération, elle ne l'annule jamais
 *  (sim : sans plancher, Forêt vs Cosmos basculait de 77 % à 13 %). */
export function entropyCut(hero: HeroState, amount: number): number {
  if (!hero.entropyMarked || amount <= 1) return 0;
  return Math.max(0, Math.min(BALANCE.cosmos.entropyHealReduction, amount - 1));
}

/** Marque, au boardInit, le(s) héros qui font face à un Cosmos. Miroir Cosmos
 *  vs Cosmos : les deux sont marqués (symétrique). */
export function markEntropy(board: BoardState): BoardState {
  const a = board.b.affinity === "spock" ? { ...board.a, entropyMarked: true } : board.a;
  const b = board.a.affinity === "spock" ? { ...board.b, entropyMarked: true } : board.b;
  return a === board.a && b === board.b ? board : { ...board, a, b };
}
