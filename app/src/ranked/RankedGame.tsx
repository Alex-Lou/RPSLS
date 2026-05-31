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
import type { AiMood, Move } from "../game";
import { useStore } from "../store";
import {
  resolveLanesRound,
  type RoundOutcome,
} from "../lanesEngine";
import { detectPlayerCombo } from "../lanesCombos";
import {
  hapticLock, hapticMatchStart, hapticMatchWin, hapticMatchLoss,
  hapticTap, hapticWin, hapticLoss,
} from "../haptic";
import type { LanePlay, PlayerSlot } from "../online";
import {
  RankedMatchView,
  type RankedMatchInfo,
  type RankedRoundData,
  type RankedRoundResultData,
  type RankedEndData,
} from "./RankedMatchView";
import {
  applyCardEffects, applyVortex, computeRoundBonuses, finalRoundWinner,
} from "./rankedRules";
import {
  starterDeck, shuffle, drawN, HAND_CAP, STARTING_HAND, CARDS, discardRandom,
} from "./cards";
import { cpuRankedDecision } from "./rankedAI";
import type {
  CardId, CpuRoundDecision, LaneTarget, PlayedCard,
  RankedBattleState,
} from "./rankedTypes";

const LANE_COUNT = 3;
const PICK_DEADLINE_MS = 20_000;
const ROUND_PAUSE_MS = 7_500;
const REVEAL_SUSPENSE_MS = 1_400;
const MATCH_FOUND_SPLASH_MS = 2_500;
const MAX_MANA = 4;

