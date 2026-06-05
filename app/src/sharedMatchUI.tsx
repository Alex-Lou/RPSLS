/**
 * Shared "cinematic" match UI bits — extracted so the classic 1v1 modes
 * (Training / Casual / Ranked / Hot-seat) can wear the same look-and-feel
 * as the Constellation Lanes mode.
 *
 * Components exported:
 *   - RollingScore: AnimatePresence popLayout digit, no pile-up on change.
 *   - CinematicMatchEnd: trophy/skull/handshake glyph that springs in then
 *     gently floats, gradient VICTOIRE/ÉGALITÉ/DÉFAITE wordmark that
 *     breathes, optional forfeit pill, score card, Rematch + Back buttons,
 *     end-of-match author quote (random per mount).
 *   - AmbientFlavor: ~10 rotating geek one-liners. Atmosphere, not signal.
 */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "./i18n";
import { useStore } from "./store";
import { rankFromLp } from "./rank";
import { BurstCanvas } from "./LevelUpOverlay";
import { classifyEnd, pickEndSubtitleKey } from "./flavor/endphrases";

/**
 * ScaleToFit — guarantees its child ALWAYS fits the available height without
 * scrolling. Measures the child's natural (pre-transform) size and applies a
 * uniform `transform: scale()` so it shrinks to fit a short viewport and never
 * needs a scrollbar. At/under capacity the scale is 1 (no change). This is how
 * the match views promise "you never scroll to reach the Lock button".
 *
 * offsetWidth/offsetHeight are read pre-transform, so scaling never feeds back
 * into the measurement (no loops); a ResizeObserver re-fits on viewport changes
 * (rotation, keyboard) and on content changes (combo banner appearing, etc.).
 */
