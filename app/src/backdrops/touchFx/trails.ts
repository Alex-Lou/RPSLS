/**
 * Per-scene trail rendering. The trail is the swept ribbon following the
 * finger; each scene paints it differently (storm = jagged blue, ink =
 * brush + bleed, prism = spectral bands, etc.). Bloom is intentionally
 * excluded — its identity is the drifting petals, not a line.
 */

import type { Pt } from "./types";
import { lerpC, PRISM_SPECTRUM, rgba, TRAIL_LIFE } from "./types";

interface TrailCtx {
  ctx: CanvasRenderingContext2D;
  pts: Pt[];
  now: number;
  pal: { c1: number[]; c2: number[] };
}

export function renderTrail(scene: string, c: TrailCtx): void {
  const { ctx, pts } = c;
  if (pts.length < 2 || scene === "bloom") return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (scene === "storm") return renderStormTrail(c);
  if (scene === "eclipse") return renderEclipseTrail(c);
  if (scene === "phantom") return renderPhantomTrail(c);
  if (scene === "emberforge") return renderEmberforgeTrail(c);
  if (scene === "tempus") return renderTempusTrail(c);
  if (scene === "coral") return renderCoralTrail(c);
  if (scene === "rust") return renderRustTrail(c);
  if (scene === "void") return renderVoidTrail(c);
  if (scene === "prism") return renderPrismTrail(c);
  if (scene === "ink") return renderInkTrail(c);
}

function renderStormTrail({ ctx, pts, now, pal }: TrailCtx): void {
  ctx.globalCompositeOperation = "lighter";
  for (const pass of [1, 0]) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const age = (now - b.t) / TRAIL_LIFE;
      const alpha = Math.max(0, 1 - age);
      if (alpha <= 0) continue;
      const frac = i / pts.length;
      ctx.beginPath();
      const jx = (Math.random() - 0.5) * 8, jy = (Math.random() - 0.5) * 8;
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
        ctx.lineTo(b.x + Math.cos(angle) * bLen + (Math.random() - 0.5) * 10, b.y + Math.sin(angle) * bLen + (Math.random() - 0.5) * 10);
        ctx.strokeStyle = rgba(pal.c1, alpha * 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function renderEclipseTrail({ ctx, pts, now, pal }: TrailCtx): void {
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
}

function renderPhantomTrail({ ctx, pts, now, pal }: TrailCtx): void {
  for (let layer = 0; layer < 4; layer++) {
    const ox = (Math.random() - 0.5) * 12 * (layer * 0.5);
    const oy = (Math.random() - 0.5) * 12 * (layer * 0.5);
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
}

function renderEmberforgeTrail({ ctx, pts, now, pal }: TrailCtx): void {
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
}

function renderTempusTrail({ ctx, pts, now, pal }: TrailCtx): void {
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
}

function renderCoralTrail({ ctx, pts, now, pal }: TrailCtx): void {
  // Glassy turquoise water trail — soft single-pass line, brighter near the
  // head (recent points). Reads like a swimming wake.
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
}

function renderRustTrail({ ctx, pts, now, pal }: TrailCtx): void {
  // Sooty smouldering trail — narrow dark line + amber rim.
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
}

function renderVoidTrail({ ctx, pts, now, pal }: TrailCtx): void {
  // Pure thin white line — precision and negative space.
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
}

function renderPrismTrail({ ctx, pts, now }: TrailCtx): void {
  // 6 colour bands offset perpendicular to the trail.
  ctx.globalCompositeOperation = "lighter";
  for (let band = 0; band < PRISM_SPECTRUM.length; band++) {
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
      ctx.strokeStyle = rgba(PRISM_SPECTRUM[band], alpha * 0.75);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function renderInkTrail({ ctx, pts, now, pal }: TrailCtx): void {
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
