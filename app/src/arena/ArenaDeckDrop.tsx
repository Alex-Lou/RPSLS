/**
 * ArenaDeckDrop — RÉVÉLATION de passage de PHASE (Alex 2026-06-17 « je ne ressens
 * rien quand mes cartes se retournent, accentue/crée le passage phase 1→2 + donne
 * des noms aux phases »). Joué UNE fois quand l'OUVERTURE (invocations seulement)
 * laisse place au DÉPLOIEMENT (cartes débloquées) : un nom de phase qui claque +
 * les cartes qui TOMBENT du deck et se RETOURNENT (dos premium → face) une à une.
 *
 * Overlay one-shot (AnimatePresence le démonte) — 100% transform/opacity. Auto-
 * dismiss géré par le parent (timer). Réutilisable pour les paliers suivants.
 */

import { motion } from "motion/react";
import { CardImage } from "../ranked/CardImage";
import { ArenaCardBack } from "./ArenaCardBack";
import type { CardId } from "../ranked/rankedTypes";

export function ArenaDeckDrop({ cards, phaseName }: { cards: CardId[]; phaseName: string }) {
  const shown = cards.slice(0, 5);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none" aria-hidden>
      {/* Scrim cosmique bref */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(60% 50% at 50% 45%, rgba(59,29,138,0.55), rgba(5,4,16,0.82))" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.0, times: [0, 0.12, 0.78, 1], ease: "easeInOut" }}
      />
      {/* Bandeau NOM DE PHASE */}
      <motion.div
        className="relative mb-3 px-5 py-1.5 text-center"
        initial={{ opacity: 0, y: -18, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [-18, 0, 0, -10], scale: [0.8, 1, 1, 1] }}
        transition={{ duration: 2.0, times: [0, 0.18, 0.8, 1], ease: "easeOut" }}
      >
        <div className="text-[11px] uppercase tracking-[0.3em] font-black text-amber-200/80">Phase 2</div>
        <div
          className="text-[26px] uppercase tracking-wider font-black text-amber-50"
          style={{ textShadow: "0 0 16px rgba(252,211,77,0.85), 0 2px 6px rgba(0,0,0,0.7)" }}
        >
          {phaseName}
        </div>
        <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-violet-200/70 mt-0.5">Cartes débloquées</div>
      </motion.div>
      {/* Les cartes TOMBENT du haut + se RETOURNENT (dos → face), décalées. */}
      <div className="relative flex items-end justify-center gap-2" style={{ perspective: 900 }}>
        {shown.map((id, i) => (
          <motion.div
            key={`${id}-${i}`}
            className="relative w-16 sm:w-[72px] aspect-[3/4]"
            initial={{ opacity: 0, y: -120, rotateZ: -8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-120, 0, 0, 24], rotateZ: [-8, 0, 0, 4] }}
            transition={{ duration: 1.8, times: [0, 0.4, 0.82, 1], ease: "easeOut", delay: 0.25 + i * 0.16 }}
          >
            {/* flip 3D : dos (180°) → face (0°) */}
            <motion.div
              className="relative w-full h-full"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.55 + i * 0.16, duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
            >
              <div className="absolute inset-0 rounded-md overflow-hidden ring-2 ring-amber-300/80 shadow-[0_8px_22px_rgba(252,211,77,0.4)]" style={{ backfaceVisibility: "hidden" }}>
                <CardImage id={id} glyphSize="text-base" />
              </div>
              <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <ArenaCardBack className="w-full h-full" glow />
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
