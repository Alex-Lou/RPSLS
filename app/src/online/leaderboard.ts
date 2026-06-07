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

/** Top-N players, highest LP first.
 *
 *  De-duplicated by nickname: the same physical player can hold more than one
 *  `player.id` (e.g. an old id orphaned by a reinstall that predates the
 *  durable anchor). Without collapsing, that person shows up several times on
 *  the ladder with the same name — exactly the "doublons" we never want. We
 *  keep the HIGHEST-LP entry per nickname and re-rank. (Two genuinely distinct
 *  players sharing a nickname is possible but rare at this game's scale; the
 *  higher score wins the row — an acceptable trade for a clean board.)
 *
 *  We over-fetch (3×) so that after collapsing duplicates we still surface
 *  ~limit distinct players. */
export async function fetchTop(limit = 100): Promise<LeaderboardEntry[]> {
  const fetchN = Math.min(limit * 3, 500);
  const flat = await cmd<string[]>(["ZREVRANGE", KEY, "0", String(fetchN - 1), "WITHSCORES"]);
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
  // Collapse same-nickname duplicates, keeping the highest-LP id. ZREVRANGE is
  // already LP-desc, so the FIRST time we see a nickname is its best entry.
  const byNick = new Map<string, { id: string; nickname: string; lp: number }>();
  for (let i = 0; i < ids.length; i++) {
    const nickname = (names[i] && names[i]!.trim()) || "Anonyme";
    const key = nickname.toLowerCase();
    if (!byNick.has(key)) byNick.set(key, { id: ids[i], nickname, lp: lps[i] });
  }
  return [...byNick.values()]
    .sort((a, b) => b.lp - a.lp)
    .slice(0, limit)
    .map((e, i) => ({ rank: i + 1, id: e.id, nickname: e.nickname, lp: e.lp }));
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
