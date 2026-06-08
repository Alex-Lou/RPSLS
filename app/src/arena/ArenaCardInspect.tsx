/**
 * ArenaCardInspect — inline cheat-sheet for a hand card during planning.
 *
 * Surfaces name + cost + description + target hint + a "Lancer" CTA that
 * confirms the play. Triggered by the FIRST tap on a hand card in
 * ArenaPlanPhase (second tap on the same card commits via the CTA).
 *
 * Extracted out of ArenaPlanPhase.tsx so that file stays comfortably
 * under the 400-line ceiling.
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
    targetKind === "lane" ? "Cible : une lane"
    : targetKind === "self" ? "Cible : toi-même"
    : targetKind === "hero" ? "Cible : héros adverse"
    : "Effet global (pas de cible)";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-sky-400/40 bg-sky-500/10 backdrop-blur-sm px-3 py-2 max-w-md mx-auto w-full flex gap-2"
    >
      <div className="relative w-10 h-14 sm:w-12 sm:h-16 shrink-0 rounded-md overflow-hidden ring-1 ring-white/15">
        <CardImage id={id} glyphSize="text-lg" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-extrabold text-white truncate">{t(card.nameKey)}</span>
          <span className={"text-[9px] font-bold uppercase tracking-wider " + RARITY_COLOR[card.rarity]}>
            {card.rarity}
          </span>
          <span className="text-[9px] font-bold text-sky-300 tabular-nums">{card.cost}m</span>
        </div>
        <p className="text-[11px] text-ink leading-snug line-clamp-3">{t(card.descKey)}</p>
        <span className="text-[9px] uppercase tracking-wider text-ink-muted italic">🎯 {targetLabel}</span>
      </div>
      <div className="flex flex-col gap-1 shrink-0 justify-center">
        <button
          onClick={onCommit}
          className="px-2 py-1 rounded-md bg-emerald-500/30 border border-emerald-400/60 text-emerald-100 text-[10px] font-black uppercase tracking-wider"
        >Lancer</button>
        <button
          onClick={onClose}
          className="px-2 py-1 rounded-md bg-hairline text-ink-muted text-[10px] font-bold"
        >Fermer</button>
      </div>
    </motion.div>
  );
}
