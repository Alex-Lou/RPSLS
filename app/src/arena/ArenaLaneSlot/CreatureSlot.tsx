/**
 * CreatureSlot — render branch for a lane cell holding a LIVE creature.
 *
 * PURELY presentational : tout l'état + les refs + les 3 useEffect de détection
 * (dégât/soin/bouclier/esquive/mort/déguisement/buff/debuff) vivent dans
 * l'orchestrateur ArenaLaneSlot, qui passe ici les flags one-shot en props.
 * Le JSX intérieur est byte-identique à l'original ; seul `reactAnim` est
 * dérivé via le helper pur creatureSlotAnim. AUCUN overlay réordonné (l'ordre
 * DOM pilote l'empilement des overlays sans z-index explicite).
 *
 * Calques FX → CreatureSlotFX.tsx ; cadre de Voie + badges → CreatureSlotBadges.tsx
 * (rendus en place, même ordre DOM).
 */

import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { CREATURE_STATS, type Creature } from "../arenaTypes";
import { creatureEffectiveAtk } from "../arenaRules";
import { DisguiseOverlay, CreatureBuffOverlay, CreatureDebuffOverlay, CreatureHealBloom, CreatureStrateOverlay, CreatureMirageOverlay, CreatureSharpenOverlay } from "../ArenaCreatureFX";
import { creatureReactAnim } from "./creatureSlotAnim";
import { CreatureImpactFX, CreatureStatusFX, CreatureHitChips } from "./CreatureSlotFX";
import { VOIE_FRAME, CreatureStatsBar, CreaturePassiveBadges } from "./CreatureSlotBadges";

