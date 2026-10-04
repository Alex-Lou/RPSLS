/**
 * États FX / résolution d'ArenaGame (extraits, cap <400 lignes/fichier).
 * - useArenaResolveFx  : états pilotés par le résolveur (aperçus, step, lane en
 *   combat, chips, FX plein-écran, recap, cue du Tracé…) + leurs purges.
 * - useArenaFxAutoClear: auto-effacement des chips + splash + anim Larcin.
 * Hooks/effets à l'IDENTIQUE, appelés aux mêmes positions dans ArenaGame
 * (ordre des hooks et dépendances inchangés).
 */

import { useEffect, useRef, useState } from "react";
import { useAnimationControls } from "motion/react";
import { hapticHeroHit, hapticMatchStart } from "../../haptic";
import type { CardId } from "../../ranked/rankedTypes";
import type { Move } from "../../engine/game";
import type { TraceCue } from "../ArenaTraceCue";
import type { TurnHistoryEntry } from "../ArenaTurnHistory";
import type { TurnRecap } from "../arenaRecap";
import { hasDominantSpell } from "../arenaFinishers";
import { engineGauge } from "../arenaEngines";
import { useCastOnDrawQueue } from "../ArenaCastOnDrawFX";
import type { ArenaTargeting, BoardState, LaneIndex, Side, TurnIntent } from "../arenaTypes";
import type { ResolveStep } from "../arenaResolverFlow";
import type { ProjectileFX } from "../ArenaProjectileFX";
import { MATCH_FOUND_SPLASH_MS } from "./arenaGameUtils";

