/**
 * Shared types + palette tables for the PremiumTouchLayer module.
 * Per-scene behaviour lives in ./spawners and ./render; the React shell in
 * ../PremiumTouchLayer.tsx wires those into pointer events + a canvas rAF.
 */

export type PremiumFxScene =
  | "storm" | "tempus" | "emberforge" | "phantom" | "eclipse"
  // 2026-06-07 lineup.
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom";

const FX_SCENES: ReadonlySet<string> = new Set([
  "storm", "tempus", "emberforge", "phantom", "eclipse",
  "coral", "rust", "void", "prism", "ink", "bloom",
]);

export function isPremiumFxScene(s: string | undefined): s is PremiumFxScene {
  return typeof s === "string" && FX_SCENES.has(s);
}

export interface Pt { x: number; y: number; t: number }
export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  born: number; life: number;
  size: number;
  kind?: string;
  /** Per-particle colour override (used by bloom's coloured petals). */
  c1?: number[];
  /** Rotation in radians (used by bloom petals + void shapes). */
  rot?: number;
  /** Per-particle angular velocity. */
  vrot?: number;
}

export const TRAIL_LIFE = 950;
export const MAX_POINTS = 120;
export const MAX_PARTS = 200;

/** Two-stop palette per scene — used by the trail and most particles. */
export const PALETTE: Record<PremiumFxScene, { c1: number[]; c2: number[] }> = {
  storm:      { c1: [155, 246, 255], c2: [160, 120, 255] },
  eclipse:    { c1: [255, 240, 192], c2: [212, 167, 69] },
  phantom:    { c1: [200, 210, 230], c2: [130, 155, 190] },
  emberforge: { c1: [255, 230, 160], c2: [255,  90,  20] },
  tempus:     { c1: [232, 207, 160], c2: [184, 149, 106] },
  coral:      { c1: [174, 242, 232], c2: [255, 107, 107] },
  rust:       { c1: [255, 180, 100], c2: [139,  69,  19] },
  void:       { c1: [255, 255, 255], c2: [180, 180, 180] },
  prism:      { c1: [255, 255, 255], c2: [139,  92, 246] },
  ink:        { c1: [ 26,  26,  26], c2: [140, 140, 140] },
  bloom:      { c1: [255, 126, 179], c2: [129, 199, 132] },
};

/**
 * Bloom petal colour rotation — each tap pulls the next colour, so the
 * player sees varied petals on consecutive taps. Bold enough to read on
 * the pastel sky background of the bloom backdrop.
 */
export const BLOOM_PETAL_COLOURS: number[][] = [
  [255, 126, 179],  // rose pétale
  [255, 217, 102],  // jaune pollen
  [255, 138, 101],  // pêche
  [186, 104, 200],  // violet doux
  [129, 199, 132],  // vert tilleul
  [102, 187, 255],  // bleu myosotis
  [255, 200, 180],  // pêche pâle
  [240, 130, 200],  // magenta clair
];

export const PRISM_SPECTRUM: number[][] = [
  [255,  32,  32],  // red
  [255, 140,   0],  // orange
  [255, 230,   0],  // yellow
  [ 32, 232,  60],  // green
  [ 32, 130, 255],  // blue
  [165,  60, 255],  // violet
];

export function rnd(amp: number) { return (Math.random() - 0.5) * 2 * amp; }

export const rgba = (c: number[], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export const lerpC = (c1: number[], c2: number[], t: number): number[] => [
  Math.round(c1[0] * (1 - t) + c2[0] * t),
  Math.round(c1[1] * (1 - t) + c2[1] * t),
  Math.round(c1[2] * (1 - t) + c2[2] * t),
];

/**
 * Steep intensity → throttle curve. 0.1× → ~10× sparser, 2.0× → ~4× denser
 * than the baseline. Same shape used by every scene that has a per-move
 * stream so the slider feels consistent.
 */
export function intervalForIntensity(k: number, baselineMs: number): number {
  const curved = k < 1.0 ? Math.pow(k, 1.6) : k * k * 0.85 + 0.15;
  return baselineMs / Math.max(0.04, curved);
}
