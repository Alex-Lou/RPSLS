import type { LanePlay, LaneResult, PlayerSlot } from "../../online/online";
import type { Move } from "../../engine/game";

export interface LanesMatchInfo {
  matchId: string;
  opponent: string;
  youAre: PlayerSlot;
  lanes: number;
  winTo: number;
}

export interface LanesRoundData {
  no: number;
  deadlineMs: number;
  startedAt: number;
}

export interface LanesRoundResultData {
  yourPlays: LanePlay[];
  oppPlays: LanePlay[];
  laneResults: LaneResult[];
  yourPoints: number;
  oppPoints: number;
  roundWinsYou: number;
  roundWinsOpp: number;
}

export interface LanesEndData {
  winner: PlayerSlot | null;
  roundWinsYou: number;
  roundWinsOpp: number;
  forfeit: boolean;
  /** Boutique éclats granted by the store on this match end (animated as
   *  a +N 💎 counter in the cinematic). Caller computes via eclatsReward()
   *  so the wrapper stays mode-agnostic. */
  eclatsGained?: number;
}

/**
 * Internal UI phase derived from the props the parent provides. Kept here so
 * the parent doesn't have to know about reveal countdowns and submit states.
 */
export type Phase =
  | "matched"        // splash visible, waiting for first round_start
  | "picking"        // round_start → user can choose lanes
  | "submitted"      // user picks locked, waiting for opponent
  | "reveal_intro"   // 1.4s suspense "Rock-Paper-Scissors-SHOOT"
  | "reveal"         // showing the verdict
  | "match_end";

export interface LanesMatchViewProps {
  /** Player's own nickname for the score header. */
  nickname: string;
  /** Match metadata (provided as soon as lanes_match_found arrives). */
  match: LanesMatchInfo;
  /** Current round details (null between rounds / before the first one). */
  round: LanesRoundData | null;
  /** Most recent resolved round (null until at least one round has finished). */
  lastResult: LanesRoundResultData | null;
  /** Match-end payload (null until the server says it's over). */
  end: LanesEndData | null;
  /** Locked-in marker — the parent stores whether *we* have already submitted
   *  picks for the current round. */
  submitted: boolean;
  /** Called when the user locks their 3 picks. */
  onSubmitPicks: (picks: [Move, Move, Move]) => void;
  /** Forfeit / back to menu. */
  onLeave: () => void;
  /** Show the pick countdown. Online (vs real players) keeps it; solo vs CPU
   *  passes false so there's no time pressure and no move played for you. */
  showTimer?: boolean;
  /** Competitive context (online) → mid-match quit triggers the escalating
   *  rankLp abandon penalty. Casual (solo vs CPU) passes false so a local
   *  forfeit doesn't move the ladder. Default true (rétro-compat online). */
  competitive?: boolean;
}
