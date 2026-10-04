/**
 * Types + réglages (plafonds, durées) de la couche interactive Quartz —
 * extraits verbatim de QuartzInteractiveLayer.tsx.
 */

export interface Crystal {
  id: number;
  /** Position in viewport %. We use % so the backdrop scales with the device. */
  x: number;
  y: number;
  rot: number;
  /** "small" = tap default, "big" = held. Mutates while held. */
  size: "small" | "big";
  /** Performance timestamp (ms) — used for tap-vs-existing crystal detection. */
  born: number;
  /** Set when the user re-taps this crystal — triggers the shatter exit. */
  shattering?: boolean;
}

export interface Bubble {
  id: number;
  x: number;
  y: number;
}

// Density caps cut HARD (Alex: still too many — "limite leur nombre ET temps").
// A handful of crystals max, a short bubble trail → tasteful sparkle, never a
// screen full of shards even when hammering the screen.
export const MAX_CRYSTALS = 6;
export const MAX_BUBBLES = 12;
// Mini-crystals leave quickly (was 6s) so they can't pile up — exit stays a
// smooth fade (see CrystalMark exit), just brief.
export const CRYSTAL_TTL_MS = 2200;
export const BUBBLE_TTL_MS = 800;
export const HOLD_BLOOM_MS = 350;
// Throttle the slide-trail harder so a fast swirl doesn't spray bubbles.
export const BUBBLE_THROTTLE_MS = 120;
export const SHATTER_HIT_RADIUS_PCT = 6;
