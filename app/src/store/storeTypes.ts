import type { Move } from "../engine/game";
import type { MatchRecord, Player, Outcome } from "../types";
import type { Locale } from "../i18n";
import type { PackResult, SeasonReward } from "../engine/economy";
import type { CardId } from "../ranked/rankedTypes";

export type ServerMode = "cloud" | "lan";

export interface ServerConfig {
  mode: ServerMode;
  /** Cloud URL (Koyeb / Cloudflare Tunnel / etc.). */
  cloudUrl: string;
  /** LAN URL — typically ws://192.168.x.y:8080 */
  lanUrl: string;
}

export interface AppState {
  player: Player;
  history: MatchRecord[];
  onboarded: boolean;
  locale: Locale;
  serverConfig: ServerConfig;

  updateProfile: (patch: Partial<Pick<Player, "nickname" | "avatar" | "themeId" | "padId" | "difficulty" | "hapticEnabled" | "hapticIntensity" | "backgroundId" | "crashReports" | "fontScale" | "customBgUrl" | "customPadUrl" | "customBgs" | "customPads" | "padChosen" | "premiumIntensity">>) => void;
  recordMatch: (m: MatchRecord) => void;
  /** Grant a flat XP bonus (e.g. tournament placement reward). */
  grantXp: (amount: number) => void;
  /** Register a competitive forfeit. Bumps the rolling abandon counter and
   *  applies the escalating extra LP penalty for repeat offenders. Returns
   *  the extra LP removed (0 for a first offence) so the UI can surface it. */
  recordAbandon: () => number;
  claimQuest: (id: string, xpReward: number, lpReward?: number) => void;
  claimDailyQuest: (id: string, xpReward: number) => void;
  recordDailyComplete: (date: string) => void;
  setOnboarded: (value: boolean) => void;
  setLocale: (locale: Locale) => void;
  setServerConfig: (patch: Partial<ServerConfig>) => void;
  resetProfile: () => void;
  /** Ranked card collection */
  unlockCard: (id: string) => void;
  setRankedDeck: (deck: string[]) => void;
  setArenaDeck: (deck: string[]) => void;
  /** Record a finished Constellation Pro (arena) match — increments the
   *  appropriate field of player.arenaStats. The sync subscriber pushes
   *  the change to the cloud via the existing playerSync pipeline. */
  recordArenaMatch: (
    outcome: "win" | "loss" | "draw",
    meta?: { playerVoie?: Move; oppVoie?: Move; forfeit?: boolean },
  ) => void;
  /** Remplace l'historique local (restauration cloud sur install fraîche —
   *  appelé UNIQUEMENT quand le local est vide, donc jamais d'écrasement). */
  restoreHistory: (h: MatchRecord[]) => void;
  /** Set the player's chosen Voie / affinity (Constellation Pro v2). */
  setArenaAffinity: (affinity: Move) => void;
  /** Spend {@link PACK_COST} éclats to open a pack of 3 cards. Duplicates
   *  are auto-converted to poussière. Returns the result, or `null` when
   *  the player cannot afford the pack. */
  openPack: () => PackResult | null;
  /** Spend poussière to add the locked card to the collection. Returns
   *  `true` on success, `false` if the player can't afford it or already
   *  owns the card. */
  craftCard: (id: CardId) => boolean;
  /** Codex completion tier — grants the éclats/poussière bonus tied to
   *  {@link import("../engine/economy").CODEX_TIERS}. Returns `false` if
   *  the player hasn't unlocked enough cards yet, or has already claimed
   *  this tier. */
  claimCodexTier: (threshold: number) => boolean;
  /** Award per-card mastery XP for every card listed (typically the deck
   *  contents at match end). Cosmetic — no balance impact. */
  awardCardMasteryXp: (cards: CardId[], outcome: Outcome) => void;
  /** Roll the season over when its 30-day window has elapsed: grant the
   *  tier-based reward, soft-reset LP, bump the season number. Returns
   *  the rollover payload so the caller (App boot) can show a modal,
   *  or null when no rollover is due yet. */
  rolloverSeasonIfDue: () => { fromSeason: number; reward: SeasonReward; lpBefore: number; lpAfter: number } | null;
  /** Apply a server-synced progression patch to the local player. Used by
   *  bootSync and the state_loaded handler to merge server-saved data. */
  applyServerSync: (patch: Partial<Player>) => void;
  /** Sign out of the account: become a fresh guest (new id, default progression)
   *  and break the durable anchor so the next boot doesn't restore the account.
   *  The account's cloud data is untouched — logging back in restores it. */
  logout: () => void;
  /** SIMULATE a premium-set purchase (no real money). Debits the cost in
   *  stars and adds the set to ownedPremiumSets. Returns `false` if the
   *  player can't afford it or already owns the set. Production swap-in
   *  will be a server call that verifies the IAP receipt before granting. */
  simulatePremiumPurchase: (setId: string, costStars: number) => boolean;
  /** Dev / test helper: credit stars directly. Wired only to the dev modal
   *  ("+1000 ✦ test"), never exposed to players. */
  grantStars: (n: number) => void;
  /** Dev / test helper: remove an "owned" set so the purchase flow can be
   *  re-tested. Reached via a long-press on the "✓ OWNED" badge in Profile.
   *  Production builds will gate this behind __DEV__ at the call site. */
  revokePremiumSet: (setId: string) => void;
}
