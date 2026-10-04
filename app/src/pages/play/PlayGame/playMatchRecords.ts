import { target, type AiMood, type MatchState } from "../../../engine/game";
import { REWARDS, type GameMode, type MatchRecord, type Opponent, type Outcome } from "../../../types";

/** Construction PURE des MatchRecord du jeu libre (forfait / fin de match),
 *  extraite VERBATIM de PlayGame.tsx — même ordre de calcul (id, horodatage). */

interface RecordCtx {
  match: MatchState;
  mode: GameMode;
  bestOf: number;
  mood: AiMood;
  isHotseat: boolean;
}

/** Abandon en cours de match → défaite par forfait. */
export function buildForfeitRecord({ match, mode, bestOf, mood, isHotseat }: RecordCtx): MatchRecord {
  const tgt = target(match);
  const opponent: Opponent = isHotseat
    ? { kind: "human", nickname: "Guest" }
    : { kind: "cpu", mood };
  const r = REWARDS[mode];
  const rec: MatchRecord = {
    id:
      globalThis.crypto && "randomUUID" in globalThis.crypto
        ? (globalThis.crypto as Crypto).randomUUID()
        : `${Date.now()}-${Math.random()}`,
    mode,
    bestOf,
    opponent,
    scorePlayer: match.scoreA,
    // Treat the opponent as crossing the finish line — that's what a
    // forfeit means in the match history.
    scoreOpponent: tgt,
    outcome: "loss",
    rounds: match.history.map((rd) => ({
      playerMove: rd.move_a,
      opponentMove: rd.move_b,
      result:
        rd.outcome.kind === "a_wins"
          ? "win"
          : rd.outcome.kind === "b_wins"
          ? "loss"
          : "draw",
    })),
    // No XP from forfeits (you don't get rewarded for bailing).
    xpDelta: 0,
    // Ranked still pays the loss penalty so players can't ditch to dodge LP.
    lpDelta: r.lpLoss,
    timestamp: Date.now(),
    forfeit: true,
  };
  return rec;
}

/** Fin de match normale (issue + XP/LP déjà calculés par l'appelant). */
export function buildMatchEndRecord(
  { match, mode, bestOf, mood, isHotseat }: RecordCtx,
  outcome: Outcome, xpDelta: number, lpDelta: number,
): MatchRecord {
  const opponent: Opponent = isHotseat
    ? { kind: "human", nickname: "Guest" }
    : { kind: "cpu", mood };

  const rec: MatchRecord = {
    id:
      (globalThis.crypto && "randomUUID" in globalThis.crypto
        ? (globalThis.crypto as Crypto).randomUUID()
        : `${Date.now()}-${Math.random()}`),
    mode,
    bestOf,
    opponent,
    scorePlayer: match.scoreA,
    scoreOpponent: match.scoreB,
    outcome,
    rounds: match.history.map((r) => ({
      playerMove: r.move_a,
      opponentMove: r.move_b,
      result:
        r.outcome.kind === "a_wins"
          ? "win"
          : r.outcome.kind === "b_wins"
          ? "loss"
          : "draw",
    })),
    xpDelta,
    lpDelta,
    timestamp: Date.now(),
  };
  return rec;
}
