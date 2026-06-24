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
import { MoveGlyph } from "../icons";
import { type Creature } from "./arenaTypes";

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

/** ⛰ STRATE (Voie Montagne) — une COUCHE DE ROCHE qui s'empile depuis le bas
 *  + des éclats de pierre à l'impact + un pulse AMBRE de puissance PERMANENTE.
 *  Signature du gain de Strate (voieAtkBonus ↑ = +1 ATK perm). Palette granite
 *  (gris-pierre) ≠ buff (émeraude/or) pour qu'on lise « le mur grandit ».
 *  One-shot, 100% transform/opacity, leak-free (démonté par AnimatePresence). */
export function CreatureStrateOverlay() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 22 }}>
      {/* Dalle de granite qui MONTE et se cale JUSTE AU-DESSUS du bandeau de stats
       *  (bottom-[24%]) → la strate s'ajoute SANS masquer la barre PV / les chips
       *  ATK-HP (c'est ce chiffre qu'on veut voir monter). */}
      <motion.div
        initial={{ opacity: 0, y: "70%", scaleY: 0.5 }}
        animate={{ opacity: [0, 0.95, 0.8, 0], y: ["70%", "0%", "0%", "0%"], scaleY: [0.5, 1, 1, 1] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, times: [0, 0.4, 0.7, 1], ease: "easeOut" }}
        className="absolute left-0 right-0 bottom-[24%] h-[26%]"
        style={{ background: "linear-gradient(to top, rgba(120,113,108,0.9), rgba(168,162,158,0.55) 60%, transparent)", boxShadow: "inset 0 2px 0 rgba(231,229,228,0.7)" }}
      />
      {/* Éclats de pierre qui sautent à l'impact de la dalle. */}
      {[-22, 0, 22].map((dx, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: 0, y: 8, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], x: dx, y: -10 - i * 4, scale: 0.9 }}
          transition={{ duration: 0.6, delay: 0.28 + i * 0.04, ease: "easeOut" }}
          className="absolute left-1/2 bottom-1/3 w-1.5 h-1.5 -ml-[3px] rounded-sm"
          style={{ background: "#d6d3d1", boxShadow: "0 0 5px rgba(120,113,108,0.95)" }}
        />
      ))}
      {/* Pulse AMBRE interne — la puissance gagnée est PERMANENTE. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 18px rgba(180,83,9,0.75)" }}
      />
    </motion.div>
  );
}

/** ⚔️ AFFÛTAGE (Voie Tranchant) — un ÉCLAT D'ACIER balaie la lame + pulse
 *  rose-acier : signature du gain d'ATK permanent d'un Ciseau (Acuité). Variante
 *  « lame » du gain de voieAtkBonus (≠ la dalle granite de Montagne). One-shot. */
export function CreatureSharpenOverlay() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 22 }}>
      {/* Éclat d'acier qui balaie en diagonale (affûtage de la lame). */}
      <motion.div
        initial={{ opacity: 0, x: "-110%" }}
        animate={{ opacity: [0, 1, 0], x: ["-110%", "10%", "120%"] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="absolute left-0 right-0 top-1/2 -mt-[3px] h-[6px] origin-center"
        style={{ rotate: "-12deg", background: "linear-gradient(90deg, transparent, #e0f2fe 38%, #ffffff 50%, #fecdd3 62%, transparent)", boxShadow: "0 0 14px 2px rgba(244,63,94,0.8)" }}
      />
      {/* Pulse rose-acier interne — la puissance gagnée est PERMANENTE. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 16px rgba(244,63,94,0.6)" }}
      />
    </motion.div>
  );
}

/** 🎭 ESQUIVE (Voie Mirage) — voile iridescent indigo↔cyan qui MIROITE en
 *  balayant + halo cyan + étincelles ✦ : signature du gain de charge d'Esquive
 *  (la créature devient insaisissable). Palette iridescente ≠ buff/Strate.
 *  One-shot, 100% transform/opacity, leak-free. */
export function CreatureMirageOverlay() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 22 }}>
      {/* Miroitement iridescent qui balaie en diagonale. */}
      <motion.div
        initial={{ opacity: 0, x: "-120%" }}
        animate={{ opacity: [0, 0.9, 0], x: ["-120%", "10%", "120%"] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, times: [0, 0.5, 1], ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: "linear-gradient(105deg, transparent 30%, rgba(129,140,248,0.7) 48%, rgba(34,211,238,0.75) 56%, transparent 72%)", mixBlendMode: "screen" }}
      />
      {/* Halo cyan interne qui pulse une fois. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 16px rgba(34,211,238,0.6)" }}
      />
      {/* Étincelles ✦ qui scintillent (insaisissable). */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: "easeOut" }}
          className="absolute text-cyan-200 text-xs font-black"
          style={{ left: `${25 + i * 25}%`, top: `${28 + (i % 2) * 30}%`, textShadow: "0 0 6px rgba(165,243,252,0.95)" }}
        >
          ✦
        </motion.span>
      ))}
    </motion.div>
  );
}

