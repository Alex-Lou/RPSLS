/**
 * CardImage — thin composer that resolves a CardId to its rendered art.
 *
 * The actual rendering primitives (and the crop scale) live in cardArt.tsx;
 * this file just does the CardId → RankedCard lookup and binds the i18n alt
 * text, so callers that already have a RankedCard object can skip straight
 * to <CardArt> / <CardArtFallback>.
 *
 * The caller must provide a sized wrapper with `relative overflow-hidden`.
 */

import { CARDS } from "./cards";
import { CardArt, CardArtFallback } from "./cardArt";
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
  return card.art
    ? <CardArt card={card} alt={t(card.nameKey)} />
    : <CardArtFallback card={card} glyphSize={glyphSize} />;
}
