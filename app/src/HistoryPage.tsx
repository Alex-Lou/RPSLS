import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { MODE_META } from "./types";
import type { MatchRecord, RecordMode, Outcome } from "./types";
import { MOVE_META, AI_MOOD_META } from "./game";
import { useT } from "./i18n";

const FILTERS: Array<{ id: "all" | RecordMode; label: string }> = [
  { id: "all",           label: "All" },
  { id: "online",        label: "Online" },
  { id: "constellation", label: "Constellation" },
  { id: "casual",        label: "Casual" },
  { id: "ranked",        label: "Ranked" },
  { id: "training",      label: "Training" },
  { id: "hotseat",       label: "Hot-seat" },
];

export function HistoryPage() {
  const t = useT();
  const history = useStore((s) => s.history);
  const [filter, setFilter] = useState<"all" | RecordMode>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === "all" ? history : history.filter((m) => m.mode === filter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-5 pt-2 pb-6 md:p-6 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight">{t("nav.history")}</h1>
        <span className="text-sm text-ink-faint">{history.length} match{history.length === 1 ? "" : "es"}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={
              "px-3 py-1.5 rounded-full text-xs font-medium border transition " +
              (filter === f.id
                ? "bg-hairline border-white/30 text-white"
                : "bg-hairline border-hairline text-ink-muted hover:text-white hover:border-white/30")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-hairline rounded-3xl p-10 text-center">
          <p className="text-ink-muted">No matches yet.</p>
          <p className="text-xs text-ink-faint mt-1">Play your first round to see it here.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {filtered.map((m) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Row
                  match={m}
                  isOpen={expanded === m.id}
                  onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
  );
}

function Row({
  match, isOpen, onToggle,
}: { match: MatchRecord; isOpen: boolean; onToggle: () => void }) {
  const outcomeColor = outcomeClass(match.outcome);
  const oppLabel =
    match.opponent.kind === "cpu"
      ? `CPU ${AI_MOOD_META[match.opponent.mood].emoji}`
      : match.opponent.nickname;

  return (
    <div className="bg-surface border border-hairline rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-hairline transition text-left"
      >
        <span className={
          "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 " +
          outcomeColor.bg
        }>
          {MODE_META[match.mode].emoji}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={"text-sm font-bold uppercase tracking-wider " + outcomeColor.text}>
              {match.outcome}
            </span>
            {match.forfeit && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-0.5"
                title="Forfeit — match abandoned mid-way"
              >
                🏳️ Forfeit
              </span>
            )}
            <span className="text-ink-faint text-xs">·</span>
            <span className="text-xs text-ink-muted">{MODE_META[match.mode].label}</span>
            <span className="text-ink-faint text-xs">·</span>
            <span className="text-xs text-ink-muted">vs {oppLabel}</span>
          </div>
          <div className="text-xs text-ink-faint mt-0.5">
            {match.scorePlayer} — {match.scoreOpponent} · BO{match.bestOf} · {ago(match.timestamp)}
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          {match.xpDelta !== 0 && (
            <span className={
              "text-xs font-semibold px-2 py-0.5 rounded-full " +
              (match.xpDelta > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-500/20 text-ink-muted")
            }>
              {match.xpDelta > 0 ? "+" : ""}{match.xpDelta} XP
            </span>
          )}
          {match.lpDelta !== 0 && (
            <span className={
              "text-xs font-semibold px-2 py-0.5 rounded-full " +
              (match.lpDelta > 0 ? "bg-rose-500/20 text-rose-300" : "bg-rose-500/30 text-rose-200")
            }>
              {match.lpDelta > 0 ? "+" : ""}{match.lpDelta} LP
            </span>
          )}
        </div>

        <span className={"text-ink-faint transition-transform " + (isOpen ? "rotate-90" : "")}>
          ›
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline p-4 grid gap-2">
              {match.rounds.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm bg-hairline rounded-xl px-3 py-2"
                >
                  <span className="text-xs text-ink-faint w-8">R{i + 1}</span>
                  <span className="capitalize flex-1 text-ink">
                    {MOVE_META[r.playerMove].label}
                  </span>
                  <span className="text-xs text-ink-faint italic">vs</span>
                  <span className="capitalize flex-1 text-right text-ink">
                    {MOVE_META[r.opponentMove].label}
                  </span>
                  <span className={"text-xs font-bold uppercase " + outcomeClass(r.result).text}>
                    {r.result}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function outcomeClass(o: Outcome) {
  return o === "win"
    ? { bg: "bg-emerald-500/20", text: "text-emerald-300" }
    : o === "loss"
    ? { bg: "bg-rose-500/20",    text: "text-rose-300" }
    : { bg: "bg-zinc-500/20",    text: "text-ink-muted" };
}

function ago(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60)        return `${s}s ago`;
  if (s < 3600)      return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)     return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
