/**
 * economy.ts — soft currency + crafting economy for the ranked card mode.
 *
 * Players earn ÉCLATS on every finished match (more on a ranked win, a small
 * consolation on a loss). They spend éclats at the boutique to open a pack
 * of {@link PACK_SIZE} cards. Duplicates inside a pack are auto-converted to
 * POUSSIÈRE — a craft resource the player can then spend to forge a specific
 * locked card. Barèmes ici (source unique, exportés vers le serveur par
 * scripts/gen-economy-meta.mjs) ; les opérations elles-mêmes (tirage, débit,
 * crédit) sont faites par le SERVEUR (online/wallet.ts, §9-B).
 */

import type { CardId, CardRarity } from "../ranked/rankedTypes";
import { ALL_CARD_IDS, CARDS } from "../ranked/cards";
import { RANK_TIERS, type RankTier } from "./rank";
import type { Outcome, RecordMode } from "../types";

/** Éclats awarded for a win, by recorded match mode. Casual gives less to
 *  keep ranked feel rewarding; constellation sits in between; ranked + online
 *  pay the most because they're the highest-effort competitive modes. */
export const ECLATS_PER_WIN: Record<RecordMode, number> = {
  casual: 5,
  ranked: 15,
  // Entraînement + hotseat : 0 💎 (Alex 2026-10 — modes sans enjeu, farmables).
  // Le serveur répond `unknown_item` à une réclamation CPU dans ces modes.
  hotseat: 0,
  training: 0,
  online: 15,
  constellation: 12,
};

/** Consolation for any finished loss, so a bad run still nudges progress. */
export const ECLATS_PER_LOSS = 2;

/** Éclats d'un match Constellation Pro (Arena) : plus long et plus exigeant,
 *  il paie un peu plus que Constellation Classé. Lu aussi par le serveur. */
export const ARENA_ECLATS = { win: 40, draw: 20, loss: 10 } as const;
/** XP d'un match Constellation Pro (Arena). Doublé (Alex 2026-10) : le mode le
 *  plus long doit être le mieux payé à l'heure. Forfait : 0. */
export const ARENA_XP = { win: 120, draw: 60, loss: 30 } as const;

/** Multiplicateur de LONGUEUR de match (en %), appliqué à l'XP ET aux 💎 des
 *  matchs vs CPU. Classique (Casual / Classé) : par `bestOf` ; Constellation
 *  (lanes) : par `winTo` (stocké dans `MatchRecord.bestOf`). Longueur inconnue →
 *  100 %. Lu aussi par le serveur (economy_meta.json) — pas de nombre dupliqué. */
export const LENGTH_MULT_BEST_OF: Record<number, number> = { 1: 40, 3: 100, 5: 140, 7: 180 };
export const LENGTH_MULT_WIN_TO: Record<number, number> = { 1: 50, 2: 100, 3: 140 };

/** Multiplicateur (%) pour `mode` et la longueur `bestOf` (winTo en Constellation). */
export function lengthMultPct(mode: string, bestOf?: number): number {
  if (bestOf == null) return 100;
  if (mode === "casual" || mode === "ranked") return LENGTH_MULT_BEST_OF[bestOf] ?? 100;
  if (mode === "constellation") return LENGTH_MULT_WIN_TO[bestOf] ?? 100;
  return 100;
}

/** Applique le multiplicateur de longueur (arrondi entier — même formule que le
 *  serveur : (montant × % + 50) / 100). */
export function scaleByLength(amount: number, mode: string, bestOf?: number): number {
  return Math.round((amount * lengthMultPct(mode, bestOf)) / 100);
}

/** Passage de niveau : 25 + 5 × niveau 💎 et +10 ✦, versés par le SERVEUR
 *  (réclamation `claim_level`). Le niveau est calculé côté client depuis l'XP :
 *  le serveur ne paie au plus que LEVEL_UP_DAILY_MAX niveaux par jour UTC (le
 *  reste attend le lendemain — rien n'est perdu) et compte les 💎 dans le
 *  plafond CPU quotidien. */
export const LEVEL_UP_ECLATS_BASE = 25;
export const LEVEL_UP_ECLATS_PER_LEVEL = 5;
export const LEVEL_UP_STARS = 10;
export const LEVEL_UP_DAILY_MAX = 5;

