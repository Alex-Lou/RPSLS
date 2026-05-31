/**
 * cardArt — isolated rendering primitives for ranked-card art.
 *
 * The card PNGs ship with a uniform-ish white border baked in around the
 * artwork. We bury it with `object-cover` + a single tuned upscale; the
 * scale value lives here so it can be tweaked in one spot when new art
 * gets added.
 *
 * Both primitives assume their parent is a sized `relative overflow-hidden`
 * box (any aspect ratio). They render absolutely into that box.
 *
 * Usage:
 *   {card.art
 *     ? <CardArt card={card} alt={t(card.nameKey)} />
 *     : <CardArtFallback card={card} glyphSize="text-xl" />}
 *
 * If you only have a CardId (not the full RankedCard), use <CardImage id={id} />
 * from CardImage.tsx — it resolves the lookup + i18n alt for you.
 */

import type { RankedCard } from "./rankedTypes";
import { RARITY_BG } from "./cards";

/**
 * Crop factor applied to every card PNG to push the baked-in white border
 * outside the visible viewport. 1.55 covers the worst-case padding
 * (augur / surge / aegis ≈ 12-13% per side) with a safety margin and looks
 * clean across the low-padding cards too.
 */
export const CARD_ART_CROP_SCALE = 1.55;

/** Tailwind class used by <CardArt>. Kept as a named export in case a caller
 *  needs to render its own <img> (e.g. with extra attributes) while still
 *  matching the standard crop. */
export const CARD_ART_IMG_CLASS =
  "absolute inset-0 w-full h-full object-cover scale-[1.55]";

/** Crop-aware <img> for a card whose art is non-null. */
export function CardArt({ card, alt }: { card: RankedCard; alt: string }) {
  if (!card.art) return null;
  return (
    <img
      src={card.art}
      alt={alt}
      className={CARD_ART_IMG_CLASS}
      draggable={false}
    />
  );
}

/** Gradient + glyph placeholder for cards without art. */
export function CardArtFallback({
  card,
  glyphSize = "text-2xl",
}: {
  card: RankedCard;
  glyphSize?: string;
}) {
  return (
    <div
      className={
        "absolute inset-0 flex items-center justify-center bg-gradient-to-br " +
        RARITY_BG[card.rarity]
      }
    >
      <span className={glyphSize + " drop-shadow-md"}>{card.glyph}</span>
    </div>
  );
}
