/**
 * Per-kind particle rendering. Dispatched on `Particle.kind` from the rAF
 * loop in PremiumTouchLayer.tsx.
 *
 * 2026-06-07 — the bloom "petal" kind was rewritten: the old single-ellipse
 * pinned-to-finger look reads "coded" and stiff. The new one builds the
 * petal from three concentric soft layers (halo / body / sheen) using
 * radial gradients + sin sway, so it drifts like a real petal in light.
 * A "pollen" kind was added for the dust motes scattered around the burst.
 */

import type { Particle } from "./types";
import { lerpC, rgba } from "./types";

export interface RenderCtx {
  ctx: CanvasRenderingContext2D;
  scene: string;
  pal: { c1: number[]; c2: number[] };
  now: number;
}

export function renderParticle(p: Particle, alpha: number, age: number, c: RenderCtx): void {
  switch (p.kind) {
    case "ring":    return drawRing(p, alpha, age, c);
    case "wisp":    return drawWisp(p, alpha, age, c);
    case "spiral":  return drawSpiral(p, alpha, age, c);
    case "bubble":  return drawBubble(p, alpha, c);
    case "fish":    return drawFish(p, alpha, c);
    case "spark":   return drawSpark(p, alpha, age, c);
    case "chevron": return drawChevron(p, alpha, c);
    case "dot":     return drawDot(p, alpha, c);
    case "photon":  return drawPhoton(p, alpha, c);
    case "blot":    return drawBlot(p, alpha, age, c);
    case "petal":   return drawPetal(p, alpha, c);
    case "pollen":  return drawPollen(p, alpha, age, c);
    default:        return drawDefault(p, alpha, age, c);
  }
}

function drawRing(p: Particle, alpha: number, age: number, { ctx, pal }: RenderCtx) {
  const radius = 4 + age * 35;
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(pal.c1, alpha * 0.6 * (1 - age));
  ctx.lineWidth = 2 * (1 - age);
  ctx.stroke();
}

function drawWisp(p: Particle, alpha: number, age: number, { ctx, pal }: RenderCtx) {
  // The phantom wisp drifts gently — mutate velocity, then draw a soft disc.
  p.vx += (Math.random() - 0.5) * 0.12;
  p.vy -= 0.015;
  const radius = p.size * (1 + age * 2);
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = rgba(lerpC(pal.c1, pal.c2, age), alpha * 0.35);
  ctx.fill();
}

function drawSpiral(p: Particle, alpha: number, age: number, { ctx, pal }: RenderCtx) {
  const spiralAge = age * 4;
  p.vx += Math.cos(spiralAge) * 0.08;
  p.vy += Math.sin(spiralAge) * 0.08 + 0.02;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fillStyle = rgba(lerpC(pal.c1, pal.c2, age), alpha * 0.9);
  ctx.fill();
}

function drawBubble(p: Particle, alpha: number, { ctx, pal }: RenderCtx) {
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(pal.c1, alpha * 0.75);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = rgba([255, 255, 255], alpha * 0.55);
  ctx.fill();
}

function drawFish(p: Particle, alpha: number, { ctx, pal }: RenderCtx) {
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
}

function drawSpark(p: Particle, alpha: number, age: number, { ctx, pal }: RenderCtx) {
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
}

function drawChevron(p: Particle, alpha: number, { ctx, pal }: RenderCtx) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot ?? 0);
  ctx.strokeStyle = rgba(pal.c1, alpha * 0.85);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-p.size, 0); ctx.lineTo(0, -p.size * 0.6); ctx.lineTo(p.size, 0);
  ctx.stroke();
  ctx.restore();
}

function drawDot(p: Particle, alpha: number, { ctx, pal }: RenderCtx) {
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fillStyle = rgba(pal.c1, alpha);
  ctx.fill();
}

function drawPhoton(p: Particle, alpha: number, { ctx, now }: RenderCtx) {
  const hue = (now * 0.001 + p.x * 0.01) % 1;
  const colours = [
    [255,  60,  60], [255, 160,  50], [255, 235,  50],
    [ 60, 230,  90], [ 60, 150, 255], [180,  80, 255],
  ];
  const colour = colours[Math.floor(hue * colours.length) % colours.length];
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fillStyle = rgba(colour, alpha * 0.95);
  ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = rgba([255, 255, 255], alpha);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function drawBlot(p: Particle, alpha: number, age: number, { ctx, pal }: RenderCtx) {
  const radius = p.size * (1 + age * 1.6);
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = rgba(pal.c2, alpha * 0.28);
  ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = rgba(pal.c1, alpha * 0.72);
  ctx.fill();
}

/**
 * Bloom petal — SMOOTHER + LESS CODED look (2026-06-07):
 *  1. A wide radial-gradient halo behind the petal (soft glow, not a hard
 *     outline) — the petal "lights" the canvas around it.
 *  2. A body layer drawn with a radial gradient that fades to translucent
 *     at the edge — replaces the flat-edge ellipse so the silhouette is
 *     never a hard cookie-cutter shape.
 *  3. A tiny opaque inner stripe (the petal vein) gives it depth without
 *     adding sharpness.
 *  4. The whole thing sways with sin() while drifting — no pinned drag.
 */
function drawPetal(p: Particle, alpha: number, { ctx, pal, now }: RenderCtx) {
  const c = p.c1 ?? pal.c1;
  // Gentle horizontal sway as the petal drifts, slightly different per petal.
  const sway = Math.sin((now - p.born) * 0.004 + p.size) * 8;
  const drift = Math.cos((now - p.born) * 0.003 + p.size * 0.7) * 3;
  ctx.save();
  ctx.translate(p.x + sway, p.y + drift);
  ctx.rotate((p.rot ?? 0));

  // 1) Halo — wide soft radial gradient (lights nearby pixels).
  const haloR = p.size * 3.0;
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
  halo.addColorStop(0, rgba(c, alpha * 0.32));
  halo.addColorStop(0.55, rgba(c, alpha * 0.10));
  halo.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(0, 0, haloR * 0.85, haloR, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2) Body — radial gradient fades to translucent at the edge.
  const bodyR = p.size;
  const body = ctx.createRadialGradient(0, -p.size * 0.4, 0, 0, 0, bodyR * 1.8);
  body.addColorStop(0, rgba([255, 255, 255], alpha * 0.55));
  body.addColorStop(0.25, rgba(c, alpha * 0.92));
  body.addColorStop(0.85, rgba(c, alpha * 0.55));
  body.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyR, bodyR * 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3) Inner vein — a tiny opaque stripe for depth.
  ctx.beginPath();
  ctx.ellipse(0, -p.size * 0.3, p.size * 0.18, p.size * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba([255, 255, 255], alpha * 0.42);
  ctx.fill();

  ctx.restore();
}

/** Bloom pollen mote — bright dot with a soft warm halo. */
function drawPollen(p: Particle, alpha: number, age: number, { ctx }: RenderCtx) {
  const fade = 1 - age * 0.6;
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
  ctx.fillStyle = rgba([255, 240, 180], alpha * 0.22 * fade);
  ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fillStyle = rgba([255, 230, 150], alpha * 0.88);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function drawDefault(p: Particle, alpha: number, age: number, { ctx, scene, pal }: RenderCtx) {
  if (scene === "emberforge") {
    p.vx += (Math.random() - 0.5) * 0.2;
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
