/**
 * ArenaCreatureFX — overlays de signature PAR CRÉATURE, niveau « Mascarade »
 * (Alex 2026-06-13 : « CA c'est l'animation que je veux pour buff/malus »).
 *
 * Extrait/élargi depuis ArenaLaneSlot (au fil de l'eau) :
 *  - `DisguiseOverlay` = l'anim Mascarade existante (le mètre-étalon), déplacée
 *    ici pour dégraisser ArenaLaneSlot ;
 *  - `CreatureBuffOverlay` / `CreatureDebuffOverlay` / `CreatureHealBloom` =
 *    NOUVEAUX, calqués sur sa qualité : multi-couches, chorégraphiés (`times`),
 *    100% transform/opacity + mixBlendMode screen → fluides WebView.
 *
 * Le SUJET réagit déjà (scale/filter via reactAnim dans ArenaLaneSlot) ; ces
 * overlays ajoutent la SIGNATURE par-dessus. ONE-SHOT : AnimatePresence (côté
 * ArenaLaneSlot) les démonte, AUCUN repeat:Infinity → zéro coût en idle, zéro
 * fuite (contrainte Alex « batterie »).
 */

import { motion } from "motion/react";

const ARROWS = [0, 1, 2];

/** 🎭 MASCARADE — voile violet + balayage conique doré + masque qui éclôt.
 *  (Inchangé : c'est la référence ; juste déplacé ici.) */
export function DisguiseOverlay() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 20 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0.4, 0] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.85, times: [0, 0.25, 0.6, 1] }}
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle, rgba(192,132,252,0.9) 0%, rgba(126,34,206,0.6) 45%, transparent 72%)", mixBlendMode: "screen" }}
      />
      <motion.div
        initial={{ rotate: 0, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 320, opacity: [0, 1, 0], scale: [0.6, 1.6, 2] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(252,211,77,0.95) 40deg, transparent 90deg)", mixBlendMode: "screen" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.2, y: 6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.2, 1.25, 1.1, 1.3], y: [6, -2, -2, -8] }}
        transition={{ duration: 0.85, times: [0, 0.3, 0.65, 1] }}
        className="absolute inset-0 flex items-center justify-center text-3xl"
        style={{ filter: "drop-shadow(0 0 8px rgba(192,132,252,0.9))" }}
      >
        🎭
      </motion.div>
    </motion.div>
  );
}

/** 💪 BUFF — montée de puissance : aura émeraude→or qui s'élève, 3 chevrons ▲
 *  qui jaillissent vers le haut, halo or interne. Pour ATK↑ et bouclier gagné. */
export function CreatureBuffOverlay() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 22 }}>
      {/* Aura montante émeraude→or */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 0.85, 0], y: [10, -4, -12] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, times: [0, 0.4, 1], ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(52,211,153,0.6) 0%, rgba(252,211,77,0.35) 50%, transparent 82%)", mixBlendMode: "screen" }}
      />
      {/* Chevrons ▲ qui montent en cascade */}
      {ARROWS.map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 10, scale: 0.7 }}
          animate={{ opacity: [0, 1, 0], y: -16 - i * 7, scale: 1 }}
          transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
          className="absolute left-1/2 -translate-x-1/2 text-emerald-200 text-sm font-black"
          style={{ bottom: "20%", textShadow: "0 0 6px rgba(52,211,153,0.95)" }}
        >
          ▲
        </motion.span>
      ))}
      {/* Halo OR interne qui pulse une fois */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 18px rgba(252,211,77,0.7)" }}
      />
    </motion.div>
  );
}

/** 💀 MALUS — affaiblissement : voile violet sombre qui DESCEND, 3 chevrons ▼
 *  qui s'enfoncent, vignette qui s'assombrit. Pour ATK↓ (Malédiction) / Toile. */
