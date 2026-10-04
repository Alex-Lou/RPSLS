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
 *
 * Découpage (cap <400 lignes/fichier) : useArenaMatchSetup (mise en place),
 * useArenaResolveFx (états FX/résolution + auto-clear), useArenaMatchRecord
 * (télémétrie/fin de match), arenaResolveWith (lancement du résolveur),
 * arenaGameUtils (useLazyRef, splash, mulligan CPU). Ordre des hooks inchangé.
 */

import { useEffect, useRef } from "react";
import { hapticMatchLoss, hapticTap } from "../../haptic";
import { tNow } from "../../i18n";
import type { CardId } from "../../ranked/rankedTypes";
import { useAndroidBackPrompt, type MatchBackHandle } from "../../match/sharedMatchUI";
import { ArenaDebugOverlay } from "../ArenaDebugOverlay";
import { DEV_TOOLS } from "../../devTools";
import { ArenaMatchSplash } from "../ArenaMatchSplash";
import { AnimatePresence, motion } from "motion/react";
import { ArenaImpactFX } from "../ArenaImpactFX";
import { ArenaTraceCue } from "../ArenaTraceCue";
import { ArenaTurnRecap } from "../ArenaTurnRecap";
import { ArenaTurnHistory } from "../ArenaTurnHistory";
import { ArenaCastOnDrawFX } from "../ArenaCastOnDrawFX";
import { ArenaHeistAnim } from "../ArenaHeistAnim";
import { ArenaPlanPhase } from "../ArenaPlanPhase";
import { mulliganSwap, mulliganReplaceInPlace } from "../arenaRules";
import { ArenaMulligan } from "../ArenaMulligan";
import {
  HERO_MAX_HP,
  type LaneIndex,
  type TurnIntent,
} from "../arenaTypes";
import { setMatchExit } from "../../matchExitStore";
import type { ArenaOnlineDriver } from "../arenaOnlineDriver";
import { BoardFillSlot } from "./BoardFillSlot";
import { HeroHitFlash } from "./HeroHitFlash";
import { useArenaIntent } from "./useArenaIntent";
import { useArenaForge } from "./useArenaForge";
import { ArenaTutorialCoach } from "../tutorial/ArenaTutorialCoach";
import { cpuMulliganIndices, routeBoardLaneTap } from "./arenaGameUtils";
import { useArenaMatchSetup } from "./useArenaMatchSetup";
import { useArenaResolveFx, useArenaFxAutoClear } from "./useArenaResolveFx";
import { useArenaTelemetryRefs, useArenaMatchRecord } from "./useArenaMatchRecord";
import { runArenaResolve, lockArenaTurn } from "./arenaResolveWith";
import { renderArenaEndScreen } from "./ArenaGameEndScreen";
import { renderArenaBackButton, renderArenaBoard } from "./ArenaGameView";

