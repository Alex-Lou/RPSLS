/**
 * CardHand — fanned hand of up to 4 cards.
 *
 * Cards are arranged in a real-hand fan: each card rotates around its bottom
 * centre, the outer ones lift slightly and tilt outward. The selected /
 * played card lifts above the fan and brings its z-index forward.
 *
 * The opponent's mirror (face-down) lives in OppHandIndicator.
 */

import { motion } from "motion/react";
import { CARDS } from "./cards";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";
import { useT } from "../i18n";

const RING_BY_RARITY: Record<string, string> = {
  common: "ring-zinc-400/40",
  rare: "ring-blue-400/50",
  epic: "ring-violet-400/60",
  legendary: "ring-amber-400/70",
};

const GLOW_BY_RARITY: Record<string, string> = {
  common: "",
  rare: "shadow-blue-400/20",
  epic: "shadow-violet-500/30",
  legendary: "shadow-amber-400/40",
};

/** Fan geometry for a given hand size — angle per slot, vertical lift of the
 *  outermost cards, and horizontal overlap. */
function fanGeometry(total: number) {
  if (total <= 1) return { spread: 0, lift: 0, overlap: 0 };
  if (total === 2) return { spread: 7, lift: 3, overlap: 8 };
  if (total === 3) return { spread: 9, lift: 5, overlap: 12 };
  return { spread: 8, lift: 7, overlap: 16 }; // 4 cards
}

export function CardHand({
  hand, mana, selected, playedId = null, onSelect, disabled = false, augurCooldown = 0,
}: {
  hand: CardId[];
  mana: number;
  selected: CardId | null;
  /** Id of the card currently committed for the round (cardPlayed.id). Used
   *  to mark self-target plays visually since they don't get a lane badge. */
  playedId?: CardId | null;
  onSelect: (id: CardId | null) => void;
  disabled?: boolean;
  augurCooldown?: number;
}) {
  const t = useT();
  if (hand.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 text-center py-1">
        {t("ranked.hand.empty")}
      </div>
    );
  }
  // Only light up the FIRST hand index matching playedId so duplicate cards
  // don't both flash.
  const playedIdx = playedId !== null ? hand.indexOf(playedId) : -1;
  const total = hand.length;
  const geo = fanGeometry(total);
  const mid = (total - 1) / 2;
  return (
    <div
      className="flex items-end justify-center relative"
      // CardHand is now at the bottom of the screen (player's side). Outer
      // cards rise UPWARD from the centre (yLift is applied as a negative y
      // in CardThumb), so paddingTop reserves room for that rise plus the
      // selected/played lift. paddingBottom stays tiny — bottoms are anchored.
      style={{ paddingTop: geo.lift + 26, paddingBottom: 2 }}
    >
      {hand.map((id, i) => {
        const card = CARDS[id];
        const isSelected = selected === id;
        const isPlayed = i === playedIdx;
        const onCooldown = (id === "augur" || id === "oracle") && augurCooldown > 0;
        const playable = !disabled && card.cost <= mana && !onCooldown;
        const offset = i - mid;
        const angle = offset * geo.spread;
        const yLift = Math.abs(offset) * geo.lift;
        const raised = isPlayed || isSelected;
        return (
          <CardThumb
            key={`${id}-${i}`}
            id={id}
            selected={isSelected}
            played={isPlayed}
            playable={playable}
            angle={angle}
            yLift={yLift}
            overlap={i === 0 ? 0 : -geo.overlap}
            raised={raised}
            zIndex={raised ? 50 : 10 + i}
            index={i}
            onClick={() => {
              if (!playable) return;
              onSelect(isSelected ? null : id);
            }}
          />
        );
      })}
    </div>
  );
}

function CardThumb({
  id, selected, played, playable, angle, yLift, overlap, raised, zIndex, index, onClick,
}: {
  id: CardId;
  selected: boolean;
  played: boolean;
  playable: boolean;
  /** Resting rotation (deg) for this slot in the fan. */
  angle: number;
  /** Resting upward lift (px) — outer cards sit higher than the centre. */
  yLift: number;
  /** Horizontal overlap with the previous card (negative margin in px). */
  overlap: number;
  /** True if this card is currently selected or already played; lifts above fan. */
  raised: boolean;
  zIndex: number;
  index: number;
  onClick: () => void;
}) {
  const t = useT();
  const card = CARDS[id];
  const ring = played
    ? "ring-emerald-400"
    : selected
    ? "ring-white"
    : RING_BY_RARITY[card.rarity];
  const glow = played
    ? "shadow-xl shadow-emerald-400/40"
    : selected
    ? "shadow-xl shadow-white/30"
    : GLOW_BY_RARITY[card.rarity];

  return (
    <motion.button
      onClick={onClick}
      disabled={!playable}
      initial={{ opacity: 0, y: 16, rotate: angle }}
      animate={{
        opacity: playable ? 1 : 0.35,
        // Cards live at the bottom of the screen: outer cards rise UPWARD
        // from the centre (y goes negative). Raised cards lift further still.
        y: raised ? -(yLift + 22) : -yLift,
        rotate: raised ? 0 : angle,
      }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 280, damping: 22 }}
      whileHover={playable ? { y: -(yLift + 10), rotate: 0, scale: 1.06 } : undefined}
      whileTap={playable ? { scale: 0.92 } : undefined}
      style={{
        marginLeft: overlap,
        zIndex,
        transformOrigin: "bottom center",
      }}
      className={
        "relative w-[56px] h-[76px] sm:w-[68px] sm:h-[92px] rounded-xl overflow-hidden transition bg-zinc-950 " +
        "ring-2 " + ring + " " + glow +
        (!playable ? " grayscale cursor-not-allowed" : "")
      }
    >
      <CardImage id={id} glyphSize="text-2xl sm:text-3xl" />
      {/* Mana pips */}
      <div className="absolute top-0.5 left-0 right-0 flex items-center justify-center gap-0.5 z-10">
        {Array.from({ length: card.cost }, (_, k) => (
          <div key={k} className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/90 ring-1 ring-black/30" />
        ))}
      </div>
      {/* Played checkmark — the only visible feedback for self-target cards
          (second-wind, vortex, supernova) which never get a lane badge. */}
      {played && (
        <div className="absolute top-1 right-1 z-20 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center shadow">
          <span className="text-[9px] text-zinc-900 font-black leading-none">✓</span>
        </div>
      )}
      {/* Name at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm py-0.5 z-10">
        <div className="text-[6px] sm:text-[7px] font-bold uppercase tracking-wider text-center text-white/90 truncate px-0.5">
          {t(card.nameKey)}
        </div>
      </div>
    </motion.button>
  );
}
