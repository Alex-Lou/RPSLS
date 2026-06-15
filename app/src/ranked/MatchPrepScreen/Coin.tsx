import { motion, AnimatePresence } from "motion/react";

/* ─────────── The coin ─────────── */

const COIN = 120;
/** Coin-flip total duration. Was 2.6s — felt draggy. 1.6s lands punchier
 *  without losing the toss arc. Used by both the parent state machine (timer
 *  → setPhase("landed")) and the Coin component (all motion transitions). */
export const FLIP_DURATION_MS = 1600;
const FLIP_DURATION_S = FLIP_DURATION_MS / 1000;

export function Coin({
  phase, winner, youTheme, oppTheme,
}: {
  phase: "idle" | "flipping" | "landed";
  winner: "you" | "opp" | null;
  youTheme: { primary: string; secondary: string };
  oppTheme: { primary: string; secondary: string };
}) {
  // 4 spins is still plenty of "wow" inside 1.6s — the previous 8 spins felt
  // dragged out (and cost 2880° of GPU compositing).
  const SPINS = 4;
  const target = phase === "idle" ? 0 : SPINS * 360 + (winner === "opp" ? 180 : 0);
  const winColor = winner === "opp" ? oppTheme.primary : youTheme.primary;

  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 900, width: COIN + 48, height: COIN + 64 }}>
      {/* Drop shadow that pinches when the coin is at apex. blur-lg instead
          of blur-xl — smaller filter region, same read. */}
      <motion.div
        aria-hidden
        animate={{
          opacity: phase === "flipping" ? [0.22, 0.08, 0.32] : 0.25,
          scaleX: phase === "flipping" ? [1, 0.55, 1] : 1,
          scaleY: phase === "flipping" ? [1, 0.4, 1] : 1,
        }}
        transition={{ duration: FLIP_DURATION_S, ease: "easeInOut" }}
        className="absolute rounded-full blur-lg"
        style={{ width: COIN * 0.8, height: 18, bottom: 4, background: "rgba(0,0,0,0.6)", willChange: "transform" }}
      />

      {/* Halo — single static blur-2xl (was blur-3xl + animated scale loop
          ×infinity, which kept the GPU busy for the whole flip). */}
      <motion.div
        aria-hidden
        animate={{ opacity: phase === "landed" ? 0.7 : phase === "flipping" ? 0.45 : 0.3 }}
        transition={{ duration: 0.3 }}
        className="absolute rounded-full blur-2xl"
        style={{ width: COIN * 1.25, height: COIN * 1.25, background: `radial-gradient(circle, ${winColor}77, transparent 70%)` }}
      />

      {/* Landing shockwave — single ring (was two). */}
      <AnimatePresence>
        {phase === "landed" && (
          <motion.div
            key="shock"
            aria-hidden
            initial={{ opacity: 0.75, scale: 0.4 }}
            animate={{ opacity: 0, scale: 2.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{ width: COIN, height: COIN, border: `2.5px solid ${winColor}` }}
          />
        )}
      </AnimatePresence>

      {/* Landing sparkles — 8 (was 14). Same coverage, half the DOM. */}
      <AnimatePresence>
        {phase === "landed" && Array.from({ length: 8 }).map((_, i) => {
          const ang = (i / 8) * Math.PI * 2;
          const dist = 60 + (i % 2) * 22;
          return (
            <motion.span
              key={"sp" + i}
              aria-hidden
              initial={{ opacity: 1, x: 0, y: 0, scale: 1.2 }}
              animate={{ opacity: 0, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist - 8, scale: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute rounded-full"
              style={{
                width: 3, height: 3,
                background: i % 2 === 0 ? "#fff" : winColor,
                boxShadow: `0 0 8px ${winColor}`,
              }}
            />
          );
        })}
      </AnimatePresence>

      {/* The coin — parabolic toss arc, snappier. willChange tells the
          compositor to promote the layer upfront so the first keyframe
          doesn'\''t hitch on mid-range phones. */}
      <motion.div
        animate={
          phase === "idle"
            ? { y: [0, -6, 0] }
            : { y: [0, -75, -55, 4, 0], scale: [1, 1.12, 1.05, 1.04, 1] }
        }
        transition={
          phase === "idle"
            ? { duration: 3, ease: "easeInOut", repeat: Infinity }
            : { duration: FLIP_DURATION_S, ease: [0.22, 0.68, 0.36, 1], times: [0, 0.35, 0.6, 0.9, 1] }
        }
        style={{ width: COIN, height: COIN, willChange: "transform" }}
        className="relative"
      >
        <motion.div
          animate={{
            rotateY: target,
            // rotateX kept for the tumble feel — single keyframe pair instead
            // of the previous 5-stop list (lighter on the animator).
            rotateX: phase === "flipping" ? [0, 18, 0] : 0,
          }}
          transition={
            phase === "idle"
              ? { duration: 0 }
              : {
                  rotateY: { duration: FLIP_DURATION_S, ease: [0.18, 0.6, 0.32, 1] },
                  rotateX: { duration: FLIP_DURATION_S, ease: "easeInOut" },
                }
          }
          style={{ transformStyle: "preserve-3d", width: COIN, height: COIN, willChange: "transform" }}
          className="relative"
        >
          <CoinFace theme={youTheme} label="TOI" rotate={0} size={COIN} />
          <CoinFace theme={oppTheme} label="ADV" rotate={180} size={COIN} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function CoinFace({
  theme, label, rotate, size,
}: {
  theme: { primary: string; secondary: string };
  label: string;
  rotate: number;
  size: number;
}) {
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
      style={{
        background: `
          conic-gradient(from 160deg at 50% 50%,
            color-mix(in oklab, ${theme.primary} 90%, #fff) 0deg,
            ${theme.primary} 90deg,
            color-mix(in oklab, ${theme.secondary} 80%, #000) 180deg,
            ${theme.primary} 270deg,
            color-mix(in oklab, ${theme.primary} 90%, #fff) 360deg
          )`,
        transform: `rotateY(${rotate}deg)`,
        backfaceVisibility: "hidden",
        border: "3.5px solid rgba(255,255,255,0.5)",
        boxShadow: `
          inset 0 0 18px rgba(0,0,0,0.5),
          inset 0 4px 8px rgba(255,255,255,0.45),
          inset 0 -3px 6px rgba(0,0,0,0.3),
          0 10px 30px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Inner relief ring */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 8,
          border: "1.5px solid rgba(255,255,255,0.2)",
          boxShadow: "inset 0 1px 3px rgba(255,255,255,0.15)",
        }}
      />
      {/* Glint sweep — faster during flip for strobing effect */}
      <motion.div
        aria-hidden
        animate={{ x: ["-140%", "140%"] }}
        transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8 }}
        className="absolute inset-y-0 w-2/5 -skew-x-12"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
      />
      {/* Edge notch marks for coin authenticity */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r = size / 2 - 4;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: size / 2 + Math.cos(a) * r - 1,
              top: size / 2 + Math.sin(a) * r - 1,
              width: 2, height: 2,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
            }}
          />
        );
      })}
      <span
        className="relative text-xl font-black text-white"
        style={{
          fontFamily: "var(--font-headline)",
          letterSpacing: "0.06em",
          textShadow: "0 2px 6px rgba(0,0,0,0.7), 0 0 12px rgba(255,255,255,0.15)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