export function ArenaGame({
  onQuit, onRematch, oppName, oppAvatar, online, tutorial,
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
  /** Tutoriel guidé (cf. arena/tutorial) : partie scriptée vs le Mentor, coach
   *  par-dessus, AUCUNE stat/historique/télémétrie, écran de fin dédié. */
  tutorial?: { onPlayReal: () => void; onReplay: () => void };
}) {
  // Mise en place (deck/Voie/persona/RNG/log/board/mulligan) → useArenaMatchSetup.
  const {
    player, difficulty, recordArenaMatch, playerDeck, playerAffinity, cpuAffinity, cpuPersona, rngPair,
    t, cardFr, mySide, oppSide, board, setBoard,
    mulliganOpen, setMulliganOpen, mulliganSwapsLeft, setMulliganSwapsLeft,
  } = useArenaMatchSetup(online, tutorial);
  // (cpuMulliganIndices → arenaGameUtils.)

  // ── INTENT (sorts/invocations planifiés) — état + builders extraits dans
  // useArenaIntent (sémantiquement identique à un useState inline). ──
  const { intent, setIntent, addSpell, removeSpell, addSummon, removeSummon, intentCost } =
    useArenaIntent(board, mySide, cardFr);
  // États FX / résolution (aperçus, step, combat, chips, FX, recap…) → useArenaResolveFx.
  const fx = useArenaResolveFx(board, mySide);
  const {
    matchSplash, resolving, setResolving, impactFX, screenShake, traceCue, turnRecap, setTurnRecap,
    recapLog, castDraw, targeting, setTargeting, heroHit, heistAnim,
  } = fx;

  // ── FORGE (dépôt/fusion/récup) — état + handlers extraits dans useArenaForge.
  // Lit l'intent (anti double-dépense) + le targeting (carte armée). N'est PAS
  // dans le chemin de timing de la résolution de combat. ──
  const { forgeFlash, forgeRecover, handleForgeTap, handleForgeDeposit } = useArenaForge({
    board, setBoard, setIntent, targeting, setTargeting, resolving, cardFr,
  });
  // Online v1 : FORGE désactivée — le dépôt est une mutation de board HORS intent
  // (setBoard direct) → elle ne passe pas par le lockstep et desyncrait les deux
  // clients. À relayer plus tard. Local : handlers normaux.
  // Tuto : Forge coupée aussi (déposer la carte du script la retirerait de la main).
  const forgeTap = online || tutorial ? () => {} : handleForgeTap;
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
      label: tNow("arena.game.quitArena"),
      onExit: () => backRef.current?.triggerConfirm(),
    });
    return () => { setMatchExit(null); };
  }, []);

  // Match-end guard — also gates handleForfeit so we never double-record.
  // Declared BEFORE handleForfeit so the closure binds the real ref.
  const matchEndedRef = useRef(false);
  // Télémétrie Watcher (trajectoire PV, raison de fin, enregistreur v:2, FPS)
  // → useArenaTelemetryRefs.
  const { trajRef, endReasonRef, turnRec } = useArenaTelemetryRefs();

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
    if (matchEndedRef.current || tutorial) { onQuit(); return; } // tuto : sortie sans défaite
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
    routeBoardLaneTap(lane, targeting, setIntent, setTargeting, addSpell);
  }
  // Splash + auto-clear des chips (Provoc, anti-taunt, riposte) + anim Larcin
  // → useArenaFxAutoClear.
  useArenaFxAutoClear(fx, board);

  // Capture PV par tour + haptique/stats/Watcher de fin de match → useArenaMatchRecord.
  useArenaMatchRecord({
    board, mySide, oppSide, trajRef, endReasonRef, turnRec, matchEndedRef, tutorial, online, recordArenaMatch,
  });

  /* ──────────── Lock & resolve ──────────── */

  function handleLockTurn() {
    // Corps → arenaResolveWith.lockArenaTurn (même ordre d'appels : IA CPU SYNC
    // ou échange lockstep online, puis resolveWith).
    lockArenaTurn({
      resolving, board, intent, intentCost, mySide, oppSide, online, tutorial, difficulty, matchEndedRef,
      setTurnRecap, setResolving, resolveWith,
    });
  }

  /** Résout un tour depuis MON intent + celui de l'ADVERSAIRE (déjà connus).
   *  Jonction UNIQUE vs-CPU / online : seul le PRODUCTEUR de l'intent adverse
   *  diffère (IA locale sync OU réseau async) ; résolution + anims identiques.
   *  prepareResolveStart(...,mySide) remet les intents en ordre CANONIQUE → les
   *  deux clients calculent le même board. */
  function resolveWith(myIntent: TurnIntent, oppIntent: TurnIntent) {
    runArenaResolve({
      board, mySide, oppSide, intentCost, turnRec, cardFr, resolverCancelRef, rngPair, online, setBoard, setIntent, fx,
    }, myIntent, oppIntent);
  }

  /* ──────────── Render ──────────── */

  if (matchSplash) {
    return <ArenaMatchSplash playerName={player.nickname || t("match.you")} playerAvatar={player.avatar} cpuName={oppName} cpuAvatar={oppAvatar} />;
  }

  // Sortie du match (burger / retour Android) : montée AUSSI en mort subite,
  // sinon backRef restait null et « Quitter » ne faisait rien.
  const backButton = renderArenaBackButton(backRef, handleForfeit, t, tutorial);

  // Mort subite / fin de tutoriel / fin de match → ArenaGameEndScreen (rendu inline).
  const endScreen = renderArenaEndScreen({
    board, setBoard, mySide, oppSide, backButton, endReasonRef, tutorial, online, onQuit, onRematch, oppName,
    resolverCancelRef, matchEndedRef, mulliganDoneRef, setMulliganOpen, setMulliganSwapsLeft, rngPair,
    playerDeck, playerAffinity, cpuAffinity, cpuPersona, setIntent, fx,
  });
  if (endScreen) return endScreen;

  return (
    <motion.div animate={screenShake} className="relative flex-1 flex flex-col min-h-0 gap-1 landscape:gap-0">
      {/* 💥 IMPACT FX plein-écran (coup puissant/fatal) — entaille Ciseaux,
       *  ébranlement Pierre… + tremblement de cette racine (Alex 2026-06-13). */}
      <ArenaImpactFX fx={impactFX} />
      <ArenaTraceCue cue={traceCue} />
      {/* Recap de fin de tour (phrases + micro-stats) — bas du pad, Pro vs-CPU + online. */}
      <ArenaTurnRecap recap={turnRecap} />
      <ArenaTurnHistory entries={recapLog} />
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
          renderArenaBoard(slotH, {
            board, mySide, intent, fx, oppName, oppAvatar, onLaneTap: handleBoardLaneTap,
            removeSpell, removeSummon, forgeTap, forgeFlash, forgeRecover,
          })
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
        onForgeDeposit={tutorial ? undefined : forgeDeposit}
        incomingAttackKey={heroHit?.side === "you" ? heroHit.key : null}
        playerName={player.nickname || t("match.you")}
        playerAvatar={player.avatar}
      />
      {tutorial && (
        <ArenaTutorialCoach
          turn={board.turn}
          planning={board.phase === "planning"}
          resolving={resolving}
          intent={intent}
          targeting={targeting}
          onRepairIntent={setIntent}
          onSkip={() => backRef.current?.triggerConfirm()}
        />
      )}
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
