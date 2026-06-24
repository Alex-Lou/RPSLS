/**
 * StormRain — HEAVY falling rain for the Tempest Fury (storm) backdrop.
 *
 * A dense gravity-driven downpour: ~280 wind-slanted streaks across 3 parallax
 * depths that fall FAST and hard, with splash rings at impact. Bright white-cyan
 * so the rain is unmistakable against any dark storm scene.
 *
 * Perf: one canvas, rAF paused on tab-hide + in combat. DPR capped at 2.
 */

import { useEffect, useRef } from "react";
import { menuFxSuppressed } from "../fx/menuFx";
import { useStore } from "../store/store";
import { gfxDensity } from "../graphics/graphicsQuality";

interface Drop { x: number; y: number; len: number; speed: number; w: number; a: number }
interface Splash { x: number; y: number; t: number }

const WIND = 2.2;

export function StormRain() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // Player intensity for the storm set — read from the store, used as a
  // density multiplier on the drop count (Profile > Intensité — Tempest Fury
  // slider). 1.0 = the shipping look; the slider clamps to [0.4, 1.6].
  const intensity = useStore((s) => s.player.premiumIntensity?.["storm"] ?? 1.0);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  // When the slider value changes, re-seed the drops with the new density.
  // Cheap: just dispatches a resize event that the main effect already
  // listens to (it calls resize() which rebuilds the drops array). No need
  // to tear down the canvas / rAF loop.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("resize"));
    }
  }, [intensity]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1, raf = 0;
    const drops: Drop[] = [];
    const splashes: Splash[] = [];

    // Spawn x-range bounds — recomputed in resize() so we can use them inside
    // makeDrop without recomputing per-drop. Math: every drop has the same
    // trajectory angle (dx/dy = 1/WIND), so to cover the BOTTOM-LEFT corner
    // (0, h), a drop must spawn at x ≈ -h/WIND while still high in y. Without
    // pushing xMin that far left, the lower-left becomes a dry triangle —
    // the bug Alex flagged. xMax stays close to w because drops drifting past
    // the right edge get respawned by the `x > w + 60` check anyway.
    let xMin = 0, xMax = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      xMin = -Math.ceil(h / WIND) - 40;
      xMax = w + 40;
      // Density: target the same ~1 drop per 1200 visible-pixel² at intensity
      // 1.0, but apply a STEEP curve to the slider so extremes really pop.
      //   - intensity 0.1 → ~10 % visible → barely a sprinkle (Alex's ask).
      //   - intensity 1.0 → baseline.
      //   - intensity 2.0 → ~3 × the baseline → torrential.
      // The cube curve keeps the centre of the slider close to baseline
      // while making the ends feel dramatic. Min floor lowered from 40 to
      // 4 so the minimum is genuinely whisper-quiet.
      const spawnW = xMax - xMin;
      const baseTarget = Math.round((spawnW * h) / 1200);
      const k = intensityRef.current;
      // Pseudo-cubic curve: k^1.4 on the low side (so 0.1 -> ~0.04), and
      // linear-ish above 1.0. Branchless via mix(low, high, step).
      const curved = k < 1.0 ? Math.pow(k, 1.6) : k * k * 0.85 + 0.15;
      // Palier perf (par appareil) : réduit AUSSI le nombre de gouttes
      // (low=0.45 / medium=0.75 / high=1), en plus de l'intensité joueur.
      const target = Math.max(4, Math.round(baseTarget * curved * gfxDensity()));
      drops.length = 0;
      for (let i = 0; i < target; i++) drops.push(makeDrop(true));
    };

    function makeDrop(anyY: boolean): Drop {
      const layer = Math.random();
      return {
        x: xMin + Math.random() * (xMax - xMin),
        y: anyY ? Math.random() * h : -30 - Math.random() * 300,
        len: 22 + layer * 38,
        speed: 14 + layer * 22,
        w: 1.0 + layer * 1.8,
        a: 0.35 + layer * 0.50,
      };
    }

    const frame = () => {
      if (menuFxSuppressed()) { ctx.clearRect(0, 0, w, h); raf = requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (const d of drops) {
        d.y += d.speed;
        d.x += d.speed / WIND;
        // Respawn when leaving the bottom OR drifting off the right edge —
        // without the second condition, drops that exit right keep rising
        // their y until y > h, leaving a dead band on the right side.
        if (d.y > h || d.x > xMax) {
          if (d.y > h && Math.random() < 0.45) splashes.push({ x: d.x, y: h - 2 - Math.random() * 6, t: performance.now() });
          // makeDrop already picks x within [xMin, xMax] — don't override it
          // with the old narrow range (that's what kept the lower-left dry).
          Object.assign(d, makeDrop(false));
        }
        ctx.strokeStyle = `rgba(210,230,245,${d.a})`;
        ctx.lineWidth = d.w;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len / WIND, d.y - d.len);
        ctx.stroke();
      }
      const now = performance.now();
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        const age = (now - s.t) / 400;
        if (age >= 1) { splashes.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(220,235,250,${0.6 * (1 - age)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2 + age * 10, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };

    const onVis = () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 z-[1] pointer-events-none"
    />
  );
}
