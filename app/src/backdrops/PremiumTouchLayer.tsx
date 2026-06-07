/**
 * PremiumTouchLayer — unique finger-following FX for each premium backdrop.
 *
 * Each scene has a TRULY DISTINCT visual identity:
 *   storm      → electric ribbon with lightning branches forking off
 *   eclipse    → golden ribbon with expanding ring pulses
 *   phantom    → wide smoky mist trail (multi-stroke soft cloud)
 *   emberforge → hot molten trail (white core → orange → red ash) + rising embers
 *   tempus     → clockwork sand grains spiraling around the path
 *   coral      → rising bubbles + tiny luminous fish drifting in the trail
 *   rust       → shower of orange sparks cascading away
 *   void       → thin geometric wireframe (lines + chevron marks)
 *   prism      → spectral rainbow ribbon (R→V) decomposing along the path
 *   ink        → bleeding ink stroke with paper-soak halo
 *   bloom      → tap spawns ONE big petal that drifts down; long-press drags it
 *
 * One <canvas>, single rAF, DPR capped at 2. Suppressed in combat.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { menuFxSuppressed } from "../fx/menuFx";
import { useStore } from "../store/store";

export type PremiumFxScene =
  | "storm" | "tempus" | "emberforge" | "phantom" | "eclipse"
  // 2026-06-07 lineup
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom";

const FX_SCENES: ReadonlySet<string> = new Set([
  "storm", "tempus", "emberforge", "phantom", "eclipse",
  "coral", "rust", "void", "prism", "ink", "bloom",
]);

export function isPremiumFxScene(s: string | undefined): s is PremiumFxScene {
  return typeof s === "string" && FX_SCENES.has(s);
}

interface Pt { x: number; y: number; t: number }
interface Particle {
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
  /** Tag for the active drag target (bloom). */
  dragId?: number;
}

const TRAIL_LIFE = 950;
const MAX_POINTS = 120;
const MAX_PARTS = 200;

const PALETTE: Record<PremiumFxScene, { c1: number[]; c2: number[] }> = {
  storm:      { c1: [155, 246, 255], c2: [160, 120, 255] },
  eclipse:    { c1: [255, 240, 192], c2: [212, 167, 69] },
  phantom:    { c1: [200, 210, 230], c2: [130, 155, 190] },
  emberforge: { c1: [255, 230, 160], c2: [255,  90,  20] },
  tempus:     { c1: [232, 207, 160], c2: [184, 149, 106] },
  // 2026-06-07 lineup — chosen so the trail reads contrasted on the scene.
  coral:      { c1: [174, 242, 232], c2: [255, 107, 107] },
  rust:       { c1: [255, 180, 100], c2: [139,  69,  19] },
  void:       { c1: [255, 255, 255], c2: [180, 180, 180] },
  prism:      { c1: [255, 255, 255], c2: [139,  92, 246] },
  ink:        { c1: [ 26,  26,  26], c2: [140, 140, 140] },
  bloom:      { c1: [255, 126, 179], c2: [129, 199, 132] },
};

// Bloom petal colour rotation — each tap pulls the next colour, so the
// player sees a different petal every time. Bold enough to read on the
// pastel sky background.
const BLOOM_PETAL_COLOURS: number[][] = [
  [255, 126, 179],  // rose pétale
  [255, 217, 102],  // jaune pollen
  [255, 138, 101],  // pêche
  [186, 104, 200],  // violet doux
  [129, 199, 132],  // vert tilleul
  [102, 187, 255],  // bleu myosotis
  [255, 200, 180],  // pêche pâle
  [240, 130, 200],  // magenta clair
];

