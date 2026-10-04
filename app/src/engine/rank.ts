/**
 * Visible competitive tier derived from a player's LP — the rank shown next to
 * the nickname in the header and (later) the online score bar. Thresholds are
 * tuned around the 1000 LP starting point so a fresh player sits at the bottom
 * of Bronze and the "reach 1100 LP" quest lands them in Silver.
 */
import { tNow } from "../i18n/core";

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

/** Nom du palier traduit dans la langue COURANTE (clé `match.tier.<id>`).
 *  `label` est un getter relu à chaque accès ; les objets restent littéraux
 *  (`id:` / `floor:`) car scripts/gen-economy-meta.mjs les lit par regex. */
const tierLabel = (id: RankTier["id"]) => tNow(`match.tier.${id}`);

export const RANK_TIERS: Omit<RankTier, "ceil">[] = [
  { id: "bronze",   get label() { return tierLabel("bronze"); },   emoji: "🥉", gradient: "from-amber-700 to-orange-500",  floor: 0 },
  { id: "silver",   get label() { return tierLabel("silver"); },   emoji: "🥈", gradient: "from-zinc-400 to-slate-200",    floor: 1100 },
  { id: "gold",     get label() { return tierLabel("gold"); },     emoji: "🥇", gradient: "from-yellow-400 to-amber-300",  floor: 1300 },
  { id: "platinum", get label() { return tierLabel("platinum"); }, emoji: "💎", gradient: "from-cyan-300 to-teal-200",     floor: 1500 },
  { id: "diamond",  get label() { return tierLabel("diamond"); },  emoji: "💠", gradient: "from-sky-300 to-indigo-300",    floor: 1750 },
];

/** Resolve the tier a given LP total falls into, with its LP window. */
export function rankFromLp(lp: number): RankTier {
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (lp >= RANK_TIERS[i].floor) idx = i;
  }
  const t = RANK_TIERS[idx];
  const ceil = idx + 1 < RANK_TIERS.length ? RANK_TIERS[idx + 1].floor : Infinity;
  return { ...t, ceil };
}

/** Tier + fill fraction (0–1) within that tier for an LP value, and the next
 *  tier (null at the cap). Single source of truth shared by every rank UI
 *  (RankedLobby, ClasseLobby) so the progress math lives in exactly one place. */
export function rankProgress(lp: number): { tier: RankTier; progress: number; next: RankTier | null } {
  const tier = rankFromLp(lp);
  const progress = tier.ceil === Infinity ? 1 : (lp - tier.floor) / (tier.ceil - tier.floor);
  const next = tier.ceil === Infinity ? null : rankFromLp(tier.ceil);
  return { tier, progress, next };
}
