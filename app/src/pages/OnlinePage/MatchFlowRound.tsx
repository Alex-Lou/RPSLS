import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { useT } from "../../i18n";
import { Hand, MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { type Move, MOVES } from "../../engine/game";
import { DotPulse } from "./StatusAndWaiting";

function TimerRing({
  startedAt,
  durationMs,
  size = 220,
}: {
  startedAt: number | null;
  durationMs: number;
  size?: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!id) id = setInterval(() => setNow(Date.now()), 250); };
    const stop = () => { if (id) { clearInterval(id); id = undefined; } };
    const onVis = () => { if (document.hidden) stop(); else { setNow(Date.now()); start(); } };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;
  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remaining / durationMs));
  const seconds = Math.ceil(remaining / 1000);
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  const urgent = remaining < 3000;
  const critical = remaining < 1000;
  const stroke = critical ? "#f43f5e" : urgent ? "#f59e0b" : "#a78bfa";

  return (
    <svg width={size} height={size} className="absolute inset-0 m-auto pointer-events-none">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={6}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        animate={critical ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
        transition={critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.2 }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono font-black"
        style={{ fontSize: size * 0.28, fill: stroke }}
      >
        {seconds}
      </text>
    </svg>
  );
}

export function PickStage({
  startedAt,
  deadlineMs,
  onPick,
}: {
  startedAt: number | null;
  deadlineMs: number;
  onPick: (mv: Move) => void;
}) {
  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div className="relative w-[220px] h-[220px] flex items-center justify-center">
        <TimerRing startedAt={startedAt} durationMs={deadlineMs} size={220} />
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Pick your move</div>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full">
        {MOVES.map((mv, i) => {
          const pal = MOVE_PALETTE[mv];
          return (
            <motion.button
              key={mv}
              onClick={() => onPick(mv)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileHover={{ y: -4, scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              aria-label={`Pick ${mv}`}
              className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 text-white transition"
              // Dark glass + theme-blended rim — consistent with ranked +
              // casual lanes pickers.
              style={{
                background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
                border: `2px solid ${moveRim(pal.hex)}`,
                boxShadow: `0 0 14px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
              title={mv}
            >
              <MoveGlyph move={mv} className="w-10 h-10 sm:w-12 sm:h-12" />
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold" style={{ color: moveRim(pal.hex) }}>{mv}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function LockedStage({ move }: { move: Move }) {
  return (
    <motion.div
      key="locked"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">
        Locked in
      </div>
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Hand move={move} size="xl" />
      </motion.div>
      <div className="text-sm text-zinc-300 font-medium">
        Waiting for opponent…
      </div>
      <DotPulse />
    </motion.div>
  );
}

export function RevealCountdown() {
  const t = useT();
  return (
    <motion.div
      key="revealcd"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 w-full px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
        {t("online.reveal.label")}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black max-w-full leading-tight">
        {[t("online.reveal.rock"), t("online.reveal.paper"), t("online.reveal.scissors"), t("online.reveal.lizard"), t("online.reveal.spock")].map((w, i) => (
          <motion.span
            key={w}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.13, duration: 0.25 }}
            className="bg-gradient-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent"
          >
            {w}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: [0.7, 1.3, 1] }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent"
      >
        {t("online.reveal.shoot")}
      </motion.div>
    </motion.div>
  );
}

export function RevealStage({
  youMove,
  oppMove,
  outcomeForYou,
  verb,
  opponentName,
}: {
  youMove: Move | null;
  oppMove: Move | null;
  outcomeForYou: "win" | "loss" | "draw" | null;
  verb: string | null;
  opponentName: string;
}) {
  const t = useT();
  // Hit-shake when the verdict lands — only on win/loss, not draw.
  const shake =
    outcomeForYou === "win" || outcomeForYou === "loss"
      ? { x: [0, -6, 6, -4, 4, 0], y: [0, 2, -2, 1, -1, 0] }
      : {};
  return (
    <motion.div
      key="reveal"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, ...shake }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-3 w-full px-2"
    >
      <div className="flex items-center justify-around w-full max-w-md mx-auto">
        {/* Your hand */}
        <motion.div
          initial={{ x: -40, opacity: 0, rotate: -12 }}
          animate={{
            x: 0,
            opacity: 1,
            rotate: 0,
            scale: outcomeForYou === "win" ? [1, 1.15, 1.05] : outcomeForYou === "loss" ? 0.92 : 1,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative"
        >
          {/* Winner glow halo */}
          {outcomeForYou === "win" && youMove && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.6, 0.25], scale: [0.5, 1.4, 1.2] }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 -z-10 rounded-3xl blur-2xl"
              style={{
                background: `radial-gradient(circle, ${MOVE_PALETTE[youMove].hex}90, transparent 70%)`,
              }}
            />
          )}
          {youMove && (
            <Hand
              move={youMove}
              size="md"
              emphasis={
                outcomeForYou === "win" ? "winner" :
                outcomeForYou === "loss" ? "loser" : "default"
              }
            />
          )}
        </motion.div>

        {/* Center VS — pulses on impact */}
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{
            scale: outcomeForYou === "draw" ? 1 : [0, 1.4, 1],
            rotate: 0,
          }}
          transition={{ delay: 0.05, type: "spring", stiffness: 280, damping: 12 }}
          className="text-2xl sm:text-3xl font-black text-zinc-600 shrink-0 px-1"
        >
          VS
        </motion.div>

        {/* Opponent hand — mirrored */}
        <motion.div
          initial={{ x: 40, opacity: 0, rotate: 12 }}
          animate={{
            x: 0,
            opacity: 1,
            rotate: 0,
            scale: outcomeForYou === "loss" ? [1, 1.15, 1.05] : outcomeForYou === "win" ? 0.92 : 1,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative scale-x-[-1]"
        >
          {outcomeForYou === "loss" && oppMove && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.6, 0.25], scale: [0.5, 1.4, 1.2] }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 -z-10 rounded-3xl blur-2xl scale-x-[-1]"
              style={{
                background: `radial-gradient(circle, ${MOVE_PALETTE[oppMove].hex}90, transparent 70%)`,
              }}
            />
          )}
          {oppMove && (
            <div className="scale-x-[-1]">
              <Hand
                move={oppMove}
                size="md"
                emphasis={
                  outcomeForYou === "loss" ? "winner" :
                  outcomeForYou === "win" ? "loser" : "default"
                }
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Sparkle/burst particles on win — pure emoji, no extra deps. */}
      {outcomeForYou === "win" && <SparkBurst color="emerald" />}
      {outcomeForYou === "loss" && <SparkBurst color="rose" />}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        className="text-center mt-1 px-2 max-w-md"
      >
        {outcomeForYou === "draw" && (
          <div className="text-zinc-300 text-base sm:text-lg font-bold">
            🤝 {t("online.verdict.draw")}
          </div>
        )}
        {outcomeForYou === "win" && verb && (
          <div className="text-emerald-300 text-base sm:text-lg font-bold leading-snug">
            ✨ {t("online.verdict.youWin")}{" "}
            <span className="text-emerald-100">{youMove}</span> {verb}{" "}
            <span className="text-emerald-100">{oppMove}</span>
          </div>
        )}
        {outcomeForYou === "loss" && verb && (
          <div className="text-rose-300 text-base sm:text-lg font-bold leading-snug">
            💥 {t("online.verdict.youLose", { opp: opponentName })}{" "}
            <span className="text-rose-100">{oppMove}</span> {verb}{" "}
            <span className="text-rose-100">{youMove}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Tiny celebratory/sad burst — 8 emojis flying outward in a star pattern. */
function SparkBurst({ color }: { color: "emerald" | "rose" }) {
  const emoji = color === "emerald" ? "✨" : "💥";
  return (
    <div className="relative h-0 w-full pointer-events-none">
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dx = Math.cos(angle) * 90;
        const dy = Math.sin(angle) * 60;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0], x: dx, y: dy, scale: [0.3, 1.2, 0.6] }}
            transition={{ duration: 0.9, delay: 0.05 * i, ease: "easeOut" }}
            className="absolute left-1/2 top-0 text-lg"
            style={{ translate: "-50% 0" }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
}
