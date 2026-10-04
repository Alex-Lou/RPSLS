/**
 * ProgressReveal — barres de progression de l'écran de fin commun.
 *
 *  - LevelBar : niveau joueur (XP). Remplit « avant → après » ; si un niveau
 *    est franchi, la barre va au bout, flashe, repart de 0 et un badge
 *    « NIVEAU N ! » sort avec la prime versée par le serveur (💎 + ✦).
 *  - TierBar  : ladder LP (Classé = classeLp, en ligne = rankLp) avec le
 *    même principe pour une promotion / rétrogradation de palier.
 *
 * Les maths viennent des helpers existants (levelFromXp, rankProgress,
 * levelUpEclats, LEVEL_UP_STARS) : aucun barème dupliqué ici.
 */
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n";
import { formatNumber } from "../../i18n/format";
import { useStore } from "../../store/store";
import { levelFromXp } from "../../engine/leveling";
import { rankFromLp, rankProgress } from "../../engine/rank";
import { LEVEL_UP_STARS, levelUpEclats } from "../../engine/economy";
import { SETTLE_MS, useAfter, useBeforeAfter, useReduced } from "./matchEndHooks";

const FILL_S = 1.3;
/** Délai (s) depuis le montage de la barre, `delay` étant compté depuis le
 *  montage de l'écran (la barre n'apparaît qu'après SETTLE_MS). */
const local = (delay: number) => Math.max(0, delay - SETTLE_MS / 1000);

/** Remplissage animé d'une barre, avec un « tour » complet si `wrap`. */
function Fill({ from, to, wrap, down, delay, gradient }: {
  from: number; to: number; wrap: boolean; down?: boolean; delay: number; gradient: string;
}) {
  const reduced = useReduced();
  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`;
  const frames = !wrap
    ? [pct(from), pct(to)]
    : down
      ? [pct(from), "0%", "100%", pct(to)]
      : [pct(from), "100%", "0%", pct(to)];
  return (
    <motion.div
      className="absolute inset-y-0 left-0 rounded-full"
      style={{ background: gradient, boxShadow: "0 0 12px color-mix(in oklab, var(--theme-primary) 60%, transparent)" }}
      initial={{ width: pct(from) }}
      animate={{ width: reduced ? pct(to) : frames }}
      transition={reduced ? { duration: 0 } : wrap
        ? { duration: FILL_S, delay, times: [0, 0.5, 0.51, 1], ease: "easeInOut" }
        : { duration: FILL_S * 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

/** Rail commun (sillon + reflet) — même look pour XP et LP. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-2.5 [@media(max-height:700px)]:h-2 w-full rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
      {children}
    </div>
  );
}

/** Badge « moment fort » (niveau / promotion) qui jaillit au-dessus du rail. */
function Moment({ show, tone, children }: { show: boolean; tone: "gold" | "rose"; children: React.ReactNode }) {
  const cls = tone === "gold"
    ? "bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950 shadow-[0_0_24px_rgba(252,211,77,0.55)]"
    : "bg-rose-500/25 text-rose-100 ring-1 ring-rose-300/40";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 6 }}
          animate={{ scale: [0.3, 1.18, 1], opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={"self-center mt-1 px-3 py-0.5 rounded-full text-[11px] font-black tracking-wide whitespace-nowrap " + cls}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const XP_GRADIENT = "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))";

/** Barre de niveau (XP du joueur). */
export function LevelBar({ xpGained, delay }: { xpGained: number; delay: number }) {
  const t = useT();
  const live = useStore((s) => s.player.xp);
  const { before, after, settled } = useBeforeAfter(live, xpGained);
  const lb = levelFromXp(before);
  const la = levelFromXp(after);
  const leveled = la.level > lb.level;
  // Le libellé bascule sur le nouveau niveau à mi-course du « tour » de barre.
  const crossed = useAfter((local(delay) + FILL_S * 0.5) * 1000, settled && leveled);
  const shown = leveled && crossed ? la : leveled ? lb : la;
  if (!settled) return <div className="h-9 w-full" aria-hidden />;
  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[11px] font-bold">
        <span className="text-ink uppercase tracking-wider">{t("end.level", { n: shown.level })}</span>
        <span className="text-ink-muted tabular-nums">
          {t("end.xpProgress", { a: formatNumber(la.xpInLevel), b: formatNumber(la.xpForNext) })}
        </span>
      </div>
      <Rail>
        <Fill from={lb.progress} to={la.progress} wrap={leveled} delay={local(delay)} gradient={XP_GRADIENT} />
      </Rail>
      <Moment show={leveled && crossed} tone="gold">
        {t("end.levelUp", { n: la.level })} {t("end.levelUpReward", { e: levelUpEclats(la.level), s: LEVEL_UP_STARS })}
      </Moment>
    </div>
  );
}

/** Barre de palier LP. `ladder` choisit la valeur du store lue (aucune autre). */
export function TierBar({ ladder, lpDelta, delay }: {
  ladder: "classeLp" | "rankLp"; lpDelta: number; delay: number;
}) {
  const t = useT();
  const live = useStore((s) => (ladder === "classeLp" ? s.player.classeLp ?? 1000 : s.player.rankLp));
  const { before, after, settled } = useBeforeAfter(live, lpDelta);
  const pb = rankProgress(before);
  const pa = rankProgress(after);
  const changed = pb.tier.id !== pa.tier.id;
  const down = after < before;
  const crossed = useAfter((local(delay) + FILL_S * 0.5) * 1000, settled && changed);
  const tier = changed && crossed ? pa.tier : changed ? pb.tier : pa.tier;
  if (!settled) return <div className="h-9 w-full" aria-hidden />;
  const nextLine = pa.next
    ? t("end.lpToNext", { n: formatNumber(pa.next.floor - after), tier: pa.next.label })
    : t("end.maxTier");
  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold">
        <span className="flex items-center gap-1 min-w-0">
          <span aria-hidden>{tier.emoji}</span>
          <span className={"uppercase tracking-wider bg-gradient-to-r bg-clip-text text-transparent " + tier.gradient}>{tier.label}</span>
          <span className="text-ink-muted tabular-nums">· {t("end.lpValue", { lp: formatNumber(after) })}</span>
        </span>
        <span className="text-ink-faint truncate">{nextLine}</span>
      </div>
      <Rail>
        <Fill
          from={pb.progress} to={pa.progress} wrap={changed} down={down} delay={local(delay)}
          gradient="linear-gradient(90deg, #fbbf24, #f59e0b)"
        />
      </Rail>
      <Moment show={changed && crossed} tone={down ? "rose" : "gold"}>
        {t(down ? "end.tierDown" : "end.tierUp", { tier: `${rankFromLp(after).emoji} ${rankFromLp(after).label}` })}
      </Moment>
    </div>
  );
}
