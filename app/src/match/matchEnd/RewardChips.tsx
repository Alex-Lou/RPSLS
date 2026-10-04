/**
 * RewardChips — compteurs animés de l'écran de fin commun : +XP, 💎 éclats,
 * ±LP, ✦. Chaque pastille jaillit (ressort) puis son nombre défile 0 → N.
 * Les valeurs sont celles que chaque mode affichait déjà (aucun barème ici).
 */
import { motion } from "motion/react";
import { useT } from "../../i18n";
import { formatNumber } from "../../i18n/format";
import { useCountUp } from "./matchEndHooks";

export interface MatchEndRewards {
  /** XP créditée (bonus série/défi inclus). */
  xp?: number;
  /** Détail des multiplicateurs (série, défi du jour…), déjà traduit. */
  xpNote?: string;
  /** Éclats 💎 gagnés. */
  eclats?: number;
  /** Variation de LP (Classé : classeLp ; en ligne : rankLp). */
  lp?: number;
  /** Étoiles ✦ gagnées. */
  stars?: number;
}

type Tone = "xp" | "eclats" | "lpUp" | "lpDown" | "stars";

const TONE: Record<Tone, string> = {
  xp: "from-emerald-400/25 to-emerald-500/10 ring-emerald-300/40 text-emerald-100",
  eclats: "from-cyan-400/25 to-sky-500/10 ring-cyan-300/40 text-cyan-100",
  lpUp: "from-amber-400/25 to-amber-500/10 ring-amber-300/40 text-amber-100",
  lpDown: "from-rose-500/25 to-rose-500/10 ring-rose-300/40 text-rose-100",
  stars: "from-violet-400/25 to-fuchsia-500/10 ring-violet-300/40 text-violet-100",
};

function Chip({ value, unit, tone, delay, signed }: {
  value: number; unit: string; tone: Tone; delay: number; signed?: boolean;
}) {
  const n = useCountUp(value, { delayMs: delay * 1000 + 150 });
  const sign = n > 0 || (signed && value > 0) ? "+" : n < 0 ? "−" : "";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 320, damping: 17 }}
      className={
        "flex items-baseline gap-1 px-3 py-1.5 [@media(max-height:700px)]:py-1 rounded-2xl bg-gradient-to-br ring-1 shadow-lg " +
        TONE[tone]
      }
    >
      <span className="text-lg [@media(max-height:700px)]:text-base font-black tabular-nums leading-none">
        {sign}{formatNumber(Math.abs(n))}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 leading-none">{unit}</span>
    </motion.div>
  );
}

/** Rangée de pastilles ; rien si aucune récompense. `delay` en secondes. */
export function RewardChips({ rewards, delay }: { rewards: MatchEndRewards; delay: number }) {
  const t = useT();
  const items: { key: string; value: number; unit: string; tone: Tone; signed?: boolean }[] = [];
  if (rewards.xp) items.push({ key: "xp", value: rewards.xp, unit: t("end.xp"), tone: "xp" });
  if (rewards.eclats) items.push({ key: "ec", value: rewards.eclats, unit: "💎", tone: "eclats" });
  if (rewards.lp) items.push({ key: "lp", value: rewards.lp, unit: t("end.lp"), tone: rewards.lp > 0 ? "lpUp" : "lpDown", signed: true });
  if (rewards.stars) items.push({ key: "st", value: rewards.stars, unit: "✦", tone: "stars" });
  if (!items.length) return null;
  return (
    <div className="w-full flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {items.map((it, i) => (
          <Chip key={it.key} value={it.value} unit={it.unit} tone={it.tone} delay={delay + i * 0.12} signed={it.signed} />
        ))}
      </div>
      {rewards.xpNote && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.5 }}
          className="text-[10px] text-amber-300 font-semibold text-center leading-tight px-2"
        >
          {rewards.xpNote}
        </motion.p>
      )}
    </div>
  );
}
