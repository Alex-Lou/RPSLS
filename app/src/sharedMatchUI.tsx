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

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "./i18n";
import { classifyEnd, pickEndSubtitleKey } from "./flavor/endphrases";

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
    zinc:    "text-zinc-300",
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
      <div className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
        <div className="flex flex-col min-w-0 flex-1">
          {youTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-zinc-400 font-medium">{youTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-emerald-200 flex items-center gap-1.5">
            <span className="truncate">{youName}</span>
            <StreakBadge streak={youStreak} />
          </span>
        </div>
        <div className="px-2 sm:px-3 flex items-center gap-1">
          <RollingScore value={youScore} color="emerald" size="lg" />
          <span className="text-zinc-600 px-0.5">:</span>
          <RollingScore value={oppScore} color="rose" size="lg" />
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          {oppTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-zinc-400 font-medium">{oppTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-rose-200 flex items-center gap-1.5 justify-end">
            <StreakBadge streak={oppStreak} />
            <span className="truncate">{oppName}</span>
          </span>
        </div>
      </div>
      {caption && (
        <div className="text-center text-[13px] sm:text-sm uppercase tracking-[0.2em] text-zinc-400 font-medium">
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
          fixed z-30 w-11 h-11 rounded-2xl bg-black/55 backdrop-blur border border-white/15
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
              className="w-full max-w-sm bg-zinc-950/95 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl"
            >
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{confirm.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">{confirm.body}</p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-sm text-zinc-200 transition active:scale-[0.97]"
                >
                  {confirm.cancelLabel ?? "Annuler"}
                </button>
                <button
                  onClick={() => { setOpen(false); onClick(); }}
                  className={
                    "flex-1 py-2.5 rounded-2xl font-bold text-sm text-white shadow-lg transition active:scale-[0.97] " +
                    (confirm.severity === "danger"
                      ? "bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/30"
                      : "bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-violet-500/30")
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
}

const QUOTE_COUNT = 10;

export function CinematicMatchEnd({
  outcome, forfeit, scoreLine, youScore, oppScore, bestOf, forfeitByYou,
  onRematch, onBack, rematchLabel, backLabel,
}: CinematicMatchEndProps) {
  const t = useT();
  const youWon = outcome === "win";
  const draw = outcome === "draw";
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
      className="flex flex-col items-center gap-2.5 py-2"
    >
      {/* Glyph: spring in, then idle-float forever. Tightened from 7xl/8xl
          to 6xl so it doesn't dominate the viewport on mobile. */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{
          scale: 1,
          rotate: 0,
          y: [0, -6, 0, -3, 0],
        }}
        transition={{
          scale:  { type: "spring", stiffness: 200, damping: 12, delay: 0.1 },
          rotate: { type: "spring", stiffness: 200, damping: 12, delay: 0.1 },
          y:      { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.0 },
        }}
        className="text-5xl sm:text-6xl leading-none"
      >
        {glyph}
      </motion.div>

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
            className="max-w-xs sm:max-w-sm px-4 text-center text-sm text-zinc-300 leading-snug"
          >
            {phrase}
          </motion.div>
        );
      })()}

      {scoreLine && (
        <div className="text-xl font-mono text-zinc-200">{scoreLine}</div>
      )}

      {/* Author quote — capped to 2 lines so a chatty Sagan quote can't
          push the rest of the screen under the Android nav. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="max-w-md mx-auto px-4 text-center"
      >
        <div
          className="text-[13px] italic text-zinc-300 leading-snug overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        >
          « {t(`lanes.endQuote.${quoteIdx}.text`)} »
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5 tracking-wide">
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
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 font-semibold text-zinc-200 transition text-sm"
        >
          {backLabel ?? t("lanes.backToMenu")}
        </button>
      </motion.div>
    </motion.div>
  );
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
          className="text-[10px] italic text-zinc-500 font-light tracking-wide"
        >
          {t(`lanes.flavor.${idx}`)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
