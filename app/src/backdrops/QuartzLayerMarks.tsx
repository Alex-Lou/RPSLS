/**
 * Rendus des éléments de la couche interactive Quartz (bulle, cristal) —
 * extraits verbatim de QuartzInteractiveLayer.tsx.
 */

import { motion } from "motion/react";
import { BUBBLE_TTL_MS, type Crystal } from "./quartzLayerConfig";

/** Small drifting bubble — gold rim, hollow centre, drifts up + fades. */
export function BubbleMark({ x, y }: { x: number; y: number }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1, 0.9], y: [0, -22, -38] }}
      transition={{ duration: BUBBLE_TTL_MS / 1000, ease: "easeOut" }}
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: 9,
        height: 9,
        translate: "-50% -50%",
        border: "1.2px solid #fde9ff",
        background:
          "radial-gradient(circle, rgba(255,233,225,0.55) 30%, rgba(251,191,36,0.18) 70%, transparent 100%)",
        boxShadow: "0 0 10px rgba(251,191,36,0.55)",
      }}
    />
  );
}

/** A summoned crystal — same shape as the backdrop shards (hex sliver),
 *  but spawn-grown with an aura + sparkle. Mutates to "big" on hold,
 *  shatters with a gold burst when re-tapped. */
export function CrystalMark({ c }: { c: Crystal }) {
  const big = c.size === "big";
  const W = big ? 56 : 36;
  const H = W * 1.55;
  // Shatter: tilt + scale-out with a small burst overlay.
  const variants = c.shattering
    ? { opacity: [1, 0], scale: [big ? 1.45 : 1, 0.4], rotate: [c.rot, c.rot + 25] }
    : {
        opacity: [0, 1, big ? 0.95 : 0.9],
        scale: [0.2, big ? 1.45 : 1, big ? 1.4 : 0.96],
        rotate: [c.rot - 30, c.rot, c.rot],
      };
  const dur = c.shattering ? 0.55 : 0.85;
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.2 }}
      animate={variants}
      // Smooth-but-quick disappearance: a soft fade + slight shrink over 0.4s
      // (was inheriting the 0.85s spawn curve) so crystals clear the screen
      // promptly without a hard pop.
      exit={{ opacity: 0, scale: 0.55, transition: { duration: 0.4, ease: "easeOut" } }}
      transition={{ duration: dur, ease: c.shattering ? "easeIn" : [0.16, 1, 0.3, 1] }}
      className="absolute pointer-events-none"
      style={{
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: W,
        height: H,
        translate: "-50% -50%",
        willChange: "transform, opacity",
      }}
    >
      {/* Aura — soft warm halo so the spawn reads as "lit from within". */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(circle, rgba(251,207,128,0.65), rgba(253,233,255,0.25) 50%, transparent 75%)",
        }}
      />
      {/* The shard. */}
      <svg viewBox="-10 -16 20 32" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`uqz-${c.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde9ff" stopOpacity="0.98" />
            <stop offset="40%" stopColor="#dbe7ff" stopOpacity="0.85" />
            <stop offset="80%" stopColor="#c8aef0" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3b2c5a" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M 0 -16 L 7 -6 L 6 12 L -6 12 L -7 -6 Z" fill={`url(#uqz-${c.id})`} />
        <path d="M 0 -14 L 3 -6 L 2 10 L -2 10 L -3 -6 Z" fill="#ffffff" fillOpacity="0.5" />
      </svg>
      {/* Shatter burst — 8 little gold motes radiating out. */}
      {c.shattering && (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * 36, y: Math.sin(a) * 36, opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: 3, height: 3,
                  background: i % 2 ? "#fde68a" : "#fbcf80",
                  boxShadow: "0 0 8px rgba(251,191,36,0.95)",
                  translate: "-50% -50%",
                }}
              />
            );
          })}
        </>
      )}
    </motion.span>
  );
}