export function ScaleToFit({
  children,
  className = "",
  align = "center",
}: {
  children: React.ReactNode;
  className?: string;
  /** Vertical anchor of the scaled content within the available box. */
  align?: "center" | "top";
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const availH = outer.clientHeight;
      const needH = inner.offsetHeight; // pre-transform layout height
      if (!availH || !needH) return;
      const next = needH > availH ? Math.max(0.4, availH / needH) : 1;
      setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className={
        "flex-1 min-h-0 w-full overflow-hidden flex justify-center " +
        (align === "top" ? "items-start " : "items-center ") +
        className
      }
    >
      <div
        ref={innerRef}
        className="w-full"
        style={{ transform: `scale(${scale})`, transformOrigin: align === "top" ? "center top" : "center center" }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Hook: while a match is mounted, intercept the Android system back button
 * (and the WebView's history-back) so it routes to `onBack` instead of
 * exiting the match silently. We push a sentinel history entry on mount and
 * re-push it on every popstate so successive back-presses keep firing the
 * handler until the caller actually unmounts the view.
 *
 * `onBack` is wrapped in a ref internally so passing a fresh closure every
 * render doesn't re-register the listener.
 */
export function useAndroidBackPrompt(onBack: () => void) {
  const cbRef = useRef(onBack);
  useEffect(() => { cbRef.current = onBack; }, [onBack]);
  useEffect(() => {
    history.pushState({ rpslsMatch: true }, "");
    const handler = () => {
      // Re-arm the back so the user has to confirm again.
      history.pushState({ rpslsMatch: true }, "");
      cbRef.current();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
}

/** Imperative handle exposed by FloatingMatchBackButton so the parent can
 *  trigger the same confirm flow from elsewhere (Android back gesture). */
export interface MatchBackHandle {
  triggerConfirm: () => void;
}

/* ──────────── RollingScore ──────────── */

/**
 * Score digit that slides up/out when its value changes, instead of letting
 * two glyphs stack on top of each other (the "binary score" bug we had in
 * Lanes before lifting state out of LanesMatchView).
 */
export function RollingScore({
  value, color, size = "lg",
}: {
  value: number;
  color: "emerald" | "rose" | "violet" | "amber" | "zinc";
  size?: "md" | "lg" | "xl";
}) {
  const palette: Record<typeof color, string> = {
    emerald: "text-emerald-300",
    rose:    "text-rose-300",
    violet:  "text-violet-300",
    amber:   "text-amber-300",
    zinc:    "text-ink-muted",
  };
  const sizeCls = size === "xl" ? "text-4xl sm:text-5xl"
                : size === "lg" ? "text-3xl sm:text-4xl"
                :                 "text-2xl sm:text-3xl";
  return (
    <span
      className={
        "relative inline-block min-w-[1.2em] text-center overflow-hidden font-black tabular-nums " +
        sizeCls + " " + palette[color]
      }
      style={{ height: "1.1em", lineHeight: "1.1em" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ──────────── MatchScoreBar ──────────── */

/**
 * The unified top-of-match score bar used by every mode (classic
 * Training/Casual/Ranked/Hot-seat AND Constellation Lanes). One component →
 * one look. Full-width score card with centered names + score; the back/quit
 * button is rendered separately by `FloatingMatchBackButton` so it docks next
 * to the burger and frees the whole row width for the score header.
 */
export function MatchScoreBar({
  youName, oppName, youScore, oppScore, caption,
  youTag, oppTag, youStreak = 0, oppStreak = 0,
}: {
  youName: string;
  oppName: string;
  youScore: number;
  oppScore: number;
  caption?: string;
  /** Tiny uppercase label above each name (e.g. "You" / "Opponent"). */
  youTag?: string;
  oppTag?: string;
  youStreak?: number;
  oppStreak?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between rounded-2xl bg-surface border border-hairline px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
        <div className="flex flex-col min-w-0 flex-1">
          {youTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-ink-muted font-medium">{youTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-emerald-200 flex items-center gap-1.5">
            <span className="truncate">{youName}</span>
            <StreakBadge streak={youStreak} />
          </span>
        </div>
        <div className="px-2 sm:px-3 flex items-center gap-1">
          <RollingScore value={youScore} color="emerald" size="lg" />
          <span className="text-ink-muted px-0.5 font-bold">:</span>
          <RollingScore value={oppScore} color="rose" size="lg" />
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          {oppTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-ink-muted font-medium">{oppTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-rose-200 flex items-center gap-1.5 justify-end">
            <StreakBadge streak={oppStreak} />
            <span className="truncate">{oppName}</span>
          </span>
        </div>
      </div>
      {caption && (
        <div className="text-center text-[13px] sm:text-sm uppercase tracking-[0.2em] text-ink-muted font-medium">
          {caption}
        </div>
      )}
    </div>
  );
}

/**
 * Floating back/quit button that docks at the top-left of the screen, right
 * next to the mobile hamburger (or just inside the desktop sidebar gutter).
 * Pulled out of MatchScoreBar so the score header can stretch full-width on
 * its own line.
 */
export const FloatingMatchBackButton = forwardRef<
  MatchBackHandle,
  {
    onClick: () => void;
    label: string;
    /** When set, clicking the button (or the parent calling triggerConfirm
     *  via the imperative handle) opens a confirmation modal first. */
    confirm?: {
      title: string;
      body: string;
      confirmLabel?: string;
      cancelLabel?: string;
      /** "danger" colors the confirm CTA red to flag a punitive action. */
      severity?: "default" | "danger";
    };
  }
>(function FloatingMatchBackButtonImpl({ onClick, label, confirm }, ref) {
  const [open, setOpen] = useState(false);
  const handleClick = () => {
    if (confirm) setOpen(true);
    else onClick();
  };
  useImperativeHandle(ref, () => ({
    triggerConfirm: () => {
      if (confirm) setOpen(true);
      else onClick();
    },
  }), [confirm, onClick]);
  return (
    <>
      <button
        onClick={handleClick}
        aria-label={label}
        title={label}
        className="
          fixed z-30 w-11 h-11 rounded-2xl bg-black/55 backdrop-blur border border-hairline
          flex items-center justify-center text-zinc-100 active:scale-95 transition shadow-lg
          hover:bg-black/70
          top-[max(env(safe-area-inset-top),32px)]
          left-[calc(max(env(safe-area-inset-left),12px)+44px+8px)]
          md:top-3
          md:left-3
        "
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-surface-raised border border-hairline rounded-3xl p-5 sm:p-6 shadow-2xl"
            >
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{confirm.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed mb-5">{confirm.body}</p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-hairline hover:bg-hairline border border-hairline font-semibold text-sm text-zinc-200 transition active:scale-[0.97]"
                >
                  {confirm.cancelLabel ?? "Annuler"}
                </button>
                <button
                  onClick={() => { setOpen(false); onClick(); }}
                  className={
                    "flex-1 py-2.5 rounded-2xl font-bold text-sm text-white shadow-lg transition active:scale-[0.97] " +
                    (confirm.severity === "danger"
                      ? "bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/30"
                      : "bg-themed shadow-violet-500/30")
                  }
                >
                  {confirm.confirmLabel ?? "Quitter"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

function StreakBadge({ streak }: { streak: number }) {
  return (
    <AnimatePresence>
      {streak >= 2 && (
        <motion.span
          key={streak}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className={
            "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
            (streak >= 3
              ? "bg-orange-500/30 text-orange-300 ring-1 ring-orange-400/50"
              : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40")
          }
        >
          🔥 {streak}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ──────────── CinematicMatchEnd ──────────── */

export interface CinematicMatchEndProps {
  /** Outcome from the player's perspective. */
  outcome: "win" | "loss" | "draw";
  /** Optional small forfeit pill. */
  forfeit?: boolean;
  /** Score line (already formatted, e.g. "3 — 1"). */
  scoreLine?: string;
  /** Final player score (used to pick a contextual subtitle phrase). */
  youScore?: number;
  /** Final opponent score (used to pick a contextual subtitle phrase). */
  oppScore?: number;
  /** Match length (used to detect sweep — 3 of bestOf 5 = sweep at 3-0). */
  bestOf?: number;
  /** True when the player was the one forfeiting (vs opponent forfeit). */
  forfeitByYou?: boolean;
  /** Rematch action (omit → no button). */
  onRematch?: () => void;
  /** Back / quit action (always shown). */
  onBack: () => void;
  /** Override the rematch button label. */
  rematchLabel?: string;
  /** Override the back button label. */
  backLabel?: string;
  /** Optional reward reveal — animates a +XP / ±LP counter on the end screen. */
  reward?: { xp?: number; lp?: number };
}

const QUOTE_COUNT = 10;

export function CinematicMatchEnd({
  outcome, forfeit, scoreLine, youScore, oppScore, bestOf, forfeitByYou,
  onRematch, onBack, rematchLabel, backLabel, reward,
}: CinematicMatchEndProps) {
  const t = useT();
  const youWon = outcome === "win";
  const draw = outcome === "draw";
  const rankLp = useStore((s) => s.player.rankLp);
  const tier = rankFromLp(rankLp);
  // Stable random pick per mount.
  const quoteIdx = useRef(Math.floor(Math.random() * QUOTE_COUNT)).current;
  // Classify the situation once at mount so the subtitle stays stable.
  const subtitleKey = useRef<string | null>(null).current;
  const finalSubtitleKey = (() => {
    if (subtitleKey) return subtitleKey;
    if (youScore == null || oppScore == null || bestOf == null) return null;
    const sit = classifyEnd({
      youScore, oppScore, bestOf,
      forfeit: !!forfeit,
      forfeitByYou: !!forfeitByYou,
    });
    return pickEndSubtitleKey(sit);
  })();

  const glyph = youWon ? "🏆" : draw ? "🤝" : "💀";
  const wordmark =
    youWon ? t("lanes.victory") :
    draw   ? t("lanes.endDraw") :
             t("lanes.defeat");
  const gradient =
    youWon ? "from-emerald-300 to-teal-400" :
    draw   ? "from-zinc-200 to-zinc-400"   :
             "from-rose-300 to-fuchsia-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col items-center gap-2.5 py-2"
    >
      {youWon && <CelebrationBurst />}

      {/* Glyph with a breathing halo behind it (green win / grey draw / red loss). */}
      <div className="relative flex items-center justify-center">
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: youWon ? [0.45, 0.85, 0.45] : 0.3, scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="absolute w-28 h-28 rounded-full blur-2xl pointer-events-none"
          style={{
            background: youWon
              ? "radial-gradient(circle, rgba(52,211,153,0.75), transparent 70%)"
              : draw
              ? "radial-gradient(circle, rgba(161,161,170,0.5), transparent 70%)"
              : "radial-gradient(circle, rgba(244,63,94,0.55), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0, y: [0, -6, 0, -3, 0] }}
          transition={{
            scale:  { type: "spring", stiffness: 200, damping: 12, delay: 0.1 },
            rotate: { type: "spring", stiffness: 200, damping: 12, delay: 0.1 },
            y:      { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.0 },
          }}
          className="relative text-5xl sm:text-6xl leading-none"
        >
          {glyph}
        </motion.div>
      </div>

      {/* Wordmark: enter then breathe. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: [1, 1.03, 1],
        }}
        transition={{
          opacity: { delay: 0.5 },
          y:       { delay: 0.5 },
          scale:   { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
        }}
        className={
          "text-3xl sm:text-4xl font-black bg-gradient-to-br bg-clip-text text-transparent leading-tight " +
          gradient
        }
      >
        {wordmark}
      </motion.div>

      {forfeit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-[10px] uppercase tracking-[0.3em] text-amber-300"
        >
          {t("lanes.byForfeit")}
        </motion.div>
      )}

      {/* Situation-aware one-liner under the wordmark — varies per match
          (sweep, comeback, close call, dominated, tight loss, etc.). */}
      {finalSubtitleKey && (() => {
        const phrase = t(finalSubtitleKey);
        // Fall back silently if the variant key isn't translated for this
        // locale — the key itself is returned by t() in that case.
        if (phrase.startsWith("endphrase.")) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.4 }}
            className="max-w-xs sm:max-w-sm px-4 text-center text-sm text-ink-muted leading-snug"
          >
            {phrase}
          </motion.div>
        );
      })()}

      {scoreLine && (
        <div className="text-xl font-mono text-zinc-200">{scoreLine}</div>
      )}

      {/* Reward reveal — animated +XP / ±LP counter. */}
      {(!!reward?.xp || (reward?.lp != null && reward.lp !== 0)) && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.0, type: "spring", stiffness: 260, damping: 18 }}
          className="flex items-center gap-4"
        >
          {!!reward?.xp && reward.xp > 0 && (
            <span className="text-lg font-black text-emerald-300">+<CountUp to={reward.xp} /> XP</span>
          )}
          {reward?.lp != null && reward.lp !== 0 && (
            <span className={"text-lg font-black " + (reward.lp > 0 ? "text-amber-300" : "text-rose-300")}>
              {reward.lp > 0 ? "+" : ""}<CountUp to={reward.lp} /> LP
            </span>
          )}
        </motion.div>
      )}

      {/* Rank standing chip — current tier + LP, springs in. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.15, type: "spring", stiffness: 240, damping: 18 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-white/12"
      >
        <span className="text-lg">{tier.emoji}</span>
        <span className={"text-sm font-bold bg-gradient-to-r bg-clip-text text-transparent " + tier.gradient}>
          {tier.label}
        </span>
        <span className="text-xs text-ink-muted tabular-nums">{rankLp} LP</span>
      </motion.div>

      {/* Author quote — capped to 2 lines so a chatty Sagan quote can't
          push the rest of the screen under the Android nav. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="max-w-md mx-auto px-4 text-center"
      >
        <div
          className="text-[13px] italic text-ink-muted leading-snug overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        >
          « {t(`lanes.endQuote.${quoteIdx}.text`)} »
        </div>
        <div className="text-[11px] text-ink-faint mt-0.5 tracking-wide">
          {t(`lanes.endQuote.${quoteIdx}.author`)}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="flex flex-row gap-2 w-full max-w-md px-2"
      >
        {onRematch && (
          <button
            onClick={onRematch}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-bold text-white shadow-lg shadow-emerald-500/30 transition text-sm"
          >
            {rematchLabel ?? t("lanes.rematch")}
          </button>
        )}
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2.5 rounded-xl bg-hairline hover:bg-white/20 border border-hairline font-semibold text-zinc-200 transition text-sm"
        >
          {backLabel ?? t("lanes.backToMenu")}
        </button>
      </motion.div>
    </motion.div>
  );
}

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
function CountUp({ to, durationMs = 700 }: { to: number; durationMs?: number }) {
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

/* ──────────── Pick VFX (impact on tap) ──────────── */

/**
 * Trigger a brief haptic buzz on a player tap. Delegates to the central
 * haptic.ts helper so it inherits the user's enable/intensity settings
 * — kept as a re-export under its old name for code-call-site stability.
 */
export { hapticTap as hapticTick } from "./haptic";

/**
 * Fires a brief inflate-ring "shock" overlay on the parent button, useful for
 * marking the exact moment a pick was committed. Wrap one of these inside any
 * `relative` button next to its <Hand>/<Icon>.
 */
export function PickShock({
  show, color = "rgba(255,255,255,0.85)",
}: {
  show: boolean;
  color?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          key="shock"
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 1.4, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: `0 0 0 3px ${color}, 0 0 24px 6px ${color}` }}
        />
      )}
    </AnimatePresence>
  );
}

/* ──────────── Ambient flavor (atmosphere only) ──────────── */

const FLAVOR_COUNT = 10;

/**
 * Random tiny one-liner from the `lanes.flavor.*` i18n bucket, rotating
 * every ~3.5s with soft fades. Used wherever there's idle pick time.
 */
export function AmbientFlavor() {
  const t = useT();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FLAVOR_COUNT));
  useEffect(() => {
    const id = setInterval(
      () => setIdx((cur) =>
        (cur + 1 + Math.floor(Math.random() * (FLAVOR_COUNT - 1))) % FLAVOR_COUNT),
      3500,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-[1.4em] flex items-center justify-center px-4 text-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.55, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4 }}
          className="text-[10px] italic text-ink-faint font-light tracking-wide"
        >
          {t(`lanes.flavor.${idx}`)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
