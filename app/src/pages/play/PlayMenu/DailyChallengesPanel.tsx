import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../../../store/store";
import { useT } from "../../../i18n";
import { InlineBurger } from "../../../ui/ModeLobbyShell";
import {
  todayDailyQuests,
  matchesToday,
  todayDateKey,
  type DailyQuestDef,
} from "../../../engine/daily";
import type { GameMode } from "../../../types";

/* ─────────── Daily Banner ─────────── */

/**
 * Daily challenges (#17) — a button showing today's claim count that opens a
 * modal listing the 3 daily objectives. Each one shows live progress (read from
 * today's recorded matches), a "Claim" button once complete (XP lands in the
 * header bar) and a "Play" button that routes to the right mode / matchmaking.
 */
export function DailyChallengesPanel({
  onStart, onGoOnline, onGoConstellation,
}: {
  onStart: (mode: GameMode, bestOf: number, questCtx?: { title: string; reward: number }) => void;
  onGoOnline?: () => void;
  onGoConstellation?: (winTo: number) => void;
}) {
  const t = useT();
  const history = useStore((s) => s.history);
  const player = useStore((s) => s.player);
  const claimDailyQuest = useStore((s) => s.claimDailyQuest);
  const [open, setOpen] = useState(false);

  const quests = useMemo(() => todayDailyQuests(), []);
  const today = useMemo(() => matchesToday(history), [history]);
  const todayKey = todayDateKey();
  const claimedIds =
    player.dailyClaims && player.dailyClaims.date === todayKey ? player.dailyClaims.ids : [];

  const states = quests.map((q) => {
    const raw = q.progress(today, player);
    return {
      q,
      value: Math.min(raw, q.target),
      complete: raw >= q.target,
      claimed: claimedIds.includes(q.id),
    };
  });
  const claimable = states.filter((s) => s.complete && !s.claimed).length;
  const claimedCount = states.filter((s) => s.claimed).length;

  function play(q: DailyQuestDef) {
    setOpen(false);
    const r = q.route;
    if (r.kind === "mode") onStart(r.mode, r.bestOf, { title: t(`daily.${q.id}.title`), reward: q.xpReward });
    else if (r.kind === "constellation") onGoConstellation?.(2);
    else onGoOnline?.();
  }

  return (
    <>
      {/* Rangée Défi du jour = [burger themed inline] + [bulle flex-1].
       *  Le burger flottant global est masqué sur cet écran (ModeSelect →
       *  setBurgerHidden) : ici il vit DANS le flux, aux couleurs du thème
       *  (color-mix var(--theme-*), OK WebView), et ouvre le même drawer.
       *  La carte joueur reprend ainsi TOUTE la largeur en haut. */}
      <div className="flex items-stretch gap-2">
        {/* Burger themed PARTAGÉ (ui/ModeLobbyShell) — même composant que les
         *  lobbies de mode, zéro redondance. */}
        <InlineBurger className="md:hidden w-12" />
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setOpen(true)}
          className="flex-1 min-w-0 rounded-xl p-2.5 sm:p-4 border flex items-center gap-3 text-left bg-surface-raised bg-gradient-to-br from-amber-500/25 via-orange-500/14 to-transparent border-amber-400/50 shadow-md shadow-amber-900/20"
        >
          <div className="text-xl sm:text-3xl shrink-0">🎯</div>
          <div className="flex-1 min-w-0">
            {/* Texte agrandi (Alex 2026-06-12 #3). */}
            <div className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-amber-300 leading-tight">
              {t("play.daily.title")}
            </div>
            <div className="text-sm sm:text-lg font-bold leading-tight">
              {claimedCount}/{quests.length} ✓
            </div>
          </div>
          {claimable > 0 ? (
            <span className="shrink-0 px-2 py-1 rounded-full bg-amber-400 text-zinc-900 text-[10px] sm:text-xs font-black">
              {t("quests.toClaim", { n: claimable })}
            </span>
          ) : (
            <span className="shrink-0 text-amber-300 text-lg">›</span>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface-raised border border-hairline rounded-3xl p-5 shadow-2xl flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-black tracking-tight bg-gradient-to-br from-amber-300 to-orange-400 bg-clip-text text-transparent">
                  🎯 {t("play.daily.title")}
                </h2>
                <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-white text-xl leading-none px-1">✕</button>
              </div>

              {states.map(({ q, value, complete, claimed }) => {
                const pct = (value / q.target) * 100;
                return (
                  <div
                    key={q.id}
                    className={
                      "rounded-2xl border p-3 flex items-center gap-3 " +
                      (claimed
                        ? "bg-white/[0.02] border-hairline opacity-60"
                        : complete
                        ? "bg-amber-500/10 border-amber-400/40"
                        : "bg-hairline border-hairline")
                    }
                  >
                    <div className="text-2xl shrink-0">{q.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">{t(`daily.${q.id}.title`)}</span>
                        <span className="text-[10px] text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full font-bold">
                          +{q.xpReward} XP
                        </span>
                        {q.scope === "online" && (
                          <span className="text-[9px] text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            online
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{t(`daily.${q.id}.desc`)}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-hairline overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-ink-muted tabular-nums whitespace-nowrap">
                          {value}/{q.target}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {claimed ? (
                        <span className="text-emerald-400 text-xl">✓</span>
                      ) : complete ? (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => claimDailyQuest(q.id, q.xpReward)}
                          className="px-3 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 font-bold text-xs shadow-lg shadow-amber-900/40"
                        >
                          {t("quests.btn.claim")}
                        </motion.button>
                      ) : (
                        <button
                          onClick={() => play(q)}
                          className="px-3 py-2 rounded-xl bg-hairline hover:bg-hairline border border-hairline text-white font-bold text-xs transition"
                        >
                          {t("play.daily.start")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
