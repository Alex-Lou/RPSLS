/**
 * arenaLog — in-memory structured log buffer for Constellation Pro.
 *
 * Replaces the previous `console.log → adb logcat` flow which lost lines
 * under load (Alex feedback "logs perdus, suivi en retard"). Now :
 *  - logs are pushed into a bounded in-memory ring buffer
 *  - subscribers (React components) are notified on every push
 *  - a debug overlay inside the app reads the buffer live, no Android
 *    logcat in the loop → zero drops, zero latency
 *  - console.log is STILL called as a fallback so `adb logcat` works too
 *    when needed, but the in-app panel is the canonical source.
 *
 * Each entry is ONE LOGICAL EVENT (a verdict, not a play-by-play dump),
 * so the panel stays readable across a long match.
 */

const ARENA_LOG_ENABLED = true;
const MAX_BUFFER = 250;

export interface ArenaLogEntry {
  ts: number;
  turn: number;
  category: string;
  msg: string;
}

const buffer: ArenaLogEntry[] = [];
const listeners = new Set<() => void>();
let currentTurn = 0;

export function alogSetTurn(turn: number): void {
  currentTurn = turn;
}

/** Push a single event into the buffer + notify subscribers. */
export function alog(category: string, ...args: unknown[]): void {
  if (!ARENA_LOG_ENABLED) return;
  const parts = args.map((a) => {
    if (a === null || a === undefined) return String(a);
    if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") return String(a);
    try { return JSON.stringify(a); } catch { return "[?]"; }
  });
  const msg = parts.join(" ");
  const entry: ArenaLogEntry = { ts: Date.now(), turn: currentTurn, category, msg };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  for (const cb of Array.from(listeners)) cb();
  // Console line for `adb logcat | grep arena:` (fallback offline diag).
  // eslint-disable-next-line no-console
  console.log(`[arena:${category}] T${currentTurn} ${msg}`);
  // Expose buffer on window so I can query it from DevTools via
  // `adb forward tcp:9222 ...` + Runtime.evaluate when live-tailing
  // remotely. Tauri WebView Chromium exposes window like a browser.
  if (typeof window !== "undefined") {
    (window as unknown as { __arenaLogs__?: ArenaLogEntry[] }).__arenaLogs__ = buffer;
  }
}

/** Snapshot of the current buffer — returned as a NEW array so callers
 *  can freely sort / slice without mutating the buffer. */
export function arenaLogSnapshot(): ArenaLogEntry[] {
  return buffer.slice();
}

/** Subscribe to log mutations — used by useSyncExternalStore or
 *  the legacy useEffect+listener pattern in ArenaDebugOverlay. */
export function arenaLogSubscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Wipe the buffer (called at match start so each match has a clean log). */
export function arenaLogReset(): void {
  buffer.length = 0;
  currentTurn = 0;
  for (const cb of Array.from(listeners)) cb();
}

/** Compact creature snapshot : "rock(a)3HP". */
export function csnap(c: { move: string; side: string; hp: number } | null | undefined): string {
  if (!c) return "∅";
  return `${c.move}(${c.side})${c.hp}HP`;
}
