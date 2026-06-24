/**
 * ArenaFuseReveal — ✦ RÉVÉLATION DE FUSION plein centre du pad.
 *
 * Extrait de ArenaBoard (Alex 2026-06-22, « au fil de l'eau » : on dégraisse le
 * fichier touché sous 400 lignes). Feature autonome : capture la carte forgée à
 * l'instant exact du flash (forgeFlashKey ne bump QUE sur une fusion, jamais sur
 * un simple dépôt) puis la révèle en grand au centre avec le burst autour. La
 * capture évite qu'un dépôt ultérieur (forgeFlashKey inchangé) ne ré-affiche la
 * révélation, et fige la carte même si le joueur récupère vite. JSX verbatim.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CardImage } from "../../ranked/CardImage";
import { FusionBurst } from "../ArenaForge";
import type { CardId } from "../../ranked/rankedTypes";

export function ArenaFuseReveal({ forgeFlashKey, forgeYou }: {
  forgeFlashKey: number | null;
  forgeYou: CardId | null;
}) {
  const [fuseReveal, setFuseReveal] = useState<{ key: number; card: CardId } | null>(null);
  useEffect(() => {
    if (forgeFlashKey && forgeYou) setFuseReveal({ key: forgeFlashKey, card: forgeYou });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forgeFlashKey]);
  return (
    <AnimatePresence>
      {fuseReveal && (
        <motion.div
          key={`fuse-reveal-${fuseReveal.key}`}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 48 }}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut", times: [0, 0.1, 0.78, 1] }}
        >
          <FusionBurst size={1.9} />
          <motion.div
            className="relative w-16 sm:w-[72px] rounded-md overflow-hidden ring-2 ring-amber-300/90 shadow-[0_8px_22px_rgba(252,211,77,0.5)]"
            initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
            animate={{ scale: [0.2, 1.18, 1], rotate: [-12, 5, 0], opacity: [0, 1, 1] }}
            transition={{ duration: 0.62, ease: "easeOut", times: [0, 0.72, 1] }}
          >
            <CardImage id={fuseReveal.card} glyphSize="text-base" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
