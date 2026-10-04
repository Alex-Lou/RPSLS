import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MOVES, type Move } from "../engine/game";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { hapticAlert, hapticTap } from "../haptic";
import { hapticTick, PickShock } from "../match/sharedMatchUI";
import { useT } from "../i18n";

/**
 * Sous-composants de la phase de pick Classé (barre de coups, chip d'effet
 * inter-manches, barre de temps) — extraits VERBATIM de RankedPickPhase.tsx.
 */

export function PickerBar({ onPickInNextEmpty }: { onPickInNextEmpty: (m: Move) => void }) {
  const t = useT();
  const [shockMove, setShockMove] = useState<Move | null>(null);
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md" role="group" aria-label={t("ranked.movePicker")}>
      {MOVES.map((mv, i) => {
        const pal = MOVE_PALETTE[mv];
        return (
          <motion.button
            key={mv}
            onClick={() => {
              hapticTick();
              setShockMove(mv);
              setTimeout(() => setShockMove((cur) => (cur === mv ? null : cur)), 450);
              onPickInNextEmpty(mv);
            }}
            aria-label={t("ranked.pickMove", { move: t("element." + mv) })}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.86 }}
            className="relative h-[56px] sm:h-[62px] rounded-xl flex flex-col items-center justify-center gap-1 py-1 px-0.5 text-white transition"
            // Dark glass surface so the white-silhouette PNG glyph reads
            // unambiguously on every theme. The per-move identity comes
            // from the rim + glow, which now blend ~45% toward the active
            // theme accent (moveRim/moveGlow) so the frames harmonise with
            // the chosen background while each move stays recognisable.
            style={{
              background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
              border: `2px solid ${moveRim(pal.hex)}`,
              boxShadow: `0 0 12px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <PickShock show={shockMove === mv} />
            {/* Symboles PLUS GRANDS + label resserré (tracking-tight) qui rentre
                sans être coupé, même « SCISSORS » (Alex 2026-07). */}
            <MoveGlyph move={mv} className="w-[40px] h-[40px] sm:w-[44px] sm:h-[44px]" />
            <span className="w-full text-center text-[10px] sm:text-[11px] uppercase tracking-tight font-bold leading-none" style={{ color: moveRim(pal.hex) }}>{t(`element.${mv}`)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Cross-round effect chip — one consistent visual style for every "pending"
 *  effect (Braise discount, Sablier/Offre bonus mana, Cascade armed, Écho
 *  stop-loss, Ancre watch, Mascarade poison, Gaïa shield charged). Tone =
 *  the card's signature palette so each effect reads by colour at a glance. */
export type EffectTone = "ember" | "sand" | "sky" | "cyan" | "violet" | "emerald" | "indigo";
export const EFFECT_PALETTE: Record<EffectTone, string> = {
  ember:   "bg-orange-500/20 border-orange-400/50 text-orange-100",
  sand:    "bg-amber-500/20 border-amber-400/50 text-amber-100",
  sky:     "bg-sky-500/20 border-sky-400/50 text-sky-100",
  cyan:    "bg-cyan-500/20 border-cyan-400/50 text-cyan-100",
  violet:  "bg-violet-500/20 border-violet-400/50 text-violet-100",
  emerald: "bg-emerald-500/20 border-emerald-400/50 text-emerald-100",
  indigo:  "bg-indigo-500/20 border-indigo-400/50 text-indigo-100",
};
export function EffectChip({
  icon, tone, label,
}: {
  icon: string;
  tone: EffectTone;
  label: string;
}) {
  return (
    <span
      className={
        "shrink-0 whitespace-nowrap text-[11px] font-bold rounded-full px-2 py-0.5 border inline-flex items-center gap-1 " +
        EFFECT_PALETTE[tone]
      }
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

export function TimerBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
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
  const level: "calm" | "urgent" | "critical" = critical ? "critical" : urgent ? "urgent" : "calm";
  useEffect(() => {
    if (level !== prevLevel.current) {
      if (level === "urgent") hapticTap();
      if (level === "critical") hapticAlert();
      prevLevel.current = level;
    }
  }, [level]);
  const color = critical ? "bg-rose-500" : urgent ? "bg-amber-400" : "bg-themed";
  const num = Math.ceil(remaining / 1000);
  return (
    <div className="w-full max-w-md flex items-center gap-3">
      <motion.span
        key={num}
        initial={{ scale: critical ? 1.4 : 1 }}
        animate={{ scale: 1 }}
        className={"text-lg sm:text-xl font-mono tabular-nums min-w-[2.5em] text-right font-extrabold " +
          (critical ? "text-rose-300" : urgent ? "text-amber-300" : "text-ink")}
      >{num}s</motion.span>
      <div className="flex-1 h-2.5 rounded-full bg-hairline overflow-hidden">
        <motion.div
          className={"h-full " + color}
          animate={{ width: `${(progress * 100).toFixed(1)}%`, opacity: critical ? [0.5, 1, 0.5] : 1 }}
          transition={{ width: { duration: 0.1, ease: "linear" }, opacity: critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.1 } }}
        />
      </div>
      {urgent && !critical && (
        <span className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-amber-300/90 font-bold">{tr("lanes.hurry")}</span>
      )}
    </div>
  );
}
