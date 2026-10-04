/**
 * ArenaCardPeek — aperçu agrandi d'une carte de la main PENDANT l'appui long.
 *
 * La carte « monte » au-dessus du doigt (nom, coût, effet Arena) sans masquer
 * le plateau ; au relâché, ArenaPlanPhase ouvre la fiche complète. Purement
 * visuel : aucun toucher capté (pointer-events none), le geste reste sur la
 * carte d'origine (pointer capture).
 */
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { CARDS, RARITY_COLOR } from "../../ranked/cards";
import { CardImage } from "../../ranked/CardImage";
import { useT } from "../../i18n";
import type { CardId } from "../../ranked/rankedTypes";
import { arenaCardDescKey } from "../arenaTypes";

const W = 176;
const GUTTER = 12;

export function ArenaCardPeek({ id, anchorX }: { id: CardId; anchorX: number }) {
  const t = useT();
  const card = CARDS[id];
  const left = Math.min(Math.max(anchorX - W / 2, GUTTER), window.innerWidth - W - GUTTER);
  return createPortal(
    <motion.div
      // Au-dessus du coach du tuto (z-80), sous la fiche complète (z-10000).
      className="fixed z-[9000] pointer-events-none rounded-2xl overflow-hidden bg-surface-raised ring-2 ring-amber-300/80 shadow-2xl"
      style={{ left, width: W, bottom: "calc(var(--sai-bottom) + 150px)", transformOrigin: "50% 100%" }}
      initial={{ opacity: 0, scale: 0.55, y: 70 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 30, transition: { duration: 0.1 } }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden">
        <CardImage id={id} glyphSize="text-5xl" />
        <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/75 ring-1 ring-sky-400/60">
          {Array.from({ length: card.cost }, (_, k) => (
            <span key={k} className="w-1.5 h-1.5 rounded-full bg-sky-300" />
          ))}
          <span className="text-[10px] font-black text-sky-200 ml-0.5 tabular-nums">{card.cost}</span>
        </div>
      </div>
      <div className="px-2.5 py-2 bg-gradient-to-b from-black/40 to-black/75">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-[13px] font-extrabold text-white leading-tight">{t(card.nameKey)}</span>
          <span className={"text-[8px] font-bold uppercase tracking-wider shrink-0 " + RARITY_COLOR[card.rarity]}>{card.rarity}</span>
        </div>
        <p className="text-[11px] text-ink leading-snug mt-1 line-clamp-4">{t(arenaCardDescKey(id))}</p>
      </div>
    </motion.div>,
    document.body,
  );
}
