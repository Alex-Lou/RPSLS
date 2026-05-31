/**
 * CardImage — single source of truth for ranked-card art rendering.
 *
 * The card PNGs ship with a decorative frame; we crop it by combining
 * `object-cover` with a slight upscale (scale-[1.35]). The caller must
 * provide a sized wrapper with `relative overflow-hidden`.
 *
 * Falls back to a gradient + glyph when the card has no art.
 */

import { CARDS, RARITY_BG } from "./cards";
import type { CardId } from "./rankedTypes";
import { useT } from "../i18n";

export function CardImage({
  id,
  glyphSize = "text-2xl",
}: {
  id: CardId;
  /** Tailwind text-size class for the emoji fallback. */
  glyphSize?: string;
}) {
  const t = useT();
  const card = CARDS[id];
  if (card.art) {
    return (
      <img
        src={card.art}
        alt={t(card.nameKey)}
        className="absolute inset-0 w-full h-full object-cover scale-[1.35]"
        draggable={false}
      />
    );
  }
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
