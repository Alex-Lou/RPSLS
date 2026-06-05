import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store";
import { QUESTS, questState, type QuestDef } from "../quests";
import { THEMES } from "../theme";
import { useT } from "../i18n";
import { hapticMatchWin } from "../haptic";

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
      className="w-full max-w-3xl mx-auto px-5 pt-2 pb-6 md:p-6 flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight">{t("quests.title")}</h1>
        <div className="text-sm text-ink-muted">
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

      <p className="text-ink-muted text-sm">{t("quests.subtitle")}</p>

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
  const [burst, setBurst] = useState(false);
  const claimable = s.complete && !s.claimed;

  const handleClaim = () => {
    hapticMatchWin();      // native reward buzz
    setBurst(true);
    onClaim();
  };

  return (
    <motion.div
      className={
        "relative overflow-hidden rounded-2xl border p-4 flex items-center gap-4 transition " +
        (s.claimed
          ? "bg-white/[0.02] border-hairline opacity-60"
          : claimable
          ? "bg-amber-500/10 border-amber-400/40"
          : "bg-hairline border-hairline")
      }
      // Claimable rows breathe with an amber glow to pull the eye.
      animate={
        claimable
          ? { boxShadow: ["0 0 0px rgba(251,191,36,0)", "0 0 22px -4px rgba(251,191,36,0.55)", "0 0 0px rgba(251,191,36,0)"] }
          : { boxShadow: "0 0 0px rgba(0,0,0,0)" }
      }
      transition={claimable ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
    >
      <motion.div
        className={
          "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 " +
          (claimable ? "bg-amber-500/30 ring-2 ring-amber-400/60" : "bg-hairline")
        }
        // The icon does a little victory dance while the reward is waiting.
        animate={claimable ? { rotate: [0, -9, 9, -5, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
        transition={claimable ? { duration: 1.6, repeat: Infinity, repeatDelay: 1.0 } : { duration: 0.3 }}
      >
        {q.emoji}
      </motion.div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={"font-semibold " + (dim ? "text-ink-muted" : "text-white")}>
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
        <p className="text-xs text-ink-muted mt-0.5">{t(`quest.${q.id}.desc`)}</p>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-hairline overflow-hidden">
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
                    : "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))",
              }}
            />
          </div>
          <span className="text-[11px] text-ink-muted tabular-nums whitespace-nowrap">
            {s.value} / {s.target}
          </span>
        </div>
      </div>

      <div className="shrink-0">
        {s.claimed ? (
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 16 }}
            className="text-emerald-400 text-xl"
          >
            ✓
          </motion.span>
        ) : s.complete ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            onClick={handleClaim}
            className="relative overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 font-bold text-sm shadow-lg shadow-amber-900/40"
          >
            {/* Shimmer sweep across the claim button. */}
            <motion.span
              aria-hidden
              className="absolute inset-y-0 -left-1/3 w-1/3"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)", transform: "skewX(-18deg)" }}
              animate={{ left: ["-33%", "133%"] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
            />
            <span className="relative">{t("quests.btn.claim")}</span>
          </motion.button>
        ) : (
          <span className="text-zinc-600 text-xs">{t("quests.status.progress")}</span>
        )}
      </div>

      {/* Claim celebration — reward chip floats up + a small burst of themed
          particles fans out. Lives on the row so it survives the button→✓ flip. */}
      <AnimatePresence>
        {burst && (
          <RewardBurst
            key="burst"
            xp={q.xpReward}
            lp={q.lpReward}
            primary={themePrimary}
            secondary={themeSecondary}
            onDone={() => setBurst(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** One-shot claim celebration: a rising +XP/+LP chip plus ~12 particles
 *  fanning out from the action area. Pure Motion/CSS, no assets. */
function RewardBurst({
  xp, lp, primary, secondary, onDone,
}: {
  xp: number;
  lp?: number;
  primary: string;
  secondary: string;
  onDone: () => void;
}) {
  const parts = Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * Math.PI * 2 + (i % 2) * 0.3;
    const dist = 34 + (i % 4) * 12;
    return {
      id: i,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist - 8,
      color: i % 2 === 0 ? primary : secondary,
      delay: (i % 5) * 0.015,
    };
  });
  return (
    <div className="absolute right-3 top-1 z-10 pointer-events-none">
      {parts.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [1, 1, 0], x: p.x, y: p.y, scale: [0, 1, 0.4] }}
          transition={{ duration: 0.9, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: p.color }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, y: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], y: -40, scale: 1.1 }}
        transition={{ duration: 1.3, ease: "easeOut" }}
        onAnimationComplete={onDone}
        className="absolute right-0 whitespace-nowrap font-black text-sm drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
      >
        <span className="text-emerald-300">+{xp} XP</span>
        {lp !== undefined && lp > 0 && <span className="text-rose-300 ml-1.5">+{lp} LP</span>}
        <span className="ml-1">✨</span>
      </motion.div>
    </div>
  );
}