/** 💎 d'un défi quotidien réclamé (dans le plafond CPU). Au plus
 *  DAILY_CHALLENGES_PER_DAY par date (= taille du tirage de todayDailyQuests). */
export const DAILY_CHALLENGE_ECLATS = 25;
export const DAILY_CHALLENGES_PER_DAY = 3;

/** 💎 d'un passage de niveau (miroir serveur). */
export function levelUpEclats(level: number): number {
  return LEVEL_UP_ECLATS_BASE + LEVEL_UP_ECLATS_PER_LEVEL * level;
}

/** Plafond QUOTIDIEN (jour UTC) d'éclats gagnés contre le CPU. Appliqué par le
 *  serveur : un match vs CPU n'est pas vérifiable, le plafond borne la triche
 *  sans gêner un joueur normal. */
export const CPU_ECLATS_DAILY_CAP = 375;

/** Cost of one pack. Tuned so a ~3-match win streak in ranked earns it. */
export const PACK_COST = 50;

/** Cards delivered per pack. */
export const PACK_SIZE = 3;

/** Drop weights inside a single card roll (sum doesn't have to be 100). */
export const PACK_WEIGHTS: Record<CardRarity, number> = {
  common: 60,
  rare: 30,
  epic: 9,
  legendary: 1,
};

/** Poussière granted when a pulled card duplicates one already owned. */
export const DUST_PER_DUPLICATE: Record<CardRarity, number> = {
  common: 5,
  rare: 15,
  epic: 40,
  legendary: 100,
};

/** Poussière needed to craft a specific locked card. Roughly 5× a duplicate
 *  so the meta-progression feels earned without being grindy. */
export const CRAFT_COST: Record<CardRarity, number> = {
  common: 25,
  rare: 75,
  epic: 200,
  legendary: 500,
};

/** Welcome bonus granted ONCE on first sign-up (server-authoritative — see
 *  crates/rpsls-server/src/account.rs). Shown pre-signup by AuthGate, so the
 *  amounts live HERE as the single source: the server reads the SAME values via
 *  economy_meta.json (scripts/gen-economy-meta.mjs). `cards` is display-only (the
 *  starter collection the account opens with); the server grants only the three
 *  currencies. */
export const WELCOME_BONUS = { eclats: 300, dust: 150, stars: 30, cards: 14 } as const;

/** Compute the éclats earned from a finished match. `bestOf` (winTo en
 *  Constellation) applique le multiplicateur de longueur ; absent → ×1. Un mode
 *  à 0 💎 (entraînement, hotseat) ne paie pas non plus la défaite. */
export function eclatsReward(mode: RecordMode, outcome: Outcome, bestOf?: number): number {
  const perWin = ECLATS_PER_WIN[mode] ?? 0;
  if (perWin === 0) return 0;
  const base = outcome === "win" ? perWin : outcome === "loss" ? ECLATS_PER_LOSS : 0;
  return scaleByLength(base, mode, bestOf);
}

/** Cartes OBTENABLES (packs, craft, Codex) : collectionnables hors Finishers
 *  Pro (injectés en match, jamais deckables). Miroir serveur `is_packable`. */
export const PACKABLE_IDS: CardId[] = ALL_CARD_IDS.filter((id) => !id.startsWith("finisher-"));
export function isPackable(id: string): boolean {
  return (PACKABLE_IDS as string[]).includes(id);
}

export function dustForDuplicate(id: CardId): number {
  return DUST_PER_DUPLICATE[CARDS[id].rarity] ?? 0;
}

export function craftCost(id: CardId): number {
  return CRAFT_COST[CARDS[id].rarity] ?? 0;
}

export interface PackResult {
  /** Cards pulled, in display order. */
  cards: CardId[];
  /** Per-card flag: true if it was new to the collection. */
  isNew: boolean[];
  /** Poussière gained from duplicates in this pack. */
  dustGained: number;
}

/** Codex (B3) completion tiers. Once the player's collection reaches the
 *  threshold, the tier becomes claimable for a one-shot éclats+poussière
 *  reward, giving long-term collectors a reason to chase every card. */
export interface CodexTier {
  threshold: number;
  eclats: number;
  dust: number;
}

