//! TypeScript mirror of `crates/rpsls-server/src/protocol.rs`.
//! Keep both in sync.

import type { Move, Outcome } from "../engine/game";

/* ──────────── Wire types ──────────── */

export type PlayerSlot = "a" | "b";

export interface OpponentInfo {
  nickname: string;
}

/* ──────────── Constellation Lanes (Phase 1+) ──────────── */

/** One placement on one lane. Phase 1 only reads `mv`; `mana`/`modifier`
 *  are placeholders that the protocol already accepts so phase 2/5 won't
 *  require a wire bump. */
export interface LanePlay {
  mv: Move;
  mana?: number;
  modifier?: string | null;
}

export type LaneWinner = "a" | "b" | "draw";

export interface LaneResult {
  a_play: LanePlay;
  b_play: LanePlay;
  outcome: Outcome;
  winner: LaneWinner;
  points: number;
}

/** Subset of player state synced to the server for persistence. */
export interface PlayerProgress {
  xp: number;
  rankLp: number;
  eclats: number;
  dust: number;
  /** Premium currency balance (✦). Synced so unspent stars survive a reinstall
   *  — not just the owned sets. Optional for back-compat with older saves. */
  stars?: number;
  wins: number;
  losses: number;
  draws: number;
  cardCollection: string[];
  cardMastery: Record<string, number>;
  codexClaimed: number[];
  /** One-time quest claims (union-merged) so rewards can't be re-claimed after
   *  a reinstall. Optional for back-compat. */
  claimedQuests?: string[];
  rankedDeck: string[];
  /** Purchased premium sets — synced (union) so paid sets survive a reinstall. */
  ownedPremiumSets?: string[];
  seasonNumber: number;
  seasonStartedAt: number;
  winStreak: number;
  /** Classé (classic 1v1) own ladder + record — cloud-saved like the rest of
   *  the progression so it survives reinstall and follows the player across
   *  devices. Optional for back-compat with a server build that predates them
   *  (it simply omits the fields → client falls back to local). */
  classeLp?: number;
  classeWins?: number;
  classeLosses?: number;
  classeDraws?: number;
  updatedAt: number;
  // Cosmetic preferences (small) — synced so a reinstall restores the chosen
  // look. Optional for back-compat with older saves that lack them.
  themeId?: string;
  backgroundId?: string;
  padId?: string;
  avatar?: string;
  nickname?: string;
  // Gameplay / accessibility prefs — restored on a fresh install (adopted under
  // the same "vierge" gate as cosmetics). Optional for back-compat.
  difficulty?: string;
  fontScale?: number;
  padChosen?: boolean;
}

/* Client → Server */
export type ClientMessage =
  | { type: "hello"; nickname: string; player_id?: string; claim_token?: string }
  | { type: "create_lobby"; best_of: number }
  | { type: "join_lobby"; code: string }
  | { type: "join_queue"; best_of: number }
  | { type: "join_lanes_queue"; win_to: number }
  | { type: "cancel" }
  | { type: "play_move"; mv: Move }
  | { type: "play_lanes"; plays: LanePlay[] }
  | { type: "leave_match" }
  | { type: "chat"; emoji: string }
  | { type: "ping" }
  | { type: "request_rematch" }
  | { type: "respond_rematch"; accept: boolean }
  | { type: "sync_state"; state: PlayerProgress };

/* Server → Client */
export type ServerMessage =
  | { type: "welcome"; session_id: string }
  | { type: "lobby_created"; code: string; best_of: number }
  | { type: "queued"; position: number }
  | {
      type: "match_found";
      match_id: string;
      opponent: OpponentInfo;
      best_of: number;
      you_are: PlayerSlot;
    }
  | { type: "round_start"; round_no: number; deadline_ms: number }
  | {
      type: "round_result";
      round_no: number;
      a_move: Move;
      b_move: Move;
      outcome: Outcome;
      score_a: number;
      score_b: number;
    }
  | {
      type: "match_end";
      winner: PlayerSlot | null;
      score_a: number;
      score_b: number;
      forfeit: boolean;
    }
  | { type: "opponent_left" }
  | { type: "chat"; from: PlayerSlot; emoji: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong" }
  | { type: "rematch_offered" }
  | { type: "rematch_declined" }
  | { type: "state_loaded"; state: PlayerProgress; claim_token?: string }
  /* Lanes variants */
  | {
      type: "lanes_match_found";
      match_id: string;
      opponent: OpponentInfo;
      you_are: PlayerSlot;
      lanes: number;
      win_to: number;
    }
  | { type: "lanes_round_start"; round_no: number; deadline_ms: number }
  | {
      type: "lanes_round_result";
      round_no: number;
      a_plays: LanePlay[];
      b_plays: LanePlay[];
      lane_results: LaneResult[];
      a_points: number;
      b_points: number;
      round_wins_a: number;
      round_wins_b: number;
    }
  | {
      type: "lanes_match_end";
      winner: PlayerSlot | null;
      round_wins_a: number;
      round_wins_b: number;
      forfeit: boolean;
    };

/* ──────────── URL helpers ──────────── */

/** Normalize a user-typed URL into a complete ws://host:port URL.
 *  Accepts:
 *    "192.168.1.42"           → "ws://192.168.1.42:8080"
 *    "192.168.1.42:8080"      → "ws://192.168.1.42:8080"
 *    "ws://host:port"         → unchanged
 *    "wss://host"             → unchanged
 *    "https://host"           → "wss://host"
 *    "http://host:8080"       → "ws://host:8080"
 */
export function normalizeServerUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  if (raw.startsWith("https://")) return "wss://" + raw.slice("https://".length);
  if (raw.startsWith("http://")) return "ws://" + raw.slice("http://".length);
  // Bare host[:port] — assume LAN, ws, port 8080 if missing.
  const hasPort = /:\d+$/.test(raw);
  return "ws://" + (hasPort ? raw : raw + ":8080");
}

