/**
 * CreatureSlot — render branch for a lane cell holding a LIVE creature.
 *
 * PURELY presentational : tout l'état + les refs + les 3 useEffect de détection
 * (dégât/soin/bouclier/esquive/mort/déguisement/buff/debuff) vivent dans
 * l'orchestrateur ArenaLaneSlot, qui passe ici les flags one-shot en props.
 * Le JSX intérieur est byte-identique à l'original ; seul `reactAnim` est
 * dérivé via le helper pur creatureSlotAnim. AUCUN overlay réordonné (l'ordre
 * DOM pilote l'empilement des overlays sans z-index explicite).
 */

import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { CREATURE_STATS, type Creature } from "../arenaTypes";
import { creatureEffectiveAtk } from "../arenaRules";
import { DisguiseOverlay, CreatureBuffOverlay, CreatureDebuffOverlay, CreatureHealBloom, CreatureStrateOverlay, CreatureMirageOverlay, CreatureSharpenOverlay } from "../ArenaCreatureFX";
import { creatureReactAnim } from "./creatureSlotAnim";

/** Vecteurs FIXES des étincelles d'impact (pas de Math.random au render —
 *  zéro jitter de re-render). 7 directions en éventail, alternance ambre/rose. */
const SPARK_VECTORS: Array<{ dx: number; dy: number; amber: boolean }> = [
  { dx: -30, dy: -24, amber: true },
  { dx: 0,   dy: -34, amber: false },
  { dx: 30,  dy: -24, amber: true },
  { dx: -36, dy: 2,   amber: false },
  { dx: 36,  dy: 2,   amber: true },
  { dx: -22, dy: 26,  amber: false },
  { dx: 22,  dy: 26,  amber: true },
];

/** Identité de Voie sur le CADRE de la créature (statique, gratuit, derrière le
 *  contenu). 1 entrée par move ayant une Voie thématisée → DRY pour la
 *  réplication (Montagne/Mirage… puis Cosmos/Tranchant/Forêt). Réversible. */
