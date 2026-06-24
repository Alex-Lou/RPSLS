/**
 * ArenaLaneSlot — single lane cell on the board (orchestrateur).
 *
 * Détient TOUT l'état + les refs + les 3 useEffect de détection (compare
 * prev/current de la créature pour déclencher dégât/soin/bouclier/esquive/mort/
 * déguisement/buff/debuff) — la LOGIQUE SENSIBLE (timing, refs, setTimeout) ne
 * quitte jamais ce fichier. Le rendu est délégué à 3 sous-composants
 * présentationnels selon l'état :
 *   1. CreatureSlot — créature vivante (stats, status icons, FX d'impact)
 *   2. PlannedSlot  — aperçu fantôme d'une invocation planifiée
 *   3. EmptySlot    — placeholder vide (+ death-ghost / "bouclier percé")
 *
 * Only consumed by ArenaBoard's LaneRow.
 */

import { memo, useEffect, useRef, useState } from "react";
import { type Creature, type LaneIndex } from "../arenaTypes";
import { CreatureSlot } from "./CreatureSlot";
import { PlannedSlot } from "./PlannedSlot";
import { EmptySlot } from "./EmptySlot";
import { DeathShatter } from "./DeathShatter";
import { CreatureDodgeOverlay } from "../ArenaCreatureFX";

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

function ArenaLaneSlotInner({
  creature, plannedSummon, isPlayer, showPlanned = false, chargeAttack = false,
  clickable = false, clickableLabel = "✦ jouer ici", onClick,
  passiveSuppressed = false,
  deflectingPulse = null,
  onRemoveSummon,
}: ArenaLaneSlotProps) {
  // Track previous HP so we can spawn a "-N" floating popup when this lane's
  // creature takes damage. We guard by move identity to avoid false-positives
  // when one creature dies and another spawns on the same lane.
  const prevRef = useRef<{ hp: number; move: Creature["move"] | null; shield: boolean; dodge: number } | null>(null);
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
      ? { hp: creature.hp, move: creature.move, shield: creature.divineShield, dodge: creature.dodgeCharges }
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
    // DODGE ESQUIVÉ — une charge d'Esquive vient d'être CONSOMMÉE (dodgeCharges
    // baisse) sans perte de PV. Élargi 2026-06-23 : avant on n'animait QUE le
    // passage à 0 (=== 0), donc un lézard à plusieurs charges (Métamorphose = 9)
    // n'animait pas ses esquives intermédiaires. Maintenant CHAQUE esquive joue.
    // Alex feedback 2026-06-09 round 5 (#5) : Esquive chip stuck sur L2.
    // Cause probable : si dodgedHit était déjà set quand la creature change
    // (mort/replace), le chip restait visible. Ajout d'un clear explicite
    // quand la creature meurt OU change de move (sticker plus jamais stale).
    if (creature && prev && prev.move === creature.move && prev.dodge > 0 && creature.dodgeCharges < prev.dodge && creature.hp === prev.hp) {
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

  // ⛰ STRATE (Voie Montagne) — détecte la hausse de voieAtkBonus. Garde STRICTE
  // à +1 (= une Strate ajoutée, gain de fin de tour) : le finisher Forteresse
  // (+2 d'un coup) a sa PROPRE cue plein-board (ArenaSpellFX) → zéro double-flash.
  // Isolé des pipelines dégâts/buff. Pas de faux positif sur résummon (la valeur
  // retombe à 0 via un render `null` entre deux créatures).
  const prevStrateRef = useRef<number>(creature?.voieAtkBonus ?? 0);
  const [strateGain, setStrateGain] = useState<{ key: number } | null>(null);
  useEffect(() => {
    const prev = prevStrateRef.current;
    const cur = creature?.voieAtkBonus ?? 0;
    if (creature && cur === prev + 1) {
      setStrateGain({ key: Date.now() });
      const id = window.setTimeout(() => setStrateGain(null), 760);
      prevStrateRef.current = cur;
      return () => window.clearTimeout(id);
    }
    prevStrateRef.current = cur;
  }, [creature?.voieAtkBonus]);

  // 🎭 ESQUIVE (Voie Mirage) — détecte la HAUSSE de dodgeCharges (= une charge
  // d'Esquive gagnée, via les cartes Mirage). La CONSOMMATION (baisse) garde son
  // chip « ✨ ESQUIVÉ » existant. Même motif one-shot que la Strate.
  const prevDodgeRef = useRef<number>(creature?.dodgeCharges ?? 0);
  const [mirageGain, setMirageGain] = useState<{ key: number } | null>(null);
  useEffect(() => {
    const prev = prevDodgeRef.current;
    const cur = creature?.dodgeCharges ?? 0;
    if (creature && cur > prev) {
      setMirageGain({ key: Date.now() });
      const id = window.setTimeout(() => setMirageGain(null), 720);
      prevDodgeRef.current = cur;
      return () => window.clearTimeout(id);
    }
    prevDodgeRef.current = cur;
  }, [creature?.dodgeCharges]);

  const slot = creature ? (
    <CreatureSlot
      creature={creature}
      isPlayer={isPlayer}
      chargeAttack={chargeAttack}
      clickable={clickable}
      clickableLabel={clickableLabel}
      onClick={onClick}
      passiveSuppressed={passiveSuppressed}
      deflectingPulse={deflectingPulse}
      dmgPop={dmgPop}
      shieldBlocked={shieldBlocked}
      dodgedHit={dodgedHit}
      hitShake={hitShake}
      buffPulse={buffPulse}
      healFlash={healFlash}
      debuffPulse={debuffPulse}
      disguiseFlash={disguiseFlash}
      strateGain={strateGain}
      mirageGain={mirageGain}
    />
  ) : plannedSummon && showPlanned ? (
    <PlannedSlot
      plannedSummon={plannedSummon}
      clickable={clickable}
      clickableLabel={clickableLabel}
      onClick={onClick}
      onRemoveSummon={onRemoveSummon}
    />
  ) : (
    <EmptySlot
      pierced={pierced}
      clickable={clickable}
      clickableLabel={clickableLabel}
      onClick={onClick}
    />
  );
  return (
    <div className="relative w-full">
      {slot}
      {/* DEATH-SHATTER en OVERLAY au-dessus de la case (quelle que soit la branche)
       *  → la mort joue TOUJOURS. Avant, le ghost vivait DANS EmptySlot et était
       *  AVALÉ quand la case affichait un fantôme d'invocation planifiée (rangée
       *  joueur reçoit `intent`) ou une nouvelle créature → « parfois la mort traîne
       *  sans anim, parfois oui parfois non ». Keyé → re-joue à chaque mort. */}
      {deathGhost && <DeathShatter key={deathGhost.key} move={deathGhost.move} isPlayer={isPlayer} />}
      {/* ✦ ESQUIVE — overlay ancré à la case (le corps détale via son propre
       *  transform dans CreatureSlot ; le fantôme reste ICI). Keyé → re-joue à
       *  chaque charge consommée. creature non-null garanti (l'esquive survit). */}
      {dodgedHit && creature && (
        <CreatureDodgeOverlay key={`dodge-${dodgedHit.key}`} move={creature.move} dir={isPlayer ? 1 : -1} />
      )}
    </div>
  );
}

/** React.memo (Alex 2026-06-23 perf) : gate de la case — pendant le combat, une
 *  case non touchée reçoit des props stables → on saute l'orchestrateur ET sa
 *  CreatureSlot. L'état d'anim interne (hitShake…) vient de useState, donc il
 *  bypasse memo : aucune animation n'est bloquée. */
export const ArenaLaneSlot = memo(ArenaLaneSlotInner);