/** ✦ ESQUIVE CONSOMMÉE (Lézard / Voie Mirage) — la signature de l'esquive.
 *  RENDU AU NIVEAU DE LA CASE (frère du slot dans ArenaLaneSlot, comme
 *  DeathShatter), PAS dans CreatureSlot : le corps glisse via le transform de sa
 *  motion.div racine, donc tout ce qui est À L'INTÉRIEUR glisserait avec lui. Cet
 *  overlay reste ANCRÉ à la case pendant que le corps détale → c'est ce décalage
 *  qui vend « il était LÀ, plus maintenant ».
 *
 *  4 calques, tous one-shot, 100% opacity/transform + teinte/box-shadow STATIQUES
 *  (zéro re-raster) : (1) halo cyan inset, (2) voile iridescent indigo↔cyan en
 *  opacity pure (PAS de mixBlendMode, contrairement au CreatureMirageOverlay du
 *  GAIN de charge — exigence perf durcie Alex 2026-06-23), (3) le FANTÔME-GLYPHE
 *  cyan qui reste figé et se délave, (4) le WHIFF : un trait qui FILE dans le vide
 *  laissé par la créature (le coup qui rate). dir = sens de la glisse du corps. */
export function CreatureDodgeOverlay({ move, dir }: { move: Creature["move"]; dir: number }) {
  const fromLeft = dir > 0;
  return (
    <motion.div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{ zIndex: 23 }} aria-hidden>
      {/* (1) HALO cyan inset — scelle la case dans un éclat. box-shadow STATIQUE,
       *  on n'anime QUE l'opacity du calque (pattern halo déjà validé perf). */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 16px rgba(34,211,238,0.6)" }}
      />
      {/* (2) VOILE iridescent indigo↔cyan — gradient en OPACITY pure (no blend). */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.35, 1] }}
        className="absolute inset-0"
        style={{ background: "linear-gradient(105deg, transparent 35%, rgba(129,140,248,0.5) 50%, rgba(34,211,238,0.55) 58%, transparent 72%)" }}
      />
      {/* (3) FANTÔME-GLYPHE — copie cyan du glyphe (teinte STATIQUE) qui reste
       *  quasi sur place (dérive légère côté opposé à la glisse) et se DÉLAVE. */}
      <motion.div
        initial={{ opacity: 0.85, scale: 1 }}
        animate={{ opacity: [0.85, 0.55, 0], x: [0, dir * -3, dir * -10], scale: [1, 1.04, 1.12] }}
        transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.4, 1] }}
        className="absolute inset-0 flex items-center justify-center"
        style={{ filter: "brightness(1.6) sepia(1) hue-rotate(140deg) saturate(2.5)" }}
      >
        <MoveGlyph move={move} className="w-[3.8rem] h-[3.8rem] sm:w-[4.35rem] sm:h-[4.35rem]" />
      </motion.div>
      {/* (4) WHIFF — trait fin qui TRAVERSE le centre désormais vide (le coup rate).
       *  Part du côté de l'attaquant. box-shadow STATIQUE, rotate constant. */}
      <motion.div
        initial={{ opacity: 0, x: fromLeft ? "-115%" : "115%", rotate: -8 }}
        animate={{ opacity: [0, 1, 0], x: fromLeft ? ["-115%", "15%", "125%"] : ["115%", "-15%", "-125%"], rotate: -8 }}
        transition={{ duration: 0.4, ease: "easeIn", delay: 0.06, times: [0, 0.45, 1] }}
        className="absolute left-0 right-0 top-1/2 h-[5px] -mt-[2.5px]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(165,243,252,0.95) 45%, #ffffff 50%, rgba(129,140,248,0.9) 55%, transparent)",
          boxShadow: "0 0 10px 1px rgba(34,211,238,0.7)",
        }}
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
