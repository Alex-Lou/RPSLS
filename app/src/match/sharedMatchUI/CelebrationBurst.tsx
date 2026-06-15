import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BurstCanvas } from "../../fx/LevelUpOverlay";

/**
 * CelebrationBurst — the real celebration. A one-shot, full-screen WebGL
 * shockwave/god-ray/sparkle burst (the very shader that powers the level-up,
 * reused here) PLUS a rich falling-confetti shower layered on top: ~46 pieces
 * with mixed shapes (squares, circles, streamers), per-piece colour, drift,
 * spin and glow. Auto-unmounts after ~3.2s so the GL context never lingers as
 * a persistent second layer over the animated backdrop.
 */
export function CelebrationBurst({ variant = "default" }: { variant?: "default" | "fire" } = {}) {
  const fire = variant === "fire";
  const [show, setShow] = useState(true);
  const pieces = useRef(
    Array.from({ length: 46 }, (_, i) => {
      const shape = i % 5; // 0-1 square, 2 circle, 3-4 streamer
      // Cool multicolour for a normal win; hot reds/oranges/yellows for a
      // tournament victory so the two celebrations feel distinct.
      const coolHues = [150, 275, 45, 330, 190, 50, 0, 110];
      const fireHues = [12, 26, 40, 4, 34, 50, 18, 30];
      return {
        x: (i * 37) % 100,
        hue: (fire ? fireHues : coolHues)[i % 8],
        delay: (i % 12) * 0.045,
        dur: 1.9 + (i % 6) * 0.32,
        rot: ((i * 97) % 900) - 450,
        drift: ((i * 53) % 60) - 30,
        w: shape >= 3 ? 4 : 7 + (i % 3) * 2,
        h: shape >= 3 ? 16 + (i % 3) * 4 : 7 + (i % 3) * 2,
        round: shape === 2,
      };
    }),
  ).current;
  useEffect(() => {
    const id = window.setTimeout(() => setShow(false), 3200);
    return () => window.clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden" aria-hidden>
      <BurstCanvas warm={fire} intensity={fire ? 1.12 : 1} />
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ top: "-8%", opacity: 0, rotate: 0 }}
          animate={{ top: "110%", x: p.drift, opacity: [0, 1, 1, 0.9, 0], rotate: p.rot }}
          transition={{ duration: p.dur, delay: 0.12 + p.delay, ease: [0.25, 0.1, 0.5, 1] }}
          className="absolute block"
          style={{
            left: `${p.x}%`,
            width: p.w,
            height: p.h,
            borderRadius: p.round ? "50%" : 2,
            background: `hsl(${p.hue} 92% 62%)`,
            boxShadow: `0 0 7px hsl(${p.hue} 92% 60% / 0.65)`,
          }}
        />
      ))}
    </div>
  );
}

/** Counts a number up from 0 → `to` (handles negatives) over ~0.7s. */
export function CountUp({ to, durationMs = 700 }: { to: number; durationMs?: number }) {
  const [n, setN] = useState(0);
  const sign = to < 0 ? -1 : 1;
  const target = Math.abs(to);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start == null) start = ts;
      const p = Math.min(1, (ts - start) / durationMs);
      setN(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return <>{sign < 0 ? -n : n}</>;
}
