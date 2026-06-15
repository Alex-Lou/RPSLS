import { motion } from "motion/react";
import { CARDS, isPassiveCard, RARITY_COLOR } from "../cards";
import { CardImage } from "../CardImage";
import { masteryLevel, MASTERY_MAX_LEVEL } from "../../engine/economy";
import type { CardId } from "../rankedTypes";

export function CardDetailContent({
  id, masteryXp, owned, inDeck, t,
}: {
  id: CardId;
  masteryXp: number;
  owned: boolean;
  inDeck: boolean;
  t: (key: string) => string;
}) {
  const card = CARDS[id];
  const mastery = masteryLevel(masteryXp);
  const passive = isPassiveCard(id);
  // Rarity-tinted left border so each tier reads at a glance.
  const borderTint =
    card.rarity === "common"   ? "border-l-zinc-400"  :
    card.rarity === "rare"     ? "border-l-blue-400"  :
    card.rarity === "epic"     ? "border-l-violet-400" :
                                 "border-l-amber-400";
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={
        "relative rounded-xl border border-hairline border-l-4 bg-surface-raised px-3 py-2.5 flex gap-3 " +
        borderTint
      }
    >
      {/* Thumbnail — fixed small footprint so the text gets the room. */}
      <div className="relative w-14 h-[74px] sm:w-16 sm:h-[84px] shrink-0 rounded-md overflow-hidden ring-1 ring-white/15">
        <CardImage id={id} glyphSize="text-xl" />
      </div>
      {/* Right column: header line + description + target hint + footer chips. */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-extrabold text-white truncate">
            {t(card.nameKey)}
          </span>
          <span className={"text-[10px] font-bold uppercase tracking-wider " + RARITY_COLOR[card.rarity]}>
            {passive ? "Passive" : card.rarity}
          </span>
        </div>
        {/* Mana cost as a pip cluster — same visual language as the hand. */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">Coût</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: card.cost }, (_, k) => (
              <span key={k} className="w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" />
            ))}
          </div>
        </div>
        <p className="text-[11px] sm:text-xs text-ink leading-snug">
          {t(card.descKey)}
        </p>
        {card.targetHintKey && t(card.targetHintKey) && (
          <p className="text-[10px] text-ink-muted leading-snug italic">
            🎯 {t(card.targetHintKey)}
          </p>
        )}
        {/* Footer chips: ownership + in-deck + mastery progress (if owned). */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {!owned && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-zinc-600/40 text-ink-muted border border-hairline">
              🔒 Verrouillée
            </span>
          )}
          {owned && inDeck && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
              ✓ Dans le deck
            </span>
          )}
          {owned && !inDeck && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-white/5 text-ink-muted border border-hairline">
              Possédée
            </span>
          )}
          {owned && mastery > 1 && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-400/40">
              {mastery >= MASTERY_MAX_LEVEL ? "⭐" : "✦"} Maîtrise {mastery}/{MASTERY_MAX_LEVEL}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
