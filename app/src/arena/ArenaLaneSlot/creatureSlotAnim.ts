import { type TargetAndTransition } from "motion/react";

/**
 * Animation de RÉACTION composite (Alex 2026-06-12 "tout trop mou") :
 * priorité attaque > dégât (secousse + flash rouge) > debuff (tassement sec) >
 * soin (respiration douce) > buff (pop doré-vert) > repos. Une seule de ces
 * réactions joue à la fois sur une case.
 *
 * Dérivation PURE (zéro état/ref/timing) extraite de ArenaLaneSlot pour garder
 * CreatureSlot sous 450 lignes. La logique de détection (qui SET ces flags via
 * les useEffect prev/current) reste dans l'orchestrateur ArenaLaneSlot.
 */
export function creatureReactAnim(args: {
  chargeAttack: boolean;
  dodgedHit: { key: number } | null;
  hitShake: { key: number } | null;
  debuffPulse: { key: number } | null;
  healFlash: { n: number; key: number } | null;
  buffPulse: { key: number } | null;
  isPlayer: boolean;
}): TargetAndTransition {
  const { chargeAttack, dodgedHit, hitShake, debuffPulse, healFlash, buffPulse, isPlayer } = args;
  // ESQUIVE (Lézard / Voie Mirage) — le corps DÉTALE latéralement : flicker de
  // désync → arrachage net ~22px → settle spring, avec un dip vertical (il
  // s'efface vers le haut), un lean dans le sens de la glisse, et un apex
  // brightness 2.1 = PHASE-SHIFT (le corps se délave l'instant où l'attaque le
  // traverse). dir = isPlayer ? droite : gauche (symétrique, lisible des 2 camps).
  // JAMAIS d'opacity sur le corps (casserait badges/PV) ; brightness fait le verre.
  // Une esquive ne déclenche jamais hitShake (hp inchangé) → priorité juste sous
  // chargeAttack. 100% transform + brightness (composité GPU, zéro raster).
  const dir = isPlayer ? 1 : -1;
  const dodgeAnim = {
    x: [0, dir * 3, dir * 22, dir * 20, dir * 6, 0],
    y: [0, -3, -7, -5, -1, 0],
    scale: [1, 0.99, 0.93, 0.96, 1.02, 1],
    rotate: [0, dir * -2, dir * -7, dir * -5, dir * 1, 0],
    filter: ["brightness(1)", "brightness(1.5)", "brightness(2.1)", "brightness(1.4)", "brightness(1.08)", "brightness(1)"],
  };
  // CHARGE animation — SLAM-style: wind-up → 60px lunge crossing the lane
  // midline → recoil from the impact → snap back. Adds rotate for weight,
  // brightness apex 1.85 + drop-shadow doré 22px so the creature looks
  // FORGED OF LIGHT at the impact frame. Way more imposing than a wiggle.
  // CHARGE — SLAM intensifié (Alex 2026-06-12 "attaque trop molle") : lunge
  // 70px, scale apex 1.42, brightness 2.1 + drop-shadow 28px → le coup CLAQUE.
  const chargeAnim = {
    y: isPlayer ? [0, -34, -70, -64, -22, 0] : [0, 34, 70, 64, 22, 0],
    x: [0, 0, -6, 8, -5, 0],
    scale: [1, 1.1, 1.42, 1.28, 1.06, 1],
    rotate: isPlayer ? [0, -3, -7, -4, 1, 0] : [0, 3, 7, 4, -1, 0],
    // PERF (Alex 2026-06-23 « saccadé ») : lueur gardée via `brightness` (filtre
    // GPU-composité, gratuit) ; `drop-shadow` animé RETIRÉ (son rayon de flou se
    // re-rasterise chaque frame sur CHAQUE attaquant = la saccade). L'impact reste
    // porté par les overlays burst/shockwave/sparks (transform/opacity).
    filter: ["brightness(1)", "brightness(1.3)", "brightness(2.1)", "brightness(1.5)", "brightness(1.12)", "brightness(1)"],
  };
  const idleAnim = { y: 0, x: 0, scale: 1, rotate: 0, filter: "brightness(1)" };
  return chargeAttack
    ? chargeAnim
    : dodgedHit
    ? dodgeAnim
    : hitShake
    ? {
        x: [0, -8, 9, -7, 5, -2, 0],
        y: isPlayer ? [0, 5, 0, 3, 0, 0, 0] : [0, -5, 0, -3, 0, 0, 0],
        scale: [1, 0.92, 1.04, 0.97, 1.01, 1, 1],
        rotate: [0, -4, 4, -2, 1, 0, 0],
        filter: ["brightness(1)", "brightness(1.85)", "brightness(0.8)", "brightness(1.35)", "brightness(1)", "brightness(1)", "brightness(1)"],
      }
    : debuffPulse
    ? {
        // DEBUFF — tassement SEC : la créature s'écrase brièvement,
        // teinte violette sombre. Brutal mais court.
        y: isPlayer ? 3 : -3, x: 0,
        scale: [1, 0.88, 0.96, 1],
        rotate: [0, 2, -1, 0],
        filter: ["brightness(1)", "brightness(0.65)", "brightness(0.85)", "brightness(1)"],
      }
    : healFlash
    ? {
        // SOIN — respiration DOUCE : gonflement lent, lueur émeraude.
        y: 0, x: 0,
        scale: [1, 1.08, 1],
        rotate: 0,
        filter: ["brightness(1)", "brightness(1.35)", "brightness(1)"],
      }
    : buffPulse
    ? {
        y: 0, x: 0,
        scale: [1, 1.18, 1.05, 1],
        rotate: [0, -2, 2, 0],
        filter: ["brightness(1)", "brightness(1.55)", "brightness(1.18)", "brightness(1)"],
      }
    : idleAnim;
}
