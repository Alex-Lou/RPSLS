/**
 * ArenaDebugOverlay — in-app log panel for diagnosing Constellation Pro
 * matches without relying on adb logcat (which dropped lines under load).
 *
 * UX:
 *  - Floating "🐛 N" button bottom-right of the match screen, always visible.
 *  - Counter shows the number of events in the buffer at a glance.
 *  - Tap → slides up a bottom-sheet panel with the last 250 events, newest
 *    on top. Each line is timestamped (relative to match start), turn-
 *    labelled, category-coloured.
 *  - Tap a category chip at the top to filter by category (turn / summon
 *    / spell / combat / hero). Tap "🗑 Reset" to clear the buffer (start
 *    of a new investigation).
 *  - Tap the floating button while open closes the panel.
 *
 * Logs are formatted by their producers in arenaRules / arenaCardEffects.
 * This component is read-only — it doesn't mutate, just renders.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { arenaLogSnapshot, arenaLogSubscribe, arenaLogReset, type ArenaLogEntry } from "./arenaLog";

const CATEGORY_COLOR: Record<string, string> = {
  turn:   "bg-violet-500/30 text-violet-100 border-violet-400/60",
  summon: "bg-emerald-500/30 text-emerald-100 border-emerald-400/60",
  spell:  "bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/60",
  combat: "bg-amber-500/30 text-amber-100 border-amber-400/60",
  hero:   "bg-rose-500/30 text-rose-100 border-rose-400/60",
  // Default tone for anything else
  _:      "bg-zinc-500/30 text-zinc-100 border-zinc-400/60",
};

const ALL_CATEGORIES = ["turn", "summon", "spell", "combat", "hero"] as const;

export function ArenaDebugOverlay() {
  const [logs, setLogs] = useState<ArenaLogEntry[]>(() => arenaLogSnapshot());
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  // Subscribe to log mutations — re-snapshot on every push so the panel
  // stays live without polling.
  useEffect(() => {
    return arenaLogSubscribe(() => setLogs(arenaLogSnapshot()));
  }, []);
  const matchStart = logs[0]?.ts ?? Date.now();
  const filtered = filter ? logs.filter((e) => e.category === filter) : logs;
  // Newest first inside the panel.
  const display = filtered.slice().reverse();

  return (
    <>
      {/* Floating bug button — déplacé EN BAS À DROITE au-dessus des nav
       *  Android (Alex 2026-06-11 : "ne pas empiéter sur l'UI/UX"). Utilise
       *  safe-area-inset-bottom + 3rem de clearance. */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed right-2.5 z-[9998] inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-emerald-200 text-[10px] font-black shadow-lg backdrop-blur active:scale-95"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 3.5rem)" }}
        aria-label="Logs match"
      >
        🐛 <span className="tabular-nums">{logs.length}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="arena-debug"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-[9999] max-h-[70vh] flex flex-col rounded-t-2xl bg-zinc-950/97 border-t border-zinc-700 shadow-2xl backdrop-blur"
          >
            {/* Header — title + reset + close */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800">
              <span className="text-[11px] uppercase tracking-[0.2em] font-black text-emerald-300">
                🐛 Logs — {logs.length} events
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={arenaLogReset}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-rose-600/30 text-rose-100 border border-rose-500/50 active:scale-95"
                >
                  🗑 Reset
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[14px] font-black px-2 text-zinc-400 hover:text-white"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Category filter row */}
            <div className="shrink-0 flex flex-wrap gap-1 px-3 py-1.5 border-b border-zinc-800">
              <FilterChip active={filter === null} onClick={() => setFilter(null)} label="Tous" tone="_" />
              {ALL_CATEGORIES.map((cat) => (
                <FilterChip
                  key={cat}
                  active={filter === cat}
                  onClick={() => setFilter(cat)}
                  label={cat}
                  tone={cat}
                />
              ))}
            </div>

            {/* Log list — scrollable, newest first */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1">
              {display.length === 0 && (
                <div className="text-center text-[11px] text-zinc-500 italic py-6">
                  Pas encore d'events {filter ? `dans la catégorie "${filter}"` : ""}.
                </div>
              )}
              {display.map((e, i) => {
                const t = ((e.ts - matchStart) / 1000).toFixed(1);
                const color = CATEGORY_COLOR[e.category] ?? CATEGORY_COLOR._;
                return (
                  <div key={i} className="flex items-baseline gap-1.5 text-[11px] leading-snug font-mono">
                    <span className="text-zinc-500 tabular-nums shrink-0 w-12 text-right">
                      {t}s
                    </span>
                    <span className="text-zinc-500 tabular-nums shrink-0 w-7">
                      T{e.turn}
                    </span>
                    <span className={"shrink-0 px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border " + color}>
                      {e.category}
                    </span>
                    <span className="text-zinc-100 break-all">{e.msg}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FilterChip({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone: string }) {
  const color = CATEGORY_COLOR[tone] ?? CATEGORY_COLOR._;
  return (
    <button
      onClick={onClick}
      className={
        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition " +
        (active ? color + " ring-2 ring-amber-300/60" : "bg-zinc-800/60 text-zinc-400 border-zinc-700 opacity-70")
      }
    >
      {label}
    </button>
  );
}
