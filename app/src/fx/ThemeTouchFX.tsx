import { useEffect, useRef } from "react";
import { menuFxSuppressed } from "./menuFx";
import { useGfxAllows } from "../graphics/graphicsQuality";

/**
 * ThemeTouchFX — a light, theme-coloured particle trail that follows the
 * finger across the MENU surfaces. A small burst on tap, a sparse trail on
 * drag, all tinted with the live theme (--theme-primary / --theme-secondary)
 * so it feels like the background's ambience reacting to your touch.
 *
 * Cheap on mobile:
 *  - One full-screen 2D canvas, additive blending (globalCompositeOperation
 *    "lighter") for a glow without per-particle gradients.
 *  - Two pre-rendered soft-dot sprites (one per theme colour) drawn with
 *    drawImage — no createRadialGradient in the hot loop.
 *  - Hard particle cap; rAF pauses when nothing is alive and when the tab is
 *    hidden; the whole thing unmounts cleanly.
 *
 * Scope: rendered in the shell. It stays quiet while `enabled` is false
 * (App passes false on the Contact page), while any game/deck screen has
 * called useNoMenuFx() (menuFxSuppressed()), and for touches that land inside
 * a [data-no-touchfx] subtree (the open nav drawer).
 */

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; sprite: 0 | 1;
};

function hexToRgb(v: string): [number, number, number] {
  const s = v.trim();
  const m = s.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const rgb = s.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return [168, 85, 247]; // violet fallback
}

export function ThemeTouchFX({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gfxOn = useGfxAllows("menuParticles"); // 'low' → inerte (pas de canvas/rAF/pointeur)

  useEffect(() => {
    if (!enabled || !gfxOn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Soft-dot sprites, one per theme colour, rebuilt when the theme moves ──
    const SPR = 48;
    const makeSprite = (rgb: [number, number, number]) => {
      const c = document.createElement("canvas");
      c.width = c.height = SPR;
      const g = c.getContext("2d")!;
      const grd = g.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
      grd.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`);
      grd.addColorStop(0.35, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.45)`);
      grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, SPR, SPR);
      return c;
    };
    let key = "";
    let sprites: [HTMLCanvasElement, HTMLCanvasElement] = [makeSprite([168, 85, 247]), makeSprite([45, 212, 191])];
    const refreshSprites = () => {
      const cs = getComputedStyle(document.documentElement);
      const p = cs.getPropertyValue("--theme-primary");
      const s = cs.getPropertyValue("--theme-secondary");
      const k = p + "|" + s;
      if (k !== key) { key = k; sprites = [makeSprite(hexToRgb(p)), makeSprite(hexToRgb(s))]; }
    };
    refreshSprites();

    const parts: Particle[] = [];
    const MAX = 140;

    const spawn = (cx: number, cy: number, n: number, energy: number) => {
      for (let i = 0; i < n && parts.length < MAX; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.2 + Math.random() * energy) * dpr;
        parts.push({
          x: cx * dpr, y: cy * dpr,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 0.35 * dpr, // gentle upward drift
          life: 0,
          max: 520 + Math.random() * 520,
          size: (3 + Math.random() * 4) * dpr,
          sprite: Math.random() < 0.5 ? 0 : 1,
        });
      }
    };

    const allowed = (e: PointerEvent): boolean => {
      if (menuFxSuppressed()) return false;
      const t = e.target as Element | null;
      if (t && typeof t.closest === "function" && t.closest("[data-no-touchfx]")) return false;
      return true;
    };

    // Burst on a genuine TAP only — a press that stays put and lifts quickly.
    // A scroll/drag is a long, moving press → no particles (a trail smeared
    // along a scroll looked bad). The colour is read at tap time so it always
    // matches the live theme/background accent.
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = allowed(e) ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onUp = (e: PointerEvent) => {
      const d = down; down = null;
      if (!d) return;
      const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (performance.now() - d.t > 350 || dist > 12) return; // held/moved → scroll
      if (!allowed(e)) return;
      refreshSprites();
      spawn(e.clientX, e.clientY, 16, 1.8);
      ensureRunning();
    };
    const onCancel = () => { down = null; };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });

    let raf = 0;
    let running = false;
    let last = performance.now();
    const ensureRunning = () => {
      if (!running && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const frame = (now: number) => {
      const dt = Math.min(48, now - last); last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        const f = p.life / p.max;
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.018 * dpr;          // soft gravity so the drift eases off
        p.vx *= 0.99; p.vy *= 0.99;   // drag
        const a = (1 - f) * (1 - f);  // ease-out fade
        const r = p.size * (1 + f * 1.4);
        ctx.globalAlpha = a * 0.9;
        ctx.drawImage(sprites[p.sprite], p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (parts.length > 0) { raf = requestAnimationFrame(frame); }
      else { running = false; }
    };

    const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, gfxOn]);

  if (!enabled || !gfxOn) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none z-[45]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