export function PremiumTouchLayer({ scene, active }: { scene: PremiumFxScene; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ptsRef = useRef<Pt[]>([]);
  const partsRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const downRef = useRef(false);
  const lastEmit = useRef(0);
  // For bloom drag: id of the petal currently being dragged (or -1).
  const dragIdRef = useRef<number>(-1);
  const dragCounterRef = useRef<number>(0);
  // For bloom: index into the petal colour palette (rotating).
  const bloomCounterRef = useRef<number>(0);
  // Live FX intensity multiplier from the slider — scales the emit rate so a
  // sliding finger on Storm at 1.6× pours markedly more sparks than at 0.4×.
  const intensity = useStore((s) => s.player.premiumIntensity?.[scene] ?? 1.0);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pal = PALETTE[scene];

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const ensureRAF = () => { if (rafRef.current == null) rafRef.current = requestAnimationFrame(frame); };

    const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
    const lerpC = (c1: number[], c2: number[], t: number) => [
      Math.round(c1[0] * (1 - t) + c2[0] * t),
      Math.round(c1[1] * (1 - t) + c2[1] * t),
      Math.round(c1[2] * (1 - t) + c2[2] * t),
    ];

    const spawnStream = (x: number, y: number) => {
      const now = performance.now();
      // Throttle interval scales INVERSELY with intensity — same steep
      // curve as the rain so the slider's ends feel genuinely different.
      // 0.1× -> ~250 ms (one spawn every ¼ s), 1.0× -> 14 ms baseline,
      // 2.0× -> 5 ms (4 × baseline density).
      const k = intensityRef.current;
      const curved = k < 1.0 ? Math.pow(k, 1.6) : k * k * 0.85 + 0.15;
      const interval = 14 / Math.max(0.04, curved);
      if (now - lastEmit.current < interval) return;
      lastEmit.current = now;
      const parts = partsRef.current;
      const push = (p: Particle) => { parts.push(p); if (parts.length > MAX_PARTS) parts.shift(); };

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
        // Bubbles rising + tiny fish darting away
        if (Math.random() < 0.55) {
          push({ x: x + rnd(10), y: y + rnd(10), vx: rnd(0.4), vy: -1.0 - Math.random() * 1.4, born: now, life: 1400 + Math.random() * 700, size: 3 + Math.random() * 4, kind: "bubble" });
        }
        if (Math.random() < 0.32) {
          const a = Math.random() * Math.PI * 2, s = 1.4 + Math.random() * 1.4;
          push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 900 + Math.random() * 400, size: 2.5 + Math.random() * 2, kind: "fish" });
        }
      } else if (scene === "rust") {
        // Hot orange sparks cascading downward + outward
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + rnd(1.0);
          const s = 1.5 + Math.random() * 2.8;
          push({ x: x + rnd(6), y: y + rnd(6), vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 600 + Math.random() * 400, size: 1.6 + Math.random() * 1.8, kind: "spark" });
        }
      } else if (scene === "void") {
        // Sparse white chevron marks at touch points + tiny dots
        if (Math.random() < 0.35) push({ x, y, vx: 0, vy: 0, born: now, life: 1300, size: 10 + Math.random() * 8, kind: "chevron", rot: Math.random() * Math.PI * 2 });
        if (Math.random() < 0.5) push({ x: x + rnd(4), y: y + rnd(4), vx: 0, vy: 0, born: now, life: 800, size: 1.3, kind: "dot" });
      } else if (scene === "prism") {
        // Photon beads in 6 spectral colours travelling outward
        if (Math.random() < 0.45) {
          const a = Math.random() * Math.PI * 2, s = 1.8 + Math.random() * 1.6;
          push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 1100, size: 2.4 + Math.random() * 1.5, kind: "photon" });
        }
      } else if (scene === "ink") {
        // Slow ink droplets bleeding into the paper — large blurry blobs
        if (Math.random() < 0.4) {
          push({ x: x + rnd(8), y: y + rnd(8), vx: rnd(0.18), vy: rnd(0.18), born: now, life: 1600 + Math.random() * 800, size: 6 + Math.random() * 6, kind: "blot" });
        }
      }
      // bloom: no stream — petals are spawned on TAP only (see onDown).
    };

    /** Bloom: spawn ONE big coloured petal that will fall slowly. Optionally
     *  tag it as the drag target so it follows the finger while held. */
    const spawnBloomPetal = (x: number, y: number, asDrag: boolean) => {
      const idx = bloomCounterRef.current++ % BLOOM_PETAL_COLOURS.length;
      const colour = BLOOM_PETAL_COLOURS[idx];
      const dragId = asDrag ? ++dragCounterRef.current : -1;
      partsRef.current.push({
        x, y,
        // Held petals have zero base velocity (pos overwritten by drag).
        // Released petals fall slowly with a sin-driven sway (handled in render).
        vx: asDrag ? 0 : rnd(0.2),
        vy: asDrag ? 0 : 0.35 + Math.random() * 0.25,
        born: performance.now(),
        // Long enough to feel deliberate: ~3.5s if falling, longer if held.
        life: 3500,
        size: 18 + Math.random() * 8,
        kind: "petal",
        c1: colour,
        rot: Math.random() * Math.PI * 2,
        vrot: rnd(0.04),
        dragId,
      });
      if (asDrag) dragIdRef.current = dragId;
      if (partsRef.current.length > MAX_PARTS) partsRef.current.shift();
    };

    const addPoint = (x: number, y: number) => {
      if (menuFxSuppressed()) return;
      ptsRef.current.push({ x, y, t: performance.now() });
      if (ptsRef.current.length > MAX_POINTS) ptsRef.current.shift();
      spawnStream(x, y);
      ensureRAF();
    };

    const tapPop = (x: number, y: number) => {
      if (menuFxSuppressed()) return;
      const now = performance.now();
      // Bloom replaces the generic tap-pop with a single big coloured petal
      // that the finger can drag while held.
      if (scene === "bloom") {
        spawnBloomPetal(x, y, true);
        ensureRAF();
        return;
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, s = 0.8 + Math.random() * 1.2;
        partsRef.current.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 360, size: 2 });
      }
      ensureRAF();
    };

    const onDown = (e: PointerEvent) => {
      downRef.current = true;
      addPoint(e.clientX, e.clientY);
      tapPop(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (!downRef.current) return;
      addPoint(e.clientX, e.clientY);
      // Bloom drag: the active petal follows the finger.
      if (scene === "bloom" && dragIdRef.current >= 0) {
        const parts = partsRef.current;
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].dragId === dragIdRef.current) {
            parts[i].x = e.clientX;
            parts[i].y = e.clientY;
            // Reset birth so the life timer doesn't fire while dragging.
            parts[i].born = performance.now();
            break;
          }
        }
      }
    };
    const onUp = () => {
      downRef.current = false;
      // Bloom: release the active petal — it starts falling from its last pos.
      if (scene === "bloom" && dragIdRef.current >= 0) {
        const parts = partsRef.current;
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].dragId === dragIdRef.current) {
            parts[i].vx = rnd(0.25);
            parts[i].vy = 0.4 + Math.random() * 0.3;
            parts[i].dragId = -1;
            // Reset birth so it lives its full lifespan after release.
            parts[i].born = performance.now();
            break;
          }
        }
        dragIdRef.current = -1;
      }
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });

    const frame = () => {
      const now = performance.now();
      const pts = ptsRef.current;
      while (pts.length && now - pts[0].t > TRAIL_LIFE) pts.shift();
      const parts = partsRef.current;

      ctx.clearRect(0, 0, w, h);

      // ── Per-scene trail rendering ──
      // Bloom has NO trail — the petal IS the interaction. Skip.
      if (pts.length >= 2 && scene !== "bloom") {
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        if (scene === "storm") {
          ctx.globalCompositeOperation = "lighter";
          for (const pass of [1, 0]) {
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const age = (now - b.t) / TRAIL_LIFE;
              const alpha = Math.max(0, 1 - age);
              if (alpha <= 0) continue;
              const frac = i / pts.length;
              ctx.beginPath();
              const jx = rnd(4), jy = rnd(4);
              ctx.moveTo(a.x, a.y);
              ctx.quadraticCurveTo((a.x + b.x) / 2 + jx, (a.y + b.y) / 2 + jy, b.x, b.y);
              if (pass === 1) { ctx.strokeStyle = rgba(pal.c2, alpha * 0.5); ctx.lineWidth = 5 * (0.4 + frac * 0.6) * 3.2; }
              else { ctx.strokeStyle = rgba(pal.c1, alpha * 0.95); ctx.lineWidth = 5 * (0.4 + frac * 0.6); }
              ctx.stroke();
              if (pass === 0 && Math.random() < 0.04 && alpha > 0.5) {
                const angle = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() - 0.5) * 1.5;
                const bLen = 15 + Math.random() * 25;
                ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(b.x + Math.cos(angle) * bLen + rnd(5), b.y + Math.sin(angle) * bLen + rnd(5));
                ctx.strokeStyle = rgba(pal.c1, alpha * 0.7);
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
            }
          }
          ctx.globalCompositeOperation = "source-over";

        } else if (scene === "eclipse") {
          ctx.globalCompositeOperation = "lighter";
          for (const pass of [1, 0]) {
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const age = (now - b.t) / TRAIL_LIFE;
              const alpha = Math.max(0, 1 - age);
              if (alpha <= 0) continue;
              const frac = i / pts.length;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
              if (pass === 1) { ctx.strokeStyle = rgba(pal.c2, alpha * 0.45); ctx.lineWidth = 6 * (0.4 + frac * 0.6) * 3.5; }
              else { ctx.strokeStyle = rgba(pal.c1, alpha * 0.9); ctx.lineWidth = 6 * (0.4 + frac * 0.6); }
              ctx.stroke();
            }
          }
          ctx.globalCompositeOperation = "source-over";

        } else if (scene === "phantom") {
          for (let layer = 0; layer < 4; layer++) {
            const ox = rnd(6) * (layer * 0.5), oy = rnd(6) * (layer * 0.5);
            const layerAlpha = [0.15, 0.25, 0.35, 0.18][layer];
            const layerWidth = [28, 20, 12, 32][layer];
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const age = (now - b.t) / TRAIL_LIFE;
              const alpha = Math.max(0, 1 - age) * layerAlpha;
              if (alpha <= 0.01) continue;
              ctx.beginPath();
              ctx.moveTo(a.x + ox, a.y + oy);
              ctx.lineTo(b.x + ox, b.y + oy);
              ctx.strokeStyle = rgba(lerpC(pal.c1, pal.c2, layer / 3), alpha);
              ctx.lineWidth = layerWidth * (0.5 + (i / pts.length) * 0.5);
              ctx.stroke();
            }
          }

        } else if (scene === "emberforge") {
          ctx.globalCompositeOperation = "lighter";
          for (const pass of [1, 0]) {
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const age = (now - b.t) / TRAIL_LIFE;
              const alpha = Math.max(0, 1 - age);
              if (alpha <= 0) continue;
              const frac = i / pts.length;
              const hot = lerpC([255, 255, 220], pal.c2, age * 0.8);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
              if (pass === 1) { ctx.strokeStyle = rgba(pal.c2, alpha * 0.4); ctx.lineWidth = 4 * (0.4 + frac * 0.6) * 3.5; }
              else { ctx.strokeStyle = rgba(hot, alpha * 0.95); ctx.lineWidth = 4 * (0.4 + frac * 0.6); }
              ctx.stroke();
            }
          }
          ctx.globalCompositeOperation = "source-over";

        } else if (scene === "tempus") {
          for (const pass of [1, 0]) {
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const age = (now - b.t) / TRAIL_LIFE;
              const alpha = Math.max(0, 1 - age);
              if (alpha <= 0) continue;
              const frac = i / pts.length;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
              if (pass === 1) { ctx.strokeStyle = rgba(pal.c2, alpha * 0.3); ctx.lineWidth = 4 * (0.4 + frac * 0.6) * 3; }
              else { ctx.strokeStyle = rgba(pal.c1, alpha * 0.85); ctx.lineWidth = 4 * (0.4 + frac * 0.6); }
              ctx.stroke();
              if (pass === 0 && i % 6 === 0 && alpha > 0.3) {
                const dx = b.x - a.x, dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len * 6, ny = dx / len * 6;
                ctx.beginPath();
                ctx.moveTo(b.x - nx, b.y - ny);
                ctx.lineTo(b.x + nx, b.y + ny);
                ctx.strokeStyle = rgba(pal.c1, alpha * 0.5);
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
            }
          }

        } else if (scene === "coral") {
          // Glassy turquoise water trail — soft single-pass line, brighter
          // near the head (recent points). Reads like a swimming wake.
          ctx.globalCompositeOperation = "lighter";
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const age = (now - b.t) / TRAIL_LIFE;
            const alpha = Math.max(0, 1 - age);
            if (alpha <= 0) continue;
            const frac = i / pts.length;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.55);
            ctx.lineWidth = 9 * (0.3 + frac * 0.7);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";

        } else if (scene === "rust") {
          // Sooty smouldering trail — narrow dark line + amber rim. Pairs
          // with the spark particles spawning above.
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const age = (now - b.t) / TRAIL_LIFE;
            const alpha = Math.max(0, 1 - age);
            if (alpha <= 0) continue;
            const frac = i / pts.length;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.85);
            ctx.lineWidth = 3.5 * (0.4 + frac * 0.6);
            ctx.stroke();
          }

        } else if (scene === "void") {
          // Pure thin white line. The point of Void is precision and
          // negative space, so the trail is one minimal stroke — no glow.
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const age = (now - b.t) / TRAIL_LIFE;
            const alpha = Math.max(0, 1 - age);
            if (alpha <= 0) continue;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.85);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

        } else if (scene === "prism") {
          // SPECTRAL RIBBON — 6 colour bands offset perpendicular to the
          // trail, each shifted a couple of pixels so the rainbow reads.
          const spectrum = [
            [255,  32,  32],  // red
            [255, 140,   0],  // orange
            [255, 230,   0],  // yellow
            [ 32, 232,  60],  // green
            [ 32, 130, 255],  // blue
            [165,  60, 255],  // violet
          ];
          ctx.globalCompositeOperation = "lighter";
          for (let band = 0; band < spectrum.length; band++) {
            const offset = (band - 2.5) * 2.5;
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const age = (now - b.t) / TRAIL_LIFE;
              const alpha = Math.max(0, 1 - age);
              if (alpha <= 0) continue;
              const dx = b.x - a.x, dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const nx = -dy / len, ny = dx / len;
              ctx.beginPath();
              ctx.moveTo(a.x + nx * offset, a.y + ny * offset);
              ctx.lineTo(b.x + nx * offset, b.y + ny * offset);
              ctx.strokeStyle = rgba(spectrum[band], alpha * 0.75);
              ctx.lineWidth = 1.8;
              ctx.stroke();
            }
          }
          ctx.globalCompositeOperation = "source-over";

        } else if (scene === "ink") {
          // Wet brush stroke + paper bleed halo (2 passes: blurry halo
          // first then sharp core on top).
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const age = (now - b.t) / TRAIL_LIFE;
            const alpha = Math.max(0, 1 - age);
            if (alpha <= 0) continue;
            const frac = i / pts.length;
            // Soft halo (the bleed).
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(pal.c2, alpha * 0.22);
            ctx.lineWidth = 22 * (0.4 + frac * 0.6);
            ctx.stroke();
            // Sharp core.
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.95);
            ctx.lineWidth = 6 * (0.4 + frac * 0.6);
            ctx.stroke();
          }
        }
      }

      // ── Particles ──
      if (parts.length) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          const isDragged = p.kind === "petal" && p.dragId === dragIdRef.current && p.dragId >= 0;
          const age = isDragged ? 0 : (now - p.born) / p.life;
          if (age >= 1) { parts.splice(i, 1); continue; }
          if (!isDragged) {
            p.x += p.vx; p.y += p.vy;
            if (p.rot != null && p.vrot != null) p.rot += p.vrot;
          }
          const alpha = isDragged ? 1 : 1 - age;

          if (p.kind === "ring") {
            const radius = 4 + age * 35;
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.6 * (1 - age));
            ctx.lineWidth = 2 * (1 - age);
            ctx.stroke();
          } else if (p.kind === "wisp") {
            p.vx += rnd(0.06); p.vy -= 0.015;
            const radius = p.size * (1 + age * 2);
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = rgba(lerpC(pal.c1, pal.c2, age), alpha * 0.35);
            ctx.fill();
          } else if (p.kind === "spiral") {
            const spiralAge = age * 4;
            p.vx += Math.cos(spiralAge) * 0.08;
            p.vy += Math.sin(spiralAge) * 0.08 + 0.02;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = rgba(lerpC(pal.c1, pal.c2, age), alpha * 0.9);
            ctx.fill();
          } else if (p.kind === "bubble") {
            // Coral bubble: hollow ring with a tiny highlight, drifts up.
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.75);
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.beginPath(); ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = rgba([255, 255, 255], alpha * 0.55);
            ctx.fill();
          } else if (p.kind === "fish") {
            // Coral micro-fish: bright dot with directional tail.
            const speed = Math.hypot(p.vx, p.vy) || 1;
            const nx = p.vx / speed, ny = p.vy / speed;
            ctx.globalCompositeOperation = "lighter";
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = rgba(pal.c1, alpha * 0.95);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p.x - nx * p.size * 1.4, p.y - ny * p.size * 1.4);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.55);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
          } else if (p.kind === "spark") {
            // Rust spark: bright tail behind a fading hot dot.
            ctx.globalCompositeOperation = "lighter";
            const hot = lerpC([255, 240, 200], pal.c2, age * 0.85);
            const trailX = p.x - p.vx * 4, trailY = p.y - p.vy * 4;
            ctx.beginPath();
            ctx.moveTo(trailX, trailY);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = rgba(hot, alpha * 0.85);
            ctx.lineWidth = p.size * 0.9;
            ctx.stroke();
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = rgba([255, 255, 220], alpha);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          } else if (p.kind === "chevron") {
            // Void chevron — pair of thin diagonal strokes, slowly rotating.
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot ?? 0);
            ctx.strokeStyle = rgba(pal.c1, alpha * 0.85);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-p.size, 0); ctx.lineTo(0, -p.size * 0.6); ctx.lineTo(p.size, 0);
            ctx.stroke();
            ctx.restore();
          } else if (p.kind === "dot") {
            // Void dot — pure white pixel that lingers briefly.
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = rgba(pal.c1, alpha);
            ctx.fill();
          } else if (p.kind === "photon") {
            // Prism photon — bright bead with a spectral-coloured tail.
            const hue = (now * 0.001 + p.x * 0.01) % 1;
            // Cheap rainbow lookup via the spectral palette.
            const colours = [
              [255,  60,  60], [255, 160,  50], [255, 235,  50],
              [ 60, 230,  90], [ 60, 150, 255], [180,  80, 255],
            ];
            const colour = colours[Math.floor(hue * colours.length) % colours.length];
            ctx.globalCompositeOperation = "lighter";
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = rgba(colour, alpha * 0.95);
            ctx.fill();
            // Soft white core
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = rgba([255, 255, 255], alpha);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          } else if (p.kind === "blot") {
            // Ink blot — large dark blob that GROWS as it bleeds into paper.
            const radius = p.size * (1 + age * 1.6);
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = rgba(pal.c2, alpha * 0.28);
            ctx.fill();
            ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = rgba(pal.c1, alpha * 0.72);
            ctx.fill();
          } else if (p.kind === "petal") {
            // Bloom coloured petal — large rotating ellipse, the visual
            // climax of the bloom touch interaction. When held the petal
            // sticks to the finger and never ages; on release it falls.
            const c = p.c1 ?? pal.c1;
            const sway = Math.sin((now - p.born) * 0.004 + p.size) * 6;
            ctx.save();
            ctx.translate(p.x + (isDragged ? 0 : sway), p.y);
            ctx.rotate(p.rot ?? 0);
            // Soft halo behind the petal.
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 1.6, p.size * 2.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = rgba(c, alpha * 0.18);
            ctx.fill();
            // Petal body.
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 1.8, 0, 0, Math.PI * 2);
            ctx.fillStyle = rgba(c, alpha * 0.92);
            ctx.fill();
            // Inner highlight stripe.
            ctx.beginPath();
            ctx.ellipse(0, -p.size * 0.4, p.size * 0.4, p.size * 0.9, 0, 0, Math.PI * 2);
            ctx.fillStyle = rgba([255, 255, 255], alpha * 0.32);
            ctx.fill();
            ctx.restore();
          } else {
            // Default particle (storm sparks, eclipse flares, emberforge embers, tap pops).
            if (scene === "emberforge") {
              p.vx += rnd(0.1);
              const hot = lerpC([255, 255, 200], pal.c2, age);
              ctx.globalCompositeOperation = "lighter";
              ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + age * 0.3), 0, Math.PI * 2);
              ctx.fillStyle = rgba(hot, alpha);
              ctx.fill();
              ctx.globalCompositeOperation = "source-over";
            } else if (scene === "storm") {
              ctx.globalCompositeOperation = "lighter";
              ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = rgba(lerpC(pal.c1, pal.c2, age), alpha);
              ctx.fill();
              ctx.globalCompositeOperation = "source-over";
            } else {
              ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (scene === "eclipse" ? 1 + age * 0.8 : 1), 0, Math.PI * 2);
              ctx.fillStyle = rgba(lerpC(pal.c1, pal.c2, age), alpha);
              ctx.fill();
            }
          }
        }
      }

      // Bloom: keep the rAF alive as long as a dragged petal exists, even
      // when no movement is happening (the petal must stay visible & rotate).
      const hasDrag = scene === "bloom" && dragIdRef.current >= 0;
      if (pts.length || parts.length || downRef.current || hasDrag) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
      }
    };

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ptsRef.current = []; partsRef.current = [];
      dragIdRef.current = -1;
      try { ctx.clearRect(0, 0, w, h); } catch { /* canvas gone */ }
    };
  }, [active, scene]);

  if (!active) return null;
  return createPortal(
    <canvas ref={canvasRef} aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />,
    document.body,
  );
}

function rnd(amp: number) { return (Math.random() - 0.5) * 2 * amp; }
