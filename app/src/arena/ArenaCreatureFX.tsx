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
import type { Move } from "../engine/game";

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
/** Cue d'ATTAQUE par MOVE, rendu sur la LANE ATTAQUÉE (la cible) — Alex
 *  2026-06-17 : « un petit effet sur l'adverse aussi, joli, soft, visible et
 *  relatif à la main ». Chaque move a sa signature LÉGÈRE (1-2 éléments,
 *  transform/opacity, one-shot, ~0.45s) — calée pour culminer à l'impact du
 *  slam. La perf reste OK (les auras idle sont gelées en résolution). */
export function MoveAttackCue({ move }: { move: Move }) {
  return (
    <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 34 }} aria-hidden>
      {move === "scissors" ? <ScissorsBlades />
        : move === "rock" ? <RockSlam />
        : move === "paper" ? <PaperWrap />
        : move === "lizard" ? <LizardFlick />
        : <SpockBolt />}
    </div>
  );
}

/** CISEAUX — 2 lames acier qui balaient en X (le tranchant). */
function ScissorsBlades() {
  const BG = "linear-gradient(to right, transparent, #e0f2fe 32%, #ffffff 50%, #e0f2fe 68%, transparent)";
  const SH = "0 0 16px 3px rgba(56,189,248,0.95), 0 0 5px 1px rgba(2,6,23,0.85)";
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: "-125%" }} animate={{ opacity: [0, 1, 1, 0], x: ["-125%", "-8%", "8%", "125%"] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.42, times: [0, 0.32, 0.56, 1], ease: "easeOut", delay: 0.06 }}
        className="absolute left-0 right-0 top-1/2 -mt-[3px] h-[6px] origin-center"
        style={{ rotate: "-24deg", background: BG, boxShadow: SH }}
      />
      <motion.div
        initial={{ opacity: 0, x: "-125%" }} animate={{ opacity: [0, 1, 1, 0], x: ["-125%", "-8%", "8%", "125%"] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.40, times: [0, 0.34, 0.56, 1], ease: "easeOut", delay: 0.16 }}
        className="absolute left-0 right-0 top-1/2 -mt-[2.5px] h-[5px] origin-center"
        style={{ rotate: "24deg", background: BG, boxShadow: SH }}
      />
    </>
  );
}

/** PIERRE — SLAM vertical : un bloc qui s'écrase depuis le haut + fissures qui
 *  rayonnent du point d'impact. Mouvement VERTICAL descendant (≠ des autres). */
function RockSlam() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "-75%", scaleY: 0.5 }} animate={{ opacity: [0, 1, 0.85, 0], y: ["-75%", "-6%", "-2%", "-2%"], scaleY: [0.5, 1, 0.85, 0.85] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.46, times: [0, 0.42, 0.58, 1], ease: "easeIn", delay: 0.02 }}
        className="absolute left-1/2 top-1/2 w-11 h-8 -ml-[22px] -mt-6"
        style={{ background: "linear-gradient(160deg, rgba(231,229,228,0.97), rgba(120,113,108,0.75))", clipPath: "polygon(16% 0, 84% 0, 100% 100%, 0 100%)", boxShadow: "0 0 16px rgba(180,83,9,0.6)" }}
      />
      {[-34, 0, 34].map((deg, k) => (
        <motion.div
          key={k}
          initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: [0, 0.95, 0], scaleY: [0, 1, 1] }} exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: "easeOut", delay: 0.3 + k * 0.03 }}
          className="absolute left-1/2 top-1/2 w-[2px] h-[42%] origin-top"
          style={{ rotate: `${deg}deg`, background: "linear-gradient(to bottom, rgba(231,229,228,0.95), transparent)" }}
        />
      ))}
    </>
  );
}

/** FEUILLE — un voile/feuille qui se DÉPLOIE pour ENVELOPPER la cible (s'ouvre
 *  du centre + nervure). Croissance RADIALE (≠ des autres). */
function PaperWrap() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.2, rotate: -22 }} animate={{ opacity: [0, 0.72, 0.5, 0], scale: [0.2, 1.05, 1.05, 1.12], rotate: [-22, 0, 0, 5] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.52, times: [0, 0.4, 0.7, 1], ease: "easeOut", delay: 0.03 }}
        className="absolute inset-1"
        style={{ background: "linear-gradient(135deg, rgba(110,231,183,0.58), rgba(5,150,105,0.32))", borderRadius: "0 85% 0 85%", boxShadow: "inset 0 0 18px rgba(52,211,153,0.5)" }}
      />
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: [0, 0.85, 0], scaleX: [0, 1, 1] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.46, ease: "easeOut", delay: 0.12 }}
        className="absolute left-[16%] right-[16%] top-1/2 h-[2px] origin-left"
        style={{ rotate: "-22deg", background: "linear-gradient(to right, rgba(167,243,208,0.95), transparent)" }}
      />
    </>
  );
}

/** LÉZARD — MORSURE : deux mâchoires (croissants) qui se REFERMENT du haut et
 *  du bas vers le centre. Convergence VERTICALE (≠ des autres). */
function LizardFlick() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "-95%" }} animate={{ opacity: [0, 1, 0], y: ["-95%", "-14%", "-14%"] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.4, times: [0, 0.55, 1], ease: "easeOut", delay: 0.04 }}
        className="absolute left-1/2 top-1/2 w-12 h-6 -ml-6 -mt-3"
        style={{ borderRadius: "0 0 100% 100%", background: "linear-gradient(180deg, rgba(196,181,253,0.92), rgba(124,58,237,0.45))", boxShadow: "0 0 11px rgba(34,211,238,0.75)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: "95%" }} animate={{ opacity: [0, 1, 0], y: ["95%", "14%", "14%"] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.4, times: [0, 0.55, 1], ease: "easeOut", delay: 0.04 }}
        className="absolute left-1/2 top-1/2 w-12 h-6 -ml-6 -mt-3"
        style={{ borderRadius: "100% 100% 0 0", background: "linear-gradient(0deg, rgba(34,211,238,0.92), rgba(8,145,178,0.45))", boxShadow: "0 0 11px rgba(167,139,250,0.75)" }}
      />
    </>
  );
}

/** SPOCK — ÉCLAIR FOURCHU : 2 segments en zigzag + flash bref. Forme JAGGED (≠). */
function SpockBolt() {
  const SEG = { background: "linear-gradient(180deg, rgba(224,231,255,0.98), rgba(56,189,248,0.92))", boxShadow: "0 0 12px 2px rgba(129,140,248,0.95)" };
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scaleY: 0.2 }} animate={{ opacity: [0, 1, 0], scaleY: [0.2, 1, 1] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.34, ease: "easeOut", delay: 0.05 }}
        className="absolute left-[40%] top-[6%] w-[3px] h-[48%] origin-top rounded-full"
        style={{ rotate: "20deg", ...SEG }}
      />
      <motion.div
        initial={{ opacity: 0, scaleY: 0.2 }} animate={{ opacity: [0, 1, 0], scaleY: [0.2, 1, 1] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.34, ease: "easeOut", delay: 0.12 }}
        className="absolute left-[54%] top-[46%] w-[3px] h-[48%] origin-top rounded-full"
        style={{ rotate: "-24deg", ...SEG }}
      />
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.06 }}
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle, rgba(129,140,248,0.42), transparent 62%)", mixBlendMode: "screen" }}
      />
    </>
  );
}
