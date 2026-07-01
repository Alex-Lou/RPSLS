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

import { useEffect, useRef, useState } from "react";
import {
  hapticLock, hapticMatchStart, hapticMatchWin, hapticMatchLoss,
  hapticTap, hapticWin, hapticLoss,
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
import { ArenaMatchEnd } from "../ArenaMatchEnd";
import { ArenaMatchSplash } from "../ArenaMatchSplash";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { ArenaImpactFX } from "../ArenaImpactFX";
import { ArenaTraceCue, type TraceCue } from "../ArenaTraceCue";
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
  type TurnIntent,
} from "../arenaTypes";
import { setMatchExit } from "../../matchExitStore";
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

// Alex feedback 2026-06-09 point #7 : décompte+GO trop rapide. Bumpé de
// 1800 → 2600ms pour laisser le "GO!" durer un peu et faire monter le
// suspense (anim splash interne dure ~1.35s + 0.45s = ~1.8s, on garde
// 800ms de plus sur "GO!" final).
const MATCH_FOUND_SPLASH_MS = 2_600;

export function ArenaGame({
  onQuit, onRematch, oppName, oppAvatar,
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
}) {
  const player = useStore((s) => s.player);
  const difficulty = player.difficulty ?? "normal";
  const recordArenaMatch = useStore((s) => s.recordArenaMatch);

  // Player deck — filter out cards we haven't adapted to Arena yet so the
  // hand never contains a no-op card. Falls back to a curated default if
  // the saved deck has too few supported cards. Saved deck is `string[]` in
  // the store; we re-narrow to CardId by filtering against the registry.
  const playerDeck = useRef<CardId[]>(buildPlayerDeck(
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
  const cpuAffinity = useRef<Move>(
    (() => {
      const pool = (["rock", "paper", "scissors", "lizard", "spock"] as const).filter(
        (m) => m !== player.arenaAffinity,
      );
      return pool[Math.floor(Math.random() * pool.length)];
    })(),
  );
  // Persona CPU random au match start (Alex 2026-06-11). Reste constante tout
  // le match pour que le feeling de l'opp soit cohérent.
  const cpuPersona = useRef(CPU_PERSONAS[Math.floor(Math.random() * CPU_PERSONAS.length)]);

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

  const [board, setBoard] = useState<BoardState>(() =>
    makeInitialBoard(playerDeck.current, buildCpuDeckMirroring(playerDeck.current, cpuAffinity.current), playerAffinity.current, cpuAffinity.current, cpuPersona.current),
  );

  // ── MULLIGAN T1 (Alex 2026-06-13 économie expert) ──
  // Une fois par match : remplace jusqu'à 2 cartes de la main de départ.
  // Le CPU mulligan EN MÊME TEMPS (heuristique : il rend ses cartes chères
  // surnuméraires) pour l'équité. "Garder tout" laisse aussi le CPU décider.
  const [mulliganOpen, setMulliganOpen] = useState(true);
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
    useArenaIntent(board, cardFr);

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
  const engineValA = engineGauge(board.a)?.value ?? 0;
  const prevEngineA = useRef(engineValA);
  useEffect(() => {
    if (engineValA > prevEngineA.current && engineValA >= 1) {
      setTraceCue({ count: engineValA, affinity: board.a.affinity, key: Date.now() });
    }
    prevEngineA.current = engineValA;
  }, [engineValA, board.a.affinity]);
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

  // Rejet IMMÉDIAT d'une carte → remplacée EN PLACE (le joueur voit la nouvelle
  // arriver). Décrémente les échanges restants.
  function handleMulliganReject(i: number) {
    if (mulliganSwapsLeft <= 0) return;
    setBoard((cur) => ({ ...cur, a: mulliganReplaceInPlace(cur.a, i) }));
    setMulliganSwapsLeft((n) => Math.max(0, n - 1));
    hapticTap();
  }
  // Fermeture (« C'est parti ! ») : le CPU mulligan UNE fois, puis on ferme.
  function handleMulliganClose() {
    setBoard((cur) => ({ ...cur, b: mulliganSwap(cur.b, cpuMulliganIndices(cur.b)) }));
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
    recordArenaMatch("loss", { playerVoie: board.a.affinity, oppVoie: board.b.affinity, forfeit: true });
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
    trajRef.current.self.push(Math.max(0, board.a.hp));
    trajRef.current.opp.push(Math.max(0, board.b.hp));
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
    const aDead = board.a.hp <= 0;
    const bDead = board.b.hp <= 0;
    const outcome: "win" | "loss" | "draw" =
      aDead && bDead ? "draw" : bDead ? "win" : "loss";
    if (outcome === "win") hapticMatchWin();
    else if (outcome === "loss") hapticMatchLoss();
    // VOIE jouée (joueur + adversaire) journalisée dans l'historique (Alex
    // 2026-06-13). board.a/b.affinity = la Voie choisie par chaque camp.
    recordArenaMatch(outcome, { playerVoie: board.a.affinity, oppVoie: board.b.affinity });
    // Télémétrie Watcher (Arena Pro vs CPU) — fail-soft, inerte si non configuré.
    if (board.a.affinity) {
      // Filet : fige le dernier tour si le settle ne l'a pas déjà fait (no-op
      // sinon — pending est purgé après chaque end). Puis lit le déroulé v:2.
      try {
        turnRec.end({
          hpSelf: Math.max(0, board.a.hp),
          hpOpp: Math.max(0, board.b.hp),
          engine: engineGauge(board.a)?.value ?? 0,
          engineOpp: engineGauge(board.b)?.value ?? 0,
          finisherUnlocked: !!board.a.finisherUnlocked,
        });
      } catch { /* télémétrie fail-soft */ }
      const turnLog = turnRec.log();
      recordWatcherMatch({
        v: turnLog.length ? 2 : 1,
        id: watcherUuid(),
        ts: Date.now(),
        mode: "pro",
        playerVoie: board.a.affinity,
        oppVoie: board.b.affinity ?? null,
        oppKind: "cpu",
        result: outcome,
        turns: board.turn,
        finalHpSelf: Math.max(0, board.a.hp),
        finalHpOpp: Math.max(0, board.b.hp),
        finisherFired: !!board.a.finisherUnlocked,
        oppFinisherFired: !!board.b.finisherUnlocked,
        hpTrajectorySelf: [...trajRef.current.self, Math.max(0, board.a.hp)],
        hpTrajectoryOpp: [...trajRef.current.opp, Math.max(0, board.b.hp)],
        endReason: endReasonRef.current,
        appVersion: watcherAppVersion,
        turnLog: turnLog.length ? turnLog : undefined,
        fps: stopMatchFps() ?? undefined, // profil FPS de la partie (rAF) — null si trop court
      });
    }
  }, [board.phase, board.a.hp, board.b.hp, recordArenaMatch]);

  /* ──────────── Lock & resolve ──────────── */

  function handleLockTurn() {
    if (resolving) return;
    if (board.phase !== "planning") return;
    // Tu peux TOUJOURS finir ton tour (Alex 2026-06-17 « grave erreur » : le Lock
    // se bloquait SILENCIEUSEMENT quand l'intent devenait inabordable — ex. après
    // retrait d'une carte qui DONNAIT du mana, Sablier/Offre). On ne bloque plus :
    // si l'intent dépasse le budget, on retire les DERNIÈRES cartes en trop
    // jusqu'à ce que ce soit payable → jamais de bouton mort, et zéro overspend
    // (le moteur débite le mana sans clamp, cf. resolver.ts).
    let safe = intent;
    while (
      intentCost(safe) > board.a.mana + intentManaGrant(safe) &&
      (safe.spells.length > 0 || safe.summons.length > 0)
    ) {
      safe = safe.spells.length > 0
        ? { ...safe, spells: safe.spells.slice(0, -1) }
        : { ...safe, summons: safe.summons.slice(0, -1) };
    }
    hapticLock();
    setResolving(true);

    const cpuIntent = cpuArenaDecision(board, "b", difficulty);
    // Pré-calcul PUR extrait dans arenaResolvePrep (troncature/dépense/exil/startBoard ; flux de résolution = ici).
    const { startBoard, safeIntent, safeCpuIntent, spentA, spentB } = prepareResolveStart(board, safe, cpuIntent);

    // Télémétrie Watcher (Tier A) — démarre le tour avec l'état AVANT résolution +
    // les coups réellement engagés (safeIntent/safeCpuIntent post-trim) + le ledger
    // des vraies cartes dépensées (id/nom/fusion). Fail-soft, observationnel.
    try {
      turnRec.begin({
        turn: board.turn,
        manaMax: board.a.maxMana,
        manaSpent: Math.min(board.a.maxMana, Math.max(0, intentCost(safe) - intentManaGrant(safe))),
        handStart: board.a.hand.length,
        deckLeft: board.a.deck.length,
        plays: buildTurnPlays(safeIntent, board.a.affinity),
        playsOpp: buildTurnPlays(safeCpuIntent, board.b.affinity),
        cards: buildCardLedger(spentA, cardFr),
        cardsOpp: buildCardLedger(spentB, cardFr),
        hpSelf: Math.max(0, board.a.hp),
        hpOpp: Math.max(0, board.b.hp),
        engine: engineGauge(board.a)?.value ?? 0,
        engineOpp: engineGauge(board.b)?.value ?? 0,
      });
    } catch { /* télémétrie fail-soft */ }

    resolverCancelRef.current = runResolverFlow({
      startBoard,
      playerIntent: safeIntent,
      cpuIntent: safeCpuIntent,
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
            hpSelf: Math.max(0, finalBoard.a.hp),
            hpOpp: Math.max(0, finalBoard.b.hp),
            engine: engineGauge(finalBoard.a)?.value ?? 0,
            engineOpp: engineGauge(finalBoard.b)?.value ?? 0,
            finisherUnlocked: !!finalBoard.a.finisherUnlocked,
          });
        } catch { /* télémétrie fail-soft */ }
      },
      onAdvanceTurn: () => {
        setResolving(false);
        setBoard((cur) => advanceToNextTurn(cur));
      },
      onMatchEnd: (winnerIsPlayer) => {
        setResolving(false);
        if (winnerIsPlayer) hapticWin(); else hapticLoss();
      },
      onLaneResolved: (o) => turnRec.lane(o),
    });
  }

  /* ──────────── Render ──────────── */

  if (matchSplash) {
    return <ArenaMatchSplash playerName={player.nickname || "Toi"} playerAvatar={player.avatar} cpuName={oppName} cpuAvatar={oppAvatar} />;
  }

  if (board.phase === "sudden-death") {
    // Round 10 VRAI BUT D'OR — Mort subite RPSLS. Le component gère le picker
    // + reveal + counter check. Quand résolu, assigne 1 HP au winner et flip
    // la phase à match-end pour que ArenaMatchEnd affiche le résultat propre.
    return (
      <ArenaSuddenDeath
        onResolved={(winner) => {
          endReasonRef.current = "suddendeath"; // télémétrie : fin par mort subite
          const nextBoard: BoardState = winner === "a"
            ? { ...board, a: { ...board.a, hp: 1 }, b: { ...board.b, hp: 0 }, phase: "match-end" }
            : { ...board, a: { ...board.a, hp: 0 }, b: { ...board.b, hp: 1 }, phase: "match-end" };
          setBoard(nextBoard);
          if (winner === "a") hapticMatchWin(); else hapticMatchLoss();
        }}
      />
    );
  }

  if (board.phase === "match-end") {
    return (
      <ArenaMatchEnd
        board={board}
        onQuit={onQuit}
        onRematch={() => {
          resolverCancelRef.current?.(); // coupe toute chaîne résiduelle (anti double-pilotage)
          // Bubble up to ArenaPage so a FRESH coin flip + new theme + new
          // CPU persona is picked for the rematch (Alex: "rematch doit refaire
          // le coin pour éventuellement changer de thème"). If no parent
          // handler, fall back to a local soft-reset.
          if (onRematch) { onRematch(); return; }
          matchEndedRef.current = false;
          setMulliganOpen(true);
          setMulliganSwapsLeft(2);
          setBoard(makeInitialBoard(playerDeck.current, buildCpuDeckMirroring(playerDeck.current, cpuAffinity.current), playerAffinity.current, cpuAffinity.current, cpuPersona.current));
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
      <FloatingMatchBackButton
        ref={backRef}
        onClick={handleForfeit}
        label="Quitter le match"
        hidden
        confirm={{
          title: "Abandonner le match ?",
          body: "C'est compté comme une défaite dans tes stats Constellation Pro. Tu peux toujours rejouer juste après.",
          confirmLabel: "Forfait",
          cancelLabel: "Continuer",
          severity: "danger",
        }}
      />
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
            playerSide="a"
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
            onForgeTap={handleForgeTap}
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
        onForgeTap={handleForgeTap}
        onForgeDeposit={handleForgeDeposit}
        incomingAttackKey={heroHit?.side === "you" ? heroHit.key : null}
        playerName={player.nickname || "Toi"}
        playerAvatar={player.avatar}
      />
      {/* ── MULLIGAN T1 — modale extraite (ArenaMulligan) : empilage des
       *  doublons + remplacement IMMÉDIAT en place (Alex 2026-06-13). ── */}
      <AnimatePresence>
        {mulliganOpen && board.turn === 1 && board.a.hand.length > 0 && !resolving && (
          <ArenaMulligan
            hand={board.a.hand}
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
       *  dropped lines under load) with an in-app live feed. */}
      <ArenaDebugOverlay />
    </motion.div>
  );
}

// Deck construction + spent-card cleanup live in arenaDecks.ts now.

// Re-export HERO_MAX_HP for callers that need the win-condition constant.
export { HERO_MAX_HP };
