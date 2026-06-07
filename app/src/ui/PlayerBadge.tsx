/**
 * PlayerBadge — single source of truth for the "who am I" surface.
 *
 * Both the persistent UserHeader (every menu page) AND the ProfilePage hero
 * render this component, so the avatar / nickname / rank chip / XP bar /
 * currency badges have IDENTICAL aspect, sizing and behaviour everywhere.
 *
 * Owns its own "+N XP" flash by watching `player.xp` directly — pages don't
 * need to pipe gainPulse down by hand. Owns its own z-promotion during a gain
 * so the bar visibly fills above any open modal (daily-quest claim, etc.).
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { levelFromXp } from "../engine/leveling";
import { rankFromLp } from "../engine/rank";
import { THEMES, gradientFromTheme } from "../theme/theme";
import { avatarImgStyle } from "../theme/avatar";
import { useT } from "../i18n";
import { CurrencyBadges } from "../ranked/CurrencyBadges";
import { ThemedXpBar } from "./ThemedXpBar";

export interface PlayerBadgeProps {
  /** Optional click handler for the avatar/name area (UserHeader uses it to
   *  jump to the profile page). ProfilePage leaves it undefined → renders a
   *  div instead of a button so the badge isn't interactive on the page it
   *  already represents. */
  onTap?: () => void;
  /** Click handler for the currency chips (typically: open the shop). */
  onCurrencyTap?: () => void;
  /** Extra container classes (e.g. `md:hidden` for the persistent header).
   *  Defaults to no responsive hiding so the badge shows on profile @ desktop. */
  className?: string;
}

export function PlayerBadge({
  onTap,
  onCurrencyTap,
  className = "",
}: PlayerBadgeProps) {
  const player = useStore((s) => s.player);
  const t = useT();
  const info = levelFromXp(player.xp);
  const rank = rankFromLp(player.rankLp);
  const theme = THEMES[player.themeId];

  // Local XP-gain detection — every instance of the badge flashes the same
  // bar whenever the player's XP grows. Means parents don't have to thread
  // gainPulse through.
  const prevXp = useRef(player.xp);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    if (player.xp > prevXp.current) {
      setGain(player.xp - prevXp.current);
      const id = window.setTimeout(() => setGain(0), 3400);
      prevXp.current = player.xp;
      return () => window.clearTimeout(id);
    }
    prevXp.current = player.xp;
  }, [player.xp]);

  // Tap-or-static wrapper for the avatar+name row. UserHeader passes a tap
  // handler; ProfilePage doesn't (already on the profile).
  const RowTag = onTap ? "button" : "div";

  return (
    <div
      className={
        // Badge is now full-width inside whichever container it sits in.
        // The CALLER decides max-width and horizontal padding (UserHeader
        // wraps it in a mobile-only narrow container, ProfilePage drops it
        // straight into its already-constrained max-w-3xl section). Forcing
        // an inner max-w-3xl + px-5 used to double the padding on profile
        // and shrink the badge to a child-of-parent strip.
        "shrink-0 w-full transition-[z-index] " +
        // While XP is landing, jump above any open modal (e.g. daily-quest
        // claim) so the bar visibly fills, then drop back behind it.
        (gain > 0 ? "z-[60]" : "z-20") + " " +
        className
      }
    >
      <div className="relative w-full flex flex-col gap-1.5 rounded-2xl border border-hairline bg-surface-raised backdrop-blur-md px-3 py-2 shadow-lg shadow-black/40 overflow-hidden">
        {/* Row 1: avatar + name/rank/level — currencies on their own row below so
            nothing overflows at 375px (3 chips + rank + name was too much). */}
        <RowTag
          {...(onTap ? { onClick: onTap, type: "button" as const } : {})}
          className="relative min-w-0 flex items-center gap-3 text-left"
        >
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-1 min-w-0 text-sm font-bold truncate">{player.nickname}</span>
              <span
                className={
                  "shrink-0 whitespace-nowrap text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full text-zinc-900 bg-gradient-to-r " +
                  rank.gradient
                }
              >
                {rank.emoji} {rank.label}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-faint">
              <span className="truncate">
                {t("sidebar.lvl")} {info.level} · {info.xpInLevel}/{info.xpForNext} {t("sidebar.xp")}
              </span>
              {(player.winStreak ?? 0) >= 2 && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 whitespace-nowrap text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/25 text-orange-300 border border-orange-400/40"
                  title="Série de victoires"
                >
                  🔥 {player.winStreak}
                  {(player.winStreak ?? 0) >= 5 ? " x2" : (player.winStreak ?? 0) >= 3 ? " x1.5" : ""}
                </motion.span>
              )}
              <span className="ml-auto shrink-0 text-ink-muted whitespace-nowrap">
                {player.rankLp} {t("sidebar.lp")}
              </span>
            </div>
          </div>

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
        </RowTag>

        {/* Row 2: currencies — full-bleed across the badge so the three chips
            spread evenly (CurrencyBadges sets flex-1 on each chip in compact
            mode). Used to be justify-center which clustered the chips into a
            tiny cramped group in the middle of an otherwise empty row. */}
        <div className="flex items-stretch border-t border-hairline pt-1.5">
          <CurrencyBadges onClick={onCurrencyTap} />
        </div>

        {/* Row 3: XP bar — full card width. */}
        <ThemedXpBar
          current={info.xpInLevel}
          total={info.xpForNext}
          gainPulse={gain}
          variant="xp"
        />
      </div>
    </div>
  );
}