/* ──────────── Minimal WS client ──────────── */

export type Listener = (msg: ServerMessage) => void;

/** Backoff schedule (ms) for reconnection attempts after an unexpected drop.
 *  Three fast retries cover transient drops, then four longer ones cover the
 *  Render free-tier cold-start window (~30-90 s of dormant wake-up). Past the
 *  end we continue with exponential backoff (see `nextReconnectDelay`) so a
 *  flat-out outage doesn't permanently kill the client — we keep trying every
 *  few minutes until the server comes back. Every delay gets ±30% jitter so N
 *  clients hitting a cold-started server don't synchronise into a herd. */
const RECONNECT_DELAYS = [400, 1_200, 3_000, 8_000, 15_000, 30_000, 60_000];
/** Backoff base once RECONNECT_DELAYS is exhausted. Capped to ~16 min. */
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS  = 16 * 60_000;
function jitter(ms: number): number {
  return Math.round(ms * (0.7 + Math.random() * 0.6));
}
function nextReconnectDelay(attempt: number): number {
  if (attempt < RECONNECT_DELAYS.length) return jitter(RECONNECT_DELAYS[attempt]);
  const exp = attempt - RECONNECT_DELAYS.length;
  const raw = BACKOFF_BASE_MS * Math.pow(2, Math.min(exp, 4));
  return jitter(Math.min(raw, BACKOFF_MAX_MS));
}

export class OnlineClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private lastUrl: string | null = null;
  private reconnectAttempt = 0;
  /** Last seen connection state. */
  status: "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error" = "idle";
  onStatus?: (s: OnlineClient["status"]) => void;
  /** Called whenever a reconnect succeeds — callers should re-issue any
   *  state-setup messages (e.g. hello) since the server has lost the session. */
  onReconnect?: () => void;

  connect(url: string, openTimeoutMs = 60_000): Promise<void> {
    this.closedByUser = false;
    this.lastUrl = url;
    this.reconnectAttempt = 0;
    this.setStatus("connecting");
    return this.openSocket(url, openTimeoutMs);
  }

  private openSocket(url: string, openTimeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const normalized = normalizeServerUrl(url);
        if (!normalized) {
          this.setStatus("error");
          reject(new Error("empty server URL"));
          return;
        }
        const wsUrl = normalized.replace(/\/+$/, "") + "/ws";
        const ws = new WebSocket(wsUrl);
        this.ws = ws;
        let settled = false;
        const guard = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { ws.close(); } catch { /* ignore */ }
          this.setStatus("error");
          reject(new Error(`connect timeout (${openTimeoutMs / 1000}s)`));
        }, openTimeoutMs);
        ws.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          const wasReconnect = this.reconnectAttempt > 0;
          this.reconnectAttempt = 0;
          this.setStatus("open");
          // App-level keepalive every 25s.
          if (this.pingTimer) clearInterval(this.pingTimer);
          this.pingTimer = setInterval(() => this.send({ type: "ping" }), 25_000);
          if (wasReconnect) this.onReconnect?.();
          resolve();
        };
        ws.onerror = () => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          this.setStatus("error");
          reject(new Error("WebSocket error (server unreachable, firewall, or wrong URL)"));
        };
        ws.onclose = () => {
          if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
          }
          // Unexpected drop? Schedule a reconnect.
          if (!this.closedByUser && this.lastUrl) {
            this.scheduleReconnect(openTimeoutMs);
          } else {
            this.setStatus(this.closedByUser ? "closed" : "error");
          }
        };
        ws.onmessage = (ev) => {
          let parsed: ServerMessage | null = null;
          try {
            parsed = JSON.parse(ev.data as string) as ServerMessage;
          } catch {
            return;
          }
          this.listeners.forEach((l) => l(parsed!));
        };
      } catch (e) {
        this.setStatus("error");
        reject(e as Error);
      }
    });
  }

  private scheduleReconnect(openTimeoutMs: number) {
    if (!this.lastUrl) {
      this.setStatus("error");
      return;
    }
    // No hard "give up after N attempts" anymore — we just slow down. A
    // dormant Render instance may take 90 s to wake; an outage may take
    // minutes. Capping at 16 min between attempts keeps the radio quiet
    // while still recovering automatically when the server returns.
    const delay = nextReconnectDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUser || !this.lastUrl) return;
      this.openSocket(this.lastUrl, openTimeoutMs).catch(() => {
        // openSocket already set "error"; onclose will re-trigger schedule.
      });
    }, delay);
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.setStatus("closed");
  }

  private setStatus(s: OnlineClient["status"]) {
    this.status = s;
    this.onStatus?.(s);
  }
}
