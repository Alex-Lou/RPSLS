/**
 * ArenaGame — top-level orchestrator for Constellation Pro vs CPU.
 *
 * Owns: the BoardState (one source of truth for both heroes, lanes,
 * creatures, mana, turn number) and the PLAYER's pending TurnIntent
 * (spells they've queued, summons they've planned).
 *
 * Turn loop:
 *   planning → lock → CPU decides its intent → resolveTurn fires →
 *   advanceToNextTurn (mana up, draw cards) → planning … until a hero
 *   hits 0 HP, which flips the phase to match-end.
 *
 * The board is the single source of truth — every UI piece reads from
 * it and never mutates anything outside. All transitions go through
 * arenaRules pure functions, so the resolver is unit-testable.
 */

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import {
  hapticLock, hapticMatchStart, hapticMatchWin, hapticMatchLoss,
  hapticTap,
} from "../../haptic";
import { useStore } from "../../store/store";
import { CARDS } from "../../ranked/cards";
import { useT } from "../../i18n";
import type { CardId } from "../../ranked/rankedTypes";
import type { Move } from "../../engine/game";
import {
  FloatingMatchBackButton, useAndroidBackPrompt,
  type MatchBackHandle,
} from "../../match/sharedMatchUI";
import { ArenaBoard } from "../ArenaBoard";
import { ArenaDebugOverlay } from "../ArenaDebugOverlay";
import { DEV_TOOLS } from "../../devTools";
import { ArenaMatchEnd } from "../ArenaMatchEnd";
import { ArenaMatchSplash } from "../ArenaMatchSplash";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { ArenaImpactFX } from "../ArenaImpactFX";
import { ArenaTraceCue, type TraceCue } from "../ArenaTraceCue";
import { ArenaTurnRecap } from "../ArenaTurnRecap";
import { buildTurnRecap, type TurnRecap } from "../arenaRecap";
import { hasDominantSpell } from "../arenaFinishers";
import { engineGauge } from "../arenaEngines";
import { ArenaCastOnDrawFX, useCastOnDrawQueue } from "../ArenaCastOnDrawFX";
import { ArenaHeistAnim } from "../ArenaHeistAnim";
import { ArenaPlanPhase } from "../ArenaPlanPhase";
import { ArenaSuddenDeath } from "../ArenaSuddenDeath";
import { arenaLogReset } from "../arenaLog";
import { advanceToNextTurn, makeInitialBoard, mulliganSwap, mulliganReplaceInPlace } from "../arenaRules";
import { ArenaMulligan } from "../ArenaMulligan";
import { findFusionResult } from "../arenaFusionCards";
import { cpuArenaDecision } from "../arenaAI";
import {
  CPU_PERSONAS,
  HERO_MAX_HP,
  intentManaGrant,
  type HeroState,
  type ArenaTargeting,
  type BoardState,
  type LaneIndex,
  type Side,
  type TurnIntent,
} from "../arenaTypes";
import { setMatchExit } from "../../matchExitStore";
import { makeRngPair, randomSeed, type RngPair } from "../../engine/rng";
import type { ArenaOnlineDriver } from "../arenaOnlineDriver";
import { hashBoard } from "../arenaNet";
import { buildCpuDeckMirroring, buildPlayerDeck, resolveArenaDeckSource } from "../arenaDecks";
import { runResolverFlow, type ResolveStep } from "../arenaResolverFlow";
import type { ProjectileFX } from "../ArenaProjectileFX";
import { BoardFillSlot } from "./BoardFillSlot";
import { HeroHitFlash } from "./HeroHitFlash";
import { useArenaIntent } from "./useArenaIntent";
import { useArenaForge } from "./useArenaForge";
import { prepareResolveStart } from "./arenaResolvePrep";
import { recordWatcherMatch, watcherUuid, watcherAppVersion, watcherEnabled, createTurnRecorder, buildTurnPlays, buildCardLedger, type WatcherMatchRecord, type TurnRecorder } from "../arenaTelemetry";
import { startMatchFps, stopMatchFps } from "../../graphics/fpsSampler";
import { useMatchSurface } from "../../fx/menuFx";

/** useRef dont la valeur initiale n'est calculée QU'AU PREMIER rendu. Avec
 *  `useRef(expr)`, `expr` est réévaluée à chaque rendu puis jetée : ArenaGame
 *  se re-rend des dizaines de fois par tour (deck reconstruit, graines
 *  retirées… pour rien). */
const UNSET = Symbol("unset");
function useLazyRef<T>(init: () => T): MutableRefObject<T> {
  const r = useRef<T | typeof UNSET>(UNSET);
  if (r.current === UNSET) r.current = init();
  return r as MutableRefObject<T>;
}

// Alex feedback 2026-06-09 point #7 : décompte+GO trop rapide. Bumpé de
// 1800 → 2600ms pour laisser le "GO!" durer un peu et faire monter le
// suspense (anim splash interne dure ~1.35s + 0.45s = ~1.8s, on garde
// 800ms de plus sur "GO!" final).
const MATCH_FOUND_SPLASH_MS = 2_600;

