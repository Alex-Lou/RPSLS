/**
 * ArenaSpellsReveal — défilé "croupier" des sorts joués pendant la reveal phase.
 *
 * Remplace l'unique BigCardReveal (qui ne montrait que la première carte) :
 * chaque carte du côté lock-in arrive face cachée, flip sur elle-même puis
 * glisse vers sa position de repos dans une rangée. Les cartes suivantes
 * arrivent en cascade avec un stagger, comme un croupier qui étale.
 *
 * KISS : pas d'état, pas d'effet. Position absolue dans le board overlay,
 * cleanup via AnimatePresence du parent.
 */

import type React from "react";
import { motion } from "motion/react";
import { CardImage } from "../ranked/CardImage";
import { CARDS, RARITY_COLOR } from "../ranked/cards";
import type { PlayedSpell } from "./arenaTypes";

const RARITY_BORDER: Record<string, string> = {
  common: "border-zinc-300/85 shadow-zinc-900/55",
  rare: "border-sky-300/85 shadow-sky-900/55",
  epic: "border-violet-300/85 shadow-violet-900/55",
  legendary: "border-amber-300/85 shadow-amber-900/55",
};
const RARITY_AURA: Record<string, string> = {
  common: "bg-zinc-300/35",
  rare: "bg-sky-400/50",
  epic: "bg-violet-400/55",
  legendary: "bg-amber-400/65",
};

interface ArenaSpellsRevealProps {
  spells: PlayedSpell[];
  side: "opp" | "you";
}

const STAGGER = 0.22;
const CARD_DURATION = 1.5;

export function ArenaSpellsReveal({ spells, side }: ArenaSpellsRevealProps) {
  if (spells.length === 0) return null;
  const isOpp = side === "opp";

  const n = spells.length;
  const slotW = 56;
  const slotH = 78;
  const overlap = 28;
  const rowW = n === 1 ? slotW : slotW + (n - 1) * (slotW - overlap);
  // Alex 2026-06-11 : opp en HAUT-DROITE du pad (anchor right), you en
  // BAS-GAUCHE (anchor left). Les cartes s'étalent vers l'intérieur depuis
  // le coin d'ancrage (croupier qui étale ses cartes).
  const anchorPos = isOpp
    ? "top-2 right-2 sm:top-3 sm:right-3"
    : "bottom-2 left-2 sm:bottom-3 sm:left-3";
  return (
    <div
      aria-hidden
      className={"absolute z-30 pointer-events-none " + anchorPos}
      style={{ width: rowW + 24, height: slotH + 28 }}
    >
      <div
        className={
          "absolute text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border " +
          (isOpp
            ? "top-0 right-0 bg-rose-950/85 border-rose-300/55 text-rose-100"
            : "bottom-0 left-0 bg-emerald-950/85 border-emerald-300/55 text-emerald-100")
        }
      >
        {isOpp ? "ADV." : "TOI"}
      </div>
      {spells.map((spell, idx) => (
        <RevealCard
          key={`${side}-${idx}-${spell.id}`}
          id={spell.id}
          idx={idx}
          total={n}
          side={side}
          slotW={slotW}
          slotH={slotH}
          overlap={overlap}
        />
      ))}
    </div>
  );
}

interface RevealCardProps {
  id: PlayedSpell["id"];
  idx: number;
  total: number;
  side: "opp" | "you";
  slotW: number;
  slotH: number;
  overlap: number;
}

function RevealCard({ id, idx, total, side, slotW, slotH, overlap }: RevealCardProps) {
  const card = CARDS[id];
  const rarity = card?.rarity ?? "common";
  const isOpp = side === "opp";

  // Décalage progressif depuis l'ancre (opp=top-right → vers la gauche,
  // you=bottom-left → vers la droite) : effet "étalage croupier".
  const restingOffset = idx * (slotW - overlap);
  const restingZ = idx - (total - 1) / 2;
  const restingTilt = restingZ * 4;

  // Carte arrive depuis le bord HORS-écran du côté ancré, puis se range
  // vers le centre du pad.
  const arriveFromX = isOpp ? 200 : -200;
  const arriveFromY = isOpp ? -40 : 40;

  const delay = idx * STAGGER;
  const lifespan = CARD_DURATION + (total - 1) * STAGGER;

  // Position absolue ancrée : opp colle au top-right, you colle au bottom-left.
  const anchorStyle: React.CSSProperties = isOpp
    ? { top: 6, right: restingOffset }
    : { bottom: 6, left: restingOffset };

  return (
    <motion.div
      initial={{ opacity: 0, x: arriveFromX, y: arriveFromY, rotateY: 180, rotateZ: 0, scale: 0.7 }}
      animate={{
        opacity: [0, 1, 1, 1, 1, 0],
        x: [arriveFromX, 0, 0, 0, 0, isOpp ? 6 : -6],
        y: [arriveFromY, 0, 0, 0, 0, isOpp ? -4 : 4],
        rotateY: [180, 180, 0, 0, 0, 0],
        rotateZ: [0, restingTilt * 1.5, restingTilt, restingTilt, restingTilt, restingTilt * 0.5],
        scale: [0.7, 1.05, 1, 1, 1, 0.85],
      }}
      transition={{
        duration: lifespan,
        delay,
        times: [0, 0.18, 0.32, 0.55, 0.85, 1],
        ease: "easeOut",
      }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 900,
        willChange: "transform",
        position: "absolute",
        width: slotW,
        height: slotH,
        zIndex: 10 + idx,
        ...anchorStyle,
      }}
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.55 }}
        animate={{ opacity: [0, 0.85, 0.4, 0], scale: [0.55, 1.6, 1.85, 2.1] }}
        transition={{ duration: 1.2, delay, times: [0, 0.35, 0.7, 1], ease: "easeOut" }}
        className={"absolute inset-0 rounded-3xl blur-2xl " + RARITY_AURA[rarity]}
      />
      <div
        className={
          "relative w-full h-full rounded-xl overflow-hidden border-2 shadow-2xl " +
          RARITY_BORDER[rarity]
        }
      >
        <CardImage id={id} glyphSize="text-2xl" />
        <div className="absolute top-0.5 left-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/80 text-sky-200 text-[8px] font-black tabular-nums">
          {card?.cost ?? 0}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5">
          <div className={"text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-center " + RARITY_COLOR[rarity]}>
            {rarity}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
