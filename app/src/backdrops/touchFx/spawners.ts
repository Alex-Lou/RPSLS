/**
 * Per-scene particle spawners. Each function takes the touch position, a
 * push() callback that enforces MAX_PARTS, and the live intensity for
 * scenes whose spawn rate depends on it.
 *
 * The keystone change here (2026-06-07) is the new BLOOM model: petals are
 * no longer pinned to the finger as a single dragged shape (the old "coded"
 * feel). Instead, a TAP emits a soft burst of N drifting petals and DRAG
 * emits a continuous stream of small petals + pollen motes — both gated by
 * `intervalForIntensity()` so the slider visibly controls density.
 */

import type { Particle } from "./types";
import {
  BLOOM_PETAL_COLOURS,
  intervalForIntensity,
  rnd,
} from "./types";

type Push = (p: Particle) => void;

/** Per-move spawn for every scene except bloom (handled separately). */
export function spawnStream(
  scene: string,
  x: number,
  y: number,
  intensity: number,
  push: Push,
  lastEmitRef: { current: number },
): void {
  const now = performance.now();
  const interval = intervalForIntensity(intensity, 14);
  if (now - lastEmitRef.current < interval) return;
  lastEmitRef.current = now;

  if (scene === "storm") {
    if (Math.random() < 0.65) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
      push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 220 + Math.random() * 180, size: 1.5 + Math.random() });
    }
  } else if (scene === "eclipse") {
    if (Math.random() < 0.35) push({ x, y, vx: 0, vy: 0, born: now, life: 700, size: 3, kind: "ring" });
    if (Math.random() < 0.4) push({ x: x + rnd(8), y: y + rnd(8), vx: rnd(0.3), vy: -0.2 + rnd(0.3), born: now, life: 800 + Math.random() * 400, size: 2 + Math.random() * 3 });
  } else if (scene === "phantom") {
    push({ x: x + rnd(14), y: y + rnd(14), vx: rnd(0.5), vy: -0.5 - Math.random() * 0.8, born: now, life: 1100 + Math.random() * 600, size: 4 + Math.random() * 5, kind: "wisp" });
  } else if (scene === "emberforge") {
    for (let i = 0; i < 3; i++) {
      push({ x: x + rnd(12), y: y + rnd(12), vx: rnd(0.6), vy: -1.0 - Math.random() * 1.5, born: now, life: 900 + Math.random() * 700, size: 2 + Math.random() * 3.5 });
    }
  } else if (scene === "tempus") {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      push({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a + 1.2) * 1.2, vy: Math.sin(a + 1.2) * 1.2 + 0.5, born: now, life: 1200 + Math.random() * 600, size: 1.5 + Math.random() * 2, kind: "spiral" });
    }
  } else if (scene === "coral") {
    if (Math.random() < 0.55) {
      push({ x: x + rnd(10), y: y + rnd(10), vx: rnd(0.4), vy: -1.0 - Math.random() * 1.4, born: now, life: 1400 + Math.random() * 700, size: 3 + Math.random() * 4, kind: "bubble" });
    }
    if (Math.random() < 0.32) {
      const a = Math.random() * Math.PI * 2, s = 1.4 + Math.random() * 1.4;
      push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 900 + Math.random() * 400, size: 2.5 + Math.random() * 2, kind: "fish" });
    }
  } else if (scene === "rust") {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + rnd(1.0);
      const s = 1.5 + Math.random() * 2.8;
      push({ x: x + rnd(6), y: y + rnd(6), vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 600 + Math.random() * 400, size: 1.6 + Math.random() * 1.8, kind: "spark" });
    }
  } else if (scene === "void") {
    if (Math.random() < 0.35) push({ x, y, vx: 0, vy: 0, born: now, life: 1300, size: 10 + Math.random() * 8, kind: "chevron", rot: Math.random() * Math.PI * 2 });
    if (Math.random() < 0.5) push({ x: x + rnd(4), y: y + rnd(4), vx: 0, vy: 0, born: now, life: 800, size: 1.3, kind: "dot" });
  } else if (scene === "prism") {
    if (Math.random() < 0.45) {
      const a = Math.random() * Math.PI * 2, s = 1.8 + Math.random() * 1.6;
      push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 1100, size: 2.4 + Math.random() * 1.5, kind: "photon" });
    }
  } else if (scene === "ink") {
    if (Math.random() < 0.4) {
      push({ x: x + rnd(8), y: y + rnd(8), vx: rnd(0.18), vy: rnd(0.18), born: now, life: 1600 + Math.random() * 800, size: 6 + Math.random() * 6, kind: "blot" });
    }
  } else if (scene === "bloom") {
    spawnBloomDrag(x, y, intensity, push, now);
  }
}

