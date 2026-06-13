/**
 * ArenaLaneSlot — single lane cell on the board.
 *
 * Renders one of three states:
 *   1. Real creature (with stats, status icons, damage flash, dmg popup)
 *   2. Ghost-preview of a planned summon (dashed border, "en attente")
 *   3. Empty placeholder ("vide")
 *
 * Extracted from ArenaBoard.tsx to keep that file under the project's
 * 400-line ceiling. Only consumed by ArenaBoard's LaneRow.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { CREATURE_STATS, type Creature, type LaneIndex } from "./arenaTypes";
import { creatureEffectiveAtk } from "./arenaRules";
import { DisguiseOverlay, CreatureBuffOverlay, CreatureDebuffOverlay, CreatureHealBloom } from "./ArenaCreatureFX";

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

// Per-creature net "bonus" vs "malus" indicator was retired after Alex
// flagged the ▼ icon was being read as "-1 ATK". The function lived here
// previously — if a future redesign brings it back, the rule was:
//   bonus = divineShield, atkBuff>0, anchored, ripostePrimed, lizard
//           dodgeCharge, rock taunt+charged.
//   malus = summonedThisTurn (rock/lizard), paper wiltedSteps>0,
//           combatBlunted, atkBuff<0, rock taunt suppressed-or-empty.

export interface ArenaLaneSlotProps {
  lane: LaneIndex;
  creature: Creature | null;
  plannedSummon: { lane: LaneIndex; move: Creature["move"] } | null;
  isPlayer: boolean;
  /** When false, the ghost-preview branch is skipped (used to suppress the
   *  player's own planned summons from rendering on the opp row, etc.). */
  showPlanned?: boolean;
  /** When true, this creature is the one CURRENTLY attacking in the lane-by-
   *  lane combat phase. It plays a real charge animation: lunge toward its
   *  opponent (player → up, opp → down), scale up at the apex, then return.
   *  Way more readable than a generic wiggle — the player SEES who hit. */
  chargeAttack?: boolean;
  /** When true, the lane is a valid drop target — frame pulses ambre + the
   *  whole slot becomes a button. Used by the lifted-targeting flow so the
   *  player taps directly on the board (CCG-style direct manip).
   *  Works on BOTH empty slots (summon, mirror) AND creature slots (aegis,
   *  curse, etc.) — the parent decides via `validLanes`. */
  clickable?: boolean;
  /** Label shown ON the valid slot overlay ("✦ Invoquer ici", "✦ Cible
   *  ta créature", "✦ Cible cette créature"). */
  clickableLabel?: string;
  /** Tap handler — only called when `clickable` is true. */
  onClick?: () => void;
  /** Set true when this creature's INNATE passive is currently suppressed
   *  by an opp counter-effect (today only: Pierre Provocation is suppressed
   *  while opp has a Feuille alive — Étouffe). When true, the gold halo and
   *  the 🛡 badge are hidden so the UI never lies about the active state. */
  passiveSuppressed?: boolean;
  /** Number that changes each time THIS lane's Pierre absorbs a deflection
   *  — drives a bright extra ring pulse so the player SEES which rock just
   *  saved their hero. null = no recent deflection. */
  deflectingPulse?: number | null;
  /** Annule l'invocation planifiée sur cette lane (croix rouge sur le ghost,
   *  joueur uniquement) — Alex 2026-06-12 "0 souplesse pour retirer". */
  onRemoveSummon?: () => void;
}

