import { motion } from "motion/react";
import { type ComboTheme } from "../engine/lanesCombos";
import { CARDS } from "./cards";
import type { PlayedCard } from "./rankedTypes";
import { useT } from "../i18n";

/**
 * Récap carte jouée + bannière de combo du reveal Classé — extraits VERBATIM de RankedRevealPhase.tsx.
 */

/* ──────────── Card-played recap line ──────────── */

/** One plain-language line: which card a side played + what it does.
 *  Tight inline layout — the chip sits right next to the card name with no
 *  empty gap. Text size bumped to text-xs so the opp card line reads cleanly
 *  even when the player didn't play one. */
export function CardLine({
  side, card, t,
}: {
  side: "you" | "opp";
  card: PlayedCard;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const meta = CARDS[card.id];
  if (!meta) return null;
  const isYou = side === "you";
  return (
    <div className="flex items-baseline gap-1.5 max-w-sm text-left">
      <span className={
        "text-[9px] uppercase tracking-wider font-bold px-1.5 py-px rounded shrink-0 " +
        (isYou ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
              : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30")
      }>
        {isYou ? t("ranked.tag.you") : t("prep.oppShort")}
      </span>
      <span className="text-sm shrink-0 self-center">🃏</span>
      <span className="text-xs leading-snug line-clamp-2 min-w-0">
        <b className={"font-bold " + (isYou ? "text-emerald-200" : "text-rose-200")}>{t(meta.nameKey)}</b>
        <span className="text-ink-muted"> — {t(meta.descKey)}</span>
      </span>
    </div>
  );
}

/* ──────────── Combo banner (compact version) ──────────── */

export function ComboBanner({
  combo, attribution,
}: {
  combo: ComboTheme;
  attribution: "you" | "opp" | "both" | null;
}) {
  const t = useT();
  const epic = combo.tier === "epic";
  const rare = combo.tier === "rare";
  const name = t(`combo.${combo.id}.name`);
  const tag = t(`combo.${combo.id}.tag`);
  const chip = attribution === "you" ? t("ranked.tag.you")
             : attribution === "opp" ? t("prep.oppShort")
             : attribution === "both" ? t("ranked.tag.both")
             : null;
  const chipCls = attribution === "you"
    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
    : attribution === "opp"
    ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
    : "bg-surface-2 text-ink-muted ring-zinc-500/30";
  return (
    <motion.div
      key={combo.id + ":" + (attribution ?? "x")}
      initial={{ opacity: 0, scale: 0.6, y: -8 }}
      animate={{
        opacity: 1,
        scale: epic ? [0.6, 1.2, 1] : 1,
        y: 0,
        x: epic ? [0, -4, 4, -2, 2, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.85, y: -6 }}
      transition={{ duration: epic ? 0.6 : 0.4, type: "spring", stiffness: 220, damping: 16 }}
      className="flex flex-col items-center gap-0.5 mt-1 w-full px-2"
    >
      {chip && (
        <div className={
          "text-[9px] uppercase tracking-[0.25em] font-bold px-1.5 py-px rounded ring-1 " + chipCls
        }>
          {chip}
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5 w-full">
        <span className="text-xl shrink-0">{combo.glyph}</span>
        <span
          className={
            (epic ? "text-xl sm:text-2xl" : rare ? "text-lg sm:text-xl" : "text-base sm:text-lg") +
            " font-black tracking-wide whitespace-nowrap bg-gradient-to-br " + combo.gradient +
            " bg-clip-text text-transparent"
          }
        >
          {name}
        </span>
        <span className="text-xl shrink-0">{combo.glyph}</span>
      </div>
      <div className={
        "text-[11px] tracking-wide text-center leading-tight " +
        (epic ? "text-amber-300/90" : rare ? "text-fuchsia-300/80" : "text-ink-muted")
      }>
        {tag}
      </div>
      {combo.bonus != null && combo.bonus > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-amber-300/70">
          +{combo.bonus}
        </div>
      )}
    </motion.div>
  );
}
