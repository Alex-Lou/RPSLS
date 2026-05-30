import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { QUESTS, questState, type QuestDef } from "./quests";
import { THEMES } from "./theme";
import { useT } from "./i18n";

export function QuestsPage() {
  const player = useStore((s) => s.player);
  const history = useStore((s) => s.history);
  const claimQuest = useStore((s) => s.claimQuest);
  const theme = THEMES[player.themeId];
  const t = useT();

  const ranked = QUESTS
    .map((q) => ({ q, s: questState(q, player, history) }))
    .sort((a, b) => {
      // claimable > in progress (more progress first) > claimed
      const rank = (x: typeof a) =>
        x.s.claimed ? 2 : x.s.complete ? 0 : 1;
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      // for in-progress, closest to done first
      const pa = a.s.value / a.s.target;
      const pb = b.s.value / b.s.target;
      return pb - pa;
    });

  const completedCount = ranked.filter((x) => x.s.claimed).length;
  const claimableCount = ranked.filter((x) => x.s.complete && !x.s.claimed).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto p-6 flex flex-col gap-4"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("quests.title")}</h1>
        <div className="text-sm text-zinc-400">
          <CountWithHighlight
            template={t("quests.claimed.count", { a: "{count}", b: QUESTS.length })}
            count={completedCount}
          />
          {claimableCount > 0 && (
            <span className="ml-3 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
              {t("quests.toClaim", { n: claimableCount })}
            </span>
          )}
        </div>
      </div>

      <p className="text-zinc-400 text-sm">{t("quests.subtitle")}</p>

      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {ranked.map(({ q, s }) => (
            <motion.li
              key={q.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <QuestRow
                q={q}
                s={s}
                themePrimary={theme.primary}
                themeSecondary={theme.secondary}
                onClaim={() => claimQuest(q.id, q.xpReward, q.lpReward)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}

/** Renders a localized template that contains the literal `{count}` token,
 * highlighting the numeric value in emerald. */
function CountWithHighlight({ template, count }: { template: string; count: number }) {
  const idx = template.indexOf("{count}");
  if (idx < 0) {
    return (
      <>
        <span className="text-emerald-300 font-semibold">{count}</span> {template}
      </>
    );
  }
  const before = template.slice(0, idx);
  const after = template.slice(idx + "{count}".length);
  return (
    <>
      {before}
      <span className="text-emerald-300 font-semibold">{count}</span>
      {after}
    </>
  );
}

function QuestRow({
  q,
  s,
  themePrimary,
  themeSecondary,
  onClaim,
}: {
  q: QuestDef;
  s: ReturnType<typeof questState>;
  themePrimary: string;
  themeSecondary: string;
  onClaim: () => void;
}) {
  const t = useT();
  const pct = (s.value / s.target) * 100;
  const dim = s.claimed;

  return (
    <div
      className={
        "rounded-2xl border p-4 flex items-center gap-4 transition " +
        (s.claimed
          ? "bg-white/[0.02] border-white/5 opacity-60"
          : s.complete
          ? "bg-amber-500/10 border-amber-400/40 shadow-lg shadow-amber-900/20"
          : "bg-white/5 border-white/10")
      }
    >
      <div
        className={
          "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 " +
          (s.complete && !s.claimed
            ? "bg-amber-500/30 ring-2 ring-amber-400/60"
            : "bg-white/5")
        }
      >
        {q.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={"font-semibold " + (dim ? "text-zinc-400" : "text-white")}>
            {t(`quest.${q.id}.title`)}
          </span>
          <span className="text-[10px] text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full font-bold">
            +{q.xpReward} XP
          </span>
          {q.lpReward !== undefined && q.lpReward > 0 && (
            <span className="text-[10px] text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded-full font-bold">
              +{q.lpReward} LP
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">{t(`quest.${q.id}.desc`)}</p>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background:
                  s.claimed
                    ? "#52525b"
                    : s.complete
                    ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                    : `linear-gradient(90deg, ${themePrimary}, ${themeSecondary})`,
              }}
            />
          </div>
          <span className="text-[11px] text-zinc-400 tabular-nums whitespace-nowrap">
            {s.value} / {s.target}
          </span>
        </div>
      </div>

      <div className="shrink-0">
        {s.claimed ? (
          <span className="text-emerald-400 text-xl">✓</span>
        ) : s.complete ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClaim}
            className="px-4 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 font-bold text-sm shadow-lg shadow-amber-900/40"
          >
            {t("quests.btn.claim")}
          </motion.button>
        ) : (
          <span className="text-zinc-600 text-xs">{t("quests.status.progress")}</span>
        )}
      </div>
    </div>
  );
}
