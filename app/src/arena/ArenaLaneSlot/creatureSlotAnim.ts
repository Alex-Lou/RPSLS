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
  hitShake: { key: number } | null;
  debuffPulse: { key: number } | null;
  healFlash: { n: number; key: number } | null;
  buffPulse: { key: number } | null;
  isPlayer: boolean;
}): TargetAndTransition {
  const { chargeAttack, hitShake, debuffPulse, healFlash, buffPulse, isPlayer } = args;
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
    filter: [
      "brightness(1) drop-shadow(0 0 0 transparent)",
      "brightness(1.3) drop-shadow(0 0 9px rgba(252,211,77,0.6))",
      "brightness(2.1) drop-shadow(0 0 28px rgba(252,211,77,1))",
      "brightness(1.5) drop-shadow(0 0 16px rgba(252,211,77,0.85))",
      "brightness(1.12) drop-shadow(0 0 5px rgba(252,211,77,0.4))",
      "brightness(1) drop-shadow(0 0 0 transparent)",
    ],
  };
  const idleAnim = { y: 0, x: 0, scale: 1, rotate: 0, filter: "brightness(1) drop-shadow(0 0 0 transparent)" };
  return chargeAttack
    ? chargeAnim
    : hitShake
    ? {
        x: [0, -8, 9, -7, 5, -2, 0],
        y: isPlayer ? [0, 5, 0, 3, 0, 0, 0] : [0, -5, 0, -3, 0, 0, 0],
        scale: [1, 0.92, 1.04, 0.97, 1.01, 1, 1],
        rotate: [0, -4, 4, -2, 1, 0, 0],
        filter: [
          "brightness(1) drop-shadow(0 0 0 transparent)",
          "brightness(1.85) drop-shadow(0 0 12px rgba(244,63,94,0.95))",
          "brightness(0.8)",
          "brightness(1.35) drop-shadow(0 0 7px rgba(244,63,94,0.6))",
          "brightness(1) drop-shadow(0 0 0 transparent)",
          "brightness(1) drop-shadow(0 0 0 transparent)",
          "brightness(1) drop-shadow(0 0 0 transparent)",
        ],
      }
    : debuffPulse
    ? {
        // DEBUFF — tassement SEC : la créature s'écrase brièvement,
        // teinte violette sombre. Brutal mais court.
        y: isPlayer ? 3 : -3, x: 0,
        scale: [1, 0.88, 0.96, 1],
        rotate: [0, 2, -1, 0],
        filter: [
          "brightness(1) drop-shadow(0 0 0 transparent)",
          "brightness(0.65) drop-shadow(0 0 10px rgba(139,92,246,0.85))",
          "brightness(0.85) drop-shadow(0 0 6px rgba(139,92,246,0.5))",
          "brightness(1) drop-shadow(0 0 0 transparent)",
        ],
      }
    : healFlash
    ? {
        // SOIN — respiration DOUCE : gonflement lent, lueur émeraude.
        y: 0, x: 0,
        scale: [1, 1.08, 1],
        rotate: 0,
        filter: [
          "brightness(1) drop-shadow(0 0 0 transparent)",
          "brightness(1.35) drop-shadow(0 0 16px rgba(52,211,153,0.95))",
          "brightness(1) drop-shadow(0 0 0 transparent)",
        ],
      }
    : buffPulse
    ? {
        y: 0, x: 0,
        scale: [1, 1.18, 1.05, 1],
        rotate: [0, -2, 2, 0],
        filter: [
          "brightness(1) drop-shadow(0 0 0 transparent)",
          "brightness(1.55) drop-shadow(0 0 14px rgba(52,211,153,0.9))",
          "brightness(1.18) drop-shadow(0 0 7px rgba(252,211,77,0.6))",
          "brightness(1) drop-shadow(0 0 0 transparent)",
        ],
      }
    : idleAnim;
}