function makeBattle(savedDeck?: string[]): RankedBattleState {
  const cleaned = (savedDeck ?? []).filter(
    (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
  );
  const source = cleaned.length > 0 ? cleaned : starterDeck();
  return {
    deck: shuffle(source),
    hand: [],
    discard: [],
    usedOneShotCards: [],
    roundWinsA: 0,
    roundWinsB: 0,
    roundsPlayed: 0,
    bonusHistory: [],
  };
}

function removeFirst<T>(arr: T[], v: T): T[] {
  const i = arr.indexOf(v);
  if (i === -1) return arr;
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

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

  const matchInfo: RankedMatchInfo = {
    matchId: "ranked-local",
    opponent: opponentName,
    youAre: "a" as PlayerSlot,
    lanes: LANE_COUNT,
    winTo,
  };

  /* ──────────── State ──────────── */
  const [round, setRound] = useState<RankedRoundData | null>(null);
  const [picks, setPicks] = useState<[Move | null, Move | null, Move | null]>([null, null, null]);
  const [cardPlayed, setCardPlayed] = useState<PlayedCard | null>(null);
  const [augurRevealed, setAugurRevealed] = useState<{ lane: LaneTarget; move: Move } | null>(null);
  const [oracleRevealed, setOracleRevealed] = useState<[Move, Move, Move] | null>(null);
  void oracleRevealed; // consumed later by RankedMatchView
  const [mana, setMana] = useState(1);
  const [battle, setBattle] = useState<RankedBattleState>(() => makeBattle(savedDeck));
  const [lastResult, setLastResult] = useState<RankedRoundResultData | null>(null);
  const [end, setEnd] = useState<RankedEndData | null>(null);

  /* ──────────── Refs (never leaked to children) ──────────── */
  const cpuDecisionRef = useRef<CpuRoundDecision | null>(null);
  const playerHistoryRef = useRef<Move[]>([]);
  const moodRef = useRef<AiMood>("random");
  const roundNoRef = useRef(0);
  const deadlineTimerRef = useRef<number | null>(null);
  const wonLastRoundRef = useRef(false);
  const timeoutCountRef = useRef(0);
  const MAX_TIMEOUTS = 3;
  /** Augur cooldown: rounds remaining before Augur can be played again. */
  const [augurCooldown, setAugurCooldown] = useState(0);

  /* ──────────── Lifecycle ──────────── */
  useEffect(() => {
    hapticMatchStart();
    const id = window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (deadlineTimerRef.current) window.clearTimeout(deadlineTimerRef.current);
    };
  }, []);

  /* ──────────── Round loop ──────────── */

  function startNextRound() {
    const nextNo = roundNoRef.current + 1;
    roundNoRef.current = nextNo;

    const newMana = Math.min(MAX_MANA, nextNo);
    setAugurCooldown((c) => Math.max(0, c - 1));

    const shouldDraw = nextNo === 1 || wonLastRoundRef.current;
    const drawCount = nextNo === 1 ? STARTING_HAND : shouldDraw ? 1 : 0;
    const drawn = drawN(battle.deck, battle.hand, battle.discard, drawCount, HAND_CAP);

    // CPU decision now, stored in ref so Augur can read without races.
    const cpuDecision = cpuRankedDecision(
      {
        mood: moodRef.current,
        difficulty,
        playerHistory: playerHistoryRef.current,
        mana: newMana,
        hand: ["aegis", "surge", "augur", "curse", "precision", "echo", "tide", "vortex"],
      },
      LANE_COUNT,
    );
    cpuDecisionRef.current = cpuDecision;

    // Reset round-time state.
    setPicks([null, null, null]);
    setCardPlayed(null);
    setAugurRevealed(null);
    setOracleRevealed(null);
    setLastResult(null);
    setMana(newMana);
    setBattle((b) => ({ ...b, deck: drawn.deck, hand: drawn.hand, discard: drawn.discard }));
    setRound({
      no: nextNo,
      deadlineMs: PICK_DEADLINE_MS,
      startedAt: Date.now(),
    });

    if (deadlineTimerRef.current) window.clearTimeout(deadlineTimerRef.current);
    deadlineTimerRef.current = window.setTimeout(() => {
      timeoutCountRef.current += 1;
      if (timeoutCountRef.current >= MAX_TIMEOUTS) {
        // Forfait — auto-lose the match
        const winsA = battle.roundWinsA;
        const winsB = winTo;
        recordMatch({
          id: `ranked-forfeit-${Date.now()}`,
          mode: "constellation",
          bestOf: winTo,
          opponent: { kind: "cpu", mood: moodRef.current },
          scorePlayer: winsA, scoreOpponent: winsB,
          outcome: "loss", rounds: [],
          xpDelta: 0, lpDelta: -10,
          timestamp: Date.now(), forfeit: true,
        });
        setEnd({ winner: "b", roundWinsYou: winsA, roundWinsOpp: winsB, forfeit: true });
        return;
      }
      const filler: [Move, Move, Move] = ["rock", "rock", "rock"];
      resolveAndAdvance(filler, true);
    }, PICK_DEADLINE_MS + 500);
  }

  /* ──────────── Player actions ──────────── */

  function handlePickMove(mv: Move) {
    setPicks((cur) => {
      const i = cur.findIndex((p) => p === null);
      if (i === -1) return cur;
      const next = cur.slice() as [Move | null, Move | null, Move | null];
      next[i] = mv;
      return next;
    });
  }
  function handleClearLane(lane: LaneTarget) {
    setPicks((cur) => {
      const next = cur.slice() as [Move | null, Move | null, Move | null];
      next[lane] = null;
      return next;
    });
  }
  function handlePlayCard(card: PlayedCard) {
    setCardPlayed(card);
    if (card.id === "augur") {
      setAugurRevealed({ lane: card.lane, move: card.revealed });
      setAugurCooldown(3); // Can't play Augur/Oracle for 2 more rounds (decremented at round start)
    } else if (card.id === "oracle") {
      // Oracle reveals all 3 — show via oracleRevealed or 3 augur states
      const r = card.revealed;
      setAugurRevealed(null); // Clear single augur, we use oracle state
      setOracleRevealed(r);
      setAugurCooldown(3);
    } else if (card.id === "echo") {
      // Copy pick from source to target lane
      setPicks((cur) => {
        const next = cur.slice() as [Move | null, Move | null, Move | null];
        next[card.toLane] = next[card.fromLane];
        return next;
      });
    }
    // vortex, supernova, second-wind, tide, precision, anchor, curse, surge, aegis
    // → applied at resolve time, no immediate UI effect beyond the card badge
  }
  function handleCancelCard() {
    if (cardPlayed?.id === "augur") setAugurRevealed(null);
    if (cardPlayed?.id === "oracle") setOracleRevealed(null);
    if (cardPlayed?.id === "echo") {
      // Undo the copy
      setPicks((cur) => {
        const next = cur.slice() as [Move | null, Move | null, Move | null];
        next[(cardPlayed as { toLane: LaneTarget }).toLane] = null;
        return next;
      });
    }
    setCardPlayed(null);
  }
  function revealAugurFor(lane: LaneTarget): Move {
    return cpuDecisionRef.current?.plays[lane].mv ?? ("rock" as Move);
  }
  function handleLock() {
    if (picks.some((p) => p === null)) return;
    hapticLock();
    timeoutCountRef.current = 0; // Player acted — reset inactivity counter
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    resolveAndAdvance(picks as [Move, Move, Move], false);
  }

  /* ──────────── Resolve a round ──────────── */

  function resolveAndAdvance(playerPicks: [Move, Move, Move], timedOut: boolean) {
    const cpu = cpuDecisionRef.current!;
    const cpuPicks: [Move, Move, Move] = [
      cpu.plays[0].mv, cpu.plays[1].mv, cpu.plays[2].mv,
    ];

    if (!timedOut) {
      playerHistoryRef.current.push(...playerPicks);
    }

    const playerPlays: LanePlay[] = playerPicks.map((mv) => ({ mv, mana: 0 }));
    // Vortex: rotate CPU picks if player played it
    const vortexActive = !timedOut && cardPlayed?.id === "vortex";
    const cpuPlays: LanePlay[] = vortexActive ? applyVortex(cpu.plays) : cpu.plays;

    let base: RoundOutcome;
    if (timedOut) {
      base = {
        lanes: playerPlays.map((p, i) => ({
          a_play: p, b_play: cpuPlays[i],
          outcome: { kind: "b_wins" as const, verb: "wins by timeout" },
          winner: "b" as const, points: 1,
        })),
        aPoints: 0,
        bPoints: LANE_COUNT,
        roundWinner: "b" as const,
      };
    } else {
      base = resolveLanesRound(playerPlays, cpuPlays);
    }

    const myCard = timedOut ? null : cardPlayed;
    const oppCard = cpu.card;

    const fx = applyCardEffects(base, myCard, oppCard);
    const yourCombo = detectPlayerCombo(playerPicks);
    const oppCombo = detectPlayerCombo(cpuPicks);
    const bonuses = computeRoundBonuses(
      fx.outcome,
      playerPlays, cpuPlays,
      myCard, oppCard,
      yourCombo, oppCombo,
      fx,
    );
    const finalWinner = finalRoundWinner(fx.outcome, bonuses, myCard, oppCard);
    const yourTotal = Math.max(0,
      fx.outcome.aPoints + bonuses.comboBonusA + bonuses.favouredBonusA +
      bonuses.surgeBonusA + bonuses.surgePenaltyB + bonuses.tideBonusA - bonuses.cursePenaltyA);
    const oppTotal = Math.max(0,
      fx.outcome.bPoints + bonuses.comboBonusB + bonuses.favouredBonusB +
      bonuses.surgeBonusB + bonuses.surgePenaltyA + bonuses.tideBonusB - bonuses.cursePenaltyB);

    wonLastRoundRef.current = finalWinner === "a";

    // Battle state update: discard played card, spend mana, lose 1 card if loss.
    const spentMana = myCard ? CARDS[myCard.id].cost : 0;
    setBattle((b) => {
      let handAfter = myCard ? removeFirst(b.hand, myCard.id) : b.hand;
      let discardAfter = b.discard;
      let usedOneShotAfter = b.usedOneShotCards;
      if (myCard) {
        const rarity = CARDS[myCard.id].rarity;
        if (rarity === "epic" || rarity === "legendary") {
          usedOneShotAfter = [...usedOneShotAfter, myCard.id];
        } else {
          discardAfter = [...discardAfter, myCard.id];
        }
      }
      // Lose round → discard 1 random card from hand
      if (finalWinner === "b" && handAfter.length > 0) {
        const dr = discardRandom(handAfter, discardAfter, usedOneShotAfter);
        handAfter = dr.hand;
        discardAfter = dr.discard;
        usedOneShotAfter = dr.usedOneShotCards;
      }
      const winsA = b.roundWinsA + (finalWinner === "a" ? 1 : 0);
      const winsB = b.roundWinsB + (finalWinner === "b" ? 1 : 0);
      return {
        ...b,
        hand: handAfter,
        discard: discardAfter,
        usedOneShotCards: usedOneShotAfter,
        roundWinsA: winsA,
        roundWinsB: winsB,
        roundsPlayed: b.roundsPlayed + 1,
        bonusHistory: [...b.bonusHistory, bonuses],
      };
    });
    setMana((m) => Math.max(0, m - spentMana));

    const nextRoundWinsA = battle.roundWinsA + (finalWinner === "a" ? 1 : 0);
    const nextRoundWinsB = battle.roundWinsB + (finalWinner === "b" ? 1 : 0);

    // Hand to reveal phase.
    setRound(null);
    setLastResult({
      yourPicks: playerPicks,
      oppPicks: cpuPicks,
      myCard, oppCard,
      augurRevealed,
      laneResults: fx.outcome.lanes,
      bonuses,
      roundWinner: finalWinner,
      yourTotal, oppTotal,
      roundWinsYou: nextRoundWinsA,
      roundWinsOpp: nextRoundWinsB,
    });

    // Reveal haptic — delayed to land with the visual flip.
    window.setTimeout(() => {
      if (yourTotal > oppTotal) hapticWin();
      else if (yourTotal < oppTotal) hapticLoss();
      else hapticTap();
    }, REVEAL_SUSPENSE_MS);

    // End-of-match check.
    if (nextRoundWinsA >= winTo || nextRoundWinsB >= winTo) {
      const youWon = nextRoundWinsA >= winTo;
      recordMatch({
        id: `ranked-cpu-${Date.now()}`,
        mode: "constellation",
        bestOf: winTo,
        opponent: { kind: "cpu", mood: moodRef.current },
        scorePlayer: nextRoundWinsA,
        scoreOpponent: nextRoundWinsB,
        outcome: youWon ? "win" : "loss",
        rounds: [],
        xpDelta: youWon ? 60 : 15,
        lpDelta: 0,
        timestamp: Date.now(),
        forfeit: false,
      });
      window.setTimeout(() => {
        if (youWon) hapticMatchWin(); else hapticMatchLoss();
        setEnd({
          winner: youWon ? "a" : "b",
          roundWinsYou: nextRoundWinsA,
          roundWinsOpp: nextRoundWinsB,
          forfeit: false,
        });
      }, ROUND_PAUSE_MS);
    } else {
      window.setTimeout(() => startNextRound(), ROUND_PAUSE_MS);
    }
  }

  function rematch() {
    setRound(null);
    setLastResult(null);
    setEnd(null);
    setPicks([null, null, null]);
    setCardPlayed(null);
    setAugurRevealed(null);
    setOracleRevealed(null);
    setAugurCooldown(0);
    setMana(1);
    setBattle(makeBattle(savedDeck));
    cpuDecisionRef.current = null;
    playerHistoryRef.current = [];
    moodRef.current = "random";
    roundNoRef.current = 0;
    wonLastRoundRef.current = false;
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    hapticMatchStart();
    window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
  }

  return (
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
      hand={battle.hand}
      roundWinsYou={battle.roundWinsA}
      roundWinsOpp={battle.roundWinsB}
      augurCooldown={augurCooldown}
      onPickMove={handlePickMove}
      onClearLane={handleClearLane}
      onPlayCard={handlePlayCard}
      onCancelCard={handleCancelCard}
      onLock={handleLock}
      revealAugurFor={revealAugurFor}
      onLeave={onMatchResult ? undefined : onQuit}
      onRematch={onMatchResult ? undefined : rematch}
      onNext={onMatchResult && end ? () => onMatchResult(end.winner === "a") : undefined}
    />
  );
}
