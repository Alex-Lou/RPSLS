/**
 * arenaLog — lightweight structured logger for Constellation Pro.
 *
 * Designed to be readable in `adb logcat | grep arena` so Alex (and I) can
 * follow EXACTLY what happens turn-by-turn in a match without bumping into
 * UI guesses. Each line is one logical event, prefixed by `[arena:<cat>]`
 * so categories can be filtered (e.g. `grep arena:combat`).
 *
 * Toggle ARENA_LOG_ENABLED off before merge / release if logs become noisy.
 * Kept on during the v2 development cycle for diagnosis.
 */

/** Flip to false to silence ALL arena logs at once. */
const ARENA_LOG_ENABLED = true;

/** Short turn marker so the player can correlate the log against the
 *  on-screen turn counter. Updated from arenaRules.advanceToNextTurn. */
let currentTurn = 0;

export function alogSetTurn(turn: number): void {
  currentTurn = turn;
}

/** Generic log — `category` filters via `grep arena:<category>`. Args are
 *  joined with spaces, primitives stringified, objects JSON-stringified.
 *  Output is one line per call. */
export function alog(category: string, ...args: unknown[]): void {
  if (!ARENA_LOG_ENABLED) return;
  const parts = args.map((a) => {
    if (a === null || a === undefined) return String(a);
    if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") return String(a);
    try { return JSON.stringify(a); } catch { return "[unstringifiable]"; }
  });
  // eslint-disable-next-line no-console
  console.log(`[arena:${category}] T${currentTurn} ${parts.join(" ")}`);
}

/** Compact creature snapshot for log lines : "rock(a)1/3" / "scissors(b)4/1". */
export function csnap(c: { move: string; side: string; hp: number } | null | undefined): string {
  if (!c) return "∅";
  return `${c.move}(${c.side})${c.hp}HP`;
}

/** Compact lane snapshot for log lines : "L0:rock(a)1/3 vs scissors(b)4/1". */
export function lsnap(laneIdx: number, lane: { a: { move: string; side: string; hp: number } | null; b: { move: string; side: string; hp: number } | null }): string {
  return `L${laneIdx}:${csnap(lane.a)}vs${csnap(lane.b)}`;
}
