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
 *   bloom      → soft burst of drifting petals on tap + continuous petal +
 *                pollen trail on drag (density scales with the intensity
 *                slider — the OLD "single pinned petal" was retired
 *                2026-06-07: too "coded", didn't react to intensity)
 *
 * One <canvas>, single rAF, DPR capped at 2. Suppressed in combat.
 *
 * Per-scene logic lives in ./touchFx/{spawners,trails,particles,types}.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { menuFxSuppressed } from "../fx/menuFx";
import { useStore } from "../store/store";
import { renderParticle, type RenderCtx } from "./touchFx/particles";
import {
  spawnBloomBurst,
  spawnGenericTap,
  spawnStream,
} from "./touchFx/spawners";
import { renderTrail } from "./touchFx/trails";
import {
  MAX_PARTS,
  MAX_POINTS,
  PALETTE,
  TRAIL_LIFE,
  type Particle,
  type Pt,
  type PremiumFxScene,
} from "./touchFx/types";

export { isPremiumFxScene, type PremiumFxScene } from "./touchFx/types";

export function PremiumTouchLayer({ scene, active }: { scene: PremiumFxScene; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ptsRef = useRef<Pt[]>([]);
  const partsRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const downRef = useRef(false);
  const lastEmit = useRef(0);
  // Live FX intensity multiplier from the slider — scales bloom burst size,
  // pollen density, and the stream throttle for every scene.
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

    const push = (p: Particle) => {
      const parts = partsRef.current;
      parts.push(p);
      if (parts.length > MAX_PARTS) parts.shift();
    };

    const addPoint = (x: number, y: number) => {
      if (menuFxSuppressed()) return;
      ptsRef.current.push({ x, y, t: performance.now() });
      if (ptsRef.current.length > MAX_POINTS) ptsRef.current.shift();
      spawnStream(scene, x, y, intensityRef.current, push, lastEmit);
      ensureRAF();
    };

    const tapPop = (x: number, y: number) => {
      if (menuFxSuppressed()) return;
      if (scene === "bloom") {
        spawnBloomBurst(x, y, intensityRef.current, push);
      } else {
        spawnGenericTap(x, y, push);
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
    };
    const onUp = () => { downRef.current = false; };

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

      renderTrail(scene, { ctx, pts, now, pal });

      if (parts.length) {
        const rc: RenderCtx = { ctx, scene, pal, now };
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          const age = (now - p.born) / p.life;
          if (age >= 1) { parts.splice(i, 1); continue; }
          p.x += p.vx; p.y += p.vy;
          if (p.rot != null && p.vrot != null) p.rot += p.vrot;
          const alpha = 1 - age;
          renderParticle(p, alpha, age, rc);
        }
      }

      if (pts.length || parts.length || downRef.current) {
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
      try { ctx.clearRect(0, 0, w, h); } catch { /* canvas gone */ }
    };
  }, [active, scene]);

  if (!active) return null;
  return createPortal(
    <canvas ref={canvasRef} aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />,
    document.body,
  );
}
