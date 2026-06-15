/**
 * PlannedSlot — render branch for a lane cell showing a PLANNED summon
 * (ghost-preview, dashed border, "en attente"). Présentationnel pur.
 */

import { motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { type Creature, type LaneIndex } from "../arenaTypes";

export function PlannedSlot({
  plannedSummon, clickable, clickableLabel, onClick, onRemoveSummon,
}: {
  plannedSummon: { lane: LaneIndex; move: Creature["move"] };
  clickable: boolean;
  clickableLabel: string;
  onClick?: () => void;
  onRemoveSummon?: () => void;
}) {
  const pal = MOVE_PALETTE[plannedSummon.move];
  const rim = moveRim(pal.hex);
  const plannedContent = (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      className="aspect-[5/4] w-full rounded-xl relative flex items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(20,22,32,0.55) 0%, rgba(10,12,20,0.55) 100%)",
        border: `2px dashed ${rim}`,
        boxShadow: `0 0 10px -3px ${moveGlow(pal.hex)}80`,
      }}
    >
      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-sm flex items-center gap-0.5" aria-label="en attente">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.1, 0.85] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
            className="w-1 h-1 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.7)]"
          />
        ))}
      </span>
      <div className="flex flex-col items-center justify-center">
        <MoveGlyph move={plannedSummon.move} className="w-12 h-12 sm:w-14 sm:h-14 opacity-85" />
        <span
          className="text-[9px] uppercase tracking-wider font-bold leading-none mt-1 opacity-90"
          style={{ color: rim }}
        >
          {plannedSummon.move}
        </span>
      </div>
    </motion.div>
  );
  // Croix rouge d'ANNULATION (Alex 2026-06-12 "0 souplesse") — retire
  // l'invocation planifiée sur la lane. Rendue en SIBLING du contenu (pas
  // enfant du <button> clickable) pour éviter un bouton imbriqué invalide.
  const removeX = onRemoveSummon ? (
    <button
      onClick={(e) => { e.stopPropagation(); onRemoveSummon(); }}
      className="absolute -top-1.5 -left-1.5 z-40 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black leading-none shadow-lg ring-2 ring-black/40 active:scale-90"
      aria-label="Annuler l'invocation"
    >
      ✕
    </button>
  ) : null;
  // Alex feedback 2026-06-09 : "remplacement ne marche pas" — quand on a
  // déjà planifié un symbole sur la lane, le slot était figé sans
  // clickable. Maintenant on wrap dans un button avec label "↻ Remplacer
  // (planifié)" pour permettre de changer d'avis avant le lock.
  if (clickable) {
    return (
      <div className="relative w-full">
        <button
          onClick={onClick}
          className="w-full focus:outline-none relative"
          aria-label={clickableLabel}
        >
          {plannedContent}
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-400/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap z-30">
            {clickableLabel}
          </span>
        </button>
        {removeX}
      </div>
    );
  }
  return (
    <div className="relative w-full">
      {plannedContent}
      {removeX}
    </div>
  );
}
