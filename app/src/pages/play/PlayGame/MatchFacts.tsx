import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GameMode, MODE_META, REWARDS } from "../../../types";
import { AiMood, AI_MOOD_META } from "../../../engine/game";
import { useT } from "../../../i18n";

export function MatchFacts({
  mode, mood, difficulty,
}: {
  mode: GameMode;
  mood: AiMood | null;
  difficulty: "easy" | "normal" | "hard";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const r = REWARDS[mode];
  return (
    <div className="bg-surface border border-hairline rounded-xl sm:rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-hairline transition"
      >
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-base">{MODE_META[mode].emoji}</span>
          <span className="font-semibold truncate">{t("mode." + mode)}</span>
          {mood && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-ink-muted truncate">
                {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
              </span>
            </>
          )}
        </div>
        <span className={"text-ink-faint text-xs transition " + (open ? "rotate-180" : "")}>▾</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid gap-3 text-xs">
              {/* Mode info */}
              <div className="border-t border-hairline pt-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
                  {t("mode." + mode)}
                </div>
                <p className="text-ink-muted leading-relaxed">{t("mode." + mode + ".tag")}</p>
                {r.xpWin > 0 && (
                  <p className="text-[11px] text-ink-muted mt-1.5">
                    {t("play.win.xp", { n: r.xpWin })}
                    {r.lpWin > 0 && ` · ${t("play.win.lp", { n: r.lpWin })}`}
                    {r.lpLoss < 0 && ` · ${t("play.loss.lp", { n: r.lpLoss })}`}
                  </p>
                )}
              </div>
              {/* Mood info */}
              {mood && (
                <div className="border-t border-hairline pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
                    {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
                  </div>
                  <p className="text-ink-muted leading-relaxed">{t("mood." + mood + ".desc")}</p>
                </div>
              )}
              {/* Difficulty info */}
              <div className="border-t border-hairline pt-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
                  {t("profile.diff.title")} · {t("diff." + difficulty)}
                </div>
                <p className="text-ink-muted leading-relaxed">{t("diff." + difficulty + ".desc")}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
