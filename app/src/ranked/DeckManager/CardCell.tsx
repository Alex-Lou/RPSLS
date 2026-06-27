import { motion } from "motion/react";
import { CARDS, isPassiveCard, RARITY_COLOR } from "../cards";
import { isFusible } from "../../arena/arenaFusionCards";
import { isCastOnDraw } from "../../arena/arenaCastOnDraw";
import { CardImage } from "../CardImage";
import type { CardId } from "../rankedTypes";
import { RARITY_DOT, UNLOCK_HINTS } from "./deckManagerConstants";
import { FuseGlyph, BoltGlyph } from "../../icons";

/** Single card cell — the entire visual was extracted from the old inline
 *  rendering so the new layout reuses it inside each mana group AND so a
 *  per-cell staggered fade animation is possible (index-based delay). */
export function CardCell({
  id, index, unlocked, inDeck, isSelected, onClick, showFusion = false, t,
}: {
  id: CardId;
  index: number;
  unlocked: boolean;
  inDeck: boolean;
  isSelected: boolean;
  onClick: () => void;
  showFusion?: boolean;
  t: (key: string) => string;
}) {
  const card = CARDS[id];
  // ⚗ Fusionnable (Arena) : marqueur DISTINCT du point de rareté — Alex
  // confondait le point « rose » (= rareté ÉPIQUE violet) avec la fusion.
  const fusible = showFusion && isFusible(id);
  // ⚡ Cartes « à la pioche » (Cast When Drawn, Arena) : badge bleu DISTINCT du
  // ⚗ fusion — le joueur repère d'un coup d'œil les cartes qui s'activent au
  // tirage. Alex 2026-06-13.
  const castDraw = showFusion && isCastOnDraw(id);
  return (
    <motion.button
      onClick={onClick}
      whileTap={unlocked ? { scale: 0.92 } : undefined}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      // Tight stagger (16ms × index) — visible but never feels slow.
      transition={{ delay: Math.min(index * 0.016, 0.24), duration: 0.18 }}
      className={
        "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center transition " +
        (isSelected
          ? "ring-2 ring-inset ring-white shadow-lg shadow-white/30 scale-105"
          : inDeck
          ? "ring-2 ring-inset ring-emerald-400/50 opacity-70"
          : unlocked
          ? "ring-1 ring-inset ring-white/20"
          : "ring-1 ring-inset ring-white/5 grayscale opacity-30")
      }
    >
      <CardImage id={id} glyphSize="text-xl" />
      {/* Mana cost pip — top-left corner, always visible (helps with curve scanning). */}
      <div className="absolute top-0.5 left-0.5 z-10 inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-full bg-black/65 backdrop-blur-sm">
        {Array.from({ length: card.cost }, (_, k) => (
          <span key={k} className="w-1 h-1 rounded-full bg-sky-300" />
        ))}
      </div>
      {/* Coin sup-droit — Alex 2026-06-13 : en ARENA, ⚗ = FUSIONNABLE (et
       *  RIEN sinon → fini les « points roses » ambigus ; la rareté reste
       *  lisible via le texte coloré du bas). En CLASSÉ (pas de fusion), le
       *  micro-point de rareté comme avant. */}
      {fusible ? (
        <div
          className="absolute top-0.5 right-0.5 z-10 px-1 h-3.5 rounded-full bg-amber-400/95 flex items-center justify-center shadow ring-1 ring-amber-200/60"
          title="Fusionnable sur la Forge (Arena)"
        >
          <FuseGlyph className="w-2 h-2 text-zinc-900" />
        </div>
      ) : castDraw ? (
        <div
          className="absolute top-0.5 right-0.5 z-10 px-1 h-3.5 rounded-full bg-sky-400/95 flex items-center justify-center shadow ring-1 ring-sky-200/70"
          title="Se déclenche À LA PIOCHE (Cast When Drawn)"
        >
          <BoltGlyph className="w-2 h-2 text-zinc-900" />
        </div>
      ) : !showFusion ? (
        <div
          className={"absolute top-1 right-1 z-10 w-1.5 h-1.5 rounded-full " + RARITY_DOT[card.rarity]}
          aria-hidden
        />
      ) : null}
      {/* Name + rarity at the bottom — no duplicate glyph here (CardImage already
       *  renders the glyph as a fallback when card.art is null; superimposing
       *  another glyph on top of the actual art read as visual clutter). */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/65 backdrop-blur-sm py-0.5 px-1 flex flex-col items-center gap-0">
        <span className="text-[7px] font-bold uppercase text-white/95 text-center leading-tight truncate w-full">
          {t(card.nameKey)}
        </span>
        <span className={"text-[7px] font-bold leading-none " + RARITY_COLOR[card.rarity]}>
          {isPassiveCard(id) ? "passive" : card.rarity}
        </span>
      </div>
      {!unlocked && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-1 z-20">
          <span className="text-[8px] text-ink-muted text-center leading-tight">
            🔒 {UNLOCK_HINTS[id] ?? "Bientôt"}
          </span>
        </div>
      )}
      {inDeck && !isSelected && (
        <div className="absolute top-0.5 right-3 z-20 w-3 h-3 rounded-full bg-emerald-400 flex items-center justify-center">
          <span className="text-[7px] text-zinc-900 font-black">✓</span>
        </div>
      )}
    </motion.button>
  );
}