export function useArenaResolveFx(board: BoardState, mySide: Side) {
  const [matchSplash, setMatchSplash] = useState(true);
  const [resolving, setResolving] = useState(false);
  // Signatures FX plein-board (Genèse, Supernova…). Purgé après l'anim par un
  // timer NETTOYÉ → aucune fuite (cf. demande Alex « zéro thread non achevée »).
  const [spellFX, setSpellFX] = useState<{ ids: CardId[]; key: number } | null>(null);
  useEffect(() => {
    if (!spellFX) return;
    // LE MOMENT : une Légendaire/Finisher reste à l'écran plus longtemps (anim
    // solo ralentie, cf. ArenaSpellFX + la pause de flux allongée).
    // Hold ≥ la fenêtre par carte du résolveur (CARD_MS 1700 / DOMINANT 2700)
    // pour qu'une carte reste affichée jusqu'à ce que la SUIVANTE la remplace,
    // sans trou noir entre deux (Alex 2026-06-23 spell-spotlight séquencé).
    const hold = hasDominantSpell(spellFX.ids) ? 2900 : 1900;
    const id = window.setTimeout(() => setSpellFX(null), hold);
    return () => window.clearTimeout(id);
  }, [spellFX?.key]);
  // IMPACT FX plein-écran (coup puissant/fatal) + TREMBLEMENT de l'écran. Purgé
  // par timer nettoyé, shake one-shot via controls → leak-free.
  const [impactFX, setImpactFX] = useState<{ move: Move; power: "strong" | "fatal"; key: number } | null>(null);
  const screenShake = useAnimationControls();
  useEffect(() => {
    if (!impactFX) return;
    const fatal = impactFX.power === "fatal";
    const amp = fatal ? 11 : 6;
    // Secousse one-shot (pas de repeat) — séquence d'amplitude décroissante.
    screenShake.start({
      x: [0, -amp, amp, -amp * 0.7, amp * 0.5, -amp * 0.25, 0],
      y: [0, amp * 0.6, -amp * 0.5, amp * 0.4, -amp * 0.2, amp * 0.1, 0],
      transition: { duration: fatal ? 0.6 : 0.45, ease: "easeOut" },
    });
    const idImpact = window.setTimeout(() => setImpactFX(null), 900);
    return () => window.clearTimeout(idImpact);
  }, [impactFX?.key]);
  // Projectile Jet de Caillou (Alex 2026-06-24) — purgé par timer nettoyé pour
  // qu'un 2e jet identique re-déclenche (transition de key). 1800ms = fin réelle
  // de l'anim (impact ~1.48s + stagger AOE ~0.18s) + petite marge ; au-delà, on
  // tenait l'essaim de nœuds monté ~540ms après qu'il soit invisible (perf).
  const [projectileShots, setProjectileShots] = useState<ProjectileFX[]>([]);
  useEffect(() => {
    if (projectileShots.length === 0) return;
    const id = window.setTimeout(() => setProjectileShots([]), 1800);
    return () => window.clearTimeout(id);
  }, [projectileShots]);
  // LE TRACÉ — cue « ★ ARÊTE TRACÉE » quand la constellation du JOUEUR (board.a)
  // MONTE. Rend le mécanisme visible : tu vois la cause→effet (« counter de Voie
  // gagné → arête tracée »). One-shot, purgé par timer nettoyé (leak-free).
  const [traceCue, setTraceCue] = useState<TraceCue | null>(null);
  // Recap de fin de tour (phrases + micro-stats en bas du pad, Pro vs-CPU + online,
  // Alex 2026-07). Posé au settle, effacé au lock suivant + par un timer nettoyé.
  const [turnRecap, setTurnRecap] = useState<TurnRecap | null>(null);
  const recapKey = useRef(0);
  // Historique consultable des recaps (le recap ne reste que ~3 s). Borné.
  const [recapLog, setRecapLog] = useState<TurnHistoryEntry[]>([]);
  useEffect(() => {
    if (!turnRecap) return;
    const id = window.setTimeout(() => setTurnRecap(null), 2800);
    return () => window.clearTimeout(id);
  }, [turnRecap?.key]);
  const engineValA = engineGauge(board[mySide])?.value ?? 0;
  const prevEngineA = useRef(engineValA);
  useEffect(() => {
    if (engineValA > prevEngineA.current && engineValA >= 1) {
      setTraceCue({ count: engineValA, affinity: board[mySide].affinity, key: Date.now() });
    }
    prevEngineA.current = engineValA;
  }, [engineValA, board[mySide].affinity]);
  useEffect(() => {
    if (!traceCue) return;
    const idCue = window.setTimeout(() => setTraceCue(null), 1800);
    return () => window.clearTimeout(idCue);
  }, [traceCue?.key]);
  // ⚡ Cartes « à la pioche » (Cast When Drawn) — file d'événements lue à chaque
  // changement de tour, jouée une par une (hook co-localisé avec son FX).
  const castDraw = useCastOnDrawQueue(board);
  /** Opp intent preview: set after lock, cleared when the spells step fires.
   *  Drives the "Adversaire joue X / summon Y" banner + ghost previews on
   *  the opp lanes so the player SEES what they committed. */
  const [oppPreview, setOppPreview] = useState<TurnIntent | null>(null);
  /** Player intent preview: mirror of oppPreview for OUR side. Set when the
   *  resolver kicks off so the player can read what they themselves locked
   *  in. Cleared when the player starts a new turn. */
  const [playerPreview, setPlayerPreview] = useState<TurnIntent | null>(null);
  /** Current step in the sequenced resolver. Drives the phase banner. */
  const [resolveStep, setResolveStep] = useState<ResolveStep | null>(null);
  /** Active targeting (lifted from ArenaPlanPhase) — when set, tapping a
   *  lane on the BOARD itself commits the spell/summon. CCG-style
   *  direct manipulation instead of separate "Lane 1/2/3" buttons. */
  const [targeting, setTargeting] = useState<ArenaTargeting>(null);
  /** Which lane is CURRENTLY animating its combat exchange — drives the
   *  per-lane "charge → impact → retreat" animation on its creatures.
   *  Only ONE lane is "live" at a time so the player's eye lands on it. */
  const [combatLane, setCombatLane] = useState<LaneIndex | null>(null);
  // Camps qui CHARGENT sur la lane en combat (Alex 2026-06-17 anti-mush) : seul
  // l'attaquant fonce, le défenseur garde sa réaction au dégât. Trade sans
  // counter = les 2 (clash). Calculé par arenaResolverFlow.runLane.
  const [combatChargers, setCombatChargers] = useState<("a" | "b")[]>([]);
  /** Hero-hit pulse: set briefly when an undefended-lane attack lands on a
   *  hero. Drives the dramatic HP-bar flash on the hit hero strip. Keyed by
   *  side + lane so consecutive hits on the same hero re-trigger the anim. */
  const [heroHit, setHeroHit] = useState<{ side: "you" | "opp"; lane: LaneIndex; key: number } | null>(null);
  // Vibration quand MON héros prend un coup (une par impact, via la clé).
  useEffect(() => {
    if (heroHit?.side === "you") hapticHeroHit();
  }, [heroHit?.key, heroHit?.side]);
  /** Taunt block: set when an undefended-lane attack is DEFLECTED by a
   *  taunt creature elsewhere. `rockLane` identifies the Pierre that ate
   *  the deflection so the UI can pull a dotted line to it. */
  const [tauntBlock, setTauntBlock] = useState<{ defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null>(null);
  /** Anti-taunt bypass: set when an attack reaches a hero DESPITE the
   *  defender having a charged Pierre, because the attacker carries Étouffe
   *  (Feuille) or Logique (Spock) — both cancel Provocation. Pops a chip on
   *  the bypassed Pierre so the player SEES why it didn't defend (Alex's
   *  recurring "pourquoi MA Pierre ne défend pas ?"). */
  const [antiTaunt, setAntiTaunt] = useState<{ bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null>(null);
  /** Riposte d'esquive (Mirage) — pop un chip sur la lane de l'attaquant quand il
   *  frappe un Lézard qui esquive : explique « pourquoi il meurt » (Alex 2026-06-28). */
  const [riposteFX, setRiposteFX] = useState<{ attackerSide: "a" | "b"; lane: LaneIndex; key: number } | null>(null);
  /** Anim Larcin (Heist) — pop quand un côté cast heist au step reveal-opp.
   *  Carte volée traverse l'écran en arc avec sillage doré, flip à l'arrivée. */
  const [heistAnim, setHeistAnim] = useState<{ caster: "you" | "opp"; stolen?: CardId; key: number } | null>(null);
  return {
    matchSplash, setMatchSplash, resolving, setResolving, spellFX, setSpellFX, impactFX, setImpactFX, screenShake,
    projectileShots, setProjectileShots, traceCue, turnRecap, setTurnRecap, recapKey, recapLog, setRecapLog, castDraw,
    oppPreview, setOppPreview, playerPreview, setPlayerPreview, resolveStep, setResolveStep, targeting, setTargeting,
    combatLane, setCombatLane, combatChargers, setCombatChargers, heroHit, setHeroHit, tauntBlock, setTauntBlock,
    antiTaunt, setAntiTaunt, riposteFX, setRiposteFX, heistAnim, setHeistAnim,
  };
}

export type ArenaResolveFx = ReturnType<typeof useArenaResolveFx>;

export function useArenaFxAutoClear(fx: ArenaResolveFx, board: BoardState) {
  const { matchSplash, setMatchSplash, tauntBlock, setTauntBlock, antiTaunt, setAntiTaunt, riposteFX, setRiposteFX, setHeistAnim } = fx;
  useEffect(() => {
    // CRITICAL: run on EVERY matchSplash=true (not just mount) — the
    // rematch button sets matchSplash back to true, but the original
    // effect had [] deps so the timer never fired again → splash stuck.
    if (!matchSplash) return;
    hapticMatchStart();
    const id = window.setTimeout(() => setMatchSplash(false), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [matchSplash]);

  // Auto-clear the "🪨 ATTAQUE DÉTOURNÉE !" chip after it's had time to be
  // read. The resolver pops the chip but never clears it, so without this
  // it stays glued on screen forever (and survives across turns / into the
  // next planning phase). Each new pop (key change) restarts the timer,
  // so back-to-back deflects each get their full read window.
  useEffect(() => {
    if (!tauntBlock) return;
    const id = window.setTimeout(() => setTauntBlock(null), 1_600);
    return () => window.clearTimeout(id);
  }, [tauntBlock?.key]);

  // Auto-clear the anti-taunt chip after its read window (same pattern as
  // tauntBlock). Each new pop (key change) restarts the timer.
  useEffect(() => {
    if (!antiTaunt) return;
    const id = window.setTimeout(() => setAntiTaunt(null), 1_700);
    return () => window.clearTimeout(id);
  }, [antiTaunt?.key]);

  // Auto-clear le chip de riposte d'esquive (même pattern que tauntBlock/antiTaunt).
  useEffect(() => {
    if (!riposteFX) return;
    const id = window.setTimeout(() => setRiposteFX(null), 1_500);
    return () => window.clearTimeout(id);
  }, [riposteFX?.key]);

  // Trigger anim Larcin — pop quand applyHeist a écrit un side-channel
  // (lastHeistStolenA/B). On watch ces fields ; quand ils changent, on
  // déclenche l'anim avec la VRAIE carte volée (sync exact effet ↔ visuel).
  useEffect(() => {
    if (board.lastHeistStolenA) {
      setHeistAnim({ caster: "you", stolen: board.lastHeistStolenA, key: Date.now() });
      const id = window.setTimeout(() => setHeistAnim(null), 2_000);
      return () => window.clearTimeout(id);
    }
  }, [board.lastHeistStolenA]);
  useEffect(() => {
    if (board.lastHeistStolenB) {
      setHeistAnim({ caster: "opp", stolen: board.lastHeistStolenB, key: Date.now() });
      const id = window.setTimeout(() => setHeistAnim(null), 2_000);
      return () => window.clearTimeout(id);
    }
  }, [board.lastHeistStolenB]);
}
