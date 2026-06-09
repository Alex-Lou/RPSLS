/**
 * ArenaMatchSplash — cinematic intro shown for ~1.8s before the match
 * UI takes over.
 *
 * Replaces the bland "Match en préparation…" text with a fighting-game
 * face-off: player avatar slides in from the left, CPU portrait
 * slides in from the right, "VS" pulses in the centre, then a brief
 * "GO!" beat tips the camera into the board. Pure CSS/motion, no asset
 * dependency beyond the existing avatar resolution.
 */

import { motion } from "motion/react";

export interface ArenaMatchSplashProps {
  playerName: string;
  playerAvatar?: string;
}

export function ArenaMatchSplash({ playerName, playerAvatar }: ArenaMatchSplashProps) {
  const isImg = playerAvatar && (
    playerAvatar.startsWith("/") || playerAvatar.startsWith("http") || playerAvatar.startsWith("data:")
  );
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 relative overflow-hidden">
      {/* Backdrop: violet/fuchsia radial that pulses once. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.3] }}
        transition={{ duration: 1.8 }}
        style={{
          background: "radial-gradient(50% 40% at 50% 50%, rgba(168,85,247,0.55) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-[11px] uppercase tracking-[0.35em] font-black text-fuchsia-300/90 relative"
      >
        ⚡ Constellation Pro ⚡
      </motion.div>

      {/* Face-off row: player on the left, VS in the middle, CPU on the right */}
      <div className="flex items-center justify-center gap-3 relative mt-1">
        <motion.div
          initial={{ x: -120, opacity: 0, scale: 0.6 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 18 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-emerald-400/70 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            {isImg ? (
              <img src={playerAvatar} alt="" className="w-full h-full object-cover" draggable={false} />
            ) : playerAvatar ? (
              <span className="text-3xl">{playerAvatar}</span>
            ) : (
              <span className="text-3xl">🧙</span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider font-black text-emerald-300 truncate max-w-[64px]">
            {playerName}
          </span>
        </motion.div>

        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
          animate={{ scale: [0.3, 1.4, 1, 1.05, 1], opacity: 1, rotate: [-10, 6, 0] }}
          transition={{ delay: 0.55, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="text-3xl sm:text-4xl font-black tracking-[0.1em] bg-gradient-to-br from-fuchsia-300 via-amber-300 to-rose-300 bg-clip-text text-transparent"
          style={{ filter: "drop-shadow(0 2px 14px rgba(244,114,182,0.6))" }}
        >
          VS
        </motion.div>

        <motion.div
          initial={{ x: 120, opacity: 0, scale: 0.6 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 18 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-rose-400/70 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-lg shadow-rose-500/30">
            <span className="text-3xl">🤖</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-black text-rose-300">
            CPU
          </span>
        </motion.div>
      </div>

      {/* Goal hint */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95, duration: 0.3 }}
        className="text-xs text-ink-muted text-center max-w-xs mt-2"
      >
        Premier héros à <span className="text-rose-300 font-black">0 ❤</span> perd.
        Invoque, lance des sorts, joue intelligent.
      </motion.div>

      {/* "GO!" beat at the end — Alex feedback 2026-06-09 point #7 : durée
       *  étendue (0.45s → 1.2s) + scale plus dramatique pour faire durer
       *  le plaisir du suspense. Le SPLASH_MS dans ArenaGame est bumpé en
       *  conséquence (1800 → 2600ms). */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.4, 1.5, 1.15, 1.08, 1] }}
        transition={{ delay: 1.35, duration: 1.2, ease: "easeOut", times: [0, 0.18, 0.4, 0.7, 1] }}
        className="absolute bottom-12 left-0 right-0 text-center text-5xl font-black tracking-[0.25em] text-amber-300"
        style={{ filter: "drop-shadow(0 0 22px rgba(252,211,77,0.95))" }}
      >
        GO !
      </motion.div>
    </div>
  );
}
