import type { Move } from "../engine/game";
import type { LaneResult, PlayerSlot } from "../online/online";
import type { CardId, LaneTarget, PlayedCard, RoundBonusBreakdown } from "./rankedTypes";

/* Types publics de RankedMatchView (extraits VERBATIM ; réexportés par
 * RankedMatchView.tsx pour les importeurs existants). */

/* ──────────── Public surface ──────────── */

export interface RankedMatchInfo {
  matchId: string;
  opponent: string;
  youAre: PlayerSlot;
  lanes: number;
  winTo: number;
}

export interface RankedRoundData {
  no: number;
  deadlineMs: number;
  startedAt: number;
}

export interface RankedRoundResultData {
  yourPicks: [Move, Move, Move];
  oppPicks: [Move, Move, Move];
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  laneResults: LaneResult[];
  bonuses: RoundBonusBreakdown;
  roundWinner: "a" | "b" | "draw";
  yourTotal: number;
  oppTotal: number;
  roundWinsYou: number;
  roundWinsOpp: number;
}

export interface RankedEndData {
  winner: PlayerSlot | null;
  roundWinsYou: number;
  roundWinsOpp: number;
  forfeit: boolean;
  /** XP awarded for this match — shown as an animated reward on the end screen. */
  xpGained?: number;
  /** Boutique éclats granted on this match end — same logic as LanesEndData. */
  eclatsGained?: number;
  /** Every card the player played during the match — fed into a "Cartes
   *  utilisées" recap below the cinematic so the player gradually learns
   *  the cards by reading them in context, no rulebook open. */
  youCardsPlayed?: CardId[];
  /** Same on the opponent side — visible to the player so they understand
   *  what was thrown at them and can plan a counter next time. */
  oppCardsPlayed?: CardId[];
}

export interface RankedMatchViewProps {
  nickname: string;
  match: RankedMatchInfo;
  round: RankedRoundData | null;
  lastResult: RankedRoundResultData | null;
  end: RankedEndData | null;
  // Round-time state
  picks: [Move | null, Move | null, Move | null];
  cardPlayed: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  mana: number;
  /** Mana ceiling for the pip display — 5 with Cadence, else 4. */
  manaMax?: number;
  /** Equipped passive cards — shown as an always-on strip in the pick phase. */
  passives?: CardId[];
  /** Braise (Ember) stacks — discount in mana on the next card played. */
  braiseStacks?: number;
  /** Cross-round V3 effects gathered for the chip strip. Each field corresponds
   *  to one card's pending/active state; the pick phase renders a chip per
   *  truthy field so the player SEES what's queued for next round. */
  activeEffects?: {
    mascaradePoison: boolean;
    bonusManaNext: number;
    cascadeArmed: boolean;
    echoActive: boolean;
    anchorRoundsLeft: number;
    gaiaCharged: boolean;
  };
  /** Boussole (Phare) reveal: opp card scheduled for THIS round — `lane` is
   *  null if the card has no lane target; `cardId` names the card so the chip
   *  can say "Adv jouera Surge → lane 2". */
  compassRevealed?: { lane: LaneTarget | null; cardId?: CardId } | null;
  /** Oracle / Télépathie reveal: opponent's 3 moves shown face-up during pick. */
  oracleRevealed?: [Move, Move, Move] | null;
  /** Oracle Inverse reveal: 3 cards peeked from the opponent's notional hand. */
  oppHandRevealed?: CardId[] | null;
  hand: CardId[];
  oppHandSize: number;
  // Actions
  onPickMove: (mv: Move) => void;
  onClearLane: (lane: LaneTarget) => void;
  onPlayCard: (card: PlayedCard) => void;
  onCancelCard: () => void;
  onLock: () => void;
  revealAugurFor: (lane: LaneTarget) => Move;
  /** Persistent round-win counts — never resets between rounds. */
  roundWinsYou: number;
  roundWinsOpp: number;
  /** Rounds remaining before Augur/Oracle can be played. 0 = available. */
  augurCooldown: number;
  onLeave?: () => void;
  onRematch?: () => void;
  /** Tournament flow: "Suivant" button after match end. */
  onNext?: () => void;
  /** Show the pick countdown. Ranked vs CPU passes false (no time pressure,
   *  no move auto-played for you). */
  showTimer?: boolean;
}
