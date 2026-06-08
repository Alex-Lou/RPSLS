/**
 * ArenaCardInspect — fullscreen modal preview of a hand card.
 *
 * Hearthstone-style: tap a card in hand → the card POPS to a big readable
 * size in the center of the screen with full art, description, target hint
 * and a clear "Lancer" CTA. Tap outside / Fermer to dismiss. The board
 * underneath is dimmed so the player focuses on the card text.
 *
 * Rendered via a fixed/portal-like absolute overlay at z-50 so it never
 * affects the layout of the board or the plan phase below — that was the
 * "Arena se resize quand je choisis une carte" complaint from Alex.
 */

import { motion } from "motion/react";
import { CARDS, RARITY_COLOR } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import type { CardId } from "../ranked/rankedTypes";

export type SpellTargetKind = "lane" | "self" | "hero" | "global";

export interface ArenaCardInspectProps {
  id: CardId;
  targetKind: SpellTargetKind;
  t: (key: string) => string;
  onCommit: () => void;
  onClose: () => void;
}

export function ArenaCardInspect({
  id, targetKind, t, onCommit, onClose,
}: ArenaCardInspectProps) {
  const card = CARDS[id];
  const targetLabel =
    targetKind === "lane" ? "🎯 Touche une LANE après confirmation"
    : targetKind === "self" ? "🎯 Cible : ton héros (auto)"
    : targetKind === "hero" ? "🎯 Cible : héros adverse (auto)"
    : "🎯 Effet global — pas de cible à choisir";
  const rarityRingMap: Record<string, string> = {
    common: "ring-zinc-400/70",
    rare: "ring-blue-400/70",
    epic: "ring-violet-400/70",
    legendary: "ring-amber-400/70",
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4"
    >
      <motion.div
        initial={{ scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.7, y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className={
          "relative w-full max-w-xs rounded-3xl overflow-hidden bg-surface-raised ring-4 " +
          rarityRingMap[card.rarity] +
          " shadow-2xl"
        }
      >
        {/* Big card art — fills the upper portion */}
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          <CardImage id={id} glyphSize="text-7xl" />
          {/* Mana cost pill top-left */}
          <div className="absolute top-2 left-2 inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-black/75 backdrop-blur-sm ring-1 ring-sky-400/60">
            {Array.from({ length: card.cost }, (_, k) => (
              <span key={k} className="w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" />
            ))}
            <span className="text-[10px] font-black text-sky-200 ml-0.5 tabular-nums">{card.cost}</span>
          </div>
          {/* Close button top-right */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white text-base font-bold flex items-center justify-center hover:bg-black/85"
            aria-label="Fermer"
          >✕</button>
        </div>
        {/* Text panel below */}
        <div className="p-3 flex flex-col gap-2 bg-gradient-to-b from-black/40 to-black/70">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-extrabold text-white">{t(card.nameKey)}</span>
            <span className={"text-[10px] font-bold uppercase tracking-wider " + RARITY_COLOR[card.rarity]}>
              {card.rarity}
            </span>
          </div>
          <p className="text-[12px] text-ink leading-relaxed">
            {t(card.descKey)}
          </p>
          <span className="text-[10px] uppercase tracking-wider text-amber-300/90 italic font-bold">
            {targetLabel}
          </span>
          <button
            onClick={onCommit}
            className="mt-1 w-full py-2.5 rounded-xl font-black uppercase tracking-wider text-white text-sm bg-gradient-to-r from-emerald-500 to-teal-500 ring-2 ring-emerald-300/40 shadow-lg"
          >
            ✨ Lancer la carte
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
