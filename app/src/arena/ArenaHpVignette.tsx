/**
 * ArenaHpVignette — PRESSION rouge en POINTILLISME quand tes PV chutent (Alex
 * 2026-06-13 : « pas un dégradé plat — un vrai effet de pression, particules
 * pointillisme qui apparaissent petit à petit, de plus en plus présentes, sur
 * les COINS de l'écran »).
 *
 * Héros 20 PV max → la pression naît à 10 PV et s'intensifie jusqu'à 0 :
 *  - un nuage de points rouges CLUSTERISÉS dans les 4 coins (densité décroît
 *    vers le centre) ;
 *  - à chaque PV perdu, DAVANTAGE de points s'allument, en cascade depuis le
 *    coin vers l'intérieur (apparition « petit à petit ») ;
 *  - plus tu es bas, plus ils sont nombreux et opaques (« de plus en plus
 *    présents »). À la mort, voile rouge plein écran.
 *
 * ANTI-FUITE (contrainte Alex « batterie ») : positions DÉTERMINISTES (zéro
 * Math.random au render), AUCUN repeat:Infinity, AUCUN setTimeout. Les points
 * sont montés seulement quand hp ≤ 10 ; chacun anime son opacité UNE fois quand
 * il s'allume/s'éteint puis se repose (statique entre deux coups → coût idle
 * nul). hp > 10 → composant démonté.
 */

import { motion } from "motion/react";

const RED_FROM = 10;
const PER_CORNER = 20; // 4 coins × 20 = 80 points

/** Pool de points clusterisés aux 4 coins, triés du PLUS proche du coin au plus
 *  lointain (→ s'allument du coin vers l'intérieur). Déterministe. */
function buildParticles() {
  const corners: [number, number][] = [[0, 0], [100, 0], [0, 100], [100, 100]];
  const out: { x: number; y: number; size: number; order: number }[] = [];
  for (let ci = 0; ci < 4; ci++) {
    const [cx, cy] = corners[ci];
    for (let i = 0; i < PER_CORNER; i++) {
      const t = i / PER_CORNER;            // 0 (coin) → 1 (vers centre)
      const dist = Math.pow(t, 1.7) * 40;  // falloff : dense près du coin
      const ang = ((i * 137.5) % 90) * (Math.PI / 180); // angle réparti dans le quadrant
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      out.push({
        x: cx === 0 ? dx : 100 - dx,
        y: cy === 0 ? dy : 100 - dy,
        size: 1.8 + ((i * 7) % 5) * 0.5,   // 1.8 → 3.8 px, varié (texture pointilliste)
        order: t + ci * 1e-3,              // tri stable, coin-most d'abord
      });
    }
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}
const PARTICLES = buildParticles();

export function ArenaHpVignette({ hp }: { hp: number }) {
  if (hp > RED_FROM) return null; // hors danger → rien (démonté)
  const danger = Math.max(0, Math.min(1, (RED_FROM - hp) / RED_FROM)); // 0 à 10 PV → 1 à 0
  const dead = hp <= 0;
  const visible = Math.round(danger * PARTICLES.length);
  return (
    <div className="fixed inset-0 pointer-events-none z-[46]" aria-hidden>
      {/* Base de pression TRÈS douce, concentrée sur les bords/coins. */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ opacity: 0.05 + danger * 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ background: `radial-gradient(ellipse at center, transparent 56%, rgba(190,25,25,${dead ? 0.6 : 0.45}) 100%)` }}
      />
      {/* POINTILLISME — chaque point s'allume quand son index passe sous le
       *  seuil `visible` ; cascade par le delay (apparition petit à petit). */}
      {PARTICLES.map((p, i) => {
        const active = i < visible;
        const target = active ? (0.3 + (1 - p.order) * 0.55) * (0.55 + danger * 0.45) : 0;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: target, scale: active ? 1 : 0.4 }}
            transition={{ duration: 0.5, delay: active ? (i % 14) * 0.022 : 0, ease: "easeOut" }}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              background: "rgba(239,68,68,0.95)",
              boxShadow: `0 0 ${p.size + 2}px rgba(239,68,68,0.85)`,
            }}
          />
        );
      })}
      {/* MORT — voile plein écran qui s'assombrit (une seule fois). */}
      {dead && (
        <motion.div
          key="hp-death"
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
          style={{ background: "radial-gradient(ellipse at center, rgba(80,0,0,0.4) 0%, rgba(20,0,0,0.85) 100%)" }}
        />
      )}
    </div>
  );
}
