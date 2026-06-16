import type { Move } from "../../engine/game";
import type { PlayerSlot } from "../../online/online";

export type Phase =
  | "menu"
  | "connecting"
  | "creating"
  | "lobby_open"   // we created a lobby, waiting for joiner
  | "joining"
  | "queued"
  | "matched"
  | "round"
  | "reveal"
  | "match_end"
  | "lanes_prep"   // Pre-match prep + coin flip with double "Je suis prêt"
  | "lanes_match"  // Constellation Lanes match in progress (LanesMatchView)
  | "lanes_bot"    // Local CPU fallback for Lanes (no opponent found / offline)
  | "error";

/** How long we look for a real opponent before dropping into a bot match. */
/** Wait this long for a real opponent before quietly offering a CPU fallback.
 *  Bumped from 10s — Alex's point: if we swap to a bot too fast, the player
 *  never *feels* like they're meeting humans, the queue never has time to
 *  fill, and the real-player base never gets to build itself. 25s gives the
 *  system a real chance to pair two humans across the world before defaulting. */
export const QUEUE_BOT_TIMEOUT_MS = 25_000;

/** Believable opponent handles for the practice-bot fallback. */
export const BOT_NAMES = ["Nova", "Blitz", "Echo", "Vortex", "Cipher", "Riot", "Saber", "Quasar"];

export interface MatchState {
  matchId: string;
  opponent: string;
  bestOf: number;
  youAre: PlayerSlot;
  scoreA: number;
  scoreB: number;
  roundNo: number;
  deadlineMs: number;
  myMove: Move | null;
  lastResult: null | {
    aMove: Move;
    bMove: Move;
    outcome: { kind: "draw" } | { kind: "a_wins"; verb: string } | { kind: "b_wins"; verb: string };
  };
  ended: null | { winner: PlayerSlot | null; forfeit: boolean };
}

export type ConnStatus = "idle" | "checking" | "waking" | "online" | "offline";

export function emptyMatch(): MatchState {
  return {
    matchId: "",
    opponent: "",
    bestOf: 3,
    youAre: "a",
    scoreA: 0,
    scoreB: 0,
    roundNo: 0,
    deadlineMs: 10_000,
    myMove: null,
    lastResult: null,
    ended: null,
  };
}
