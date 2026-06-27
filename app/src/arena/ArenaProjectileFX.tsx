/**
 * ArenaProjectileFX — projectiles « cailloux » lane→lane (Alex 2026-06-24/25).
 *
 * Jet de Caillou = 1 tir (cible). Éboulement = AOE → plusieurs tirs (lane ciblée
 * + lanes voisines touchées). Chaque caillou voyage de la cellule source (ma
 * rangée, lane N) vers la cellule cible (rangée adverse, lane N) en arc de cloche,
 * avec une TRAÎNÉE (comète), une poussière de départ et un flash d'impact, pour
 * que le JET soit clairement visible (Alex « je ne vois pas le jet / ni l'anim
 * d'éboulement »). La MORT éventuelle reste gérée par DeathShatter (diff de board).
 *
 * Multi-tirs : le composant reçoit une LISTE de tirs et en rend un par entrée,
 * décalés (stagger) par index → effet d'avalanche pour l'AOE. Géométrie lue via
 * data-arena-lane / data-arena-side relativement à data-arena-board-root.
 * GPU-safe (transform/opacity), one-shot via AnimatePresence + timers nettoyés.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LaneIndex, Side } from "./arenaTypes";

export interface ProjectileFX {
  fromSide: Side;
  toSide: Side;
  lane: LaneIndex;
  key: number;
}

interface Geo {
  from: { x: number; y: number };
  to: { x: number; y: number };
  apex: { x: number; y: number };
}

// Vol assez lent pour VOIR le lancé (Alex), MAIS la roche ACCÉLÈRE dans la cible
// (easeIn) et SLAM à l'impact — fini le « hyper trop mou, aucun ressenti » (Alex
// 2026-06-26). Le punch vient de l'impact sec (flash/onde/éclats/squash), pas de
// la durée. 0.95s = lisible sans flotter.
const TRAVEL_MS = 0.95; // s
// Éclats de roche qui giclent à l'impact (vecteurs déterministes → GPU-safe, pas
// de Math.random au render).
const IMPACT_SHARDS = [
  { dx: -26, dy: -20 }, { dx: 28, dy: -16 }, { dx: -32, dy: 6 },
  { dx: 33, dy: 10 }, { dx: -15, dy: 27 }, { dx: 20, dy: 29 }, { dx: 5, dy: -33 },
];

/** Rend la LISTE des tirs, chacun décalé par son index (avalanche pour l'AOE). */
export function ArenaProjectileFX({ shots }: { shots: ProjectileFX[] }) {
  return (
    <AnimatePresence>
      {shots.map((s, i) => (
        <SingleProjectile key={s.key} fx={s} delay={i * 0.09} />
      ))}
    </AnimatePresence>
  );
}

