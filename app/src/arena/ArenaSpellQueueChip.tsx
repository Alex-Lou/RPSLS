/**
 * ArenaSpellQueueChip — mini-carte cliquable pour les sorts planifiés.
 *
 * Remplace l'ancien chip glyph+texte (bouton avec emoji) par une vraie mini
 * carte CCG avec art, badge mana, badge lane (L1/2/3) et croix retrait. Sert
 * dans la queue intent (sous la main) et dans la rangée utility sur l'avatar
 * (sorts self/hero/global).
 *
 * KISS : pas d'état interne. Le parent gère onRemove. AnimatePresence parent
 * fournit l'enter/exit anim.
 */

import { motion } from "motion/react";
import { CardImage } from "../ranked/CardImage";
import { CARDS } from "../ranked/cards";
import type { CardId } from "../ranked/rankedTypes";

const RING_BY_RARITY: Record<string, string> = {
  common: "ring-zinc-300/70",
  rare: "ring-sky-300/80",
  epic: "ring-violet-300/80",
  legendary: "ring-amber-300/85",
};

interface ArenaSpellQueueChipProps {
  id: CardId;
  /** Label de lane (1-3) si lane-target. Caché si undefined. */
  laneLabel?: number;
  /** Coût mana à afficher (déjà calculé avec CALCUL Finisher si actif). */
  cost: number;
  /** Côté : "you" (teinte emerald) vs "opp" (teinte rose). Pour le preview opp. */
  side?: "you" | "opp";
  /** Si true, mini-mode encore plus compact (rangée utility avatar). */
  compact?: boolean;
  onRemove?: () => void;
}

export function ArenaSpellQueueChip({
  id, laneLabel, cost, side = "you", compact = false, onRemove,
}: ArenaSpellQueueChipProps) {
  const card = CARDS[id];
  if (!card) return null;
  const rarity = card.rarity;
  const isOpp = side === "opp";
  // Simplification (Alex 2026-06-11) : chip plus compact, croix discrète à
  // cheval sur le bord, pas de bandeau rareté qui mange la miniature.
  const w = compact ? 30 : 36;
  const h = compact ? 40 : 48;
  return (
    <motion.button
      layout
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      whileTap={onRemove ? { scale: 0.92 } : undefined}
      onClick={onRemove}
      disabled={!onRemove}
      className={
        "relative rounded-md overflow-visible ring-2 shadow shrink-0 " +
        (onRemove ? "active:scale-95 " : "pointer-events-none ") +
        RING_BY_RARITY[rarity] + " " +
        (isOpp ? "shadow-rose-900/55 " : "shadow-emerald-900/55 ")
      }
      style={{ width: w, height: h }}
      aria-label={onRemove ? `Retirer ${card.nameKey}` : card.nameKey}
    >
      {/* Wrapper qui clip l'art à l'intérieur du chip seulement (croix exclue) */}
      <div className="absolute inset-0 rounded-md overflow-hidden">
        <CardImage id={id} glyphSize={compact ? "text-sm" : "text-base"} />
        {/* Badge mana cost top-left — compact */}
        <span className="absolute top-0 left-0 px-1 py-0 bg-black/85 text-sky-200 text-[8px] font-black tabular-nums leading-tight rounded-br-md">
          {cost}
        </span>
        {/* Badge lane label bottom-right — compact */}
        {laneLabel !== undefined && (
          <span className="absolute bottom-0 right-0 px-1 py-0 bg-amber-500/90 text-white text-[8px] font-black tabular-nums leading-tight rounded-tl-md">
            L{laneLabel}
          </span>
        )}
      </div>
      {/* Croix à cheval sur le bord — sortant juste un poil, en overlay hors clip. */}
      {onRemove && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center shadow ring-[1px] ring-rose-950/80 leading-none">
          ✕
        </span>
      )}
    </motion.button>
  );
}
