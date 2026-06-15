import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Move, MOVES } from "../../../engine/game";
import { Hand } from "../../../icons";
import { AmbientFlavor } from "../../../match/sharedMatchUI";
import { useT } from "../../../i18n";
import { PickHandButton } from "./PickHandButton";

const PICK_TIMEOUT_MS = 8000;

export function PickPanel({
  title, subtitle, onPick, onTimeout, withTimer = false, recentOppMoves,
}: {
  title: string; subtitle: string; onPick: (m: Move) => void;
  onTimeout?: () => void;
  withTimer?: boolean; recentOppMoves?: Move[];
}) {
  const t = useT();
  const [remaining, setRemaining] = useState(PICK_TIMEOUT_MS);
  const [locked, setLocked] = useState(false);

  // Tick timer
  useEffect(() => {
    if (!withTimer || locked) return;
    if (remaining <= 0) {
      setLocked(true);
      // Prefer explicit timeout handler (Game uses it to score against the player);
      // otherwise fall back to random auto-pick.
      if (onTimeout) {
        onTimeout();
      } else {
        const r = MOVES[Math.floor(Math.random() * MOVES.length)];
        onPick(r);
      }
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 100), 100);
    return () => clearTimeout(id);
  }, [remaining, withTimer, locked, onPick, onTimeout]);

  const pct = withTimer ? Math.max(0, remaining / PICK_TIMEOUT_MS) : 1;
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining < 1500 && remaining > 0;
  const critical = remaining < 500 && remaining > 0;

  const handlePick = (m: Move) => {
    if (locked) return;
    setLocked(true);
    onPick(m);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={critical
        ? { opacity: 1, y: 0, x: [0, -3, 3, -3, 3, 0] }
        : { opacity: 1, y: 0, x: 0 }
      }
      exit={{ opacity: 0, y: -16 }}
      transition={critical
        ? { x: { duration: 0.4, repeat: Infinity }, default: { duration: 0.25 } }
        : { duration: 0.25 }
      }
      className={
        "relative bg-surface backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 px-3 py-3 sm:p-12 border flex flex-col items-center gap-2 sm:gap-6 w-full transition-colors " +
        (urgent
          ? "ring-rose-500/50 border-rose-500/40"
          : "ring-white/10 border-hairline")
      }
    >
      {/* Critical red flash overlay covering the whole panel */}
      <AnimatePresence>
        {critical && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-rose-500/40 pointer-events-none"
          />
        )}
      </AnimatePresence>
      <div className="text-center">
        <h2 className="text-lg sm:text-3xl font-bold leading-tight">{title}</h2>
        <p className="text-ink-muted text-xs sm:text-base mt-1">{subtitle}</p>
      </div>

      {recentOppMoves && recentOppMoves.length > 0 && (
        <div className="flex items-center gap-2 bg-surface border border-hairline rounded-xl px-3 py-1.5">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-ink-muted font-medium">
            {t("match.cpu.last")}
          </span>
          <div className="flex gap-1">
            {recentOppMoves.map((m, i) => (
              <motion.div
                key={`${i}-${m}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.6 + i * 0.15, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Hand move={m} size="sm" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {withTimer && (
        <div className="w-full max-w-md relative">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-ink-muted mb-1">
            <span className={"uppercase tracking-wider " + (urgent ? "text-rose-300 font-bold" : "")}>
              {t("match.timeleft")}
            </span>
            <motion.span
              animate={{
                scale: critical ? [1, 1.5, 1] : urgent ? [1, 1.2, 1] : 1,
                color: urgent ? "#f87171" : "#e4e4e7",
              }}
              transition={{ duration: 0.35, repeat: urgent ? Infinity : 0 }}
              className={"font-bold " + (urgent ? "text-lg sm:text-2xl" : "text-sm sm:text-base")}
            >
              {seconds}s
            </motion.span>
          </div>
          <div className="h-1.5 sm:h-2 rounded-full bg-hairline overflow-hidden">
            <motion.div
              className={
                "h-full rounded-full " +
                (urgent ? "bg-rose-400" : "bg-themed")
              }
              animate={{
                width: `${pct * 100}%`,
                boxShadow: urgent
                  ? ["0 0 0px #f87171", "0 0 14px #f87171", "0 0 0px #f87171"]
                  : "0 0 0px transparent",
              }}
              transition={{
                width: { duration: 0.1, ease: "linear" },
                boxShadow: { duration: 0.5, repeat: urgent ? Infinity : 0 },
              }}
            />
          </div>
        </div>
      )}

      {/* 5 hands in one clean, proportional row — same compact picker model
          as the Lanes / Ranked modes (was big 'lg' cards in a 3+2 grid, which
          felt oversized and crowded on phones). */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md">
        {MOVES.map((m, i) => (
          <PickHandButton
            key={m}
            move={m}
            label={t("element." + m)}
            index={i}
            disabled={locked}
            onPick={handlePick}
          />
        ))}
      </div>

      {/* Atmosphere — same rotating geek one-liners as in Constellation,
          so every mode breathes with the same vibe. Hidden on mobile so the
          panel stays short enough to fit the board without clipping the title. */}
      <div className="mt-1 hidden sm:block">
        <AmbientFlavor />
      </div>
    </motion.div>
  );
}
