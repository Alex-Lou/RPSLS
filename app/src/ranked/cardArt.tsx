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
      decoding="async"
    />
  );
}

/** Fond d'identité de Voie pour les cartes SANS art (texture + liseré), gated par
 *  `card.voie`. Purement CSS, réversible. 1 entrée/Voie → DRY pour la réplication
 *  (Montagne/Mirage… puis Cosmos/Tranchant/Forêt). */
const VOIE_CARD_BG: Partial<Record<string, { background: string; boxShadow: string }>> = {
  // ⛰ Montagne — granite gris-pierre.
  rock: {
    background:
      "radial-gradient(circle at 50% 38%, rgba(168,162,158,0.35), rgba(68,64,60,0.22) 60%, transparent), repeating-linear-gradient(135deg, rgba(120,113,108,0.12) 0 3px, transparent 3px 7px)",
    boxShadow: "inset 0 0 0 1px rgba(214,211,209,0.4)",
  },
  // 🎭 Mirage — champ iridescent indigo↔cyan.
  lizard: {
    background:
      "radial-gradient(circle at 50% 38%, rgba(129,140,248,0.35), rgba(34,211,238,0.18) 60%, transparent), repeating-linear-gradient(135deg, rgba(99,102,241,0.12) 0 3px, transparent 3px 7px)",
    boxShadow: "inset 0 0 0 1px rgba(165,180,252,0.4)",
  },
  // ⚔️ Tranchant — acier + rose-cardinal.
  scissors: {
    background:
      "radial-gradient(circle at 50% 38%, rgba(244,63,94,0.30), rgba(148,163,184,0.18) 60%, transparent), repeating-linear-gradient(135deg, rgba(225,29,72,0.12) 0 3px, transparent 3px 7px)",
    boxShadow: "inset 0 0 0 1px rgba(254,205,211,0.4)",
  },
  // 🌲 Forêt — canopée émeraude + sève dorée.
  paper: {
    background:
      "radial-gradient(circle at 50% 38%, rgba(52,211,153,0.32), rgba(16,122,87,0.18) 60%, transparent), repeating-linear-gradient(135deg, rgba(5,150,105,0.12) 0 3px, transparent 3px 7px)",
    boxShadow: "inset 0 0 0 1px rgba(167,243,208,0.4)",
  },
  // 🌌 Cosmos — nébuleuse violette + cyan glacé.
  spock: {
    background:
      "radial-gradient(circle at 50% 38%, rgba(139,92,246,0.32), rgba(34,211,238,0.16) 60%, transparent), repeating-linear-gradient(135deg, rgba(124,58,237,0.12) 0 3px, transparent 3px 7px)",
    boxShadow: "inset 0 0 0 1px rgba(196,181,253,0.4)",
  },
};

/** Gradient + glyph placeholder for cards without art. */
export function CardArtFallback({
  card,
  glyphSize = "text-2xl",
}: {
  card: RankedCard;
  glyphSize?: string;
}) {
  const voieBg = card.voie ? VOIE_CARD_BG[card.voie] : undefined;
  return (
    <div
      className={
        "absolute inset-0 flex items-center justify-center bg-gradient-to-br " +
        RARITY_BG[card.rarity]
      }
    >
      {voieBg && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: voieBg.background, boxShadow: voieBg.boxShadow }}
        />
      )}
      <span className={glyphSize + " drop-shadow-md relative"}>{card.glyph}</span>
    </div>
  );
}
