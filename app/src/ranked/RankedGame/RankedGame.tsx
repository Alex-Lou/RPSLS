/**
 * RankedGame — top-level orchestrator for Constellation Ranked vs CPU.
 *
 * Owns: battle state (deck/hand/discard/roundWins/bonusHistory), round state
 * (picks, card-in-flight, mana, augur-revealed), refs for CPU decision and
 * player history (never leaked to children).
 *
 * The round loop:
 *   splash → drawing → picking → lock → reveal-intro → reveal → inter-round
 *   → drawing → ... → match-end → recordMatch.
 */

import { useEffect, useRef, useState } from "react";
import type { Move } from "../../engine/game";
import { useStore } from "../../store/store";
import { shuffleLaneIdentities } from "../../engine/lanesCombos";
import { makeRng, randomSeed, type Rng } from "../../engine/rng";
import { hapticLock, hapticMatchStart } from "../../haptic";
import type { PlayerSlot } from "../../online/online";
import { RankedMatchView, type RankedMatchInfo } from "../RankedMatchView";
import type { LaneTarget } from "../rankedTypes";
import { RiposteOverlay } from "./RiposteOverlay";
import { SuddenDeathOverlay } from "./SuddenDeathOverlay";
import { useV3BonusState } from "./useV3BonusState";
import { useRankedGameState } from "./useRankedGameState";
import { LANE_COUNT, MATCH_FOUND_SPLASH_MS, MAX_MANA } from "./rankedGameConstants";
import type { RankedGameCtx } from "./rankedGameContext";
import { createStartNextRound } from "./startNextRound";
import { createCardActions } from "./rankedCardActions";
import { createResolveAndAdvance } from "./resolveAndAdvance";
import { createSubPhases } from "./rankedSubPhases";
import { createMatchLifecycle } from "./rankedMatchLifecycle";

