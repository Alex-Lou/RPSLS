import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { levelFromXp } from "./leveling";
import { useT } from "./i18n";
import { hapticMatchWin } from "./haptic";

const CONFETTI_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#f87171", "#22d3ee"];

/**
 * Global level-up celebration. Mounted once in App so it catches an XP gain
 * from *anywhere* — a match win, a quest claim, a daily claim — and fires a
 * confetti burst + "LEVEL UP" banner the instant the player crosses a level.
 */
export function LevelUpWatcher() {
  const xp = useStore((s) => s.player.xp);
  const level = levelFromXp(xp).level;
  const prev = useRef(level);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  useEffect(() => {
    if (level > prev.current) {
      setCelebrate(level);
      hapticMatchWin();
      const id = window.setTimeout(() => setCelebrate(null), 2800);
      prev.current = level;
      return () => window.clearTimeout(id);
    }
    prev.current = level;
  }, [level]);

  return (
    <AnimatePresence>
      {celebrate !== null && <LevelUpOverlay level={celebrate} />}
    </AnimatePresence>
  );
}

function LevelUpOverlay({ level }: { level: number }) {
  const t = useT();
  // Confetti pieces, computed once for this celebration.
  const pieces = useRef(
    Array.from({ length: 38 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 2,
      delay: Math.random() * 0.18,
      rot: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      dist: 130 + Math.random() * 280,
      drift: (Math.random() - 0.5) * 140,
    })),
  ).current;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x * p.dist + p.drift,
            y: [0, -p.dist * 0.55, p.dist],
            opacity: [1, 1, 0],
            rotate: p.rot,
          }}
          transition={{ duration: 2.2, delay: p.delay, ease: "easeOut" }}
          className="absolute w-2.5 h-2.5 rounded-[2px]"
          style={{ background: p.color }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 10 }}
        animate={{ scale: [0.4, 1.15, 1], opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14 }}
        className="flex flex-col items-center gap-1 px-8 py-5 rounded-3xl bg-zinc-950/80 backdrop-blur-md border border-amber-400/40 shadow-2xl shadow-amber-900/40"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 0.9 }}
          className="text-5xl"
        >
          🎉
        </motion.div>
        <div className="text-2xl font-black tracking-wider bg-gradient-to-br from-amber-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
          {t("levelup.title")}
        </div>
        <div className="text-sm font-bold text-zinc-200">{t("levelup.reached", { n: level })}</div>
      </motion.div>
    </motion.div>
  );
}
