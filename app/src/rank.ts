/**
 * Visible competitive tier derived from a player's LP — the rank shown next to
 * the nickname in the header and (later) the online score bar. Thresholds are
 * tuned around the 1000 LP starting point so a fresh player sits at the bottom
 * of Bronze and the "reach 1100 LP" quest lands them in Silver.
 */
export interface RankTier {
  id: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  label: string;
  emoji: string;
  /** Tailwind gradient stops for the chip background. */
  gradient: string;
  /** LP at which this tier begins. */
  floor: number;
  /** LP at which the next tier begins (Infinity for the top tier). */
  ceil: number;
}

const TIERS: Omit<RankTier, "ceil">[] = [
  { id: "bronze",   label: "Bronze",   emoji: "🥉", gradient: "from-amber-700 to-orange-500",  floor: 0 },
  { id: "silver",   label: "Silver",   emoji: "🥈", gradient: "from-zinc-400 to-slate-200",    floor: 1100 },
  { id: "gold",     label: "Gold",     emoji: "🥇", gradient: "from-yellow-400 to-amber-300",  floor: 1300 },
  { id: "platinum", label: "Platinum", emoji: "💎", gradient: "from-cyan-300 to-teal-200",     floor: 1500 },
  { id: "diamond",  label: "Diamond",  emoji: "💠", gradient: "from-sky-300 to-indigo-300",    floor: 1750 },
];

/** Resolve the tier a given LP total falls into, with its LP window. */
export function rankFromLp(lp: number): RankTier {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (lp >= TIERS[i].floor) idx = i;
  }
  const t = TIERS[idx];
  const ceil = idx + 1 < TIERS.length ? TIERS[idx + 1].floor : Infinity;
  return { ...t, ceil };
}
