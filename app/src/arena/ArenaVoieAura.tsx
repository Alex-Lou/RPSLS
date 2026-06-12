/**
 * ArenaVoieAura — identité visuelle PERSO du joueur selon sa Voie.
 *
 * Rendu UNIQUEMENT sur le strip "you" (jamais l'adversaire, jamais partagé
 * comme les apparences/thèmes/pads — c'est une signature privée du joueur,
 * Alex 2026-06-12). Un calque animé `absolute inset-0` derrière le HUD perso :
 * teinte de base + "spine" (liseré) signature + un motif ambiant unique par
 * Voie. Alpha volontairement basse pour garder HP/mana parfaitement lisibles,
 * et `pointer-events-none` + inset-0 pour ZÉRO impact sur la hauteur du strip
 * (le pad reste stable).
 *
 *   Montagne (rock)     → facettes de granite qui dérivent lentement
 *   Forêt    (paper)    → feuilles d'émeraude qui montent en oscillant
 *   Tranchant(scissors) → lames d'acier qui balaient en diagonale
 *   Mirage   (lizard)   → brume iridescente violet↔cyan qui scintille
 *   Cosmos   (spock)    → champ d'étoiles indigo + souffle de nébuleuse
 */

import { motion } from "motion/react";
import type { Move } from "../engine/game";

interface VoieTheme {
  /** Liseré vertical gauche — couleur signature de la Voie. */
  spine: string;
  /** Dégradé de fond (alpha basse). */
  base: string;
  /** Lueur de bord intérieure. */
  glow: string;
}

const VOIE_THEME: Record<Move, VoieTheme> = {
  // Montagne — granite chaud, stone + ambre.
  rock: {
    spine: "linear-gradient(180deg, #d6d3d1, #b45309)",
    base: "linear-gradient(110deg, rgba(120,113,108,0.20) 0%, rgba(68,64,60,0.10) 55%, rgba(180,83,9,0.10) 100%)",
    glow: "inset 0 0 18px -6px rgba(214,211,209,0.5)",
  },
  // Forêt — émeraude vivante.
  paper: {
    spine: "linear-gradient(180deg, #6ee7b7, #059669)",
    base: "linear-gradient(110deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.08) 60%, rgba(4,120,87,0.10) 100%)",
    glow: "inset 0 0 18px -6px rgba(52,211,153,0.55)",
  },
  // Tranchant — acier + cramoisi.
  scissors: {
    spine: "linear-gradient(180deg, #fda4af, #be123c)",
    base: "linear-gradient(110deg, rgba(244,63,94,0.16) 0%, rgba(113,113,122,0.06) 55%, rgba(159,18,57,0.10) 100%)",
    glow: "inset 0 0 18px -6px rgba(251,113,133,0.5)",
  },
  // Mirage — iridescent violet→cyan.
  lizard: {
    spine: "linear-gradient(180deg, #c4b5fd, #22d3ee)",
    base: "linear-gradient(110deg, rgba(167,139,250,0.16) 0%, rgba(34,211,238,0.12) 60%, rgba(192,132,252,0.10) 100%)",
    glow: "inset 0 0 18px -6px rgba(167,139,250,0.55)",
  },
  // Cosmos — indigo profond stellaire.
  spock: {
    spine: "linear-gradient(180deg, #a5b4fc, #38bdf8)",
    base: "linear-gradient(110deg, rgba(99,102,241,0.18) 0%, rgba(30,27,75,0.10) 55%, rgba(56,189,248,0.10) 100%)",
    glow: "inset 0 0 18px -6px rgba(129,140,248,0.55)",
  },
};

/** Étoiles fixes (pas de Math.random → pas de jitter au re-render). */
const STARS: Array<[number, number, number]> = [
  // [x%, y%, taille px]
  [10, 32, 2], [26, 68, 1.5], [42, 22, 2.5], [56, 58, 1.5],
  [70, 36, 2], [84, 70, 1.5], [18, 84, 1.5], [62, 82, 2],
];
const LEAVES = [16, 40, 60, 82]; // positions X% des feuilles

export function VoieAura({ affinity }: { affinity: Move }) {
  const th = VOIE_THEME[affinity];
  return (
    <div
      className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
      style={{ zIndex: 0, boxShadow: th.glow, border: "1px solid rgba(255,255,255,0.05)" }}
      aria-hidden
    >
      {/* Teinte de base qui "respire" lentement. */}
      <motion.div
        className="absolute inset-0"
        style={{ background: th.base }}
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Liseré signature à gauche. */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: th.spine }}
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <VoieMotif affinity={affinity} />
    </div>
  );
}

/** Motif ambiant propre à chaque Voie. Nombre de nœuds animés volontairement
 *  modeste (≤6) — WebView Android, on reste sur transform/opacity. */
function VoieMotif({ affinity }: { affinity: Move }) {
  switch (affinity) {
    case "rock":
      return (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${18 + i * 30}%`,
                top: `${20 + (i % 2) * 38}%`,
                width: 22 - i * 3,
                height: 22 - i * 3,
                background: "linear-gradient(135deg, rgba(214,211,209,0.32), rgba(120,113,108,0.06))",
                clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
              }}
              animate={{ x: [0, 5, 0], y: [0, -3, 0], rotate: [0, 6, 0], opacity: [0.35, 0.6, 0.35] }}
              transition={{ duration: 7 + i * 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
            />
          ))}
        </>
      );
    case "paper":
      return (
        <>
          {LEAVES.map((x, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${x}%`,
                bottom: "-10%",
                width: 9,
                height: 9,
                borderRadius: "0 100% 0 100%",
                background: "linear-gradient(135deg, rgba(110,231,183,0.55), rgba(5,150,105,0.15))",
              }}
              animate={{ y: ["0%", "-180%"], x: [0, i % 2 ? 8 : -8, 0], rotate: [0, 180, 360], opacity: [0, 0.7, 0] }}
              transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 1.1 }}
            />
          ))}
        </>
      );
    case "scissors":
      return (
        <>
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              className="absolute -inset-y-2 w-10"
              style={{
                left: "-20%",
                background:
                  "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 45%, rgba(244,63,94,0.7) 55%, transparent 100%)",
                transform: "skewX(-22deg)",
                mixBlendMode: "screen",
              }}
              animate={{ left: ["-25%", "120%"], opacity: [0, 0.9, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2.4, ease: "easeIn", delay: i * 1.9 }}
            />
          ))}
        </>
      );
    case "lizard":
      return (
        <>
          {[28, 52, 74].map((y, i) => (
            <motion.div
              key={i}
              className="absolute left-0 right-0 h-3"
              style={{
                top: `${y}%`,
                background:
                  "linear-gradient(90deg, transparent, rgba(167,139,250,0.4), rgba(34,211,238,0.4), transparent)",
                filter: "blur(2px)",
                mixBlendMode: "screen",
              }}
              animate={{ x: ["-12%", "12%", "-12%"], scaleX: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            />
          ))}
        </>
      );
    case "spock":
      return (
        <>
          {/* Souffle de nébuleuse. */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 120% at 30% 50%, rgba(129,140,248,0.28) 0%, transparent 60%), radial-gradient(50% 100% at 80% 60%, rgba(56,189,248,0.22) 0%, transparent 60%)",
            }}
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          {STARS.map(([x, y, s], i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, boxShadow: "0 0 4px rgba(186,230,253,0.9)" }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
            />
          ))}
        </>
      );
    default:
      return null;
  }
}