export function RankedGame({
  winTo, opponentName = "CPU", onQuit, onMatchResult,
}: {
  winTo: number;
  opponentName?: string;
  onQuit: () => void;
  onMatchResult?: (won: boolean) => void;
}) {
  const profileNickname = useStore((s) => s.player.nickname);
  const difficulty = useStore((s) => s.player.difficulty);
  const recordMatch = useStore((s) => s.recordMatch);
  const savedDeck = useStore((s) => s.player.rankedDeck);
  const awardCardMasteryXp = useStore((s) => s.awardCardMasteryXp);

  // PRNG SEEDÉ du match (Phase 0 lockstep) : seed aléatoire au boot pour le
  // vs-CPU (comportement inchangé, mais résolution REPRODUCTIBLE) ; plus tard le
  // seed viendra du serveur pour synchroniser les 2 joueurs. TOUTE la résolution
  // (deck / pioche / défausse / lane-perm / aléa de cartes) consomme CE rng dans
  // un ordre déterministe. Le CPU AI, lui, garde Math.random (input, mort en PvP).
  const [rng] = useState<Rng>(() => makeRng(randomSeed()));

  // Shuffle the lane arrangement once per match — synchronously during this
  // (parent) render so the board children read the SAME arrangement on first
  // paint. The ref guards against re-shuffling on re-renders / StrictMode.
  const laneShuffled = useRef(false);
  if (!laneShuffled.current) { shuffleLaneIdentities(rng); laneShuffled.current = true; }

  const matchInfo: RankedMatchInfo = {
    matchId: "ranked-local",
    opponent: opponentName,
    youAre: "a" as PlayerSlot,
    lanes: LANE_COUNT,
    winTo,
  };

  /* ──────────── State ──────────── */
  // États + refs du match extraits dans useRankedGameState (MÊME ordre de
  // hooks), destructurés ici aux MÊMES noms.
  const gameState = useRankedGameState(savedDeck, rng);
  const {
    round, picks, handlePickMove, handleClearLane, cardPlayed,
    augurRevealed, compassRevealed, oracleRevealed, mana, battle,
    aliveRef, lastResult, end, riposteData, suddenDeathData,
    cpuDecisionRef, deadlineTimerRef, augurCooldown,
  } = gameState;
  // État des cartes bonus V3 (+ Mascarade) extrait dans useV3BonusState :
  // déclarations PURES (refs/states + setters combinés), destructurées ici aux
  // MÊMES noms → le cœur de match (startNextRound/resolveAndAdvance/rematch)
  // reste byte-identique. Le SÉQUENÇAGE des resets reste piloté ci-dessous.
  const v3 = useV3BonusState();
  const {
    mascaradePoison, braiseStacks, bonusManaNext, manaMaxBoostRef, cascadeArmed,
    echoActive, anchorRoundsLeft, gaiaCharged, setGaiaCharged, oppHandRevealed,
  } = v3;

  // Contexte de CE rendu → fabriques des fonctions du cœur de match. Recréées à
  // chaque rendu exactement comme les anciennes fonctions locales : mêmes
  // closures (y compris lues depuis un setTimeout programmé plus tôt).
  const ctx: RankedGameCtx = {
    ...gameState, ...v3,
    rng, difficulty, winTo, savedDeck, recordMatch, awardCardMasteryXp, onQuit, onMatchResult,
  };
  const startNextRound = createStartNextRound(ctx);
  const { handlePlayCard, handleCancelCard } = createCardActions(ctx);
  const resolveAndAdvance = createResolveAndAdvance(ctx, startNextRound);
  const { handleRipostePick, handleSuddenDeathPick } = createSubPhases(ctx, startNextRound);
  const { rematch, handleLeave } = createMatchLifecycle(ctx, startNextRound);

  /* ──────────── Lifecycle ──────────── */
  useEffect(() => {
    hapticMatchStart();
    // Seed Bouclier de Gaïa charge if the passive is equipped — consumed once
    // per match on the first round you'd lose.
    setGaiaCharged(battle.passives.includes("gaia"));
    const id = window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (deadlineTimerRef.current) window.clearTimeout(deadlineTimerRef.current);
    };
  }, []);

  /* ──────────── Player actions ──────────── */

  function revealAugurFor(lane: LaneTarget): Move {
    return cpuDecisionRef.current?.plays[lane].mv ?? ("rock" as Move);
  }
  function handleLock() {
    if (picks.some((p) => p === null)) return;
    hapticLock();
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    resolveAndAdvance(picks as [Move, Move, Move], false);
  }

  return (
    <>
      <RankedMatchView
        nickname={profileNickname}
        match={matchInfo}
        round={round}
        lastResult={lastResult}
        end={end}
        picks={picks}
        cardPlayed={cardPlayed}
        augurRevealed={augurRevealed}
        mana={mana}
        manaMax={(battle.passives.includes("cadence") ? MAX_MANA + 1 : MAX_MANA) + manaMaxBoostRef.current}
        passives={battle.passives}
        braiseStacks={braiseStacks}
        activeEffects={{
          mascaradePoison,
          bonusManaNext,
          cascadeArmed,
          echoActive,
          anchorRoundsLeft,
          gaiaCharged,
        }}
        compassRevealed={compassRevealed}
        oracleRevealed={oracleRevealed}
        oppHandRevealed={oppHandRevealed}
        hand={battle.hand}
        oppHandSize={battle.oppHandSize}
        roundWinsYou={battle.roundWinsA}
        roundWinsOpp={battle.roundWinsB}
        augurCooldown={augurCooldown}
        onPickMove={handlePickMove}
        onClearLane={handleClearLane}
        onPlayCard={handlePlayCard}
        onCancelCard={handleCancelCard}
        onLock={handleLock}
        revealAugurFor={revealAugurFor}
        onLeave={handleLeave}
        onRematch={onMatchResult ? undefined : rematch}
        onNext={onMatchResult && end ? () => onMatchResult(end.winner === "a") : undefined}
        showTimer={false}
      />
      {riposteData && (
        <RiposteOverlay
          data={riposteData}
          onPick={handleRipostePick}
        />
      )}
      {suddenDeathData && (
        <SuddenDeathOverlay
          data={suddenDeathData}
          onPick={handleSuddenDeathPick}
        />
      )}
    </>
  );
}
