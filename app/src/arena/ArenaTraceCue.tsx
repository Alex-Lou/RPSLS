/**
 * ArenaTraceCue — cue plein-écran « ★ ARÊTE TRACÉE » (Alex 2026-06-23 « j'ai rien
 * vu ni compris à la constellation »).
 *
 * LE TRACÉ était invisible : la barre constellation est minuscule et rien ne
 * signalait la cause→effet « j'ai gagné un counter de ma Voie → j'ai tracé une
 * arête ». Ce cue centré, déclenché à chaque montée d'étoile du JOUEUR, rend le
 * mécanisme LISIBLE et fort. One-shot, auto-démonté (AnimatePresence), zéro
 * repeat:Infinity → pas de fuite.
 */

import { AnimatePresence, motion } from "motion/react";
import { MOVE_PALETTE } from "../icons";
import { engineEffectText } from "./arenaEngines";
import type { Move } from "../engine/game";

export interface TraceCue {
  /** Nouvelle valeur de la jauge de Voie (1, 2 ou 3). */
  count: number;
  affinity?: Move;
  key: number;
}

const VOIE_NAME: Record<Move, string> = {
  rock: "Montagne", paper: "Forêt", scissors: "Tranchant", lizard: "Mirage", spock: "Cosmos",
};

export function ArenaTraceCue({ cue }: { cue: TraceCue | null }) {
  const color = cue?.affinity ? (MOVE_PALETTE[cue.affinity]?.hex ?? "#a78bfa") : "#a78bfa";
  const complete = (cue?.count ?? 0) >= 3;
  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 55 }}
      aria-hidden
    >
      <AnimatePresence>
        {cue && (
          <motion.div
            key={`tracecue-${cue.key}`}
            initial={{ opacity: 0, scale: 0.7, y: 12 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.12, 1.04, 1.08], y: [12, 0, 0, -10] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, times: [0, 0.18, 0.78, 1], ease: "easeOut" }}
            className="flex flex-col items-center gap-1"
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -18 }}
              animate={{ scale: [0.4, 1.45, 1.2], rotate: [-18, 0, 5] }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="text-6xl leading-none"
              style={{ color, filter: `drop-shadow(0 0 18px ${color})` }}
            >
              {complete ? "✦" : "★"}
            </motion.div>
            <div
              className="text-[11px] font-black uppercase tracking-[0.3em]"
              style={{ color, textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}
            >
              Counter gagné
            </div>
            <div
              className="text-base font-black uppercase tracking-widest"
              style={{ color: "#fff", textShadow: `0 0 12px ${color}, 0 2px 4px rgba(0,0,0,0.75)` }}
            >
              {VOIE_NAME[cue.affinity ?? "rock"]} {cue.count}/3
            </div>
            <div
              className="text-sm font-bold"
              style={{ color, textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
            >
              {complete ? "✦ FINISHER PRÊT !" : `→ ${engineEffectText(cue.affinity)}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
