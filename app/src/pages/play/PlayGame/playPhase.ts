import type { Move, RoundResult } from "../../../engine/game";

/** Phases du match libre (extrait de PlayGame.tsx). */
export type Phase =
  | { kind: "atout-select" }
  | { kind: "p1-pick" }
  | { kind: "pass"; p1Move: Move }
  | { kind: "p2-pick"; p1Move: Move }
  | { kind: "countdown"; aMove: Move; bMove: Move }
  | { kind: "reveal"; round: RoundResult; matchOver: boolean; atoutNote?: string }
  | { kind: "match-end" };

