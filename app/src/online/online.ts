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

/* Client → Server */
export type ClientMessage =
  | { type: "hello"; nickname: string; player_id?: string }
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
  | { type: "respond_rematch"; accept: boolean };

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

/** Backoff schedule (ms) for reconnection attempts after an unexpected drop. */
const RECONNECT_DELAYS = [400, 1_200, 3_000];

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
    if (this.reconnectAttempt >= RECONNECT_DELAYS.length || !this.lastUrl) {
      this.setStatus("error");
      return;
    }
    const delay = RECONNECT_DELAYS[this.reconnectAttempt];
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
