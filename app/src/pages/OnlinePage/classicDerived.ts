/**
 * Valeurs dérivées (point de vue du joueur) du match Classique en ligne.
 * Fonction pure extraite verbatim d'OnlinePage.
 */
import type { MatchState } from "./types";

export function classicDerived(m: MatchState) {
  const youScore = m.youAre === "a" ? m.scoreA : m.scoreB;
  const oppScore = m.youAre === "a" ? m.scoreB : m.scoreA;
  const youMove =
    m.lastResult ? (m.youAre === "a" ? m.lastResult.aMove : m.lastResult.bMove) : null;
  const oppMove =
    m.lastResult ? (m.youAre === "a" ? m.lastResult.bMove : m.lastResult.aMove) : null;

  const outcomeForYou: "win" | "loss" | "draw" | null = m.lastResult
    ? m.lastResult.outcome.kind === "draw"
      ? "draw"
      : (m.lastResult.outcome.kind === "a_wins") === (m.youAre === "a")
      ? "win"
      : "loss"
    : null;
  const verb =
    m.lastResult && m.lastResult.outcome.kind !== "draw"
      ? m.lastResult.outcome.verb
      : null;
  return { youScore, oppScore, youMove, oppMove, outcomeForYou, verb };
}