export function ArenaGame({
  onQuit, onRematch, oppName, oppAvatar, online,
}: {
  onQuit: () => void;
  /** Called when the player taps "Rejouer" on the match-end screen.
   *  Bubbled up so ArenaPage can route back to the prep screen (fresh
   *  coin flip → fresh theme/pad for the new match). */
  onRematch?: () => void;
  /** Identité cosmétique CPU (depuis le prep) — affichée sur le strip adverse
   *  en match : nom réel + portrait hero_*.png, plus de « CPU » + 🤖. */
  oppName?: string;
  oppAvatar?: string;
  /** Pro ONLINE (absent = vs-CPU local). Fournit le camp assigné, la graine
   *  partagée, le deck/Voie réels de l'adversaire, et l'échange lockstep des
   *  intents/mulligan + la déclaration d'issue. Cf. arenaOnlineDriver. */
  online?: ArenaOnlineDriver;
}) {
  useMatchSurface();
  const player = useStore((s) => s.player);
  const difficulty = player.difficulty ?? "normal";
  const recordArenaMatch = useStore((s) => s.recordArenaMatch);

  // Player deck — filter out cards we haven't adapted to Arena yet so the
  // hand never contains a no-op card. Falls back to a curated default if
  // the saved deck has too few supported cards. Saved deck is `string[]` in
  // the store; we re-narrow to CardId by filtering against the registry.
  const playerDeck = useLazyRef<CardId[]>(() => buildPlayerDeck(
    // Source résolue PAR VOIE (Alex 2026-06-22) : deck CUSTOM édité de la Voie >
    // deck SIGNATURE curé > deck arène libre (fallback rankedDeck, migration douce).
    resolveArenaDeckSource(
      player.arenaAffinity, player.arenaDeckByVoie, player.arenaDeck ?? player.rankedDeck,
    ).filter(
      (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
    ),
    player.arenaAffinity, // orienté Voie (Phase B) : priorise tes signatures, exclut les autres Voies
  ));
  // Constellation Pro v2 Couche 1 — Affinité du joueur passée au moteur.
  // Le CPU prend une Affinité ALÉATOIRE à chaque match (Constellation 3⭐
  // s'allume aussi côté opp) — pas d'adaptive selon le joueur pour garder une
  // part d'imprévisibilité, MAIS jamais la même Voie que le joueur (Alex
  // 2026-06-16 anti-miroir : éviter le plateau « dupliqué » 3 pierres vs
  // 3 pierres). Re-tiré à chaque remount (rematch via ArenaPage) ; le
  // soft-reset local réutilise la valeur, déjà ≠ joueur.
  const playerAffinity = useRef(player.arenaAffinity);
  const cpuAffinity = useLazyRef<Move>(
    () => {
      const pool = (["rock", "paper", "scissors", "lizard", "spock"] as const).filter(
        (m) => m !== player.arenaAffinity,
      );
      return pool[Math.floor(Math.random() * pool.length)];
    },
  );
  // Persona CPU random au match start (Alex 2026-06-11). Reste constante tout
  // le match pour que le feeling de l'opp soit cohérent.
  const cpuPersona = useLazyRef(() => CPU_PERSONAS[Math.floor(Math.random() * CPU_PERSONAS.length)]);
  // Phase 0 lockstep (Pro online, 2026-07) — paire de PRNG seedés, UN PAR CAMP
  // (a=joueur, b=CPU), consommée par TOUTE la résolution (init deck, sorts à
  // hasard, pioches). vs-CPU : graine aléatoire par match → même feeling
  // qu'avant, mais partie REPRODUCTIBLE (replay/debug). Online : la graine
  // viendra du shared_seed serveur → les 2 clients rejouent la même partie.
  // Re-tirée au soft-reset rematch (chaque match = sa graine).
  // Online : graine PARTAGÉE du serveur (les 2 clients rejouent la même partie).
  // Local : graine aléatoire par match (feeling inchangé, partie reproductible).
  const rngPair = useLazyRef<RngPair>(() => online?.rngPair ?? makeRngPair(randomSeed()));

  // Wipe the log buffer at match start so each match has a clean diagnostic
  // history (Alex flag : "tu pers tout finalement"). Called once at mount.
  const logResetRef = useRef(false);
  if (!logResetRef.current) {
    arenaLogReset();
    logResetRef.current = true;
  }

  const t = useT();
  // Nom "vulgarisé" d'une carte pour les logs (Alex 2026-06-12 : "détails
  // vulgarisés pour dire pourquoi xxx ne peut pas faire yyy"). Retombe sur
  // l'id si la clé i18n manque.
  const cardFr = (id: CardId) => t(CARDS[id]?.nameKey ?? "") || id;

  // Camp CANONIQUE du joueur local. Local vs-CPU : "a" (l'adversaire CPU = "b").
  // Online : `online.mySide` (le serveur assigne A/B). Le board reste CANONIQUE
  // (a=A, b=B) — `mySide` ne pilote QUE la PERSPECTIVE (rendu/intent/télémétrie/
  // victoire), jamais l'état résolu : les deux clients calculent le MÊME board
  // (le résolveur départage a-avant-b).
  const mySide: Side = online?.mySide ?? "a";
  const oppSide: Side = mySide === "a" ? "b" : "a";

  const [board, setBoard] = useState<BoardState>(() => {
    // Deck/Voie de l'ADVERSAIRE : online = les VRAIS (échangés au handshake) ;
    // local = deck CPU miroir + Voie aléatoire. On place MON deck sur mySide et
    // celui de l'adversaire sur oppSide → board CANONIQUE identique des 2 côtés.
    const myDeck = playerDeck.current;
    const myAff = playerAffinity.current;
    const oppDeckResolved = online?.oppDeck ?? buildCpuDeckMirroring(myDeck, cpuAffinity.current);
    const oppAff = online?.oppAffinity ?? cpuAffinity.current;
    const deckA = mySide === "a" ? myDeck : oppDeckResolved;
    const deckB = mySide === "a" ? oppDeckResolved : myDeck;
    const affA = mySide === "a" ? myAff : oppAff;
    const affB = mySide === "a" ? oppAff : myAff;
    // Persona = tempérament de l'IA (cosmétique) — inutile en online (adversaire humain).
    const personaB = online ? undefined : cpuPersona.current;
    return makeInitialBoard(deckA, deckB, affA, affB, personaB, rngPair.current);
  });

  // ── MULLIGAN T1 (Alex 2026-06-13 économie expert) ──
  // Une fois par match : remplace jusqu'à 2 cartes de la main de départ.
  // Le CPU mulligan EN MÊME TEMPS (heuristique : il rend ses cartes chères
  // surnuméraires) pour l'équité. "Garder tout" laisse aussi le CPU décider.
  // Online v1 : PAS de mulligan (le mulligan par-tap ne se relaie pas à
  // l'identique ; les mains de départ sont déjà déterministes et identiques des
  // deux côtés). À câbler en relayé plus tard. Local : mulligan T1 normal.
  const [mulliganOpen, setMulliganOpen] = useState(!online);
  // Échanges restants (départ 2). Modèle IMMÉDIAT : chaque rejet remplace EN
  // PLACE (cf. ArenaMulligan) → plus de sélection multi-index.
  const [mulliganSwapsLeft, setMulliganSwapsLeft] = useState(2);
  function cpuMulliganIndices(h: HeroState): number[] {
    // Garde 1 carte chère max en ouverture ; rend les suivantes (≤2).
    const idx: number[] = [];
    let expensive = 0;
    h.hand.forEach((c, i) => {
      if ((CARDS[c]?.cost ?? 0) >= 3) {
        expensive += 1;
        if (expensive > 1 && idx.length < 2) idx.push(i);
      }
    });
    return idx;
  }

  // ── INTENT (sorts/invocations planifiés) — état + builders extraits dans
  // useArenaIntent (sémantiquement identique à un useState inline). ──
  const { intent, setIntent, addSpell, removeSpell, addSummon, removeSummon, intentCost } =
    useArenaIntent(board, mySide, cardFr);

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

  // ── FORGE (dépôt/fusion/récup) — état + handlers extraits dans useArenaForge.
  // Lit l'intent (anti double-dépense) + le targeting (carte armée). N'est PAS
  // dans le chemin de timing de la résolution de combat. ──
  const { forgeFlash, forgeRecover, handleForgeTap, handleForgeDeposit } = useArenaForge({
    board, setBoard, setIntent, targeting, setTargeting, resolving, cardFr,
  });
  // Online v1 : FORGE désactivée — le dépôt est une mutation de board HORS intent
  // (setBoard direct) → elle ne passe pas par le lockstep et desyncrait les deux
  // clients. À relayer plus tard. Local : handlers normaux.
  const forgeTap = online ? () => {} : handleForgeTap;
  const forgeDeposit = online ? (_id: CardId) => {} : handleForgeDeposit;

  // Rejet IMMÉDIAT d'une carte → remplacée EN PLACE (le joueur voit la nouvelle
  // arriver). Décrémente les échanges restants.
  function handleMulliganReject(i: number) {
    if (mulliganSwapsLeft <= 0) return;
    setBoard((cur) => ({ ...cur, [mySide]: mulliganReplaceInPlace(cur[mySide], i, rngPair.current[mySide]) }));
    setMulliganSwapsLeft((n) => Math.max(0, n - 1));
    hapticTap();
  }
  // Fermeture (« C'est parti ! ») : le CPU mulligan UNE fois, puis on ferme.
  // Double tap sur « C'est parti ! » pendant l'animation de sortie de la
  // modale (encore cliquable) : le CPU mulliganait DEUX fois.
  const mulliganDoneRef = useRef(false);
  function handleMulliganClose() {
    if (mulliganDoneRef.current) return;
    mulliganDoneRef.current = true;
    setBoard((cur) => ({ ...cur, [oppSide]: mulliganSwap(cur[oppSide], cpuMulliganIndices(cur[oppSide]), rngPair.current[oppSide]) }));
    setMulliganOpen(false);
  }

  /** Imperative handle on the floating back button — lets the Android
   *  back-gesture trigger the SAME confirmation modal instead of just
   *  silently exiting the match. */
  const backRef = useRef<MatchBackHandle | null>(null);
  // Register le forfeit dans le matchExitStore (Alex 2026-06-11) — le drawer
  // burger l'affiche en TOP au lieu d'avoir 2 boutons HUD séparés. triggerConfirm
  // pop le même modal qu'avant.
  useEffect(() => {
    setMatchExit({
      label: "Quitter Arena",
      onExit: () => backRef.current?.triggerConfirm(),
    });
    return () => { setMatchExit(null); };
  }, []);

  // Match-end guard — also gates handleForfeit so we never double-record.
  // Declared BEFORE handleForfeit so the closure binds the real ref.
  const matchEndedRef = useRef(false);

  // Télémétrie Watcher : trajectoire des PV par tour (capturée à chaque tour) +
  // raison de fin (par défaut KO ; mise à « suddendeath » par la mort subite).
  const trajRef = useRef<{ self: number[]; opp: number[] }>({ self: [], opp: [] });
  const endReasonRef = useRef<WatcherMatchRecord["endReason"]>("ko");
  // Enregistreur de déroulé v:2 (Tier A+B) — observationnel, inerte si le Watcher
  // n'est pas configuré. begin() au lock, lane() en combat, end() au settle.
  const turnRecRef = useRef<TurnRecorder | null>(null);
  if (!turnRecRef.current) turnRecRef.current = createTurnRecorder(watcherEnabled());
  const turnRec = turnRecRef.current;

  // Profil FPS de la partie (rAF continu, zéro overhead) — démarré à l'entrée de
  // l'écran de combat, arrêté + joint au MatchRecord à l'enregistrement (fin de
  // partie). Observationnel, fail-soft. Ne mesure que si le Watcher est configuré.
  useEffect(() => {
    if (watcherEnabled()) startMatchFps();
    return () => { stopMatchFps(); };
  }, []);

  // Handle d'annulation du résolveur en cours (Audit anim Build A — fuite mémoire).
  // runResolverFlow programme ~9s de setTimeout ; on garde son cancel() pour
  // couper la chaîne au forfait / rematch / unmount, sinon elle continue sur un
  // composant démonté et peut relancer une partie quittée.
  const resolverCancelRef = useRef<null | (() => void)>(null);
  useEffect(() => () => { resolverCancelRef.current?.(); }, []);

  /** Forfeit handler: records a LOSS on arenaStats + bounces back out.
   *  Set `matchEndedRef` so the existing match-end useEffect doesn't
   *  also try to record an outcome (would double-count). */
  function handleForfeit() {
    resolverCancelRef.current?.(); // coupe net la résolution en vol (anti-fuite)
    if (matchEndedRef.current) { onQuit(); return; }
    matchEndedRef.current = true;
    hapticMatchLoss();
    recordArenaMatch("loss", { playerVoie: board[mySide].affinity, oppVoie: board[oppSide].affinity, forfeit: true, online: !!online });
    onQuit();
  }

  /** Android system back: route through the SAME confirm modal so the
   *  player can't accidentally throw the match by swiping. During the
   *  match-end screen (board.phase === "match-end") we never reach this
   *  return path — the Match-End component owns its own back button. */
  useAndroidBackPrompt(() => {
    if (board.phase === "match-end" || matchSplash) { onQuit(); return; }
    backRef.current?.triggerConfirm();
  });

  /** Route a board-lane tap to the active targeting intent. Called by
   *  ArenaBoard when a lane slot is clicked while targeting is non-null.
   *  `side` is the row that was tapped — the board only forwards taps
   *  from rows where the spell's per-side validity is true, so we can
   *  trust it without re-validating here. */
  function handleBoardLaneTap(lane: LaneIndex, _side: "a" | "b") {
    if (!targeting) return;
    if (targeting.kind === "summon") {
      hapticTap();
      setIntent((cur) => ({
        ...cur,
        summons: [...cur.summons.filter((s) => s.lane !== lane), { lane, move: targeting.move }],
      }));
      setTargeting(null);
      return;
    }
    if (targeting.kind === "spell" && targeting.targetKind === "lane") {
      // Route through addSpell so the board lane-tap gets the SAME guards as
      // the hand flow: MAX_SPELLS cap, 1-card=1-cast (usageCount vs handCount),
      // aegis/anchor mutual exclusion, and the aegis 1×/match lock. Tapping a
      // lane used to setIntent directly, bypassing ALL of them — that's why the
      // same card (Aegis, Anchor) could be assigned twice (Alex). addSpell does
      // its own hapticTap and silently no-ops a rejected cast (card stays).
      addSpell({ id: targeting.id, kind: "lane", lane });
      setTargeting(null);
      return;
    }
  }

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

  // Télémétrie Watcher : capture les PV des 2 héros une fois par tour (au
  // changement de board.turn = après la résolution du tour précédent). Volontaire
  // que la dép soit [board.turn] seul (1 point/tour, pas à chaque frame de combat).
  useEffect(() => {
    if (board.phase === "match-end" || board.phase === "sudden-death") return;
    trajRef.current.self.push(Math.max(0, board[mySide].hp));
    trajRef.current.opp.push(Math.max(0, board[oppSide].hp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.turn]);

  // Match-end haptic + stat record. Fired once when the phase flips.
  // recordArenaMatch lives in the store and is sync'd to the cloud via the
  // existing playerSync subscriber (fingerprint covers arenaStats now).
  // matchEndedRef is declared above (alongside handleForfeit) so a forfeit
  // can flip the same guard.
  useEffect(() => {
    if (board.phase !== "match-end") return;
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    // Perspective du joueur LOCAL (camp mySide). En vs-CPU, mySide="a" → me=a,
    // opp=b (inchangé) ; en online camp B, me=b → victoire/défaite correctes.
    const me = board[mySide];
    const opp = board[oppSide];
    const meDead = me.hp <= 0;
    const oppDead = opp.hp <= 0;
    const outcome: "win" | "loss" | "draw" =
      meDead && oppDead ? "draw" : oppDead ? "win" : "loss";
    if (outcome === "win") hapticMatchWin();
    else if (outcome === "loss") hapticMatchLoss();
    // Online : déclare l'issue AU SERVEUR + le hash du board final (anti-triche
    // Phase 4) — le serveur compare les DEUX déclarations (vainqueur + hash) ;
    // désaccord = drop, aucun crédit. En lockstep honnête, les deux coïncident.
    online?.reportResult(outcome, hashBoard(board));
    // VOIE jouée (joueur + adversaire) journalisée dans l'historique (Alex
    // 2026-06-13). me/opp.affinity = la Voie choisie par chaque camp.
    recordArenaMatch(outcome, { playerVoie: me.affinity, oppVoie: opp.affinity, online: !!online });
    // Télémétrie Watcher (Arena Pro vs CPU) — fail-soft, inerte si non configuré.
    if (me.affinity) {
      // Filet : fige le dernier tour si le settle ne l'a pas déjà fait (no-op
      // sinon — pending est purgé après chaque end). Puis lit le déroulé v:2.
      try {
        turnRec.end({
          hpSelf: Math.max(0, me.hp),
          hpOpp: Math.max(0, opp.hp),
          engine: engineGauge(me)?.value ?? 0,
          engineOpp: engineGauge(opp)?.value ?? 0,
          finisherUnlocked: !!me.finisherUnlocked,
        });
      } catch { /* télémétrie fail-soft */ }
      const turnLog = turnRec.log();
      recordWatcherMatch({
        v: turnLog.length ? 2 : 1,
        id: watcherUuid(),
        ts: Date.now(),
        mode: "pro",
        playerVoie: me.affinity,
        oppVoie: opp.affinity ?? null,
        oppKind: "cpu",
        result: outcome,
        turns: board.turn,
        finalHpSelf: Math.max(0, me.hp),
        finalHpOpp: Math.max(0, opp.hp),
        finisherFired: !!me.finisherUnlocked,
        oppFinisherFired: !!opp.finisherUnlocked,
        hpTrajectorySelf: [...trajRef.current.self, Math.max(0, me.hp)],
        hpTrajectoryOpp: [...trajRef.current.opp, Math.max(0, opp.hp)],
        endReason: endReasonRef.current,
        appVersion: watcherAppVersion,
        turnLog: turnLog.length ? turnLog : undefined,
        fps: stopMatchFps() ?? undefined, // profil FPS de la partie (rAF) — null si trop court
      });
    }
  }, [board.phase, board[mySide].hp, board[oppSide].hp, recordArenaMatch]);

  /* ──────────── Lock & resolve ──────────── */

  function handleLockTurn() {
    if (resolving) return;
    if (board.phase !== "planning") return;
    setTurnRecap(null); // le recap du tour précédent disparaît dès qu'on relance
    // Tu peux TOUJOURS finir ton tour (Alex 2026-06-17 « grave erreur » : le Lock
    // se bloquait SILENCIEUSEMENT quand l'intent devenait inabordable — ex. après
    // retrait d'une carte qui DONNAIT du mana, Sablier/Offre). On ne bloque plus :
    // si l'intent dépasse le budget, on retire les DERNIÈRES cartes en trop
    // jusqu'à ce que ce soit payable → jamais de bouton mort, et zéro overspend
    // (le moteur débite le mana sans clamp, cf. resolver.ts).
    let safe = intent;
    while (
      intentCost(safe) > board[mySide].mana + intentManaGrant(safe) &&
      (safe.spells.length > 0 || safe.summons.length > 0)
    ) {
      safe = safe.spells.length > 0
        ? { ...safe, spells: safe.spells.slice(0, -1) }
        : { ...safe, summons: safe.summons.slice(0, -1) };
    }
    hapticLock();
    setResolving(true);

    // Intent de l'ADVERSAIRE. Local vs-CPU : l'IA joue oppSide (SYNC). Online :
    // on envoie MON intent et on attend celui de l'adversaire (lockstep, ASYNC),
    // puis on résout des DEUX côtés à l'identique. `board.turn` = round partagé
    // déterministe → les deux clients s'apparient sur le même tour.
    if (online) {
      online
        // hashBoard(board) = empreinte de l'état AVANT ce tour (anti-triche
        // Phase 4) : le serveur compare les hashes des deux clients pour ce tour.
        .exchangeIntent(board.turn, safe, hashBoard(board))
        .then((oppIntent) => {
          if (matchEndedRef.current) return; // match clos pendant l'attente → on jette
          resolveWith(safe, oppIntent);
        })
        .catch(() => { /* déconnexion/fin : gérée par les callbacks de session */ });
    } else {
      resolveWith(safe, cpuArenaDecision(board, oppSide, difficulty));
    }
  }

  /** Résout un tour depuis MON intent + celui de l'ADVERSAIRE (déjà connus).
   *  Jonction UNIQUE vs-CPU / online : seul le PRODUCTEUR de l'intent adverse
   *  diffère (IA locale sync OU réseau async) ; résolution + anims identiques.
   *  prepareResolveStart(...,mySide) remet les intents en ordre CANONIQUE → les
   *  deux clients calculent le même board. */
  function resolveWith(myIntent: TurnIntent, oppIntent: TurnIntent) {
    // Pré-calcul PUR (troncature/dépense/exil/startBoard) — cf. arenaResolvePrep.
    const { startBoard, safeIntent, safeCpuIntent, spentA, spentB } = prepareResolveStart(board, myIntent, oppIntent, mySide);

    // Télémétrie Watcher (Tier A) — démarre le tour avec l'état AVANT résolution +
    // les coups réellement engagés (safeIntent/safeCpuIntent post-trim) + le ledger
    // des vraies cartes dépensées (id/nom/fusion). Fail-soft, observationnel.
    try {
      turnRec.begin({
        turn: board.turn,
        manaMax: board[mySide].maxMana,
        manaSpent: Math.min(board[mySide].maxMana, Math.max(0, intentCost(myIntent) - intentManaGrant(myIntent))),
        handStart: board[mySide].hand.length,
        deckLeft: board[mySide].deck.length,
        plays: buildTurnPlays(safeIntent, board[mySide].affinity),
        playsOpp: buildTurnPlays(safeCpuIntent, board[oppSide].affinity),
        cards: buildCardLedger(spentA, cardFr),
        cardsOpp: buildCardLedger(spentB, cardFr),
        hpSelf: Math.max(0, board[mySide].hp),
        hpOpp: Math.max(0, board[oppSide].hp),
        engine: engineGauge(board[mySide])?.value ?? 0,
        engineOpp: engineGauge(board[oppSide])?.value ?? 0,
      });
    } catch { /* télémétrie fail-soft */ }

    resolverCancelRef.current = runResolverFlow({
      // Réglage « combat rapide » (Profil) : pauses de lecture raccourcies.
      holdScale: useStore.getState().player.fastCombat ? 0.5 : 1,
      startBoard,
      playerIntent: safeIntent,
      cpuIntent: safeCpuIntent,
      rng: rngPair.current,
      mySide,
      noSuddenDeath: !!online, // online : mort subite non déterministe → NUL propre
      setBoard,
      setOppPreview,
      setPlayerPreview,
      setResolveStep,
      setCombatLane,
      setCombatChargers,
      setHeroHit,
      setTauntBlock,
      setAntiTaunt,
      setRiposteFX,
      setSpellFX,
      setImpactFX,
      setProjectileFX: setProjectileShots,
      onSettle: (finalBoard) => {
        setIntent({ spells: [], summons: [] });
        // Télémétrie Watcher — fige le tour avec l'état APRÈS combat (post-cleanup,
        // avant l'avance). Couvre aussi le tour fatal (onSettle court au settle même
        // en match-end). Fail-soft, observationnel.
        try {
          turnRec.end({
            hpSelf: Math.max(0, finalBoard[mySide].hp),
            hpOpp: Math.max(0, finalBoard[oppSide].hp),
            engine: engineGauge(finalBoard[mySide])?.value ?? 0,
            engineOpp: engineGauge(finalBoard[oppSide])?.value ?? 0,
            finisherUnlocked: !!finalBoard[mySide].finisherUnlocked,
          });
        } catch { /* télémétrie fail-soft */ }
        // Recap de fin de tour (phrases + micro-stats) — delta board AVANT (`board`,
        // pré-résolution) → APRÈS (finalBoard), du point de vue local. null au coup
        // fatal (l'écran de fin prend le relais). Affiché en bas du pad.
        setTurnRecap(buildTurnRecap(board, finalBoard, mySide, ++recapKey.current));
      },
      onAdvanceTurn: () => {
        setResolving(false);
        setBoard((cur) => advanceToNextTurn(cur, rngPair.current));
      },
      // Vibration de fin : UNE seule, dans l'effet de fin de match (perspective
      // mySide). Ici elle doublait la vibration.
      onMatchEnd: () => {
        setResolving(false);
      },
      onLaneResolved: (o) => turnRec.lane(o),
    });
  }

  /* ──────────── Render ──────────── */

  if (matchSplash) {
    return <ArenaMatchSplash playerName={player.nickname || "Toi"} playerAvatar={player.avatar} cpuName={oppName} cpuAvatar={oppAvatar} />;
  }

  // Sortie du match (burger / retour Android) : montée AUSSI en mort subite,
  // sinon backRef restait null et « Quitter » ne faisait rien.
  const backButton = (
    <FloatingMatchBackButton
      ref={backRef}
      onClick={handleForfeit}
      label={t("match.quit")}
      hidden
      confirm={{
        title: t("match.quitConfirm"),
        body: t("arena.quit.body"),
        confirmLabel: t("arena.quit.confirm"),
        cancelLabel: t("arena.quit.cancel"),
        severity: "danger",
      }}
    />
  );

  if (board.phase === "sudden-death") {
    // Round 10 VRAI BUT D'OR — Mort subite RPSLS. Le component gère le picker
    // + reveal + counter check. Quand résolu, assigne 1 HP au winner et flip
    // la phase à match-end pour que ArenaMatchEnd affiche le résultat propre.
    return (
      <>
      {backButton}
      <ArenaSuddenDeath
        onResolved={(winner) => {
          endReasonRef.current = "suddendeath"; // télémétrie : fin par mort subite
          const nextBoard: BoardState = winner === "a"
            ? { ...board, a: { ...board.a, hp: 1 }, b: { ...board.b, hp: 0 }, phase: "match-end" }
            : { ...board, a: { ...board.a, hp: 0 }, b: { ...board.b, hp: 1 }, phase: "match-end" };
          setBoard(nextBoard); // vibration de fin : effet de fin de match (une seule)
        }}
      />
      </>
    );
  }

  if (board.phase === "match-end") {
    return (
      <ArenaMatchEnd
        board={board}
        mySide={mySide}
        onQuit={onQuit}
        // En ligne : pas de « Rejouer » (session close → le soft-reset local
        // lançait un faux match qui se bloquait au 1er tour).
        onRematch={online ? undefined : () => {
          resolverCancelRef.current?.(); // coupe toute chaîne résiduelle (anti double-pilotage)
          // Bubble up to ArenaPage so a FRESH coin flip + new theme + new
          // CPU persona is picked for the rematch (Alex: "rematch doit refaire
          // le coin pour éventuellement changer de thème"). If no parent
          // handler, fall back to a local soft-reset.
          if (onRematch) { onRematch(); return; }
          matchEndedRef.current = false;
          mulliganDoneRef.current = false;
          setMulliganOpen(true);
          setMulliganSwapsLeft(2);
          rngPair.current = makeRngPair(randomSeed()); // graine FRAÎCHE par match (comme le shared_seed online)
          setBoard(makeInitialBoard(playerDeck.current, buildCpuDeckMirroring(playerDeck.current, cpuAffinity.current), playerAffinity.current, cpuAffinity.current, cpuPersona.current, rngPair.current));
          setIntent({ spells: [], summons: [] });
          setOppPreview(null);
          setPlayerPreview(null);
          setResolveStep(null);
          setResolving(false);
          setCombatLane(null);
          setHeroHit(null);
          setTargeting(null);
          setMatchSplash(true);
        }}
      />
    );
  }

  return (
    <motion.div animate={screenShake} className="relative flex-1 flex flex-col min-h-0 gap-1 landscape:gap-0">
      {/* 💥 IMPACT FX plein-écran (coup puissant/fatal) — entaille Ciseaux,
       *  ébranlement Pierre… + tremblement de cette racine (Alex 2026-06-13). */}
      <ArenaImpactFX fx={impactFX} />
      <ArenaTraceCue cue={traceCue} />
      {/* Recap de fin de tour (phrases + micro-stats) — bas du pad, Pro vs-CPU + online. */}
      <ArenaTurnRecap recap={turnRecap} />
      {/* ⚡ Cartes « à la pioche » (Cast When Drawn) — éclair + carte + effet,
       *  jouées une par une (Alex 2026-06-13). One-shot, démonte via onDone. */}
      <AnimatePresence>
        {castDraw.head && (
          <ArenaCastOnDrawFX key={castDraw.head.key} event={castDraw.head} onDone={castDraw.shift} />
        )}
      </AnimatePresence>
      {/* Floating back / forfeit — same component every other match surface
       *  uses (Classic, Ranked, Lanes). The confirm modal pops first; on
       *  confirm we record a LOSS on arenaStats and bounce out. Hidden on
       *  match-end (the end screen owns its own back button). */}
      {/* Hidden mode : le bouton standalone n'est PLUS rendu, mais le composant
       *  garde son imperative handle (triggerConfirm) et le confirm modal. Le
       *  drawer burger expose la sortie via matchExitStore (Alex 2026-06-11
       *  "DANS le burger, pas 2 boutons HUD"). */}
      {backButton}
      {/* Round 16 : DEUX exigences Alex — (1) moves/deck PAS rétrécis → la plan
       *  phase est DEHORS du slot mesuré (jamais scalée). (2) CADRE du pad plus
       *  haut, cartes INCHANGÉES, espace au centre → BoardFillSlot mesure la
       *  hauteur dispo et la pose en px sur le board ; le pad `flex-1` la
       *  remplit (fiable car parent à hauteur EXPLICITE, pas flex profond),
       *  lanes écartées haut/bas (`justify-between`), centre vide (chip queues). */}
      <BoardFillSlot>
        {(slotH) => (
          <ArenaBoard
            fillHeight={slotH}
            board={board}
            playerSide={mySide}
            intent={intent}
            oppPreview={oppPreview}
            playerPreview={playerPreview}
            resolveStep={resolveStep}
            combatLane={combatLane}
            combatChargers={combatChargers}
            heroHit={heroHit}
            tauntBlock={tauntBlock}
            antiTaunt={antiTaunt}
            riposteFX={riposteFX}
            spellFX={spellFX}
            projectileShots={projectileShots}
            oppName={oppName}
            oppAvatar={oppAvatar}
            targeting={targeting}
            onLaneTap={handleBoardLaneTap}
            onRemoveSpell={removeSpell}
            onRemoveSummon={removeSummon}
            forgeYou={board.forgeA ?? null}
            forgeOpp={board.forgeB ?? null}
            onForgeTap={forgeTap}
            forgeFlashKey={forgeFlash}
            forgeRecoverKey={forgeRecover}
            forgeHighlight={
              targeting?.kind === "spell"
                ? board.forgeA
                  ? (findFusionResult(targeting.id, board.forgeA) ? "fuse" : null)
                  : "deposit"
                : null
            }
          />
        )}
      </BoardFillSlot>
      <ArenaPlanPhase
        board={board}
        intent={intent}
        intentCost={intentCost(intent)}
        disabled={resolving}
        targeting={targeting}
        onSetTargeting={setTargeting}
        onAddSpell={addSpell}
        onRemoveSpell={removeSpell}
        onAddSummon={addSummon}
        onRemoveSummon={removeSummon}
        onLock={handleLockTurn}
        onForgeTap={forgeTap}
        onForgeDeposit={forgeDeposit}
        incomingAttackKey={heroHit?.side === "you" ? heroHit.key : null}
        playerName={player.nickname || "Toi"}
        playerAvatar={player.avatar}
      />
      {/* ── MULLIGAN T1 — modale extraite (ArenaMulligan) : empilage des
       *  doublons + remplacement IMMÉDIAT en place (Alex 2026-06-13). ── */}
      <AnimatePresence>
        {mulliganOpen && board.turn === 1 && board[mySide].hand.length > 0 && !resolving && (
          <ArenaMulligan
            hand={board[mySide].hand}
            swapsLeft={mulliganSwapsLeft}
            onRejectOne={handleMulliganReject}
            onClose={handleMulliganClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {heistAnim && (
          <ArenaHeistAnim
            key={heistAnim.key}
            caster={heistAnim.caster}
            stolen={heistAnim.stolen}
            animKey={heistAnim.key}
          />
        )}
      </AnimatePresence>
      {/* FLASH ÉCRAN dégâts héros (Alex 2026-06-11) — vignette extraite (HeroHitFlash). */}
      <HeroHitFlash heroHit={heroHit} />
      {/* Debug log overlay — floating 🐛 button + bottom-sheet panel
       *  that shows live arena events. Replaces adb logcat (which
       *  dropped lines under load) with an in-app live feed. Dev / debug
       *  device builds only. */}
      {DEV_TOOLS && <ArenaDebugOverlay />}
    </motion.div>
  );
}

// Deck construction + spent-card cleanup live in arenaDecks.ts now.

// Re-export HERO_MAX_HP for callers that need the win-condition constant.
export { HERO_MAX_HP };
