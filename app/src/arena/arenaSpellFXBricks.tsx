/**
 * arenaSpellFXBricks — briques visuelles réutilisables des signatures VFX
 * (transform/opacity + screen blend → fluide WebView, auto-démontées). Extrait
 * de arenaSpellSignatures 2026-06-30 (séparation kit/data, règle <450 lignes).
 */

import { motion } from "motion/react";

/* Particules radiales déterministes (pas de Math.random → SSR/replay sûrs,
 * et même semence = même éclat, ce qui suffit visuellement). */
export function radial(n: number, radius: number, jitter = 0): { x: number; y: number; deg: number }[] {
  const out: { x: number; y: number; deg: number }[] = [];
  for (let i = 0; i < n; i++) {
    const deg = (360 / n) * i;
    const r = radius + (jitter ? ((i % 3) - 1) * jitter : 0);
    const rad = (deg * Math.PI) / 180;
    out.push({ x: Math.cos(rad) * r, y: Math.sin(rad) * r, deg });
  }
  return out;
}

/* ─── Briques réutilisables (transform/opacity only) ─────────────────────── */

export function CoreFlash({ from, to, dur = 0.7 }: { from: string; to: string; dur?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 1, 0], scale: [0.4, 1.7, 2.6] }}
      transition={{ duration: dur, ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
      style={{ background: `radial-gradient(circle, ${from} 0%, ${to} 45%, transparent 72%)`, mixBlendMode: "screen" }}
    />
  );
}

export function Shockwave({ color, delay = 0, dur = 0.7, max = 3.4 }: { color: string; delay?: number; dur?: number; max?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.9, scale: 0.2 }}
      animate={{ opacity: 0, scale: max }}
      transition={{ duration: dur, ease: "easeOut", delay }}
      className="absolute left-1/2 top-1/2 w-32 h-32 -ml-16 -mt-16 rounded-full"
      style={{ border: `2.5px solid ${color}`, boxShadow: `0 0 24px ${color}` }}
    />
  );
}

export function Sparks({ count, radius, color, dur = 0.7, size = 6, inward = false }: { count: number; radius: number; color: string; dur?: number; size?: number; inward?: boolean }) {
  const pts = radial(count, radius, radius * 0.18);
  return (
    <>
      {pts.map((p, i) => (
        <motion.span
          key={i}
          initial={inward ? { opacity: 0, x: p.x, y: p.y, scale: 0.4 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={inward ? { opacity: [0, 1, 0], x: 0, y: 0, scale: 0.3 } : { opacity: 0, x: p.x, y: p.y, scale: 0.3 }}
          transition={{ duration: dur, ease: "easeOut", delay: (i % 4) * 0.03 }}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      ))}
    </>
  );
}

export function GlyphPop({ glyph, color, dur = 0.9 }: { glyph: string; color: string; dur?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.3, rotate: -18 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1.1, 1.5], rotate: [-18, 0, 0, 6] }}
      transition={{ duration: dur, times: [0, 0.3, 0.7, 1], ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl"
      style={{ filter: `drop-shadow(0 0 12px ${color})` }}
    >
      {glyph}
    </motion.span>
  );
}
