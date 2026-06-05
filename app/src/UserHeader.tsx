import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { levelFromXp } from "./leveling";
import { rankFromLp } from "./rank";
import { THEMES, gradientFromTheme } from "./theme/theme";
import { avatarImgStyle } from "./theme/avatar";
import { useT } from "./i18n";
import type { Page } from "./Sidebar";

/**
 * Persistent player header, shown at the top of every menu page (never during a
 * match). Surfaces avatar · nickname · rank · level · XP bar · LP and — crucially
 * — flashes a "+N XP" chip and a bar glow whenever XP is gained (e.g. a quest is
 * claimed), so progression is *visible* landing in the bar no matter which page
 * triggered it. Tapping it opens the profile.
 */
export function UserHeader({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const player = useStore((s) => s.player);
  const t = useT();
  const info = levelFromXp(player.xp);
  const rank = rankFromLp(player.rankLp);
  const theme = THEMES[player.themeId];

  // Detect an XP increase → flash a "+N XP" chip + bar glow so the reward is
  // felt the instant it lands, whichever page triggered the gain.
  const prevXp = useRef(player.xp);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    if (player.xp > prevXp.current) {
      setGain(player.xp - prevXp.current);
      // Linger ~3.4s (was 1.6s) so the player actually SEES the bar fill +
      // the +N XP chip rather than it flashing past.
      const id = window.setTimeout(() => setGain(0), 3400);
      prevXp.current = player.xp;
      return () => window.clearTimeout(id);
    }
    prevXp.current = player.xp;
  }, [player.xp]);

  return (
    <div
      className={
        "md:hidden shrink-0 w-full max-w-3xl mx-auto px-5 pt-1 pb-2 transition-[z-index] " +
        // While XP is landing, jump above any open modal (e.g. the daily-quest
        // claim modal) so the bar visibly fills, then drop back behind it.
        (gain > 0 ? "z-[60]" : "z-20")
      }
    >
      <button
        onClick={() => onNavigate("profile")}
        className="relative w-full flex items-center gap-3 rounded-2xl border border-hairline bg-surface-raised backdrop-blur-md px-3 py-2 text-left shadow-lg shadow-black/40 overflow-hidden"
      >
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ring-1 ring-white/20 shadow-lg overflow-hidden"
          style={{ background: gradientFromTheme(theme) }}
        >
          {/^(data:|\/|https?:)/.test(player.avatar) ? (
            <img
              src={player.avatar}
              alt=""
              className="w-full h-full object-cover"
              style={avatarImgStyle(player.avatar)}
            />
          ) : (
            <span>{player.avatar}</span>
          )}
        </div>

        {/* Name + rank + XP bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">{player.nickname}</span>
            <span
              className={
                "shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full text-zinc-900 bg-gradient-to-r " +
                rank.gradient
              }
            >
              {rank.emoji} {rank.label}
            </span>
            {/* Win-streak momentum badge — appears at 2+, pulses, and shows
                the active XP multiplier once the bonus kicks in (3+). */}
            {(player.winStreak ?? 0) >= 2 && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/25 text-orange-300 border border-orange-400/40"
                title="Série de victoires"
              >
                🔥 {player.winStreak}
                {(player.winStreak ?? 0) >= 5 ? " ×2" : (player.winStreak ?? 0) >= 3 ? " ×1.5" : ""}
              </motion.span>
            )}
          </div>

          {/* XP bar — the landing target for every XP gain. Taller + a slower
              fill so the progression reads clearly; the glow lingers ~3.4s. */}
          <div className="mt-1 relative h-3 rounded-full bg-hairline overflow-hidden">
            <motion.div
              animate={{
                width: `${info.progress * 100}%`,
                boxShadow: gain > 0
                  ? ["0 0 0px var(--theme-primary)", "0 0 16px var(--theme-primary)", "0 0 6px var(--theme-primary)"]
                  : "0 0 0px transparent",
              }}
              transition={{
                width: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                boxShadow: { duration: 1.4, ease: "easeOut" },
              }}
              className="h-full rounded-full"
              // Follow the chosen background's accent (App.tsx maps it onto
              // --theme-primary/secondary) so the XP bar matches the theme/bg.
              style={{ background: "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))" }}
            />
            <AnimatePresence>
              {gain > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: "-30%" }}
                  animate={{ opacity: [0, 0.9, 0], x: "130%" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                  className="absolute inset-y-0 w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, var(--theme-secondary), transparent)" }}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="mt-0.5 flex items-center justify-between text-[10px] text-ink-faint">
            <span>
              {t("sidebar.lvl")} {info.level} · {info.xpInLevel}/{info.xpForNext} {t("sidebar.xp")}
            </span>
            <span className="text-ink-muted">
              {player.rankLp} {t("sidebar.lp")}
            </span>
          </div>
        </div>

        {/* Flying "+N XP" chip on gain */}
        <AnimatePresence>
          {gain > 0 && (
            <motion.span
              initial={{ opacity: 0, y: 8, scale: 0.7 }}
              animate={{ opacity: [0, 1, 1, 0], y: -20, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute right-3 top-2 text-emerald-300 font-black text-sm drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] pointer-events-none"
            >
              +{gain} ✨
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