function SingleProjectile({ fx, delay }: { fx: ProjectileFX; delay: number }) {
  const [geo, setGeo] = useState<Geo | null>(null);

  // Coordonnées source/cible (centres des cellules de lane) en local de la racine
  // du board, au montage. Cellule manquante (rare) → on s'abstient.
  useEffect(() => {
    const root = document.querySelector("[data-arena-board-root]");
    const src = document.querySelector(`[data-arena-lane="${fx.lane}"][data-arena-side="${fx.fromSide}"]`);
    const dst = document.querySelector(`[data-arena-lane="${fx.lane}"][data-arena-side="${fx.toSide}"]`);
    if (!root || !src || !dst) return;
    const r = root.getBoundingClientRect();
    const center = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
    };
    const from = center(src);
    const to = center(dst);
    const apex = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 30 };
    setGeo({ from, to, apex });
  }, [fx.key]);

  if (!geo) return null;
  const { from, to, apex } = geo;
  // Instant où la roche PERCUTE (fraction du vol) → tous les FX d'impact s'y calent.
  const impactDelay = delay + TRAVEL_MS * 0.82;

  return (
    <motion.div aria-hidden className="absolute inset-0 pointer-events-none z-[46]">
      {/* Poussière de DÉPART à la source — on VOIT le caillou quitter la lane. */}
      <motion.div
        className="absolute w-7 h-7 rounded-full"
        style={{
          left: from.x - 14, top: from.y - 14,
          background: "radial-gradient(circle, rgba(214,211,209,0.85), rgba(120,113,108,0.35) 55%, transparent 72%)",
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0.85, 0], scale: [0.4, 1.5] }}
        transition={{ duration: 0.45, ease: "easeOut", delay }}
      />
      {/* TRAÎNÉE (comète) : 2 échos qui ACCÉLÈRENT avec la roche (easeIn). */}
      {[0.07, 0.035].map((d, i) => (
        <motion.div
          key={`trail-${i}`}
          className="absolute rounded-full"
          style={{
            left: 0, top: 0,
            width: 13 - i * 3, height: 13 - i * 3,
            marginLeft: -(6.5 - i * 1.5), marginTop: -(6.5 - i * 1.5),
            background: "radial-gradient(circle, rgba(231,229,228,0.75), rgba(120,113,108,0.45) 60%, transparent)",
          }}
          initial={{ x: from.x, y: from.y, opacity: 0 }}
          animate={{
            x: [from.x, apex.x, to.x],
            y: [from.y, apex.y, to.y],
            opacity: [0, 0.55 - i * 0.12, 0],
          }}
          transition={{ duration: TRAVEL_MS, ease: "easeIn", times: [0, 0.5, 0.82], delay: delay + d }}
        />
      ))}
      {/* LA ROCHE — accélère dans la cible (easeIn) puis SLAM + squash à l'impact. */}
      <motion.div
        className="absolute rounded-[44%]"
        style={{
          left: 0, top: 0, width: 26, height: 26, marginLeft: -13, marginTop: -13,
          background: "radial-gradient(circle at 34% 28%, #f5f5f4, #a8a29e 45%, #57534e 100%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.75), inset 0 1px 2px rgba(255,255,255,0.5)",
          border: "1px solid rgba(120,113,108,0.95)",
        }}
        initial={{ x: from.x, y: from.y, opacity: 0, scale: 0.5, rotate: 0 }}
        animate={{
          x: [from.x, apex.x, to.x, to.x],
          y: [from.y, apex.y, to.y, to.y],
          opacity: [0, 1, 1, 0],
          scale: [0.5, 1, 1.28, 0.35],
          rotate: [0, 210, 420, 460],
        }}
        transition={{ duration: TRAVEL_MS, ease: "easeIn", times: [0, 0.5, 0.82, 1], delay }}
      />
      {/* ── IMPACT (sec, punchy) — tout calé sur impactDelay ──────────────── */}
      {/* Flash dur et bref. */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: to.x - 30, top: to.y - 30, width: 60, height: 60,
          background: "radial-gradient(circle, rgba(255,255,255,0.98), rgba(252,211,77,0.6) 38%, transparent 70%)",
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], scale: [0.3, 1.5, 1.9] }}
        transition={{ duration: 0.22, ease: "easeOut", delay: impactDelay }}
      />
      {/* Onde de choc qui CLAQUE vers l'extérieur. */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: to.x - 20, top: to.y - 20, width: 40, height: 40, border: "3px solid rgba(231,229,228,0.95)" }}
        initial={{ opacity: 0.9, scale: 0.2 }}
        animate={{ opacity: 0, scale: 2.7 }}
        transition={{ duration: 0.34, ease: "easeOut", delay: impactDelay }}
      />
      {/* Éclats de roche qui GICLENT. */}
      {IMPACT_SHARDS.map((s, i) => (
        <motion.span
          key={`shard-${i}`}
          className="absolute rounded-[2px]"
          style={{ left: to.x - 2, top: to.y - 2, width: 4, height: 4, background: "#d6d3d1", boxShadow: "0 0 4px rgba(120,113,108,0.85)" }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.dx, y: s.dy, opacity: [1, 1, 0], scale: 0.3 }}
          transition={{ duration: 0.38, ease: "easeOut", delay: impactDelay }}
        />
      ))}
      {/* Kick de poussière au sol à l'impact. */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: to.x - 26, top: to.y - 13, width: 52, height: 26, background: "radial-gradient(ellipse, rgba(168,162,158,0.6), transparent 70%)" }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.7, 0], scale: [0.4, 1.3, 1.7] }}
        transition={{ duration: 0.4, ease: "easeOut", delay: impactDelay }}
      />
    </motion.div>
  );
}
