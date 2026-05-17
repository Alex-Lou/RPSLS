//! TypeScript mirror of `crates/rpsls-server/src/protocol.rs`.
//! Keep both in sync.

import type { Move, Outcome } from "./game";

/* ──────────── Wire types ──────────── */

export type PlayerSlot = "a" | "b";

export interface OpponentInfo {
  nickname: string;
}

/* Client → Server */
export type ClientMessage =
  | { type: "hello"; nickname: string }
  | { type: "create_lobby"; best_of: number }
  | { type: "join_lobby"; code: string }
  | { type: "join_queue"; best_of: number }
  | { type: "cancel" }
  | { type: "play_move"; mv: Move }
  | { type: "leave_match" }
  | { type: "chat"; emoji: string }
  | { type: "ping" };

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
  | { type: "pong" };

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

export class OnlineClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  /** Last seen connection state. */
  status: "idle" | "connecting" | "open" | "closed" | "error" = "idle";
  onStatus?: (s: OnlineClient["status"]) => void;

  connect(url: string): Promise<void> {
    this.closedByUser = false;
    this.setStatus("connecting");
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
        ws.onopen = () => {
          this.setStatus("open");
          // App-level keepalive every 25s.
          this.pingTimer = setInterval(() => this.send({ type: "ping" }), 25_000);
          resolve();
        };
        ws.onerror = () => {
          this.setStatus("error");
          reject(new Error("ws error"));
        };
        ws.onclose = () => {
          if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
          }
          this.setStatus(this.closedByUser ? "closed" : "error");
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
