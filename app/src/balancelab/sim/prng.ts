/**
 * prng — PRNG seedé (mulberry32) + patch/restore de Math.random.
 *
 * Le moteur (shuffle de boardInit, pioche anti-doublon, tie-breaks de l'IA)
 * utilise Math.random() global. Pour qu'un changement de réglage produise un
 * DELTA LISIBLE (et pas du bruit Monte-Carlo), on enveloppe chaque partie d'un
 * Math.random déterministe seedé, puis on restaure l'original. Scope sandbox du
 * Lab uniquement — le jeu n'est jamais touché (balance.html est une page à part).
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _realRandom = Math.random;

/** Installe un Math.random déterministe pour la durée d'une partie. */
export function patchRandom(seed: number): void {
  const rng = mulberry32(seed);
  (Math as { random: () => number }).random = rng;
}

/** Restaure le Math.random natif (à appeler après chaque partie). */
export function restoreRandom(): void {
  (Math as { random: () => number }).random = _realRandom;
}
