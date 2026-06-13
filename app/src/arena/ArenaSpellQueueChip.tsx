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
  /** Index dans un éventail (Alex 2026-06-11) : >0 → overlap vers la gauche
   *  + léger tilt + zIndex croissant, pour empiler proprement sans déborder. */
  fanIndex?: number;
  onRemove?: () => void;
}

export function ArenaSpellQueueChip({
  id, laneLabel, cost, side = "you", compact = false, fanIndex = 0, onRemove,
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
      // Sortie : RETRAIT manuel (croix dispo) = disparition sobre ; sinon la
      // carte a été UTILISÉE → désintégration « poussière d'étoile dorée » qui
      // s'envole vers le haut (Alex 2026-06-13). One-shot, leak-free.
      exit={onRemove
        ? { scale: 0.5, opacity: 0, y: -4 }
        : {
            // ⚠ DEUX conditions pour que la désintégration JOUE (Alex 2026-06-13,
            // 2 fois remontée) : (1) transition DURATION ici — l'exit anime des
            // KEYFRAMES (tableaux) qu'un RESSORT snappe ; (2) l'AnimatePresence
            // parent (ArenaHeroStrip) doit rester MONTÉ à la consommation, sinon
            // l'exit ne joue jamais. La carte CONSOMMÉE gonfle, se dore à blanc,
            // puis se DISSOUT vers le haut.
            opacity: [1, 1, 0],
            y: [0, -10, -38],
            scale: [1, 1.25, 0.35],
            rotate: [0, -3, 7],
            filter: ["brightness(1)", "brightness(2.2) saturate(2.4)", "brightness(1.6)"],
            transition: { duration: 0.64, ease: "easeOut", times: [0, 0.4, 1] },
          }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      whileTap={onRemove ? { scale: 0.92 } : undefined}
      onClick={onRemove}
      disabled={!onRemove}
      className={
        "relative rounded-md overflow-visible ring-2 shadow shrink-0 " +
        (onRemove ? "active:scale-95 " : "pointer-events-none ") +
        RING_BY_RARITY[rarity] + " " +
        (isOpp ? "shadow-rose-900/55 " : "shadow-sky-900/55 ")
      }
      style={{
        width: w,
        height: h,
        marginLeft: fanIndex > 0 ? -Math.round(w * 0.45) : 0, // overlap éventail
        rotate: fanIndex > 0 ? `${Math.min(fanIndex, 4) * 3}deg` : "0deg",
        zIndex: 10 + fanIndex,
      }}
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
      {/* ✨ DÉSINTÉGRATION dorée — flash central + 12 paillettes en éventail vers
       *  le HAUT. Invisibles à l'affichage, jouées À LA SORTIE seulement quand la
       *  carte est CONSOMMÉE (pas de croix). One-shot via exit (durée), leak-free.
       *  Enfants du chip → s'animent quand l'AnimatePresence parent le démonte. */}
      {!onRemove && (
        <motion.span
          key="dust-flash"
          className="absolute left-1/2 top-1/2 w-6 h-6 -ml-3 -mt-3 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,243,191,0.95), transparent 70%)", mixBlendMode: "screen" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: [0, 1, 0], scale: [0.3, 1.9, 2.6] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}
      {!onRemove && Array.from({ length: 12 }, (_, i) => i).map((i) => {
        const a = (-150 + i * (120 / 11)) * (Math.PI / 180); // éventail vers le HAUT
        const dist = 16 + (i % 3) * 10;
        return (
          <motion.span
            key={`dust-${i}`}
            className="absolute left-1/2 top-1/2 w-1 h-1 -ml-0.5 -mt-0.5 rounded-full bg-amber-200 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: [0, 1, 0], x: [0, Math.cos(a) * dist], y: [0, Math.sin(a) * dist - 6], scale: [0.3, 1, 0.15] }}
            transition={{ duration: 0.62, ease: "easeOut", delay: (i % 6) * 0.025 }}
            style={{ boxShadow: "0 0 5px rgba(252,211,77,0.95)" }}
          />
        );
      })}
    </motion.button>
  );
}
