/**
 * Écrans de fin d'ArenaGame (extraits, cap <400 lignes/fichier) : mort subite,
 * fin de tutoriel, fin de match (+ soft-reset « Rejouer »). Fonction de RENDU
 * pure (pas un composant, aucun hook) appelée inline par ArenaGame → arbre
 * React et ordre d'évaluation identiques. null = la partie continue.
 */

import type { Dispatch, MutableRefObject, ReactElement, SetStateAction } from "react";
import type { Move } from "../../engine/game";
import type { CardId } from "../../ranked/rankedTypes";
import { ArenaMatchEnd } from "../ArenaMatchEnd";
import { ArenaSuddenDeath } from "../ArenaSuddenDeath";
import { makeInitialBoard } from "../arenaRules";
import type { BoardState, CpuPersona, Side, TurnIntent } from "../arenaTypes";
import { makeRngPair, randomSeed, type RngPair } from "../../engine/rng";
import type { ArenaOnlineDriver } from "../arenaOnlineDriver";
import { buildCpuDeckMirroring } from "../arenaDecks";
import { ArenaTutorialEnd } from "../tutorial/ArenaTutorialEnd";
import type { WatcherMatchRecord } from "../arenaTelemetry";
import type { ArenaResolveFx } from "./useArenaResolveFx";

export interface ArenaEndScreenCtx {
  board: BoardState;
  setBoard: Dispatch<SetStateAction<BoardState>>;
  mySide: Side;
  oppSide: Side;
  backButton: ReactElement;
  endReasonRef: MutableRefObject<WatcherMatchRecord["endReason"]>;
  tutorial: { onPlayReal: () => void; onReplay: () => void } | undefined;
  online: ArenaOnlineDriver | undefined;
  onQuit: () => void;
  onRematch: (() => void) | undefined;
  oppName: string | undefined;
  resolverCancelRef: MutableRefObject<null | (() => void)>;
  matchEndedRef: MutableRefObject<boolean>;
  mulliganDoneRef: MutableRefObject<boolean>;
  setMulliganOpen: Dispatch<SetStateAction<boolean>>;
  setMulliganSwapsLeft: Dispatch<SetStateAction<number>>;
  rngPair: MutableRefObject<RngPair>;
  playerDeck: MutableRefObject<CardId[]>;
  playerAffinity: MutableRefObject<Move | undefined>;
  cpuAffinity: MutableRefObject<Move>;
  cpuPersona: MutableRefObject<CpuPersona>;
  setIntent: Dispatch<SetStateAction<TurnIntent>>;
  fx: ArenaResolveFx;
}

export function renderArenaEndScreen(ctx: ArenaEndScreenCtx): ReactElement | null {
  const {
    board, setBoard, mySide, oppSide, backButton, endReasonRef, tutorial, online, onQuit, onRematch, oppName,
    resolverCancelRef, matchEndedRef, mulliganDoneRef, setMulliganOpen, setMulliganSwapsLeft, rngPair,
    playerDeck, playerAffinity, cpuAffinity, cpuPersona, setIntent, fx,
  } = ctx;
  const {
    setRecapLog, setOppPreview, setPlayerPreview, setResolveStep, setResolving, setCombatLane, setHeroHit,
    setTargeting, setMatchSplash,
  } = fx;
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

if (board.phase === "match-end" && tutorial) {
  return (
    <ArenaTutorialEnd
      won={board[mySide].hp > 0 && board[oppSide].hp <= 0}
      onPlay={tutorial.onPlayReal}
      onReplay={tutorial.onReplay}
      onQuit={onQuit}
    />
  );
}

if (board.phase === "match-end") {
  return (
    <ArenaMatchEnd
      board={board}
      mySide={mySide}
      oppName={oppName}
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
        setRecapLog([]);
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
  return null;
}
