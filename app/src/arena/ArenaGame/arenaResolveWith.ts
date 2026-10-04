/**
 * runArenaResolve — corps de ArenaGame.resolveWith (extrait, cap <400 lignes) :
 * pré-calcul PUR (prepareResolveStart), début d'enregistrement Watcher, puis
 * lancement du résolveur séquencé (runResolverFlow) avec les setters d'ArenaGame.
 * lockArenaTurn = corps de handleLockTurn (verrouillage + intent adverse).
 * Appelé synchroniquement depuis resolveWith → mêmes valeurs capturées (board
 * du rendu courant), même ordre d'appels, même consommation du RNG.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useStore } from "../../store/store";
import type { CardId } from "../../ranked/rankedTypes";
import { buildTurnRecap } from "../arenaRecap";
import { engineGauge } from "../arenaEngines";
import { advanceToNextTurn } from "../arenaRules";
import { intentManaGrant, type BoardState, type Side, type TurnIntent } from "../arenaTypes";
import { hapticLock } from "../../haptic";
import { hashBoard } from "../arenaNet";
import { cpuArenaDecision } from "../arenaAI";
import { tutorialCpuIntent } from "../tutorial/tutorialScript";
import type { Difficulty } from "../../types";
import type { RngPair } from "../../engine/rng";
import type { ArenaOnlineDriver } from "../arenaOnlineDriver";
import { runResolverFlow } from "../arenaResolverFlow";
import { prepareResolveStart } from "./arenaResolvePrep";
import { buildTurnPlays, buildCardLedger, type TurnRecorder } from "../arenaTelemetry";
import type { ArenaResolveFx } from "./useArenaResolveFx";

export interface ArenaResolveCtx {
  board: BoardState;
  mySide: Side;
  oppSide: Side;
  intentCost: (i: TurnIntent) => number;
  turnRec: TurnRecorder;
  cardFr: (id: CardId) => string;
  resolverCancelRef: MutableRefObject<null | (() => void)>;
  rngPair: MutableRefObject<RngPair>;
  online: ArenaOnlineDriver | undefined;
  setBoard: Dispatch<SetStateAction<BoardState>>;
  setIntent: Dispatch<SetStateAction<TurnIntent>>;
  fx: ArenaResolveFx;
}

export function runArenaResolve(ctx: ArenaResolveCtx, myIntent: TurnIntent, oppIntent: TurnIntent): void {
  const { board, mySide, oppSide, intentCost, turnRec, cardFr, resolverCancelRef, rngPair, online, setBoard, setIntent, fx } = ctx;
  const {
    setOppPreview, setPlayerPreview, setResolveStep, setCombatLane, setCombatChargers, setHeroHit, setTauntBlock,
    setAntiTaunt, setRiposteFX, setSpellFX, setImpactFX, setProjectileShots, setTurnRecap, recapKey, setRecapLog, setResolving,
  } = fx;
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
      const recap = buildTurnRecap(board, finalBoard, mySide, ++recapKey.current);
      setTurnRecap(recap);
      if (recap) setRecapLog((l) => [...l, { turn: board.turn, recap }].slice(-40));
    },
    onAdvanceTurn: () => {
      setResolving(false);
      // noSuddenDeath IDENTIQUE au resolver (double KO de fatigue → même départage).
      setBoard((cur) => advanceToNextTurn(cur, rngPair.current, { noSuddenDeath: !!online }));
    },
    // Vibration de fin : UNE seule, dans l'effet de fin de match (perspective
    // mySide). Ici elle doublait la vibration.
    onMatchEnd: () => {
      setResolving(false);
    },
    onLaneResolved: (o) => turnRec.lane(o),
  });
}

export interface ArenaLockCtx {
  resolving: boolean;
  board: BoardState;
  intent: TurnIntent;
  intentCost: (i: TurnIntent) => number;
  mySide: Side;
  oppSide: Side;
  online: ArenaOnlineDriver | undefined;
  tutorial: unknown;
  difficulty: Difficulty;
  matchEndedRef: MutableRefObject<boolean>;
  setTurnRecap: ArenaResolveFx["setTurnRecap"];
  setResolving: ArenaResolveFx["setResolving"];
  resolveWith: (myIntent: TurnIntent, oppIntent: TurnIntent) => void;
}

/** Corps de ArenaGame.handleLockTurn (extrait) — verrouille le tour du joueur,
 *  obtient l'intent adverse (IA locale SYNC / réseau lockstep ASYNC) puis résout. */
export function lockArenaTurn(ctx: ArenaLockCtx): void {
  const { resolving, board, intent, intentCost, mySide, oppSide, online, tutorial, difficulty, matchEndedRef, setTurnRecap, setResolving, resolveWith } = ctx;
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
    resolveWith(safe, tutorial ? tutorialCpuIntent(board.turn) : cpuArenaDecision(board, oppSide, difficulty));
  }
}
