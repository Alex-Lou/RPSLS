/**
 * LeaderboardPage — global ranking (top 100 by LP) read live from Upstash.
 *
 * Read-only: the board is written server-side after real online-ranked
 * matches. Shows a clear "coming soon" state when not configured, an empty
 * state until the first results land, and highlights the player's own row.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "./store";
import { useT } from "./i18n";
import { rankFromLp } from "./rank";
import { avatarImgStyle } from "./avatar";
import {
  leaderboardEnabled,
  fetchTop,
  fetchMyRank,
  type LeaderboardEntry,
} from "./leaderboard";

export function LeaderboardPage() {
  const t = useT();
  const player = useStore((s) => s.player);
  const enabled = leaderboardEnabled();

  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [mine, setMine] = useState<{ rank: number; lp: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setError(false);
    setEntries(null);
    fetchTop(100)
      .then((e) => alive && setEntries(e))
      .catch(() => { if (alive) { setError(true); setEntries([]); } });
    fetchMyRank(player.id)
      .then((m) => alive && setMine(m))
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled, player.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-4 flex-1 min-h-0 py-2 px-1 max-w-lg mx-auto w-full"
    >
      {/* Title */}
      <div className="text-center shrink-0">
        <h1
          className="text-2xl sm:text-4xl font-extrabold tracking-tight text-themed leading-tight"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          🏆 {t("leaderboard.title")}
        </h1>
        <p className="mt-1 text-ink-muted text-xs sm:text-sm">{t("leaderboard.subtitle")}</p>
      </div>

      {/* Your rank pill */}
      {enabled && (
        <div
          className="shrink-0 rounded-2xl px-4 py-3 flex items-center justify-between bg-surface"
          style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg overflow-hidden shrink-0"
              style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 32%, transparent))" }}
            >
              {/^(data:|\/|https?:)/.test(player.avatar)
                ? <img src={player.avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(player.avatar)} />
                : <span>{player.avatar}</span>}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink truncate">{player.nickname}</div>
              <div className="text-[11px] text-ink-muted">
                {mine ? t("leaderboard.yourRank", { rank: mine.rank }) : t("leaderboard.unranked")}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-black text-themed tabular-nums">{(mine?.lp ?? player.rankLp)}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">LP</div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-zinc-950/40 border border-hairline">
        {!enabled ? (
          <Empty icon="🚧" text={t("leaderboard.soon")} />
        ) : entries === null ? (
          <Empty icon="⏳" text={t("leaderboard.loading")} />
        ) : error ? (
          <Empty icon="⚠️" text={t("leaderboard.error")} />
        ) : entries.length === 0 ? (
          <Empty icon="🌌" text={t("leaderboard.empty")} />
        ) : (
          <ul className="divide-y divide-white/5">
            {entries.map((e) => (
              <Row key={e.id} entry={e} isMe={e.id === player.id} />
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const tier = rankFromLp(entry.lp);
  const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
  return (
    <li
      className={"flex items-center gap-3 px-3 py-2.5 " + (isMe ? "bg-white/[0.06]" : "")}
      style={isMe ? { boxShadow: "inset 3px 0 0 var(--theme-primary)" } : undefined}
    >
      <div className="w-8 text-center shrink-0">
        {medal ? <span className="text-xl">{medal}</span>
               : <span className="text-sm font-bold text-ink-faint tabular-nums">{entry.rank}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className={"text-sm font-semibold truncate " + (isMe ? "text-white" : "text-ink")}>
          {entry.nickname}{isMe ? " ·" : ""}
        </div>
        <div className="text-[10px] uppercase tracking-wider flex items-center gap-1">
          <span>{tier.emoji}</span>
          <span className="text-ink-faint">{tier.label}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-black text-ink tabular-nums">{entry.lp}</span>
        <span className="text-[10px] text-ink-faint ml-1">LP</span>
      </div>
    </li>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
      <div className="text-4xl">{icon}</div>
      <p className="text-sm text-ink-muted max-w-xs leading-relaxed">{text}</p>
    </div>
  );
}