// Étalés sur toute la collection (Alex 2026-10). Seules les cartes OBTENABLES
// comptent (PACKABLE_IDS = 110 : les 5 Finishers ne sont ni tirables ni
// forgeables) → le dernier palier est 110, pas 115 (inatteignable).
export const CODEX_TIERS: CodexTier[] = [
  { threshold: 20,  eclats: 50,   dust: 0 },
  { threshold: 30,  eclats: 100,  dust: 25 },
  { threshold: 40,  eclats: 150,  dust: 50 },
  { threshold: 55,  eclats: 250,  dust: 100 },
  { threshold: 70,  eclats: 350,  dust: 150 },
  { threshold: 85,  eclats: 450,  dust: 200 },
  { threshold: 100, eclats: 600,  dust: 300 },
  { threshold: 110, eclats: 1000, dust: 500 },
];

/** Find the tier definition for a given threshold, or undefined if unknown. */
export function codexTier(threshold: number): CodexTier | undefined {
  return CODEX_TIERS.find((t) => t.threshold === threshold);
}

/** Per-card mastery (B4). XP grows when the card is in the deck during a
 *  finished match — pure cosmetic (a gold star at level 5) so the system
 *  never reads as pay-to-win.
 *  Index in the array = level - 1, value = XP required to reach the level. */
export const MASTERY_THRESHOLDS = [0, 25, 75, 150, 300] as const;
export const MASTERY_MAX_LEVEL = MASTERY_THRESHOLDS.length;

export function masteryLevel(xp: number): number {
  for (let i = MASTERY_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= MASTERY_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/** Mastery XP granted per card in the deck when a match ends. Tuned so a
 *  motivated player gradually masters their favourite cards (~60 wins to
 *  cap a card) without it feeling slow. */
export function masteryXpForMatch(outcome: Outcome): number {
  if (outcome === "win") return 5;
  if (outcome === "loss") return 1;
  return 0;
}

/** Season (B5) — 30-day cadence. At rollover the player's LP is softly
 *  reset (so the ladder churns instead of fossilising) and they receive a
 *  one-shot reward based on the tier they ended the season in. */
export const SEASON_DURATION_MS = 30 * 24 * 3600 * 1000;

export interface SeasonReward {
  /** Inclusive LP floor used to pick this reward (matches the tier order
   *  in engine/rank.ts: Bronze 0, Silver 1100, Gold 1300, Platinum 1500,
   *  Diamond 1750). */
  minLp: number;
  /** Display label — the human-readable tier name baked in. */
  tier: string;
  eclats: number;
  dust: number;
  /** ✦ de fin de saison (Alex 2026-10). */
  stars: number;
}

/** Reward AMOUNTS per tier (keyed by RANK_TIERS id). Only the amounts live here;
 *  the LP floors + tier labels are DERIVED from RANK_TIERS (single source), so a
 *  threshold/label change in rank.ts flows through automatically. */
const SEASON_REWARD_AMOUNTS: Record<RankTier["id"], { eclats: number; dust: number; stars: number }> = {
  bronze:   { eclats: 50,  dust: 0,   stars: 10  },
  silver:   { eclats: 150, dust: 20,  stars: 20  },
  gold:     { eclats: 300, dust: 50,  stars: 40  },
  platinum: { eclats: 500, dust: 100, stars: 60  },
  diamond:  { eclats: 700, dust: 200, stars: 100 },
};

export const SEASON_REWARDS: SeasonReward[] = RANK_TIERS.map((t) => ({
  minLp: t.floor,
  // Getter : libellé traduit relu à l'affichage (pas figé au chargement).
  get tier() { return t.label; },
  ...SEASON_REWARD_AMOUNTS[t.id],
}));

/** Pick the reward bucket the LP value falls into — highest-tier wins. */
export function seasonRewardForLp(lp: number): SeasonReward {
  let pick = SEASON_REWARDS[0];
  for (const r of SEASON_REWARDS) {
    if (lp >= r.minLp) pick = r;
  }
  return pick;
}

/** Soft-reset the player's LP so the next season starts in the lower half
 *  of their previous tier. Floor of 1000 keeps the bronze entry meaningful. */
export function softResetLp(lp: number): number {
  return Math.max(1000, Math.floor(lp * 0.8));
}
