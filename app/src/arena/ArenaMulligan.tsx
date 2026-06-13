/**
 * ArenaMulligan — modale de main de départ. Extrait de ArenaGame (2026-06-13,
 * « au fil de l'eau » : on dégraisse le fichier touché).
 *
 * Refonte (Alex) :
 *  - les DOUBLONS sont EMPILÉS (une seule tuile + carte « derrière » + ×N) au
 *    lieu d'occuper deux cases pour rien (#1/#6) ;
 *  - le remplacement est IMMÉDIAT et EN PLACE : taper une carte la remplace
 *    sur-le-champ par une autre, à la même position → on VOIT la nouvelle
 *    arriver, fini le doute « est-ce qu'une nouvelle vient ? » (#5).
 */

import { AnimatePresence, motion } from "motion/react";
import { CardImage } from "../ranked/CardImage";
import type { CardId } from "../ranked/rankedTypes";

export function ArenaMulligan({
  hand, swapsLeft, onRejectOne, onClose,
}: {
  hand: CardId[];
  /** Échanges restants (départ 2). 0 → tuiles non-interactives. */
  swapsLeft: number;
  /** Rejette la carte à cet index de la main → remplacée EN PLACE par le parent. */
  onRejectOne: (handIndex: number) => void;
  onClose: () => void;
}) {
  // Groupe les doublons : une tuile par carte, avec ses indices de main.
  const groups: { id: CardId; indices: number[] }[] = [];
  hand.forEach((id, i) => {
    const g = groups.find((x) => x.id === id);
    if (g) g.indices.push(i);
    else groups.push({ id, indices: [i] });
  });
  const canReject = swapsLeft > 0;
  return (
    <motion.div
      key="mulligan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-sm rounded-3xl border-2 border-amber-400/50 bg-zinc-950/97 p-4 shadow-2xl"
      >
        <div className="text-center mb-3">
          <div className="text-base font-black text-amber-200 uppercase tracking-wider">🔁 Main de départ</div>
          <p className="text-[11.5px] text-ink mt-1.5 leading-snug">
            <b>Tape une carte</b> qui ne te plaît pas (trop chère, inutile contre ta Voie…) : elle est <b>remplacée sur-le-champ</b> par une autre de ton deck.
          </p>
          <p className={"text-[11px] mt-1.5 font-black " + (canReject ? "text-amber-300" : "text-emerald-300")}>
            {canReject
              ? `${swapsLeft} échange${swapsLeft > 1 ? "s" : ""} restant${swapsLeft > 1 ? "s" : ""}`
              : "Plus d'échange — prêt !"}
          </p>
        </div>
        <div className="flex items-end justify-center gap-2 flex-wrap mb-4 min-h-[80px]">
          <AnimatePresence mode="popLayout">
            {groups.map((g) => {
              const n = g.indices.length;
              return (
                <motion.button
                  key={`${g.id}-${g.indices[0]}`}
                  layout
                  initial={{ opacity: 0, scale: 0.6, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: -8 }}
                  transition={{ type: "spring", stiffness: 360, damping: 26 }}
                  onClick={() => { if (canReject) onRejectOne(g.indices[0]); }}
                  disabled={!canReject}
                  className={"relative w-[52px] h-[71px] " + (canReject ? "active:scale-95" : "opacity-60 cursor-not-allowed")}
                >
                  {/* Carte « derrière » — montre qu'il y a un doublon (empilement). */}
                  {n > 1 && (
                    <div className="absolute inset-0 rounded-lg overflow-hidden ring-1 ring-white/15 -rotate-6 translate-x-1.5 translate-y-1.5 opacity-60">
                      <CardImage id={g.id} glyphSize="text-base" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-lg overflow-hidden ring-2 ring-white/25">
                    <CardImage id={g.id} glyphSize="text-xl" />
                  </div>
                  {n > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-zinc-900 text-[10px] font-black flex items-center justify-center ring-1 ring-amber-200 shadow">
                      ×{n}
                    </span>
                  )}
                  {canReject && (
                    <span className="absolute bottom-0 inset-x-0 bg-rose-600/85 text-white text-[8px] font-black text-center py-0.5 tracking-wider">↻ REJETER</span>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl font-black text-sm text-zinc-900 active:scale-95 transition"
          style={{ background: "linear-gradient(135deg, #fde68a, #f59e0b)" }}
        >
          C'est parti !
        </button>
      </motion.div>
    </motion.div>
  );
}