export function ArenaLaneSlot({
  creature, plannedSummon, isPlayer, showPlanned = false, chargeAttack = false,
  clickable = false, clickableLabel = "✦ jouer ici", onClick,
  passiveSuppressed = false,
  deflectingPulse = null,
  onRemoveSummon,
}: ArenaLaneSlotProps) {
  // Track previous HP so we can spawn a "-N" floating popup when this lane's
  // creature takes damage. We guard by move identity to avoid false-positives
  // when one creature dies and another spawns on the same lane.
  const prevRef = useRef<{ hp: number; move: Creature["move"] | null; shield: boolean; dodge: boolean } | null>(null);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  /** "🛡️ ABSORBÉ" chip — when the previous tick had a divine shield AND
   *  the current tick has none AND HP didn't change, we know the shield
   *  just ate the hit. Alex's "le lézard ne perd pas de vie" complaint. */
  const [shieldBlocked, setShieldBlocked] = useState<{ key: number } | null>(null);
  /** "✨ ESQUIVÉ" chip — when dodgeCharge true→false with HP unchanged. */
  const [dodgedHit, setDodgedHit] = useState<{ key: number } | null>(null);
  /** "🩸 BOUCLIER PERCÉ" chip — the creature died WHILE still shielded, which
   *  only happens when Tranchant (Ciseau) / LAME pierces it (a normal hit is
   *  fully absorbed). Makes the pierce visible (Alex: chip Tranchant explicite). */
  const [pierced, setPierced] = useState<{ key: number } | null>(null);
  /** Death overlay — when a creature that WAS here is now gone, render a
   *  brief shatter/fade animation for ~600ms before the slot becomes empty.
   *  Tracks the move that just died so we can show its glyph one last time. */
  const [deathGhost, setDeathGhost] = useState<{ move: Creature["move"]; key: number } | null>(null);
  /** Secousse de DÉGÂT (Alex 2026-06-12 "manque secousse quand attaquée/altérée") :
   *  recul brutal + flash rouge quand la créature perd des PV. */
  const [hitShake, setHitShake] = useState<{ key: number } | null>(null);
  /** Pulse de BUFF : la créature gonfle + halo doré-vert quand son ATK monte
   *  ou qu'elle gagne un bouclier (Alex "buffées trop molles"). */
  const [buffPulse, setBuffPulse] = useState<{ key: number } | null>(null);
  /** SOIN (Sève, etc.) : lueur verte douce + "+N" — calme et smooth,
   *  par contraste avec le hit brutal (Alex 2026-06-13 "fortes ou calmes"). */
  const [healFlash, setHealFlash] = useState<{ n: number; key: number } | null>(null);
  /** DEBUFF (Curse −ATK, Toile englue) : flash violet sombre + tassement sec. */
  const [debuffPulse, setDebuffPulse] = useState<{ key: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    const snap = creature
      ? { hp: creature.hp, move: creature.move, shield: creature.divineShield, dodge: creature.dodgeCharges > 0 }
      : null;
    if (creature && prev && prev.move === creature.move && creature.hp < prev.hp) {
      const dmg = prev.hp - creature.hp;
      setDmgPop({ n: dmg, key: Date.now() });
      setHitShake({ key: Date.now() }); // SECOUSSE de dégât (recul + flash rouge)
      const id = window.setTimeout(() => setDmgPop(null), 1000);
      const sid = window.setTimeout(() => setHitShake(null), 480);
      prevRef.current = snap;
      return () => { window.clearTimeout(id); window.clearTimeout(sid); };
    }
    // SOIN — hp REMONTE in-place (même créature) : pulse vert + "+N".
    if (creature && prev && prev.move === creature.move && creature.hp > prev.hp) {
      setHealFlash({ n: creature.hp - prev.hp, key: Date.now() });
      const id = window.setTimeout(() => setHealFlash(null), 900);
      prevRef.current = snap;
      return () => window.clearTimeout(id);
    }
    // SHIELD ABSORBED — prev had shield, now doesn't, HP unchanged.
    if (creature && prev && prev.move === creature.move && prev.shield && !creature.divineShield && creature.hp === prev.hp) {
      setShieldBlocked({ key: Date.now() });
      const id = window.setTimeout(() => setShieldBlocked(null), 1400);
      prevRef.current = snap;
      return () => window.clearTimeout(id);
    }
    // DODGE ESQUIVÉ — prev had dodge, now doesn't, HP unchanged. Alex
    // feedback : "animations pour les effets de type esquive du lézard
    // au premier tour" — manquait avant.
    // Alex feedback 2026-06-09 round 5 (#5) : Esquive chip stuck sur L2.
    // Cause probable : si dodgedHit était déjà set quand la creature change
    // (mort/replace), le chip restait visible. Ajout d'un clear explicite
    // quand la creature meurt OU change de move (sticker plus jamais stale).
    if (creature && prev && prev.move === creature.move && prev.dodge && creature.dodgeCharges === 0 && creature.hp === prev.hp) {
      setDodgedHit({ key: Date.now() });
      const id = window.setTimeout(() => setDodgedHit(null), 1400);
      prevRef.current = snap;
      return () => window.clearTimeout(id);
    }
    // Guard #5 — si la creature disparaît OU change d'identité (move), on
    // force le clear des chips save pour éviter qu'ils restent stuck.
    if (!creature || (prev && creature.move !== prev.move)) {
      setDodgedHit(null);
      setShieldBlocked(null);
    }
    // Death transition.
    if (!creature && prev && prev.move !== null) {
      setDeathGhost({ move: prev.move, key: Date.now() });
      const id = window.setTimeout(() => setDeathGhost(null), 650);
      // Aegis pierced — the creature died WHILE still shielded, which only
      // happens when Tranchant (Ciseau) / LAME pierces it (a normal hit would
      // be fully absorbed). Surface the pierce so it isn't invisible.
      let pid: number | undefined;
      if (prev.shield) {
        setPierced({ key: Date.now() });
        pid = window.setTimeout(() => setPierced(null), 1400);
      }
      prevRef.current = null;
      return () => { window.clearTimeout(id); if (pid !== undefined) window.clearTimeout(pid); };
    }
    prevRef.current = snap;
  }, [creature]);

  // 🎭 MASCARADE / déguisement — détecte un changement de symbole IN-PLACE
  // (la créature reste vivante mais son `move` change : seul Mascarade fait
  // ça aujourd'hui). Déclenche un flash de transformation (voile violet +
  // balayage doré + masque 🎭) et le glyphe se retourne sur sa nouvelle
  // identité. Effet ISOLÉ du pipeline de dégâts pour ne pas interférer avec
  // les chips save/death. Pas de faux positif sur résummon : une créature
  // qui meurt passe par un render `null` (slot vide) avant le nouveau summon,
  // donc prevMoveRef retombe à null entre les deux.
  const prevMoveRef = useRef<Creature["move"] | null>(creature?.move ?? null);
  const [disguiseFlash, setDisguiseFlash] = useState<{ key: number } | null>(null);
  useEffect(() => {
    const prevM = prevMoveRef.current;
    const curM = creature?.move ?? null;
    if (prevM && curM && prevM !== curM) {
      setDisguiseFlash({ key: Date.now() });
      const id = window.setTimeout(() => setDisguiseFlash(null), 850);
      prevMoveRef.current = curM;
      return () => window.clearTimeout(id);
    }
    prevMoveRef.current = curM;
  }, [creature?.move]);

  // 💪 BUFF pulse — détecte une hausse d'ATK (atkBuff) ou un bouclier gagné
  // IN-PLACE. Déclenche un pop + halo (cf. reactAnim). Isolé du pipeline
  // dégâts. Pas de faux positif sur résummon (passage par null entre deux).
  const prevBuffRef = useRef<{ atk: number; shield: boolean; webbed: boolean } | null>(
    creature ? { atk: creature.atkBuff, shield: creature.divineShield, webbed: !!creature.cannotAttack } : null,
  );
  useEffect(() => {
    const prev = prevBuffRef.current;
    const cur = creature
      ? { atk: creature.atkBuff, shield: creature.divineShield, webbed: !!creature.cannotAttack }
      : null;
    if (cur && prev && (cur.atk > prev.atk || (!prev.shield && cur.shield))) {
      setBuffPulse({ key: Date.now() });
      const id = window.setTimeout(() => setBuffPulse(null), 680);
      prevBuffRef.current = cur;
      return () => window.clearTimeout(id);
    }
    // DEBUFF — ATK qui BAISSE (Curse) ou englument Toile (cannotAttack
    // false→true) : tassement sec violet (Alex 2026-06-13).
    if (cur && prev && (cur.atk < prev.atk || (!prev.webbed && cur.webbed))) {
      setDebuffPulse({ key: Date.now() });
      const id = window.setTimeout(() => setDebuffPulse(null), 620);
      prevBuffRef.current = cur;
      return () => window.clearTimeout(id);
    }
    prevBuffRef.current = cur;
  }, [creature?.atkBuff, creature?.divineShield, creature?.cannotAttack]);

  if (creature) {
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
    const rim = moveRim(pal.hex);
    const glow = moveGlow(pal.hex);
    // Side affinity tinting: player creatures get an emerald inner badge,
    // opp creatures get a rose one — visual ownership cue independent of
    // the move's signature color (kept on the frame rim).
    const sideTint = isPlayer ? "rgba(52,211,153,0.55)" : "rgba(244,63,94,0.55)";
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
    // Animation de RÉACTION composite (Alex 2026-06-12 "tout trop mou") :
    // priorité attaque > dégât (secousse + flash rouge) > buff (pop doré-vert)
    // > repos. Une seule de ces réactions joue à la fois sur une case.
    const idleAnim = { y: 0, x: 0, scale: 1, rotate: 0, filter: "brightness(1) drop-shadow(0 0 0 transparent)" };
    const reactAnim = chargeAttack
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
    return (
      <motion.div
        layout
        // ENTRÉE D'INVOCATION dramatisée (Alex 2026-06-13) : la créature
        // JAILLIT de son camp (offset + rotation) et atterrit avec un
        // overshoot spring — fini le simple fondu.
        initial={{ opacity: 0, y: isPlayer ? 20 : -20, scale: 0.55, rotate: isPlayer ? -6 : 6 }}
        animate={{ opacity: 1, ...reactAnim }}
        transition={
          chargeAttack
            ? { duration: 0.72, ease: "easeOut", times: [0, 0.2, 0.42, 0.55, 0.78, 1] }
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
          zIndex: chargeAttack ? 30 : hitShake || buffPulse ? 20 : 1,
          background: "linear-gradient(160deg, rgba(20,22,32,0.94) 0%, rgba(10,12,20,0.94) 100%)",
          border: `2px solid ${creature.divineShield ? "rgba(252,211,77,0.95)" : rim}`,
          boxShadow:
            (creature.divineShield
              ? "0 0 20px -2px rgba(252,211,77,0.7), "
              : `0 0 14px -3px ${glow}, `) +
            `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${sideTint}30`,
        }}
      >
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
        <AnimatePresence>
          {debuffPulse && <CreatureDebuffOverlay key={`debuff-${debuffPulse.key}`} />}
        </AnimatePresence>
        {/* 🕸 TOILE GLUANTE — voile lime + badge tant que la créature est
         *  engluée (cannotAttack, expire en fin de tour). L'UI ne ment pas :
         *  ⚔ affiche déjà 0, ceci montre POURQUOI. */}
        {creature.cannotAttack && (
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
          style={{ transformStyle: "preserve-3d", lineHeight: 0 }}
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
          {creature.stifles && (
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
            initial={{ opacity: 0.7 }}
            animate={{
              boxShadow: [
                "inset 0 0 0 2px rgba(252,211,77,0.55), 0 0 14px 2px rgba(252,211,77,0.45)",
                "inset 0 0 0 3px rgba(252,211,77,0.95), 0 0 26px 5px rgba(252,211,77,0.75)",
                "inset 0 0 0 2px rgba(252,211,77,0.55), 0 0 14px 2px rgba(252,211,77,0.45)",
              ],
              opacity: [0.85, 1, 0.85],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-xl pointer-events-none z-[5]"
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: [0, 1, 0.85, 0],
                scale: [0.9, 1.1, 1.15, 1.2],
                boxShadow: [
                  "0 0 0 0 rgba(168,85,247,0)",
                  "inset 0 0 0 4px rgba(168,85,247,0.95), 0 0 28px 8px rgba(252,211,77,0.85)",
                  "inset 0 0 0 3px rgba(252,211,77,0.95), 0 0 36px 10px rgba(168,85,247,0.7)",
                  "inset 0 0 0 0 rgba(252,211,77,0), 0 0 0 0 rgba(168,85,247,0)",
                ],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="absolute inset-0 rounded-xl pointer-events-none z-[6]"
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
              <span className="px-1.5 py-0.5 rounded bg-violet-300/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
                ✨ ESQUIVÉ
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

  if (plannedSummon && showPlanned) {
    const pal = MOVE_PALETTE[plannedSummon.move];
    const rim = moveRim(pal.hex);
    const plannedContent = (
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        className="aspect-[5/4] w-full rounded-xl relative flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(20,22,32,0.55) 0%, rgba(10,12,20,0.55) 100%)",
          border: `2px dashed ${rim}`,
          boxShadow: `0 0 10px -3px ${moveGlow(pal.hex)}80`,
        }}
      >
        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-sm flex items-center gap-0.5" aria-label="en attente">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.1, 0.85] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
              className="w-1 h-1 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.7)]"
            />
          ))}
        </span>
        <div className="flex flex-col items-center justify-center">
          <MoveGlyph move={plannedSummon.move} className="w-12 h-12 sm:w-14 sm:h-14 opacity-85" />
          <span
            className="text-[9px] uppercase tracking-wider font-bold leading-none mt-1 opacity-90"
            style={{ color: rim }}
          >
            {plannedSummon.move}
          </span>
        </div>
      </motion.div>
    );
    // Croix rouge d'ANNULATION (Alex 2026-06-12 "0 souplesse") — retire
    // l'invocation planifiée sur la lane. Rendue en SIBLING du contenu (pas
    // enfant du <button> clickable) pour éviter un bouton imbriqué invalide.
    const removeX = onRemoveSummon ? (
      <button
        onClick={(e) => { e.stopPropagation(); onRemoveSummon(); }}
        className="absolute -top-1.5 -left-1.5 z-40 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black leading-none shadow-lg ring-2 ring-black/40 active:scale-90"
        aria-label="Annuler l'invocation"
      >
        ✕
      </button>
    ) : null;
    // Alex feedback 2026-06-09 : "remplacement ne marche pas" — quand on a
    // déjà planifié un symbole sur la lane, le slot était figé sans
    // clickable. Maintenant on wrap dans un button avec label "↻ Remplacer
    // (planifié)" pour permettre de changer d'avis avant le lock.
    if (clickable) {
      return (
        <div className="relative w-full">
          <button
            onClick={onClick}
            className="w-full focus:outline-none relative"
            aria-label={clickableLabel}
          >
            {plannedContent}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-400/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap z-30">
              {clickableLabel}
            </span>
          </button>
          {removeX}
        </div>
      );
    }
    return (
      <div className="relative w-full">
        {plannedContent}
        {removeX}
      </div>
    );
  }

  // Empty slot — but wrapped as a BUTTON when clickable, with pulsing amber
  // ring so the targeting flow shows valid drops directly on the board.
  // Also hosts the death-ghost overlay (kept for ~650ms after a death).
  const baseEmpty = (
    <div className="aspect-[5/4] w-full rounded-xl border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center relative overflow-hidden">
      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">vide</span>
      <AnimatePresence>
        {deathGhost && (
          <motion.div
            key={deathGhost.key}
            initial={{ opacity: 1, scale: 1, rotate: 0 }}
            animate={{ opacity: 0, scale: 0.4, rotate: isPlayer ? 25 : -25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeIn" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ filter: "drop-shadow(0 0 12px rgba(244,63,94,0.7))" }}
          >
            <MoveGlyph move={deathGhost.move} className="w-12 h-12 opacity-90" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Aegis pierced chip — the shielded creature here was just pierced
       *  (Tranchant / LAME). Red "bouclier percé" so the pierce is visible. */}
      <AnimatePresence>
        {pierced && (
          <motion.div
            key={pierced.key}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -22 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <span className="px-1.5 py-0.5 rounded bg-rose-400/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
              🩸 Bouclier percé
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  if (clickable) {
    return (
      <button
        onClick={onClick}
        className="w-full focus:outline-none"
        aria-label={clickableLabel}
      >
        <motion.div
          animate={{ scale: [1, 1.04, 1], boxShadow: [
            "0 0 0 0 rgba(252,211,77,0)",
            "0 0 14px 2px rgba(252,211,77,0.55)",
            "0 0 0 0 rgba(252,211,77,0)",
          ] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="aspect-[5/4] w-full rounded-xl border-2 border-amber-300/80 bg-amber-500/20 flex items-center justify-center relative overflow-hidden"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-amber-100 font-black text-center px-1">
            {clickableLabel}
          </span>
        </motion.div>
      </button>
    );
  }
  return baseEmpty;
}
