import { motion } from "motion/react";
import { MoveGlyph } from "../../icons";
import { type Creature } from "../arenaTypes";

/** Éclats de MORT — fragments fixes qui jaillissent quand une créature meurt.
 *  Vecteurs déterministes (pas de Math.random au render), transform/opacity only
 *  → GPU-safe (leçons perf Round 2). */
const DEATH_SHARDS: Array<{ dx: number; dy: number; rot: number }> = [
  { dx: -30, dy: -24, rot: -50 },
  { dx: 32, dy: -20, rot: 45 },
  { dx: -36, dy: 6, rot: 70 },
  { dx: 36, dy: 10, rot: -60 },
  { dx: -20, dy: 30, rot: 30 },
  { dx: 22, dy: 32, rot: -35 },
];

/**
 * DeathShatter — l'animation de MORT d'une créature : flash d'éclatement +
 * glyphe qui implose + éclats. Rendu en OVERLAY au niveau ArenaLaneSlot (au-dessus
 * de la case, quelle que soit la branche affichée) pour qu'elle joue TOUJOURS.
 * Avant, elle vivait DANS EmptySlot → elle était AVALÉE si la case affichait un
 * fantôme d'invocation planifiée (rangée joueur) ou une nouvelle créature, d'où le
 * « parfois la mort traîne sans anim, parfois oui parfois non » (Alex 2026-06-23).
 */
export function DeathShatter({ move, isPlayer }: { move: Creature["move"]; isPlayer: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[40]" aria-hidden>
      {/* FLASH d'éclatement — burst blanc→rouge qui explose vers l'extérieur. */}
      <motion.div
        initial={{ opacity: 0.95, scale: 0.5 }}
        animate={{ opacity: 0, scale: 2.5 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(244,63,94,0.6) 38%, transparent 70%)" }}
      />
      {/* Le glyphe SHATTER : pop bref (1→1.18) puis IMPLOSION (→0.2) + spin. */}
      <motion.div
        initial={{ opacity: 1, scale: 1, rotate: 0 }}
        animate={{ opacity: [1, 1, 0], scale: [1, 1.18, 0.2], rotate: isPlayer ? 32 : -32 }}
        transition={{ duration: 0.45, times: [0, 0.22, 1], ease: "easeIn" }}
        className="absolute inset-0 flex items-center justify-center"
        style={{ filter: "drop-shadow(0 0 10px rgba(244,63,94,0.8))" }}
      >
        <MoveGlyph move={move} className="w-12 h-12" />
      </motion.div>
      {/* ÉCLATS — fragments qui jaillissent du centre. */}
      {DEATH_SHARDS.map((s, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: s.dx, y: s.dy, opacity: 0, scale: 0.3, rotate: s.rot }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.04 }}
          className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-sm"
          style={{ marginLeft: -3, marginTop: -3, background: "#fda4af", boxShadow: "0 0 5px rgba(244,63,94,0.9)" }}
        />
      ))}
    </div>
  );
}
