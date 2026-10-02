/**
 * Global leaderboard — read-only client of the game server's HTTP API.
 *
 * The board lives in Redis and is written exclusively server-side by the Rust
 * server after a real online-ranked match — so the ladder can't be faked from
 * the client. Reads go through the server too (`GET /leaderboard`,
 * `GET /leaderboard/rank/:id`): the app holds NO database token (a read-only
 * Upstash token can read every key of the database, not just the ladder).
 *
 * Nickname de-duplication and ranking are done server-side.
 */

import { normalizeServerUrl } from "./online";

export interface LeaderboardEntry {
  rank: number;
  id: string;
  nickname: string;
  lp: number;
}

/** `wss://host[/ws]` → `https://host` (the server serves HTTP on the same host). */
function httpBase(serverUrl: string): string {
  return normalizeServerUrl(serverUrl)
    .replace(/\/+$/, "")
    .replace(/\/ws$/, "")
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");
}

async function getJson<T>(serverUrl: string, path: string): Promise<T> {
  const res = await fetch(httpBase(serverUrl) + path, { cache: "no-store" });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return (await res.json()) as T;
}

/** True when a server URL is configured. */
export function leaderboardEnabled(serverUrl: string): boolean {
  return Boolean(serverUrl.trim());
}

/** Top players (server-capped at 100), highest LP first, already de-duplicated. */
export function fetchTop(serverUrl: string): Promise<LeaderboardEntry[]> {
  return getJson<LeaderboardEntry[]>(serverUrl, "/leaderboard");
}

/** The caller's own rank + LP, or null if they're not on the board yet. */
export async function fetchMyRank(
  serverUrl: string,
  id: string,
): Promise<{ rank: number; lp: number } | null> {
  if (!id) return null;
  return getJson<{ rank: number; lp: number } | null>(
    serverUrl,
    `/leaderboard/rank/${encodeURIComponent(id)}`,
  );
}
