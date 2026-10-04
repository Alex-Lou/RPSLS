import type { Move } from "../engine/game";
import type { MatchRecord, Player, Outcome } from "../types";
import type { Locale } from "../i18n";
import type { SeasonReward } from "../engine/economy";
import type { CardId } from "../ranked/rankedTypes";

export type ServerMode = "cloud" | "lan";

/** Écran de fin de saison : palier versé + soft reset du LP. */
export interface SeasonRolloverInfo {
  fromSeason: number;
  reward: SeasonReward;
  lpBefore: number;
  lpAfter: number;
}

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

  updateProfile: (patch: Partial<Pick<Player, "nickname" | "avatar" | "themeId" | "padId" | "difficulty" | "hapticEnabled" | "hapticIntensity" | "backgroundId" | "crashReports" | "fontScale" | "customBgUrl" | "customPadUrl" | "customBgs" | "customPads" | "padChosen" | "premiumIntensity" | "graphicsQuality" | "graphicsMeasured">>) => void;
  recordMatch: (m: MatchRecord) => void;
  /** Crédite UNIQUEMENT le ladder Classé local (classeLp + classeStats) — utilisé
   *  pour un « match rapide vs joueur réel » lancé depuis le hub Classé : le match
   *  online alimente déjà le rankLp serveur, on ajoute ici le classeLp côté client
   *  (« compter dans les deux », Alex 2026-07). Forfait = pénalité dédiée, hors W/L. */
  recordClasseOutcome: (outcome: "win" | "loss" | "draw", forfeit: boolean) => void;
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
  /** Sauvegarde le deck signature ÉDITÉ d'une Voie (Constellation Pro). */
  setArenaVoieDeck: (voie: Move, deck: string[]) => void;
  /** Record a finished Constellation Pro (arena) match — increments the
   *  appropriate field of player.arenaStats. The sync subscriber pushes
   *  the change to the cloud via the existing playerSync pipeline. */
  recordArenaMatch: (
    outcome: "win" | "loss" | "draw",
    meta?: { playerVoie?: Move; oppVoie?: Move; forfeit?: boolean; online?: boolean },
  ) => void;
  /** Remplace l'historique local (restauration cloud sur install fraîche —
   *  appelé UNIQUEMENT quand le local est vide, donc jamais d'écrasement). */
  restoreHistory: (h: MatchRecord[]) => void;
  /** Set the player's chosen Voie / affinity (Constellation Pro v2). */
  setArenaAffinity: (affinity: Move) => void;
  /** Award per-card mastery XP for every card listed (typically the deck
   *  contents at match end). Cosmetic — no balance impact. */
  awardCardMasteryXp: (cards: CardId[], outcome: Outcome) => void;
  /** Roll the season over when its 30-day window has elapsed: grant the
   *  tier-based reward, soft-reset LP, bump the season number. Returns
   *  the rollover payload so the caller (App boot) can show a modal,
   *  or null when no rollover is due yet. */
  rolloverSeasonIfDue: () => SeasonRolloverInfo | null;
  /** Écran de fin de saison à afficher (App.tsx). Posé par le flux local
   *  (ancien) ou par le serveur (portefeuille actif, cf. online/wallet.ts).
   *  Non persisté. */
  seasonRollover: SeasonRolloverInfo | null;
  setSeasonRollover: (r: SeasonRolloverInfo | null) => void;
  /** Apply a server-synced progression patch to the local player. Used by
   *  bootSync and the state_loaded handler to merge server-saved data. */
  applyServerSync: (patch: Partial<Player>) => void;
  /** Sign out of the account: become a fresh guest (new id, default progression)
   *  and break the durable anchor so the next boot doesn't restore the account.
   *  The account's cloud data is untouched — logging back in restores it. */
  logout: () => void;
  /** Dev / test helper: remove an "owned" set so the purchase flow can be
   *  re-tested. Reached via a long-press on the "✓ OWNED" badge in Profile.
   *  Production builds will gate this behind __DEV__ at the call site. */
  revokePremiumSet: (setId: string) => void;
}
