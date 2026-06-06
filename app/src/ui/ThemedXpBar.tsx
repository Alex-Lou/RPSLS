/**
 * ThemedXpBar — the player-progression bar, ranked-grade.
 *
 * The old bar was a flat gradient — austere against animated themes like
 * Quartz, Casino or Aurora. This one:
 *   - sits on a soft inner-shadow "groove" the bar fills (depth, not flat)
 *   - tracks --theme-primary / --theme-secondary so it adopts the active
 *     palette (no hardcoded violet)
 *   - paints a slow diagonal gloss sweep while progress > 0 (idle ambience)
 *   - releases sparks + a wide glow flash on every XP gain (gain ambience)
 *   - shows 4 milestone ticks so the player reads "1/4, 1/2, 3/4 of the way"
 *     at a glance — turns the bar into a small dashboard, not a slider.
 *
 * Same component is reused for ranked LP (`variant="lp"`) so the look stays
 * coherent across the two progression surfaces.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface ThemedXpBarProps {
  /** Current value within the level (e.g. xpInLevel). */
  current: number;
  /** Value needed to fill the bar (e.g. xpForNext). */
  total: number;
  /** Short label rendered just above the bar (e.g. "LVL 4" / "BRONZE 1000"). */
  label?: string;
  /** Number to flash when the value changes (+12 XP, +20 LP, …). Pass the
   *  *delta*, not the new total — the parent decides when to fire. */
  gainPulse?: number;
  /** Height variant. "lp" makes it slightly slimmer and changes the gloss
   *  tilt so the two bars sit next to each other without echoing. */
  variant?: "xp" | "lp";
  /** Extra classes (margin overrides, etc.). */
  className?: string;
}

export function ThemedXpBar({
  current, total, label, gainPulse, variant = "xp", className = "",
}: ThemedXpBarProps) {
  const progress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  // Flash whenever gainPulse changes value (not strictly > 0 — supports −LP too).
  const [flash, setFlash] = useState<number | null>(null);
  const lastGain = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (gainPulse !== undefined && gainPulse !== lastGain.current) {
      if (gainPulse !== 0) setFlash(gainPulse);
      lastGain.current = gainPulse;
      const id = setTimeout(() => setFlash(null), 1800);
      return () => clearTimeout(id);
    }
  }, [gainPulse]);

  const isLp = variant === "lp";
  const heightClass = isLp ? "h-4" : "h-5";

  return (
    <div className={"relative w-full " + className}>
      {label && (
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-ink-muted">
            {label}
          </span>
          <span className="text-[10px] tabular-nums font-bold text-ink-faint">
            {current.toLocaleString("fr-FR")} / {total.toLocaleString("fr-FR")}
          </span>
        </div>
      )}

      <div
        className={
          "relative w-full " + heightClass + " rounded-full overflow-hidden " +
          "bg-black/40 ring-1 ring-white/8 " +
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.05)]"
        }
      >
        {/* Milestone ticks: 25/50/75% — show the structure. */}
        {[0.25, 0.5, 0.75].map((p) => (
          <span key={p} aria-hidden
            className="absolute top-1 bottom-1 w-px bg-white/15"
            style={{ left: `${p * 100}%` }}
          />
        ))}

        {/* Fill — theme-coloured gradient. */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ width: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }}
          style={{
            background:
              "linear-gradient(90deg, var(--theme-primary), color-mix(in oklab, var(--theme-primary) 30%, var(--theme-secondary)), var(--theme-secondary))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.3)",
          }}
        >
          {/* Idle gloss sweep — slow diagonal highlight. */}
          {progress > 0 && (
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(" + (isLp ? "100deg" : "115deg") +
                  ", transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)",
                backgroundSize: "240% 100%",
                animation: "xpbar-gloss 5.4s linear infinite",
                mixBlendMode: "screen",
              }}
            />
          )}
        </motion.div>

        {/* Gain flash — wide bright sweep across the WHOLE bar (not just the
            fill) so the player's eye catches it even at near-empty. */}
        <AnimatePresence>
          {flash !== null && (
            <motion.span
              key={`flash-${flash}`}
              aria-hidden
              initial={{ opacity: 0, x: "-30%" }}
              animate={{ opacity: [0, 0.95, 0], x: "110%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="absolute inset-y-0 w-1/2"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--theme-secondary), transparent)",
                filter: "blur(2px)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Halo pulse on gain — fills the rounded outline with a glow. */}
        <AnimatePresence>
          {flash !== null && (
            <motion.span
              key={`halo-${flash}`}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow:
                  "0 0 14px var(--theme-primary), inset 0 0 10px color-mix(in oklab, var(--theme-secondary) 60%, transparent)",
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* +N chip floating up from the right edge of the fill. */}
      <AnimatePresence>
        {flash !== null && flash !== 0 && (
          <motion.span
            key={`chip-${flash}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: -10 }}
            exit={{ opacity: 0, y: -22 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className={
              "absolute right-1 top-0 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums shadow-lg pointer-events-none " +
              (flash > 0
                ? "text-zinc-900 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300"
                : "text-white bg-gradient-to-r from-rose-500 to-pink-500")
            }
          >
            {flash > 0 ? "+" : ""}{flash}
            <span className="ml-0.5 opacity-80">{isLp ? "LP" : "XP"}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// Single keyframe injected once for the gloss sweep — used by every instance.
if (typeof document !== "undefined" && !document.getElementById("themed-xpbar-keyframes")) {
  const style = document.createElement("style");
  style.id = "themed-xpbar-keyframes";
  style.textContent =
    "@keyframes xpbar-gloss { 0% { background-position: 240% 0; } 100% { background-position: -120% 0; } }";
  document.head.appendChild(style);
}
