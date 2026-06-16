import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Hand, MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { MOVES, type Move } from "../../engine/game";
import { hapticAlert, hapticTap } from "../../haptic";
import { useT } from "../../i18n";
import { hapticTick, PickShock } from "../sharedMatchUI";
import { detectPlayerCombo, laneIdentityAt, laneFavoursMove } from "../../engine/lanesCombos";
import { GameTable, FaceDownLaneCard } from "./GameTable";
import { IDENTITY_KEYS } from "./data";

export function PickStage({
  picks, onPick, onClearLane, startedAt, deadlineMs, showTimer = true, onSubmit, opponentName, youName,
}: {
  picks: (Move | null)[];
  /** Pick `mv` — drops it into the next empty lane. */
  onPick: (mv: Move) => void;
  onClearLane: (lane: number) => void;
  startedAt: number;
  deadlineMs: number;
  showTimer?: boolean;
  onSubmit: () => void;
  opponentName: string;
  youName: string;
}) {
  const t = useT();
  const allFilled = picks.every((p) => p !== null);
  const remaining = 3 - picks.filter(Boolean).length;
  // Combo preview — only triggers once all 3 picks are placed, before lock.
  const preview = allFilled ? detectPlayerCombo(picks as Move[]) : null;
  return (
    <div className="w-full flex flex-col items-center gap-2 sm:gap-3">
      {/* Timer — pinned top. Hidden in solo vs CPU (no time pressure). */}
      {showTimer && <TimerBar startedAt={startedAt} durationMs={deadlineMs} />}

      {/* Table at natural height; the parent stage scrolls if the whole pick
          phase exceeds the viewport so the picker + LOCK stay reachable. */}
      <div className="w-full flex items-center justify-center">
      <GameTable
        opponentName={opponentName}
        youName={youName}
        oppStatus={t("lanes.tableOppThinking")}
        youStatus={
          allFilled ? t("lanes.tableYouReady") : t("lanes.pickRemaining", { n: remaining })
        }
        oppRow={
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {[0, 1, 2].map((i) => (
              <FaceDownLaneCard key={i} index={i} pulsing />
            ))}
          </div>
        }
        youRow={
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {picks.map((mv, i) => (
              <LaneSlot key={i} index={i} pick={mv} onClear={() => onClearLane(i)} />
            ))}
          </div>
        }
      />
      </div>

      <div className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-ink-faint text-center px-4">
        {t("lanes.pickInstruction")}
      </div>

      <PickerBar onPickInNextEmpty={onPick} />

      {/* Combo preview: shown as soon as the 3 picks form a known combo. */}
      <AnimatePresence>
        {preview && (
          <motion.div
            key={preview.id}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">
              {t("lanes.potentialCombo")}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{preview.glyph}</span>
              <span
                className={
                  "text-base sm:text-lg font-black tracking-wider bg-gradient-to-br " +
                  preview.gradient +
                  " bg-clip-text text-transparent"
                }
              >
                {t(`combo.${preview.id}.name`)}
              </span>
              <span className="text-xl">{preview.glyph}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onSubmit}
        disabled={!allFilled}
        className={
          "shrink-0 mt-1 px-7 py-3 rounded-2xl font-bold text-white transition " +
          (allFilled
            ? "bg-themed shadow-lg shadow-themed hover:scale-[1.02]"
            : "bg-hairline text-ink-faint cursor-not-allowed")
        }
      >
        {allFilled ? t("lanes.lockButton") : t("lanes.pickRemaining", { n: remaining })}
      </button>
    </div>
  );
}

function LaneSlot({
  index, pick, onClear,
}: { index: number; pick: Move | null; onClear: () => void }) {
  const t = useT();
  const identity = laneIdentityAt(index);
  const favoured = pick ? laneFavoursMove(index, pick) : false;
  const idKey = IDENTITY_KEYS[index];
  const title = t(`${idKey}.title`);
  const hint = t(`${idKey}.hint`);

  // Per-identity accent palette — used on the ring, badge and the
  // "favoured" halo so the player learns to associate colour ↔ lane.
  const accent = identity.accent;
  const ringIdle =
    accent === "amber"  ? "ring-amber-400/30"  :
    accent === "sky"    ? "ring-sky-400/30"    :
                          "ring-emerald-400/30";
  const ringFav =
    accent === "amber"  ? "ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.55)]"  :
    accent === "sky"    ? "ring-sky-400/80 shadow-[0_0_24px_rgba(56,189,248,0.55)]"    :
                          "ring-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.55)]";
  const accentText =
    accent === "amber"  ? "text-amber-300"  :
    accent === "sky"    ? "text-sky-300"    :
                          "text-emerald-300";
  const haloColor =
    accent === "amber"  ? "rgba(251,191,36,0.5)"  :
    accent === "sky"    ? "rgba(56,189,248,0.5)"  :
                          "rgba(52,211,153,0.5)";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={"flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold " + accentText}>
        <span>{identity.glyph}</span>
        <span>{title}</span>
      </div>
      <button
        onClick={onClear}
        disabled={!pick}
        className={
          "aspect-square w-full rounded-xl border-2 transition flex items-center justify-center relative ring-2 " +
          (favoured ? ringFav : ringIdle) + " " +
          (pick
            ? "border-emerald-400/50 bg-emerald-600/25 hover:bg-rose-500/20 hover:border-rose-400/50"
            : "border-dashed border-hairline bg-surface-2")
        }
        title={pick ? t("lanes.clearLane", { move: pick }) : hint}
      >
        {/* Soft halo glow when the placed move is on its favoured lane —
            a STEADY constant glow (no opacity pulse) so the board stays calm. */}
        {favoured && (
          <div
            aria-hidden
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${haloColor}, transparent 70%)`,
              filter: "blur(8px)",
              opacity: 0.6,
            }}
          />
        )}
        {pick ? (
          <>
            <Hand move={pick} size="sm" />
            {favoured && (
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 12 }}
                className={
                  "absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-zinc-900 shadow-lg flex items-center gap-1 " +
                  (accent === "amber"  ? "bg-amber-300" :
                   accent === "sky"    ? "bg-sky-300"   :
                                          "bg-emerald-300")
                }
              >
                ✨ +1
              </motion.span>
            )}
          </>
        ) : (
          <span className="text-2xl text-zinc-700 font-black">?</span>
        )}
      </button>
      <span className="text-[9px] text-ink-faint text-center leading-tight hidden sm:block">
        {hint}
      </span>
    </div>
  );
}

function PickerBar({ onPickInNextEmpty }: { onPickInNextEmpty: (m: Move) => void }) {
  const [shockMove, setShockMove] = useState<Move | null>(null);
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md">
      {MOVES.map((mv, i) => {
        const pal = MOVE_PALETTE[mv];
        function handleClick() {
          hapticTick();
          setShockMove(mv);
          setTimeout(() => setShockMove((cur) => (cur === mv ? null : cur)), 450);
          onPickInNextEmpty(mv);
        }
        return (
          <motion.button
            key={mv}
            onClick={handleClick}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.86 }}
            aria-label={`Pick ${mv}`}
            className="relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 text-white transition"
            // Dark glass + theme-blended rim — same treatment as the ranked
            // picker so every mode's move buttons look consistent and adapt
            // to the active background accent.
            style={{
              background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
              border: `2px solid ${moveRim(pal.hex)}`,
              boxShadow: `0 0 12px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <PickShock show={shockMove === mv} />
            <MoveGlyph move={mv} className="w-9 h-9 sm:w-11 sm:h-11" />
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold leading-none" style={{ color: moveRim(pal.hex) }}>{mv}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function TimerBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  // Track previous urgency level so we can fire a haptic on each transition.
  const prevLevel = useRef<"calm" | "urgent" | "critical">("calm");

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!id) id = setInterval(() => setNow(Date.now()), 250); };
    const stop = () => { if (id) { clearInterval(id); id = undefined; } };
    const onVis = () => { if (document.hidden) stop(); else { setNow(Date.now()); start(); } };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remaining / durationMs));
  const urgent = remaining < 3000 && remaining > 0;
  const critical = remaining < 1000 && remaining > 0;
  const expired = remaining === 0;
  const level: "calm" | "urgent" | "critical" =
    expired ? "critical" : critical ? "critical" : urgent ? "urgent" : "calm";

  useEffect(() => {
    if (level !== prevLevel.current) {
      if (level === "urgent")  hapticTap();
      if (level === "critical") hapticAlert();
      prevLevel.current = level;
    }
  }, [level]);

  const color = critical || expired ? "bg-rose-500" : urgent ? "bg-amber-400" : "bg-themed";
  const num = Math.ceil(remaining / 1000);

  return (
    <div className="w-full max-w-md flex flex-col gap-1 items-center">
      <div className="flex items-center gap-3 w-full">
        <motion.span
          key={num}
          initial={{ scale: critical ? 1.4 : 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.25 }}
          className={
            "text-sm font-mono tabular-nums w-10 text-right font-bold " +
            (critical || expired ? "text-rose-300" : urgent ? "text-amber-300" : "text-ink-muted")
          }
        >
          {num}s
        </motion.span>
        <div className="flex-1 h-2 rounded-full bg-hairline overflow-hidden">
          <motion.div
            className={"h-full " + color}
            animate={{
              width: `${(progress * 100).toFixed(1)}%`,
              opacity: critical ? [0.5, 1, 0.5] : 1,
            }}
            transition={{
              width:   { duration: 0.1, ease: "linear" },
              opacity: critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.1 },
            }}
          />
        </div>
      </div>
      {/* Pressure overlay: faint red vignette + screen shake when critical. */}
      <AnimatePresence>
        {critical && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 pointer-events-none z-30"
            style={{
              boxShadow: "inset 0 0 120px 30px rgba(244,63,94,0.6)",
            }}
          />
        )}
      </AnimatePresence>
      {urgent && !critical && (
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">
          {tr("lanes.hurry")}
        </div>
      )}
      {critical && (
        <motion.div
          animate={{ x: [0, -3, 3, -2, 2, 0] }}
          transition={{ duration: 0.3, repeat: Infinity }}
          className="text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold text-center px-4"
        >
          {tr("lanes.pickFastOrLose")}
        </motion.div>
      )}
    </div>
  );
}