const VOIE_FRAME: Partial<Record<Creature["move"], { bg: string; shadow: string }>> = {
  // ⛰ Montagne — granite gris-pierre.
  rock: {
    bg: "linear-gradient(150deg, rgba(168,162,158,0.20), rgba(68,64,60,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(214,211,209,0.35), inset 0 0 14px rgba(68,64,60,0.40)",
  },
  // 🎭 Mirage — voile iridescent indigo↔cyan.
  lizard: {
    bg: "linear-gradient(150deg, rgba(129,140,248,0.18), rgba(34,211,238,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(165,180,252,0.35), inset 0 0 14px rgba(99,102,241,0.35)",
  },
  // ⚔️ Tranchant — acier froid + rose-cardinal.
  scissors: {
    bg: "linear-gradient(150deg, rgba(244,63,94,0.16), rgba(148,163,184,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(254,205,211,0.35), inset 0 0 14px rgba(225,29,72,0.30)",
  },
  // 🌲 Forêt — émeraude vivante + sève dorée.
  paper: {
    bg: "linear-gradient(150deg, rgba(52,211,153,0.18), rgba(16,122,87,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(167,243,208,0.35), inset 0 0 14px rgba(5,150,105,0.35)",
  },
  // 🌌 Cosmos — violet du vide + liseré cyan glacé.
  spock: {
    bg: "linear-gradient(150deg, rgba(139,92,246,0.18), rgba(34,211,238,0.08) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(196,181,253,0.35), inset 0 0 14px rgba(124,58,237,0.35)",
  },
};

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
      {/* Radial burst overlay — at the apex of the charge, a bright
       *  white → amber ring expands outward from the creature's center.
       *  Drives the "impact" feel beyond the lunge alone. */}
      <AnimatePresence>
        {chargeAttack && (
          <motion.div
            key="charge-burst"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0.7, 0], scale: [0.4, 1.4, 2.2, 2.8] }}
            transition={{ duration: 0.6, ease: "easeOut", times: [0, 0.35, 0.6, 1], delay: 0.16 }}
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(252,211,77,0.6) 35%, transparent 70%)",
              mixBlendMode: "screen",
            }}
          />
        )}
        {/* ONDE DE CHOC (Alex 2026-06-12 "combats trop mous") : un anneau
         *  net qui claque vers l'extérieur à l'apex du slam. Transform-only. */}
        {chargeAttack && (
          <motion.div
            key="shockwave"
            initial={{ opacity: 0, scale: 0.45 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.45, 1.7, 2.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.3, 1], delay: 0.24 }}
            className="absolute inset-0 pointer-events-none rounded-full border-2"
            style={{ borderColor: "rgba(252,211,77,0.9)", boxShadow: "0 0 12px rgba(252,211,77,0.5)" }}
          />
        )}
      </AnimatePresence>
      {/* ÉTINCELLES D'IMPACT — 7 particules en éventail quand la créature
       *  encaisse (hitShake). Vecteurs fixes, transform/opacity only. */}
      <AnimatePresence>
        {hitShake && (
          <motion.div
            key={`sparks-${hitShake.key}`}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 25 }}
            exit={{ opacity: 0 }}
          >
            {SPARK_VECTORS.map((v, i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{ x: v.dx, y: v.dy, scale: 0.2, opacity: 0 }}
                transition={{ duration: 0.42, ease: "easeOut", delay: i * 0.012 }}
                className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                style={{
                  background: v.amber ? "#fcd34d" : "#fb7185",
                  boxShadow: v.amber
                    ? "0 0 6px rgba(252,211,77,0.95)"
                    : "0 0 6px rgba(251,113,133,0.95)",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* FLASH ROUGE de coup (Alex 2026-06-23 « le dégât est encore mou ») : voile
       *  rouge bref sur TOUTE la case quand la créature encaisse — viscéral et
       *  lisible, opacity-only (GPU-safe, pas de filtre animé). */}
      <AnimatePresence>
        {hitShake && (
          <motion.div
            key={`hitflash-${hitShake.key}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, times: [0, 0.3, 1], ease: "easeOut" }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ background: "rgba(244,63,94,0.7)", zIndex: 24 }}
          />
        )}
      </AnimatePresence>
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
      {/* 🕸 TOILE GLUANTE — voile lime + badge tant que la créature est
       *  engluée (cannotAttack, expire en fin de tour). L'UI ne ment pas :
       *  ⚔ affiche déjà 0, ceci montre POURQUOI. */}
      {creature.cannotAttack && !creature.phasedOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }} aria-hidden>
          <div
            className="absolute inset-0 rounded-xl"
            style={{ background: "radial-gradient(circle, rgba(132,204,22,0.16) 0%, rgba(132,204,22,0.05) 60%, transparent 80%)" }}
          />
          <motion.span
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1 left-1/2 -translate-x-1/2 text-[13px] drop-shadow"
            title="Engluée — ne peut pas attaquer ce tour"
          >
            🕸️
          </motion.span>
        </div>
      )}
      {/* 🌘 ÉCLIPSE — créature EN PHASE : voile cyan + liseré pulsant + badge tant
       *  qu'elle est intouchable (phasedOut, expire fin de tour). Elle survit à
       *  tout ce tour mais n'attaque pas → on rend l'intangibilité LISIBLE.
       *  Perf-safe : box-shadow STATIQUE, on n'anime que l'opacity (cf. halo Provoc). */}
      {creature.phasedOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 16 }} aria-hidden>
          <div
            className="absolute inset-0 rounded-xl"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(129,140,248,0.10) 55%, transparent 82%)" }}
          />
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-xl"
            style={{ boxShadow: "inset 0 0 0 2px rgba(34,211,238,0.55), inset 0 0 16px rgba(34,211,238,0.4)" }}
          />
          <span
            className="absolute top-1 left-1/2 -translate-x-1/2 text-[12px] drop-shadow"
            title="En phase (Éclipse) — intouchable ce tour, n'attaque pas"
          >
            🌘
          </span>
        </div>
      )}
      {/* 🔥 PHÉNIX — flamme de RENAISSANCE : quand une créature revient
       *  (justRevived), une flamme or→rouge s'élève UNE fois (rise + fade).
       *  Per-turn (flag effacé au reset suivant). One-shot, leak-free. */}
      {creature.justRevived && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 21 }} aria-hidden>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.4, 1.8] }}
            transition={{ duration: 1.0, times: [0, 0.4, 1], ease: "easeOut" }}
            className="absolute inset-0 rounded-xl"
            style={{ background: "radial-gradient(circle at 50% 70%, rgba(251,146,60,0.8) 0%, rgba(249,115,22,0.4) 40%, transparent 72%)", mixBlendMode: "screen" }}
          />
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], y: -18, scale: 1.2 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl"
            style={{ filter: "drop-shadow(0 0 8px rgba(249,115,22,0.9))" }}
          >
            🔥
          </motion.span>
        </div>
      )}
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
      {/* ATK and HP corner badges + a MINI HP BAR at the very bottom edge
       *  of the slot that animates fill width on damage/heal — Alex
       *  feedback : "je vois pas les pv de chaque move descendre",
       *  the chip alone wasn't read as a status indicator. */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-0">
        {/* HP bar — sits above the badges. Fills + colour changes by
         *  threshold (green > 50%, amber > 25%, rose otherwise). The
         *  width animates so a hit is OBVIOUS, not just a number flip. */}
        <div className="mx-1 mb-0.5 h-1.5 rounded-full bg-black/65 overflow-hidden ring-1 ring-black/40 shadow-inner">
          <motion.div
            className={
              "h-full rounded-full " +
              (creature.hp / stats.hp > 0.5
                ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                : creature.hp / stats.hp > 0.25
                ? "bg-gradient-to-r from-amber-500 to-amber-300"
                : "bg-gradient-to-r from-rose-600 to-rose-400")
            }
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, (creature.hp / stats.hp) * 100))}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          />
        </div>
        {/* Bottom row : ATK left + HP chip right. */}
        <div className="flex items-end justify-between px-1 pb-0.5">
          <span
            className={
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-black leading-none tabular-nums shadow " +
              (atkReduced
                ? "bg-rose-600/90 text-rose-50"
                : "bg-amber-500/85 text-amber-50")
            }
            title={atkReduced ? "ATK réduite par un malus actif" : undefined}
          >
            ⚔ {atk}
            {atkReduced && <span className="text-[8px] opacity-95">↓</span>}
            {!atkReduced && creature.atkBuff > 0 && <span className="text-[7px] opacity-90">+{creature.atkBuff}</span>}
          </span>
          <motion.span
            key={creature.hp}
            initial={{ scale: 1.3, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#fee2e2" }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-600/85 text-[10px] font-black leading-none tabular-nums shadow"
          >
            ❤ {creature.hp}/{stats.hp}
          </motion.span>
        </div>
      </div>
      {/* INNATE PASSIVE BADGE top-right — one per move, RPSLS identity.
       *  Pierre's Provocation can be suppressed by opp Étouffe (Feuille)
       *  in which case neither the badge nor the gold halo show, so the
       *  UI never lies about the live state of the passive. */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5">
        {creature.taunt && !passiveSuppressed && creature.provocationCharges > 0 && (
          <span
            className="text-[9px] px-1 py-0.5 rounded bg-amber-400/95 text-black font-black tracking-wider shadow leading-none inline-flex items-center gap-0.5"
            title={"Provocation — annule la prochaine attaque (charge " + creature.provocationCharges + ")"}
          >
            🛡{creature.provocationCharges > 1 ? <span className="text-[7px]">×{creature.provocationCharges}</span> : null}
          </span>
        )}
        {creature.move === "paper" && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/95 text-black font-black tracking-wider shadow leading-none" title="Étouffe — annule la Provocation des Pierres adverses">
            🌿
          </span>
        )}
        {creature.pierces && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-rose-400/95 text-black font-black tracking-wider shadow leading-none" title="Tranchant — ignore les boucliers adverses au combat">
            ⚔
          </span>
        )}
        {creature.dodgeCharges > 0 && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-sky-400/95 text-black font-black tracking-wider shadow leading-none" title="Esquive — la prochaine blessure est ignorée">
            ✨
          </span>
        )}
        {creature.spellImmune && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-violet-400/95 text-black font-black tracking-wider shadow leading-none" title="Logique — immunisé aux sorts adverses">
            🧬
          </span>
        )}
        {/* Spell-granted statuses — secondary row of small emojis */}
        {creature.divineShield && <span className="text-[10px]" title="Aegis (sort) — prochaine attaque absorbée">🛡️</span>}
        {creature.anchored && <span className="text-[10px]" title="Ancré (sort) — immun aux sorts opp ce tour">⚓</span>}
        {creature.ripostePrimed && <span className="text-[10px]" title="Riposte (sort) — si tué en combat, son tueur meurt aussi">⚔️</span>}
      </div>
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
      {/* Floating damage popup */}
      <AnimatePresence>
        {dmgPop && (
          <motion.div
            key={dmgPop.key}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: 1, y: -28, scale: 1.15 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
            style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
          >
            −{dmgPop.n}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Shield absorbed chip — pops when divineShield just ate damage. */}
      <AnimatePresence>
        {shieldBlocked && (
          <motion.div
            key={shieldBlocked.key}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -22 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="px-1.5 py-0.5 rounded bg-amber-300/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
              🛡️ ABSORBÉ
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Dodge chip — pops when dodgeCharge (Lézard Esquive) absorbed the hit. */}
      <AnimatePresence>
        {dodgedHit && (
          <motion.div
            key={dodgedHit.key}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -22 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="px-1.5 py-0.5 rounded bg-cyan-300/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
              ✦ ESQUIVÉ
            </span>
          </motion.div>
        )}
      </AnimatePresence>
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
          <motion.div
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(252,211,77,0)",
                "inset 0 0 0 3px rgba(252,211,77,0.9), 0 0 18px 2px rgba(252,211,77,0.6)",
                "0 0 0 0 rgba(252,211,77,0)",
              ],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-xl pointer-events-none"
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
