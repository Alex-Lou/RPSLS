/**
 * Global leaderboard — read-only client for the Upstash Redis REST API.
 *
 * The board is a Redis SORTED SET `leaderboard` (member = player.id, score =
 * LP) plus a hash `leaderboard:names` (player.id → nickname). The app only
 * ever READS it (this module ships a read-only token, which Upstash blocks
 * from writing). Entries are written exclusively server-side by the Rust
 * server after a real online-ranked match — so the ladder can't be faked from
 * the client.
 *
 * If the env vars aren't set (e.g. a fresh checkout without .env.local), the
 * whole feature is inert and the page shows a "coming soon" state.
 */

const URL = import.meta.env.VITE_UPSTASH_REDIS_REST_URL as string | undefined;
const TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_READONLY_TOKEN as string | undefined;

const KEY = "leaderboard";
const NAMES = "leaderboard:names";

/** True when the leaderboard is configured (URL + token present). */
export function leaderboardEnabled(): boolean {
  return Boolean(URL && TOKEN);
}

async function cmd<T>(command: (string | number)[]): Promise<T> {
  const res = await fetch(URL as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  nickname: string;
  lp: number;
}

/** Top-N players, highest LP first. */
export async function fetchTop(limit = 100): Promise<LeaderboardEntry[]> {
  const flat = await cmd<string[]>(["ZREVRANGE", KEY, "0", String(limit - 1), "WITHSCORES"]);
  if (!flat || flat.length === 0) return [];
  const ids: string[] = [];
  const lps: number[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    ids.push(flat[i]);
    lps.push(Number(flat[i + 1]));
  }
  let names: (string | null)[] = ids.map(() => null);
  try {
    names = await cmd<(string | null)[]>(["HMGET", NAMES, ...ids]);
  } catch {
    /* names hash missing → fall back to "Anonyme" */
  }
  return ids.map((id, i) => ({
    rank: i + 1,
    id,
    nickname: (names[i] && names[i]!.trim()) || "Anonyme",
    lp: lps[i],
  }));
}

/** The caller's own rank + LP, or null if they're not on the board yet. */
export async function fetchMyRank(id: string): Promise<{ rank: number; lp: number } | null> {
  if (!id) return null;
  const [rank, score] = await Promise.all([
    cmd<number | null>(["ZREVRANK", KEY, id]),
    cmd<string | null>(["ZSCORE", KEY, id]),
  ]);
  if (rank == null || score == null) return null;
  return { rank: rank + 1, lp: Number(score) };
}