function CreatureSlotInner({
  creature, isPlayer, chargeAttack, clickable, clickableLabel, onClick,
  passiveSuppressed, deflectingPulse,
  dmgPop, shieldBlocked, dodgedHit, hitShake, buffPulse, healFlash, debuffPulse, disguiseFlash, strateGain, mirageGain,
}: {
  creature: Creature;
  isPlayer: boolean;
  chargeAttack: boolean;
  clickable: boolean;
  clickableLabel: string;
  onClick?: () => void;
  passiveSuppressed: boolean;
  deflectingPulse: number | null;
  dmgPop: { n: number; key: number } | null;
  shieldBlocked: { key: number } | null;
  dodgedHit: { key: number } | null;
  hitShake: { key: number } | null;
  buffPulse: { key: number } | null;
  healFlash: { n: number; key: number } | null;
  debuffPulse: { key: number } | null;
  disguiseFlash: { key: number } | null;
  strateGain: { key: number } | null;
  mirageGain: { key: number } | null;
}) {
  const stats = CREATURE_STATS[creature.move];
  // Effective ATK = base + buff − (Lente/Lent on summon, Fanaison per
  // turn for Paper, Émoussé after 1st combat for Scissors). This is the
  // SAME function the combat engine uses, so the badge always tells the
  // truth ("⚔ 0" really means 0 damage this turn).
  const atk = creatureEffectiveAtk(creature);
  const baseAtkPlusBuff = stats.atk + creature.atkBuff;
  const atkReduced = atk < baseAtkPlusBuff; // a malus is biting
  const lowHp = creature.hp <= 1;
  const pal = MOVE_PALETTE[creature.move];
  // Cadre d'identité de Voie (granite Montagne, iridescent Mirage…) — statique.
  const voieFrame = VOIE_FRAME[creature.move];
  const rim = moveRim(pal.hex);
  const glow = moveGlow(pal.hex);
  // Side affinity tinting: player creatures get an emerald inner badge,
  // opp creatures get a rose one — visual ownership cue independent of
  // the move's signature color (kept on the frame rim).
  const sideTint = isPlayer ? "rgba(52,211,153,0.55)" : "rgba(244,63,94,0.55)";
  const reactAnim = creatureReactAnim({ chargeAttack, dodgedHit, hitShake, debuffPulse, healFlash, buffPulse, isPlayer });
  return (
    <motion.div
      // PAS de `layout` (Alex 2026-06-26) : prop orpheline (aucun layoutId/LayoutGroup,
      // grille 3 colonnes + aspect fixes → zéro reflow à animer). À la mort, la case
      // s'unmount instantanément (pas d'AnimatePresence) mais `layout` projetait un
      // FANTÔME du corps mort ~1s → « double à la mort ». Retiré = 1 mort = 1 anim.
      // PAS D'ENTRÉE animée (Alex 2026-06-27) : l'ancienne « invocation dramatisée »
      // faisait JAILLIR la case depuis le bas avec rotation + overshoot spring = la
      // « rotation ~45° qui plonge puis se redresse juste AVANT le combat » qu'il ne
      // veut plus. initial=false → la créature posée APPARAÎT en place, point. Les
      // anims (charge/atk, dégât, buff, soin, mort) restent intactes : ce sont des
      // ÉVÉNEMENTS, pas l'enclenchement.
      initial={false}
      animate={{ opacity: 1, ...reactAnim }}
      transition={
        chargeAttack
          ? { duration: 0.72, ease: "easeOut", times: [0, 0.2, 0.42, 0.55, 0.78, 1] }
          : dodgedHit
          ? { duration: 0.55, ease: [0.22, 1, 0.36, 1], times: [0, 0.18, 0.34, 0.5, 0.74, 1] }
          : hitShake
          ? { duration: 0.46, ease: "easeOut" }
          : debuffPulse
          ? { duration: 0.5, ease: "easeOut" }
          : healFlash
          ? { duration: 0.85, ease: "easeInOut" }
          : buffPulse
          ? { duration: 0.6, ease: "easeOut" }
          : { type: "spring", stiffness: 380, damping: 24 }
      }
      className="aspect-[5/4] w-full rounded-xl relative flex flex-col items-center justify-center overflow-hidden transition"
      style={{
        zIndex: chargeAttack ? 30 : dodgedHit ? 22 : hitShake || buffPulse ? 20 : 1,
        background: "linear-gradient(160deg, rgba(20,22,32,0.94) 0%, rgba(10,12,20,0.94) 100%)",
        border: `2px solid ${creature.divineShield ? "rgba(252,211,77,0.95)" : rim}`,
        boxShadow:
          (creature.divineShield
            ? "0 0 20px -2px rgba(252,211,77,0.7), "
            : `0 0 14px -3px ${glow}, `) +
          `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${sideTint}30`,
      }}
    >
      {/* CADRE D'IDENTITÉ DE VOIE — voile thématique statique + liseré (granite
       *  Montagne, iridescent Mirage…). Pur CSS (transform/opacity-safe), zéro
       *  coût idle, derrière le contenu. Réversible (VOIE_FRAME[move]). */}
      {voieFrame && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: voieFrame.bg, boxShadow: voieFrame.shadow }}
        />
      )}
      <CreatureImpactFX chargeAttack={chargeAttack} hitShake={hitShake} />
      {/* 🎭 MASCARADE — voile de déguisement : un balayage conique doré
       *  tourne autour de la créature pendant qu'un voile violet pulse, et
       *  un masque 🎭 éclôt au centre. Signature visuelle du changement
       *  d'identité (Alex 2026-06-12). */}
      <AnimatePresence>
        {disguiseFlash && <DisguiseOverlay key={`disg-${disguiseFlash.key}`} />}
      </AnimatePresence>
      {/* 💪 BUFF / 💀 MALUS — overlays SIGNATURE niveau Mascarade (Alex
       *  2026-06-13). Le sujet réagit déjà (reactAnim) ; ceci ajoute l'aura
       *  montante (buff) ou le voile qui s'enfonce (malus) par-dessus.
       *  cf. ArenaCreatureFX. One-shot, leak-free. */}
      <AnimatePresence>
        {buffPulse && <CreatureBuffOverlay key={`buff-${buffPulse.key}`} />}
      </AnimatePresence>
      {/* Cue du gain d'ATK PERMANENT (voieAtkBonus↑), thématisée par move :
       *  Montagne = dalle granite qui s'empile, Tranchant = éclat d'acier. */}
      <AnimatePresence>
        {strateGain && (creature.move === "scissors"
          ? <CreatureSharpenOverlay key={`atk-${strateGain.key}`} />
          : <CreatureStrateOverlay key={`atk-${strateGain.key}`} />)}
      </AnimatePresence>
      {/* 🎭 ESQUIVE (Voie Mirage) — cue du gain de charge d'Esquive. */}
      <AnimatePresence>
        {mirageGain && <CreatureMirageOverlay key={`mirage-${mirageGain.key}`} />}
      </AnimatePresence>
      <AnimatePresence>
        {debuffPulse && <CreatureDebuffOverlay key={`debuff-${debuffPulse.key}`} />}
      </AnimatePresence>
      <CreatureStatusFX creature={creature} />
      {/* ✚ SOIN — floraison émeraude (signature) + « +N » qui s'élève. */}
      <AnimatePresence>
        {healFlash && <CreatureHealBloom key={`heal-bloom-${healFlash.key}`} />}
      </AnimatePresence>
      <AnimatePresence>
        {healFlash && (
          <motion.div
            key={`heal-${healFlash.key}`}
            initial={{ opacity: 0, y: 6, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: -22, scale: 1.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-x-0 top-1 flex justify-center pointer-events-none text-base font-black text-emerald-300"
            style={{ zIndex: 26, textShadow: "0 2px 8px rgba(52,211,153,0.85), 0 0 2px black" }}
          >
            +{healFlash.n}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Side-affinity dot removed — Alex feedback: the rim color of the
       *  slot + the row layout (player bottom, opp top) already distinguish
       *  ownership. Freed up top-left for the player's card stickers (the
       *  bottom-left was hiding the ATK badge). */}
      {/* TURN INDICATOR retired — Alex read the ▼ as "-1 ATK" and was
       *  confused. The ATK badge already displays the effective value
       *  (Lente shows 0, Émoussé 3, Fanaison 2, etc.), and the top-right
       *  badges show which passifs are active. The indicator was
       *  duplicating info while creating confusion, so it's gone. The
       *  `turnIndicator` helper is preserved above in case a future
       *  surfacing of net-state becomes useful. */}
      {/* Le glyphe se RETOURNE (rotateY) sur sa nouvelle identité quand la
       *  créature est déguisée (Mascarade). Au repos : animate no-op. */}
      <motion.div
        animate={
          disguiseFlash
            ? { rotateY: [90, -20, 0], scale: [0.7, 1.18, 1], filter: ["brightness(2)", "brightness(1.3)", "brightness(1)"] }
            : { rotateY: 0, scale: 1, filter: "brightness(1)" }
        }
        transition={disguiseFlash ? { duration: 0.7, times: [0, 0.55, 1] } : { duration: 0.2 }}
        style={{ transformStyle: "preserve-3d", lineHeight: 0, opacity: creature.phasedOut ? 0.4 : 1 }}
      >
        {/* É3 (audit UX 2026-06-12) : glyphe +~9% — slot INCHANGÉ. */}
        <MoveGlyph move={creature.move} className="w-[3.8rem] h-[3.8rem] sm:w-[4.35rem] sm:h-[4.35rem]" />
      </motion.div>
      <span
        className="text-[9px] uppercase tracking-wider font-black leading-none mt-0.5"
        style={{ color: rim }}
      >
        {creature.move}
      </span>
      <CreatureStatsBar creature={creature} stats={stats} atk={atk} atkReduced={atkReduced} lowHp={lowHp} />
      <CreaturePassiveBadges creature={creature} passiveSuppressed={passiveSuppressed} />
      {/* GOLD HALO — pulsing ring around the whole slot when Provocation is
       *  active AND charged. Hidden when suppressed or out of charges. */}
      {creature.taunt && !passiveSuppressed && creature.provocationCharges > 0 && (
        <motion.div
          aria-hidden
          // PERF (Alex 2026-06-23 « saccadé ») : ce halo Provocation tournait en
          // repeat:Infinity en animant un box-shadow-blur 26px = re-raster par frame
          // sur 1-6 créatures pendant TOUT le combat. Box-shadow STATIQUE + pulse
          // d'OPACITY seul (GPU-composité) → quasi gratuit, même rendu.
          initial={{ opacity: 0.7 }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-xl pointer-events-none z-[5]"
          style={{ boxShadow: "inset 0 0 0 3px rgba(252,211,77,0.8), 0 0 22px 4px rgba(252,211,77,0.6)" }}
        />
      )}
      {/* DEFLECTION PULSE — fires when THIS rock just ate an attack. A
       *  bright violet→amber expanding ring + flash so the player sees
       *  exactly which rock saved their hero. Keyed by deflectingPulse so
       *  consecutive deflects re-fire the anim. */}
      <AnimatePresence>
        {deflectingPulse !== null && (
          <motion.div
            key={"defl-" + deflectingPulse}
            aria-hidden
            // PERF (Alex 2026-06-23) : box-shadow STATIQUE + on n'anime que
            // opacity/scale (avant : box-shadow-blur 36px animé sur plusieurs déflexions/tour).
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 1, 0.85, 0], scale: [0.9, 1.1, 1.15, 1.25] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-xl pointer-events-none z-[6]"
            style={{ boxShadow: "inset 0 0 0 4px rgba(168,85,247,0.9), 0 0 30px 8px rgba(252,211,77,0.8)" }}
          />
        )}
      </AnimatePresence>
      <CreatureHitChips dmgPop={dmgPop} shieldBlocked={shieldBlocked} dodgedHit={dodgedHit} />
      {/* TARGETING OVERLAY — when this creature slot is a valid target
       *  for the active spell (e.g. Curse on opp, Aegis on mine), overlay
       *  a pulsing amber ring + the label so the player KNOWS this is
       *  what to tap. Transparent button captures the tap. */}
      {clickable && onClick && (
        <button
          onClick={onClick}
          aria-label={clickableLabel}
          className="absolute inset-0 z-20 flex items-end justify-center focus:outline-none"
        >
          {/* PERF : box-shadow STATIQUE + pulse d'opacité seul (composité GPU),
           *  comme le halo Provocation — avant, l'ombre animée était re-rastérisée
           *  à chaque image sur chaque créature ciblable. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ boxShadow: "inset 0 0 0 3px rgba(252,211,77,0.9), 0 0 18px 2px rgba(252,211,77,0.6)" }}
          />
          <span className="relative mb-1 px-1.5 py-0.5 rounded bg-amber-400/90 text-black text-[9px] uppercase tracking-wider font-black shadow-lg">
            {clickableLabel}
          </span>
        </button>
      )}
    </motion.div>
  );
}

/** React.memo (Alex 2026-06-23 perf « animations saccadées ») : le résolveur
 *  appelle setBoard ~8×/tour ; sans memo, CHAQUE case (6) + ses ~8 calques
 *  AnimatePresence se reconciliaient à chaque tick = la frame à 730ms. Le moteur
 *  garde la référence des créatures inchangées → comparaison par défaut SÛRE
 *  (saute uniquement les cases byte-identiques ; un vrai changement re-rend). */
export const CreatureSlot = memo(CreatureSlotInner);
