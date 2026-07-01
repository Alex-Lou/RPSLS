/**
 * CardHand — fanned hand of up to 4 cards.
 *
 * Cards are arranged in a real-hand fan: each card rotates around its bottom
 * centre, the outer ones lift slightly and tilt outward. The selected /
 * played card lifts above the fan and brings its z-index forward.
 *
 * The opponent's mirror (face-down) lives in OppHandIndicator.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CARDS } from "./cards";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";
import { fanGeometry } from "./handFan";
import { useT } from "../i18n";

/** True on short viewports (landscape phones) where the hand must shrink so
 *  the board + move picker still fit. Self-contained so callers don't thread
 *  a flag through. */
function useShortViewport(maxH = 560): boolean {
  const [short, setShort] = useState(
    typeof window !== "undefined" ? window.innerHeight < maxH : false,
  );
  useEffect(() => {
    const onResize = () => setShort(window.innerHeight < maxH);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [maxH]);
  return short;
}

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

export function CardHand({
  hand, mana, braiseStacks = 0, selected, playedId = null, onSelect, disabled = false, augurCooldown = 0,
}: {
  hand: CardId[];
  mana: number;
  /** Braise discount in mana on the NEXT card played (min effective cost 1). */
  braiseStacks?: number;
  selected: CardId | null;
  /** Id of the card currently committed for the round (cardPlayed.id). Used
   *  to mark self-target plays visually since they don't get a lane badge. */
  playedId?: CardId | null;
  onSelect: (id: CardId | null) => void;
  disabled?: boolean;
  augurCooldown?: number;
}) {
  const t = useT();
  const compact = useShortViewport();
  if (hand.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-[0.25em] text-ink-faint text-center py-1">
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
      // selected/played lift. Compact (landscape) shrinks the reserve.
      style={{ paddingTop: geo.lift + (compact ? 6 : 10), paddingBottom: 2 }}
    >
      {hand.map((id, i) => {
        const card = CARDS[id];
        const isSelected = selected === id;
        const isPlayed = i === playedIdx;
        const onCooldown = (id === "augur" || id === "oracle") && augurCooldown > 0;
        // Braise discount: the effective cost of the NEXT card the player
        // plays is reduced. Floor at 1 so cards always cost at least 1 mana.
        const effectiveCost = Math.max(1, card.cost - braiseStacks);
        const discounted = effectiveCost < card.cost;
        const playable = !disabled && effectiveCost <= mana && !onCooldown;
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
            effectiveCost={effectiveCost}
            discounted={discounted}
            angle={angle}
            yLift={yLift}
            overlap={i === 0 ? 0 : -geo.overlap}
            raised={raised}
            zIndex={raised ? 50 : 10 + i}
            index={i}
            compact={compact}
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
  id, selected, played, playable, effectiveCost, discounted, angle, yLift, overlap, raised, zIndex, index, compact, onClick,
}: {
  id: CardId;
  selected: boolean;
  played: boolean;
  playable: boolean;
  /** Cost after Braise discount — used for the pip cluster and the playable
   *  check. When < card.cost a 🔥 marker tells the player WHY it's cheaper. */
  effectiveCost: number;
  discounted: boolean;
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
  /** Short-viewport (landscape) → smaller card footprint. */
  compact: boolean;
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
        "relative rounded-xl overflow-hidden transition bg-surface-raised " +
        (compact
          ? "w-[36px] h-[48px] "
          : "w-[45px] h-[60px] sm:w-[52px] sm:h-[70px] ") +
        "ring-2 " + ring + " " + glow +
        (!playable ? " grayscale cursor-not-allowed" : "")
      }
    >
      <CardImage id={id} glyphSize="text-2xl sm:text-3xl" />
      {/* Mana pips — show the EFFECTIVE cost (post-Braise). When the discount
       *  is active, the pips turn ember-orange + a 🔥 marker reads "discount". */}
      <div className="absolute top-0.5 left-0 right-0 flex items-center justify-center gap-0.5 z-10">
        {discounted && <span className="text-[8px] mr-0.5" aria-hidden>🔥</span>}
        {Array.from({ length: effectiveCost }, (_, k) => (
          <div key={k} className={
            "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-black/30 " +
            (discounted ? "bg-orange-300" : "bg-white/90")
          } />
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
        <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-center text-white/90 truncate px-0.5">
          {t(card.nameKey)}
        </div>
      </div>
    </motion.button>
  );
}