/**
 * Continuous bloom emission triggered by drag/swipe. Throttle ALREADY
 * applied by the spawnStream caller — this just decides what particles to
 * spawn at one tick, scaling counts/sizes with the live intensity.
 */
function spawnBloomDrag(
  x: number,
  y: number,
  intensity: number,
  push: Push,
  now: number,
): void {
  const k = Math.max(0.4, Math.min(2.0, intensity));
  // One small petal every tick + a tiny pollen mote at higher intensity.
  // The petal drifts gently with sin sway (no pinned drag id any more).
  const colour = BLOOM_PETAL_COLOURS[Math.floor(Math.random() * BLOOM_PETAL_COLOURS.length)];
  const petalSize = 6 + Math.random() * 4 + k * 2.5;
  push({
    x: x + rnd(6),
    y: y + rnd(6),
    vx: rnd(0.2),
    vy: 0.25 + Math.random() * 0.35,
    born: now,
    life: 2200 + Math.random() * 900,
    size: petalSize,
    kind: "petal",
    c1: colour,
    rot: Math.random() * Math.PI * 2,
    vrot: rnd(0.025),
  });
  // Pollen dust — small bright motes, count scales with intensity.
  const pollenCount = k > 1.1 ? 2 : k > 0.7 ? 1 : Math.random() < 0.4 ? 1 : 0;
  for (let i = 0; i < pollenCount; i++) {
    push({
      x: x + rnd(14),
      y: y + rnd(14),
      vx: rnd(0.4),
      vy: -0.2 + rnd(0.4),
      born: now,
      life: 900 + Math.random() * 500,
      size: 1.4 + Math.random() * 1.6,
      kind: "pollen",
    });
  }
}

/**
 * Bloom TAP: emit a soft burst of N drifting petals around the touch. N
 * scales with intensity (1 at min, up to 6 at max) so the slider visibly
 * changes how lush a single tap looks.
 */
export function spawnBloomBurst(
  x: number,
  y: number,
  intensity: number,
  push: Push,
): void {
  const now = performance.now();
  const k = Math.max(0.4, Math.min(2.0, intensity));
  // 1 petal at k=0.4, ~3 at k=1.0, ~6 at k=2.0.
  const count = Math.max(1, Math.round(0.5 + k * 2.6));
  const startIdx = Math.floor(Math.random() * BLOOM_PETAL_COLOURS.length);
  for (let i = 0; i < count; i++) {
    const colour = BLOOM_PETAL_COLOURS[(startIdx + i) % BLOOM_PETAL_COLOURS.length];
    // Burst petals fly outward at a soft angle from the touch — they curl
    // away from each other and slow into a drifting fall.
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const radius = 4 + Math.random() * 14;
    push({
      x: x + Math.cos(ang) * radius,
      y: y + Math.sin(ang) * radius,
      vx: Math.cos(ang) * (0.8 + Math.random() * 0.6),
      vy: Math.sin(ang) * (0.6 + Math.random() * 0.4) + 0.25,
      born: now,
      life: 2600 + Math.random() * 900,
      size: 9 + Math.random() * 5 + k * 3,
      kind: "petal",
      c1: colour,
      rot: Math.random() * Math.PI * 2,
      vrot: rnd(0.04),
    });
  }
  // A halo of bright pollen flecks around the burst.
  const halo = Math.round(2 + k * 4);
  for (let i = 0; i < halo; i++) {
    const ang = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 28;
    push({
      x: x + Math.cos(ang) * radius,
      y: y + Math.sin(ang) * radius,
      vx: Math.cos(ang) * 0.4,
      vy: Math.sin(ang) * 0.3 - 0.15,
      born: now,
      life: 700 + Math.random() * 500,
      size: 1.6 + Math.random() * 1.8,
      kind: "pollen",
    });
  }
}

/** Generic 5-particle pop used for every non-bloom tap. */
export function spawnGenericTap(x: number, y: number, push: Push): void {
  const now = performance.now();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, s = 0.8 + Math.random() * 1.2;
    push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 360, size: 2 });
  }
}
