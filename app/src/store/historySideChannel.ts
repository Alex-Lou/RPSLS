import type { MatchRecord } from "../types";
import { useStore } from "./store";

/** localStorage key for the history side-channel (kept out of the main
 *  rpsls-app-state blob — see partialize in persistConfig.ts). */
export const HISTORY_STORAGE_KEY = "rpsls-history";
/** Maximum delay between a recordMatch and the corresponding history flush.
 *  2 s is short enough that an app kill never loses more than the last
 *  match, long enough that a 5-burst (match end → reward → streak →
 *  mastery → quest claim) collapses into a single write. */
const HISTORY_FLUSH_DELAY_MS = 2_000;

let _historyFlushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleHistoryFlush() {
  if (_historyFlushTimer) return;
  _historyFlushTimer = setTimeout(() => {
    _historyFlushTimer = null;
    try {
      const h = useStore.getState().history;
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(h));
    } catch {
      // Quota exceeded or storage disabled — silently drop. The in-memory
      // history is still correct for the live session.
    }
  }, HISTORY_FLUSH_DELAY_MS);
}

/** Wire the debounced history persistence to the store. MUST be called once,
 *  AFTER `useStore` exists (see store.ts) — ES module imports are hoisted, so a
 *  for-effect import could not guarantee this ordering; an explicit call can. */
export function initHistorySideChannel() {
  // Subscribe once: every change to history schedules a debounced flush.
  // Same-tick bursts collapse into one write.
  {
    let lastRef: MatchRecord[] | null = null;
    useStore.subscribe((s) => {
      if (s.history !== lastRef) {
        lastRef = s.history;
        scheduleHistoryFlush();
      }
    });
  }

  // Best-effort final flush on pagehide — covers the "user kills the app
  // during the 2 s debounce window" case without blocking the close path.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      if (!_historyFlushTimer) return;
      clearTimeout(_historyFlushTimer);
      _historyFlushTimer = null;
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(useStore.getState().history));
      } catch { /* ignore */ }
    });
  }
}
