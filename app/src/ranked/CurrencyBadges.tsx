/**
 * CurrencyBadges — the reusable 💎 éclats + ✨ poussière chip pair.
 *
 * Lives wherever the player profile is surfaced (UserHeader on every menu
 * page, RankedLobby profile card, anywhere else XP/LP are read at a glance).
 * Tapping fires `onClick` so the caller can route to the shop — bypassing
 * the legacy "open DeckManager to see your wallet" flow that hid the loop.
 *
 * Renders a small pulsing dot on the éclats badge once the player can
 * afford a pack, so they SEE that something new is unlockable without
 * opening any menu.
 */

import { motion } from "motion/react";
import { useStore } from "../store/store";
import { PACK_COST } from "../engine/economy";

interface Props {
  /** Click handler — usually a navigation to the shop. When undefined the
   *  badges still render but are read-only (e.g. when already on the shop). */
  onClick?: () => void;
  /** "compact" (default) = small chip pair for crowded headers.
   *  "full" = bigger card-shaped pills for a profile card body. */
  size?: "compact" | "full";
  /** When true, drop the click-affordance ring & cursor — useful when the
   *  parent button already handles the click (UserHeader avatar/name area). */
  inert?: boolean;
}

export function CurrencyBadges({ onClick, size = "compact", inert }: Props) {
  const eclats = useStore((s) => s.player.eclats ?? 0);
  const dust = useStore((s) => s.player.dust ?? 0);
  const canBuyPack = eclats >= PACK_COST;

  const isFull = size === "full";

  return (
    <div className={"flex items-stretch gap-1.5 " + (isFull ? "" : "shrink-0")}>
      <CurrencyChip
        icon="💎"
        value={eclats}
        toneFrom="from-cyan-500/30"
        toneTo="to-sky-500/15"
        ring="ring-cyan-400/40"
        text="text-cyan-200"
        big={isFull}
        inert={inert}
        onClick={onClick}
        accent={canBuyPack ? "ready" : "none"}
        label="Éclats"
      />
      <CurrencyChip
        icon="✨"
        value={dust}
        toneFrom="from-violet-500/30"
        toneTo="to-fuchsia-500/15"
        ring="ring-violet-400/40"
        text="text-violet-200"
        big={isFull}
        inert={inert}
        onClick={onClick}
        accent="none"
        label="Poussière"
      />
    </div>
  );
}

function CurrencyChip({
  icon, value, toneFrom, toneTo, ring, text, big, inert, onClick, accent, label,
}: {
  icon: string;
  value: number;
  toneFrom: string;
  toneTo: string;
  ring: string;
  text: string;
  big: boolean;
  inert?: boolean;
  onClick?: () => void;
  /** "ready" = pulse a small green dot. Used on éclats when the player can
   *  buy a pack — gives a passive nudge to open the boutique. */
  accent: "ready" | "none";
  label: string;
}) {
  const interactive = !inert && !!onClick;
  const Tag = interactive ? motion.button : (big ? motion.div : motion.span);
  return (
    <Tag
      onClick={interactive ? onClick : undefined}
      whileTap={interactive ? { scale: 0.94 } : undefined}
      title={`${label} : ${value.toLocaleString("fr-FR")}`}
      aria-label={`${label} ${value}`}
      className={
        "relative inline-flex items-center gap-1 rounded-full ring-1 bg-gradient-to-br backdrop-blur-sm transition " +
        ring + " " + toneFrom + " " + toneTo + " " +
        (big ? "px-3 py-1.5" : "px-2 py-0.5") + " " +
        (interactive ? "cursor-pointer hover:brightness-110" : "")
      }
    >
      <span className={big ? "text-base" : "text-[11px]"}>{icon}</span>
      <span className={"font-black tabular-nums " + text + " " + (big ? "text-sm" : "text-[11px]")}>
        {formatCompact(value)}
      </span>
      {accent === "ready" && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: [0.7, 1.1, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className={
            "absolute rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] " +
            (big ? "top-0 right-0 w-2.5 h-2.5" : "-top-0.5 -right-0.5 w-2 h-2")
          }
          aria-hidden
        />
      )}
    </Tag>
  );
}

/** Pretty-print large numbers so the chip stays narrow ("1.2k" instead of
 *  "1 234"). Keeps four digits readable at a glance. */
function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}