export function CreatureDebuffOverlay() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 22 }}>
      {/* Voile violet sombre qui descend */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: [0, 0.8, 0], y: [-10, 4, 12] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.65, times: [0, 0.4, 1], ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.65) 0%, rgba(76,29,149,0.4) 50%, transparent 82%)", mixBlendMode: "screen" }}
      />
      {/* Chevrons ▼ qui s'enfoncent */}
      {ARROWS.map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: -8, scale: 0.7 }}
          animate={{ opacity: [0, 1, 0], y: 12 + i * 6, scale: 0.9 }}
          transition={{ duration: 0.6, delay: i * 0.07, ease: "easeIn" }}
          className="absolute left-1/2 -translate-x-1/2 text-violet-300 text-sm font-black"
          style={{ top: "20%", textShadow: "0 0 6px rgba(139,92,246,0.95)" }}
        >
          ▼
        </motion.span>
      ))}
      {/* Assombrissement bref (vignette) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ background: "radial-gradient(circle, transparent 28%, rgba(30,10,60,0.75) 100%)" }}
      />
    </motion.div>
  );
}

/** ✚ SOIN — floraison émeraude douce qui respire + petites étincelles montantes.
 *  Complète le « +N » existant pour donner du corps au soin. */
export function CreatureHealBloom() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 21 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1.3, 1.6] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.85, ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.7) 0%, rgba(52,211,153,0.25) 45%, transparent 72%)", mixBlendMode: "screen" }}
      />
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], y: -14 - i * 4, scale: 0.9 }}
          transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
          className="absolute w-1 h-1 rounded-full bg-emerald-200"
          style={{ left: `${30 + i * 13}%`, bottom: "25%", boxShadow: "0 0 5px rgba(52,211,153,0.95)" }}
        />
      ))}
    </motion.div>
  );
}

/** ✂ TRANCHANT (Ciseaux) — cue de lane LÉGER quand une créature Ciseaux
 *  attaque : DEUX entailles diagonales (lecture « double lame ») qui balaient
 *  la case. Donne la signature « tranchant » dès la 1ʳᵉ manche, distincte de
 *  l'entaille PLEIN ÉCRAN (ArenaImpactFX) réservée aux gros coups (≥4/fatal).
 *  ZÉRO emoji (règle dure Alex). One-shot, 100% transform/opacity, leak-free.
 *  (Alex 2026-06-17, Pro-37.) */
export function ScissorsLaneFlourish() {
  // Lames ACIER qui BALAIENT la case en X — VRAI mouvement (translateX) au lieu
  // d'un trait fixe, plus grosses (5/4px) + contraste fort (cyan/blanc + bord
  // sombre + lueur cyan) pour TRANCHER sur l'éclat doré de charge. Calé pour
  // culminer ~à l'apex du slam. (Alex 2026-06-17 « punchy ».)
  const BLADE_BG = "linear-gradient(to right, transparent, #e0f2fe 32%, #ffffff 50%, #e0f2fe 68%, transparent)";
  const BLADE_SHADOW = "0 0 16px 3px rgba(56,189,248,0.95), 0 0 5px 1px rgba(2,6,23,0.85)";
  return (
    <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 34 }} aria-hidden>
      {/* Lame 1 (descendante) — balaie gauche→droite en traversant la case. */}
      <motion.div
        initial={{ opacity: 0, x: "-125%" }}
        animate={{ opacity: [0, 1, 1, 0], x: ["-125%", "-8%", "8%", "125%"] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.42, times: [0, 0.32, 0.56, 1], ease: "easeOut", delay: 0.06 }}
        className="absolute left-0 right-0 top-1/2 -mt-[3px] h-[6px] origin-center"
        style={{ rotate: "-24deg", background: BLADE_BG, boxShadow: BLADE_SHADOW }}
      />
      {/* Lame 2 (montante) — croise la première en X, juste après. */}
      <motion.div
        initial={{ opacity: 0, x: "-125%" }}
        animate={{ opacity: [0, 1, 1, 0], x: ["-125%", "-8%", "8%", "125%"] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.40, times: [0, 0.34, 0.56, 1], ease: "easeOut", delay: 0.16 }}
        className="absolute left-0 right-0 top-1/2 -mt-[2.5px] h-[5px] origin-center"
        style={{ rotate: "24deg", background: BLADE_BG, boxShadow: BLADE_SHADOW }}
      />
    </div>
  );
}
