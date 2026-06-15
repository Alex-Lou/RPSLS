import { useRef } from "react";
import { motion } from "motion/react";
import { useT } from "../../i18n";
import { useStore } from "../../store/store";
import { rankFromLp } from "../../engine/rank";
import { classifyEnd, pickEndSubtitleKey } from "../../flavor/endphrases";
import { CelebrationBurst, CountUp } from "./CelebrationBurst";

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
  /** Optional reward reveal — animates a +XP / ±LP / 💎 counter on the end
   *  screen. The éclats slot reads the recordMatch award the store just
   *  granted, so the player physically sees the boutique progress arrive
   *  instead of finding it later by chance. */
  reward?: { xp?: number; lp?: number; eclats?: number };
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
      // w-full + horizontal padding so every inner row can claim the full
      // viewport width — fixes the "screen-in-a-screen" framing Alex flagged
      // where the cinematic was capped to max-w-md and a wide blank gutter
      // showed on both sides.
      className="relative flex flex-col items-center gap-3 py-2 w-full px-3 sm:px-6"
    >
      {youWon && <CelebrationBurst />}

      {/* Glyph with a breathing halo behind it (green win / grey draw / red loss). */}
      <div className="relative flex items-center justify-center">
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: youWon ? [0.45, 0.85, 0.45] : 0.3, scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full blur-2xl pointer-events-none"
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
          className="relative text-6xl sm:text-7xl leading-none"
        >
          {glyph}
        </motion.div>
      </div>

      {/* Wordmark: enter then breathe. Sized to BREATHE wide — fills the
          available width on every screen instead of a cramped pill. */}
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
          "text-5xl sm:text-6xl md:text-7xl font-black bg-gradient-to-br bg-clip-text text-transparent leading-tight tracking-tight " +
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
            className="w-full max-w-2xl px-2 text-center text-base sm:text-lg text-ink-muted leading-snug"
          >
            {phrase}
          </motion.div>
        );
      })()}

      {scoreLine && (
        <div className="text-2xl sm:text-3xl font-mono font-black text-ink tracking-wider">{scoreLine}</div>
      )}

      {/* Reward reveal — animated +XP / ±LP / 💎 counters. */}
      {(!!reward?.xp || (reward?.lp != null && reward.lp !== 0) || !!reward?.eclats) && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.0, type: "spring", stiffness: 260, damping: 18 }}
          className="flex items-center flex-wrap justify-center gap-x-4 gap-y-1"
        >
          {!!reward?.xp && reward.xp > 0 && (
            <span className="text-lg font-black text-emerald-300">+<CountUp to={reward.xp} /> XP</span>
          )}
          {reward?.lp != null && reward.lp !== 0 && (
            <span className={"text-lg font-black " + (reward.lp > 0 ? "text-amber-300" : "text-rose-300")}>
              {reward.lp > 0 ? "+" : ""}<CountUp to={reward.lp} /> LP
            </span>
          )}
          {!!reward?.eclats && reward.eclats > 0 && (
            <span className="text-lg font-black text-cyan-300">+<CountUp to={reward.eclats} /> 💎</span>
          )}
        </motion.div>
      )}

      {/* Rank standing chip — current tier + LP, springs in. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.15, type: "spring", stiffness: 240, damping: 18 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-hairline"
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
        className="w-full max-w-2xl mx-auto px-2 text-center"
      >
        <div
          className="text-base sm:text-lg italic text-ink-muted leading-snug overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        >
          « {t(`lanes.endQuote.${quoteIdx}.text`)} »
        </div>
        <div className="text-sm text-ink-faint mt-1 tracking-wide">
          {t(`lanes.endQuote.${quoteIdx}.author`)}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="flex flex-row gap-3 w-full max-w-2xl px-2"
      >
        {onRematch && (
          <button
            onClick={onRematch}
            className="flex-1 px-5 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-black text-white shadow-lg shadow-emerald-500/30 transition text-base uppercase tracking-wider"
          >
            {rematchLabel ?? t("lanes.rematch")}
          </button>
        )}
        <button
          onClick={onBack}
          className="flex-1 px-5 py-3 sm:py-3.5 rounded-2xl bg-hairline hover:bg-white/20 border border-hairline font-bold text-ink transition text-base uppercase tracking-wider"
        >
          {backLabel ?? t("lanes.backToMenu")}
        </button>
      </motion.div>
    </motion.div>
  );
}
