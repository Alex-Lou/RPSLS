/**
 * ArenaHeistAnim — anim du cast Larcin (Heist).
 *
 * Une mini-carte face cachée s'arrache du paquet adverse, traverse l'écran
 * en arc avec un sillage doré, puis atterrit dans le paquet du caster où
 * elle flip face visible et fade. Effet "vol" cinéma — coût ~150 lignes.
 */

import { motion } from "motion/react";
import { CardImage } from "../ranked/CardImage";
import { CARDS } from "../ranked/cards";
import type { CardId } from "../ranked/rankedTypes";

interface ArenaHeistAnimProps {
  /** Côté qui a lancé Heist. Détermine la direction du vol. */
  caster: "you" | "opp";
  /** Carte piochée chez l'adversaire (révélée à l'atterrissage). Si absent,
   *  on flip sur l'envers stylisé (cas où la pioche n'est pas exposée). */
  stolen?: CardId;
  /** Clé d'instance pour relancer l'anim (resolver clé Date.now()). */
  animKey: number;
}

export function ArenaHeistAnim({ caster, stolen, animKey }: ArenaHeistAnimProps) {
  // Vol d'opposition vers nous = de top-right vers bottom-left.
  // Vol de nous vers opposition = de bottom-left vers top-right.
  const isFromOpp = caster === "you";
  const startCorner = isFromOpp
    ? { top: "10%", right: "8%" } as const
    : { bottom: "12%", left: "8%" } as const;
  const endCorner = isFromOpp
    ? { bottom: "14%", left: "8%" } as const
    : { top: "10%", right: "8%" } as const;
  const sx = isFromOpp ? 0 : 0;
  const sy = isFromOpp ? 0 : 0;
  // Trajet en arc : la carte traverse l'écran en haut puis redescend (Bézier
  // sur transitions y) → effet "vol courbé". Tween direct + offset Y midpoint.
  const dx = isFromOpp ? -380 : 380;
  const dy = isFromOpp ? 240 : -240;
  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden" key={animKey}>
      {/* Sillage doré qui suit la carte */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6, ...startCorner }}
        animate={{
          opacity: [0, 0.9, 0.6, 0],
          scale: [0.6, 1.3, 1.5, 0.8],
          x: [sx, dx * 0.3, dx * 0.7, dx],
          y: [sy, dy * 0.3 - 60, dy * 0.7 - 30, dy],
        }}
        transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], times: [0, 0.3, 0.7, 1] }}
        className="absolute w-24 h-24 rounded-full bg-amber-300/55 blur-2xl shadow-[0_0_60px_20px_rgba(252,211,77,0.55)]"
        style={startCorner}
      />
      {/* Particules de poussière dorée (3 petites étoiles en traîne) */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          aria-hidden
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 0.95, 0.5, 0],
            scale: [0.4, 1.1, 0.9, 0.5],
            x: [sx, dx * 0.25 - 10 * i, dx * 0.6 - 20 * i, dx - 30 * i],
            y: [sy, dy * 0.25 - 40 + 8 * i, dy * 0.6 - 10 + 8 * i, dy + 8 * i],
          }}
          transition={{
            duration: 1.5,
            delay: 0.08 + i * 0.07,
            ease: [0.4, 0, 0.2, 1],
            times: [0, 0.3, 0.6, 1],
          }}
          className="absolute text-[10px] text-amber-200"
          style={startCorner}
        >
          ✦
        </motion.div>
      ))}
      {/* La carte volée : face cachée pendant le vol, flip visible à l'arrivée */}
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.65,
          rotateY: 180,
          rotateZ: isFromOpp ? -18 : 18,
          x: sx,
          y: sy,
          ...startCorner,
        }}
        animate={{
          opacity: [0, 1, 1, 1, 1, 0],
          scale: [0.65, 1.0, 1.1, 1.05, 1.0, 0.7],
          rotateY: [180, 180, 90, 0, 0, 0],
          rotateZ: [
            isFromOpp ? -18 : 18,
            isFromOpp ? -12 : 12,
            0,
            isFromOpp ? 4 : -4,
            isFromOpp ? 2 : -2,
            0,
          ],
          x: [sx, dx * 0.35, dx * 0.7, dx, dx, dx + (isFromOpp ? -8 : 8)],
          y: [sy, dy * 0.35 - 70, dy * 0.7 - 35, dy, dy, dy + (isFromOpp ? 10 : -10)],
        }}
        transition={{
          duration: 1.8,
          ease: [0.45, 0, 0.25, 1],
          times: [0, 0.25, 0.55, 0.7, 0.88, 1],
        }}
        style={{
          ...startCorner,
          position: "absolute",
          width: 88,
          height: 124,
          transformStyle: "preserve-3d",
          perspective: 1000,
          willChange: "transform",
        }}
      >
        <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-amber-300/85 shadow-2xl shadow-amber-900/60 bg-gradient-to-br from-zinc-900 via-zinc-800 to-amber-950">
          {stolen && CARDS[stolen] ? (
            <CardImage id={stolen} glyphSize="text-3xl" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-5xl drop-shadow-[0_0_8px_rgba(252,211,77,0.85)]">🏴‍☠️</div>
            </div>
          )}
          <div className="absolute top-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/80 text-amber-200 text-[8px] font-black tabular-nums">
            {stolen && CARDS[stolen] ? CARDS[stolen].cost : "?"}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-0.5">
            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-center text-amber-200">
              LARCIN
            </div>
          </div>
        </div>
      </motion.div>
      {/* Flash final à l'atterrissage */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 0.9, 0], scale: [0.4, 0.4, 2.2, 2.8] }}
        transition={{ duration: 1.8, ease: "easeOut", times: [0, 0.7, 0.85, 1] }}
        className="absolute w-32 h-32 rounded-full bg-amber-200/60 blur-2xl"
        style={endCorner}
      />
    </div>
  );
}
