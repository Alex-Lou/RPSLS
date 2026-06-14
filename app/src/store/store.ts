import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Move } from "../engine/game";
import type { MatchRecord, Player } from "../types";
import { CLASSE_LP, classeLpDelta } from "../types";
import type { Locale } from "../i18n";
import { todayDateKey } from "../engine/daily";
import { sanitisePersisted } from "./storeMigrationGuard";
import { clearAnchor } from "../online/playerAnchor";
import { abandonPenaltyLp, activeAbandonCount, nextAbandon } from "../match/forfeit";
import { nextStreak, streakBonusXp } from "../match/streak";
import {
  PACK_COST,
  SEASON_DURATION_MS,
  type PackResult,
  type SeasonReward,
  codexTier,
  craftCost,
  dustForDuplicate,
  eclatsReward,
  masteryXpForMatch,
  rollPack,
  seasonRewardForLp,
  softResetLp,
} from "../engine/economy";
import type { CardId } from "../ranked/rankedTypes";
import type { Outcome } from "../types";

const emptyByMove = () => ({
  rock:     { picked: 0, won: 0 },
  paper:    { picked: 0, won: 0 },
  scissors: { picked: 0, won: 0 },
  lizard:   { picked: 0, won: 0 },
  spock:    { picked: 0, won: 0 },
});

function uuid(): string {
  // crypto.randomUUID is available in Tauri 2 WebView2 and all modern browsers.
  return (globalThis.crypto && "randomUUID" in globalThis.crypto
    ? (globalThis.crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
}

export function defaultPlayer(): Player {
  return {
    id: uuid(),
    nickname: "Player 1",
    avatar: "🎮",
    themeId: "violet",
    padId: "chalkboard",
    difficulty: "normal",
    xp: 0,
    rankLp: 1000,
    stats: { wins: 0, losses: 0, draws: 0, byMove: emptyByMove() },
    claimedQuests: [],
    completedDailies: [],
    dailyClaims: { date: "", ids: [] },
    createdAt: Date.now(),
    hapticEnabled: true,
    hapticIntensity: "med",
    cardCollection: ["aegis", "precision", "anchor", "second-wind", "surge", "augur"],
    rankedDeck: ["aegis", "precision", "surge", "augur", "anchor", "second-wind"],
    arenaDeck: ["aegis", "precision", "surge", "augur", "anchor", "second-wind", "heist", "supernova", "seve", "jet-caillou"],
    eclats: 0,
    dust: 0,
    stars: 0,
    ownedPremiumSets: [],
    codexClaimed: [],
    cardMastery: {},
    season: { number: 1, startedAt: Date.now() },
    classeLp: 1000,
    classeStats: { wins: 0, losses: 0, draws: 0 },
    backgroundId: "default",
    customBgs: [],
    customPads: [],
  };
}

export type ServerMode = "cloud" | "lan";

export interface ServerConfig {
  mode: ServerMode;
  /** Cloud URL (Koyeb / Cloudflare Tunnel / etc.). */
  cloudUrl: string;
  /** LAN URL — typically ws://192.168.x.y:8080 */
  lanUrl: string;
}

interface AppState {
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

function detectLocale(): Locale {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  const code = nav.slice(0, 2).toLowerCase();
  const supported: Locale[] = [
    "en", "fr", "es", "de", "it",
    "pt", "zh", "ja", "ru", "ar",
    "ko", "hi", "tr", "pl", "nl",
  ];
  return (supported as string[]).includes(code) ? (code as Locale) : "en";
}

/** Public Render.com deploy of crates/rpsls-server. Free tier, sleeps after
 *  15 min of inactivity (first request after a sleep takes ~30-50s to wake). */
export const DEFAULT_CLOUD_URL = "wss://rpsls-server-tptj.onrender.com";

export function defaultServerConfig(): ServerConfig {
  return {
    mode: "cloud",
    cloudUrl: DEFAULT_CLOUD_URL,
    lanUrl: "ws://localhost:8080", // host PC default; joiners type the LAN IP
  };
}

const HISTORY_LIMIT = 100;

/**
 * Ranked unlocks — checked after every recordMatch, idempotent.
 * Tier thresholds mirror rank.ts (Silver 1100 / Gold 1300 / Platinum 1500).
 * Constellation wins/sweeps are counted from match history.
 */
function applyRankedUnlocks(
  collection: string[],
  rankLp: number,
  history: MatchRecord[],
): string[] {
  const set = new Set(collection);
  const constellWins = history.filter(
    (h) => h.mode === "constellation" && h.outcome === "win",
  ).length;
  const constellSweeps = history.filter(
    (h) =>
      h.mode === "constellation" &&
      h.outcome === "win" &&
      h.scorePlayer === h.bestOf &&
      h.scoreOpponent === 0,
  ).length;
  if (constellWins >= 5) set.add("riposte");
  if (constellWins >= 10) set.add("curse");
  if (constellSweeps >= 3) set.add("vortex");
  if (rankLp >= 1100) set.add("heist");
  if (rankLp >= 1300) set.add("oracle");
  if (rankLp >= 1500) set.add("supernova");
  // New mechanics cards.
  if (constellWins >= 3) set.add("mirror");   // early rare — anti-counter tool
  if (rankLp >= 1200) set.add("gambit");      // mid-tier high-roll epic
  // Outil de Forge (Arena 2026-06-13) — débloqué tôt pour jouer le bras de fer
  // forge (vole la carte forgée non récupérée de l'adversaire).
  if (constellWins >= 1) set.add("razzia");
  // 6 arts orphelins Pro (2026-06-13) — débloqués dès 1 victoire pour les jouer.
  if (constellWins >= 1) {
    for (const c of ["surcharge", "toxine", "echo", "rappel", "double-mot", "chronomancien"]) set.add(c);
  }
  // ⚡ Cartes « à la pioche » (Cast When Drawn, 2026-06-13) — progression douce :
  // communes dès la 1re victoire, rares à la 2e, épiques à la 4e.
  if (constellWins >= 1) {
    for (const c of ["coup-de-bol", "bouffee-air", "cafeine", "tuile"]) set.add(c);
  }
  if (constellWins >= 2) {
    for (const c of ["eclair-genie", "patate-chaude", "pile-ou-face"]) set.add(c);
  }
  if (constellWins >= 4) {
    for (const c of ["trefle-chance", "sursaut"]) set.add(c);
  }
  return set.size === collection.length ? collection : Array.from(set);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      player: defaultPlayer(),
      history: [],
      onboarded: false,
      locale: detectLocale(),
      serverConfig: defaultServerConfig(),

      setOnboarded: (value) => set({ onboarded: value }),
      setLocale: (locale) => set({ locale }),
      setServerConfig: (patch) =>
        set((s) => ({ serverConfig: { ...s.serverConfig, ...patch } })),

      updateProfile: (patch) =>
        set((s) => ({ player: { ...s.player, ...patch } })),

      recordMatch: (m) =>
        set((s) => {
          const p = structuredClone(s.player);
          // Win-streak momentum: roll the streak, then top up the win XP with
          // the streak bonus (×1.5 at 3 wins, ×2 at 5+). Loss resets it.
          const streak = nextStreak(p.winStreak ?? 0, m.outcome);
          p.winStreak = streak;
          const bonusXp = m.outcome === "win" ? streakBonusXp(m.xpDelta, streak) : 0;
          p.xp = Math.max(0, p.xp + m.xpDelta + bonusXp);
          // CLAMP lpDelta to ±50: a determined cheater can rebuild the client
          // and call recordMatch({ lpDelta: 9_999_999 }) — without this clamp
          // they could mint LP locally, triggering inflated season-rollover
          // rewards (LP-tiered: ≤700 éclats + 200 dust). The global leaderboard
          // is still server-authoritative (record_result in match_engine.rs
          // hard-codes ±20/−15), so this only matters for local rewards.
          // Real ranked LP can ONLY be granted server-side via online matches.
          const safeLpDelta = Math.max(-50, Math.min(50, m.lpDelta | 0));
          p.rankLp = Math.max(0, p.rankLp + safeLpDelta);
          // Soft-currency éclats earned every finished match (no forfeit).
          if (!m.forfeit) {
            p.eclats = (p.eclats ?? 0) + eclatsReward(m.mode, m.outcome);
          }
          // Classé (classic 1v1) local ladder — its OWN classement, separate
          // from the online-only rankLp above. Quick match + tournament both
          // record mode "ranked", so every Classé result climbs/drops here. A
          // forfeit takes the dedicated forfeit penalty (and is NOT counted in
          // the win/loss record, matching how the global stats skip it).
          if (m.mode === "ranked") {
            const dLp = m.forfeit ? CLASSE_LP.forfeit : classeLpDelta(m.outcome);
            p.classeLp = Math.max(0, (p.classeLp ?? 1000) + dLp);
            if (!m.forfeit) {
              const cs = p.classeStats ?? { wins: 0, losses: 0, draws: 0 };
              if (m.outcome === "win") cs.wins++;
              else if (m.outcome === "loss") cs.losses++;
              else cs.draws++;
              p.classeStats = cs;
            }
          }
          if (m.outcome === "win") p.stats.wins++;
          else if (m.outcome === "loss") p.stats.losses++;
          else p.stats.draws++;
          for (const r of m.rounds) {
            const k = r.playerMove as Move;
            p.stats.byMove[k].picked++;
            if (r.result === "win") p.stats.byMove[k].won++;
          }
          const newHistory = [m, ...s.history].slice(0, HISTORY_LIMIT);
          p.cardCollection = applyRankedUnlocks(p.cardCollection ?? [], p.rankLp, newHistory);
          return {
            player: p,
            history: newHistory,
          };
        }),

      grantXp: (amount) =>
        set((s) => ({ player: { ...s.player, xp: Math.max(0, s.player.xp + Math.round(amount)) } })),

      recordAbandon: () => {
        const now = Date.now();
        const prior = activeAbandonCount(get().player.abandons, now);
        const extra = abandonPenaltyLp(prior);
        set((s) => ({
          player: {
            ...s.player,
            rankLp: Math.max(0, s.player.rankLp + extra),
            abandons: nextAbandon(s.player.abandons, now),
          },
        }));
        return extra;
      },

      claimQuest: (id, xpReward, lpReward = 0) =>
        set((s) => {
          if (s.player.claimedQuests.includes(id)) return s;
          return {
            player: {
              ...s.player,
              xp: s.player.xp + xpReward,
              rankLp: s.player.rankLp + lpReward,
              claimedQuests: [...s.player.claimedQuests, id],
            },
          };
        }),

      claimDailyQuest: (id, xpReward) =>
        set((s) => {
          const today = todayDateKey();
          const cur =
            s.player.dailyClaims && s.player.dailyClaims.date === today
              ? s.player.dailyClaims
              : { date: today, ids: [] };
          if (cur.ids.includes(id)) return s;
          return {
            player: {
              ...s.player,
              xp: s.player.xp + xpReward,
              dailyClaims: { date: today, ids: [...cur.ids, id] },
            },
          };
        }),

      recordDailyComplete: (date) =>
        set((s) => {
          if (s.player.completedDailies.includes(date)) return s;
          return {
            player: {
              ...s.player,
              completedDailies: [...s.player.completedDailies, date],
            },
          };
        }),

      resetProfile: () => set({ player: defaultPlayer(), history: [], onboarded: false }),
      unlockCard: (id) => set((s) => {
        const col = s.player.cardCollection ?? [];
        if (col.includes(id)) return s;
        return { player: { ...s.player, cardCollection: [...col, id] } };
      }),
      recordArenaMatch: (outcome, meta) => set((s) => {
        const cur = s.player.arenaStats ?? { wins: 0, losses: 0, draws: 0 };
        const next = {
          wins:   cur.wins + (outcome === "win" ? 1 : 0),
          losses: cur.losses + (outcome === "loss" ? 1 : 0),
          draws:  cur.draws + (outcome === "draw" ? 1 : 0),
        };
        // Éclats reward — mirrors the existing eclatsReward(mode, outcome)
        // scale for casual modes. Constellation Pro is higher-effort (longer
        // matches, deeper strategy) so it pays slightly above Constellation
        // Ranked: win 20, draw 10, loss 5.
        const reward = outcome === "win" ? 20 : outcome === "draw" ? 10 : 5;
        // HISTORIQUE (Alex 2026-06-13 « voies jouées dans l'historique ») : on
        // journalise AUSSI le match vs-CPU (avant : SEULS les compteurs
        // arenaStats, aucune entrée dans `history` → log vide + voie perdue). La
        // VOIE jouée (joueur + adversaire) est conservée → consultable ET
        // synchronisable au cloud (cf. buildProgressFromPlayer).
        const rec: MatchRecord = {
          id: `arena-${Date.now()}`,
          mode: "constellation",
          bestOf: 1,
          opponent: { kind: "cpu", mood: "logical" },
          scorePlayer: outcome === "win" ? 1 : 0,
          scoreOpponent: outcome === "loss" ? 1 : 0,
          outcome,
          rounds: [],
          xpDelta: 0,
          lpDelta: 0,
          timestamp: Date.now(),
          forfeit: meta?.forfeit || undefined,
          playerVoie: meta?.playerVoie,
          oppVoie: meta?.oppVoie,
        };
        const newHistory = [rec, ...s.history].slice(0, HISTORY_LIMIT);
        // Débloque les cartes Arena selon constellWins : l'history vs-CPU compte
        // ENFIN (avant, ces victoires n'étaient pas journalisées → 0 unlock).
        const cardCollection = applyRankedUnlocks(s.player.cardCollection ?? [], s.player.rankLp, newHistory);
        return {
          player: {
            ...s.player,
            arenaStats: next,
            eclats: (s.player.eclats ?? 0) + reward,
            cardCollection,
          },
          history: newHistory,
        };
      }),

      restoreHistory: (h) => set({ history: h }),
      setRankedDeck: (deck) => set((s) => ({
        player: { ...s.player, rankedDeck: deck },
      })),
      setArenaDeck: (deck) => set((s) => ({
        player: { ...s.player, arenaDeck: deck },
      })),
      setArenaAffinity: (affinity) => set((s) => ({
        player: { ...s.player, arenaAffinity: affinity },
      })),

      openPack: () => {
        const player = get().player;
        if ((player.eclats ?? 0) < PACK_COST) return null;
        const owned = new Set(player.cardCollection ?? []);
        const cards = rollPack();
        const isNew = cards.map((id) => {
          if (owned.has(id)) return false;
          owned.add(id);
          return true;
        });
        const dustGained = cards.reduce(
          (sum, id, i) => (isNew[i] ? sum : sum + dustForDuplicate(id)),
          0,
        );
        set((s) => ({
          player: {
            ...s.player,
            eclats: (s.player.eclats ?? 0) - PACK_COST,
            dust: (s.player.dust ?? 0) + dustGained,
            cardCollection: Array.from(owned),
          },
        }));
        return { cards, isNew, dustGained };
      },

      craftCard: (id) => {
        const player = get().player;
        const owned = new Set(player.cardCollection ?? []);
        if (owned.has(id)) return false;
        const cost = craftCost(id);
        if ((player.dust ?? 0) < cost) return false;
        set((s) => ({
          player: {
            ...s.player,
            dust: (s.player.dust ?? 0) - cost,
            cardCollection: [...(s.player.cardCollection ?? []), id],
          },
        }));
        return true;
      },

      claimCodexTier: (threshold) => {
        const tier = codexTier(threshold);
        if (!tier) return false;
        const player = get().player;
        const collection = player.cardCollection ?? [];
        if (collection.length < threshold) return false;
        const claimed = player.codexClaimed ?? [];
        if (claimed.includes(threshold)) return false;
        set((s) => ({
          player: {
            ...s.player,
            eclats: (s.player.eclats ?? 0) + tier.eclats,
            dust: (s.player.dust ?? 0) + tier.dust,
            codexClaimed: [...claimed, threshold],
          },
        }));
        return true;
      },

      awardCardMasteryXp: (cards, outcome) => {
        const xp = masteryXpForMatch(outcome);
        if (xp <= 0 || cards.length === 0) return;
        set((s) => {
          const cur = { ...(s.player.cardMastery ?? {}) };
          for (const c of cards) cur[c] = (cur[c] ?? 0) + xp;
          return { player: { ...s.player, cardMastery: cur } };
        });
      },

      rolloverSeasonIfDue: () => {
        const player = get().player;
        const now = Date.now();
        const season = player.season ?? { number: 1, startedAt: now };
        // If we just initialised, persist that and report no rollover.
        if (!player.season) {
          set((s) => ({ player: { ...s.player, season } }));
          return null;
        }
        if (now - season.startedAt < SEASON_DURATION_MS) return null;
        const lpBefore = player.rankLp;
        const reward = seasonRewardForLp(lpBefore);
        const lpAfter = softResetLp(lpBefore);
        set((s) => ({
          player: {
            ...s.player,
            rankLp: lpAfter,
            eclats: (s.player.eclats ?? 0) + reward.eclats,
            dust: (s.player.dust ?? 0) + reward.dust,
            season: { number: season.number + 1, startedAt: now },
          },
        }));
        return { fromSeason: season.number, reward, lpBefore, lpAfter };
      },

      applyServerSync: (patch) =>
        set((s) => ({ player: { ...s.player, ...patch } })),
      logout: () => {
        // Break the durable account link so the next boot doesn't restore it,
        // then become a fresh guest. The account's data stays in the cloud
        // (under its own player_id) — logging back in restores everything.
        void clearAnchor();
        set({ player: defaultPlayer(), history: [] });
      },
      simulatePremiumPurchase: (setId, costStars) => {
        const p = useStore.getState().player;
        const owned = p.ownedPremiumSets ?? [];
        if (owned.includes(setId)) return false;
        const stars = p.stars ?? 0;
        if (stars < costStars) return false;
        set((s) => ({
          player: {
            ...s.player,
            stars: (s.player.stars ?? 0) - costStars,
            ownedPremiumSets: [...(s.player.ownedPremiumSets ?? []), setId],
          },
        }));
        return true;
      },
      grantStars: (n) =>
        set((s) => ({ player: { ...s.player, stars: Math.max(0, (s.player.stars ?? 0) + Math.round(n)) } })),
      revokePremiumSet: (setId) =>
        set((s) => ({
          player: {
            ...s.player,
            ownedPremiumSets: (s.player.ownedPremiumSets ?? []).filter((id) => id !== setId),
          },
        })),
    }),
    {
      name: "rpsls-app-state",
      version: 22,
      migrate: (persisted: unknown, version: number): AppState => {
        const state = persisted as {
          player?: Partial<Player> & { customVariants?: unknown };
          history?: MatchRecord[];
          onboarded?: boolean;
          locale?: Locale;
          serverConfig?: Partial<ServerConfig>;
        };
        if (state?.player) {
          if (version < 2 && !("padId" in state.player)) {
            state.player.padId = "chalkboard";
          }
          if (version < 3) {
            if (!("claimedQuests" in state.player)) state.player.claimedQuests = [];
            if (!("completedDailies" in state.player)) state.player.completedDailies = [];
          }
          if (version < 4 && !("difficulty" in state.player)) {
            state.player.difficulty = "normal";
          }
          // v8: Custom Lab removed — strip the now-dead field if present.
          if (version < 8 && "customVariants" in state.player) {
            delete state.player.customVariants;
          }
        }
        if (version < 5 && state && typeof state.onboarded !== "boolean") {
          state.onboarded = true;
        }
        if (version < 7 && state && !state.locale) {
          state.locale = detectLocale();
        }
        if (version < 9 && state) {
          state.serverConfig = { ...defaultServerConfig(), ...(state.serverConfig ?? {}) };
        }
        // v10: the v9 default lanUrl "ws://192.168.1.1:8080" was a bad guess
        // (it's the typical router). Replace with the localhost default so
        // the host PC works out-of-the-box and joiners only have to type
        // the IP once.
        if (version < 10 && state?.serverConfig) {
          if (state.serverConfig.lanUrl === "ws://192.168.1.1:8080") {
            state.serverConfig.lanUrl = "ws://localhost:8080";
          }
        }
        // v11: flip the default mode to "cloud" and fill the Render URL for
        // users who never set a cloud URL.
        if (version < 11 && state?.serverConfig) {
          if (!state.serverConfig.cloudUrl) {
            state.serverConfig.cloudUrl = DEFAULT_CLOUD_URL;
          }
          state.serverConfig.mode = "cloud";
        }
        // v12: haptic settings — opt-in by default, medium intensity.
        if (version < 12 && state?.player) {
          if (state.player.hapticEnabled === undefined) state.player.hapticEnabled = true;
          if (state.player.hapticIntensity === undefined) state.player.hapticIntensity = "med";
        }
        // v13: daily-challenge (#17) claims tracker.
        if (version < 13 && state?.player && !("dailyClaims" in state.player)) {
          state.player.dailyClaims = { date: "", ids: [] };
        }
        // v14: cosmetic background — default to the original gradient.
        if (version < 14 && state?.player && !("backgroundId" in state.player)) {
          state.player.backgroundId = "default";
        }
        // v15: personal image library — seed customBgs/customPads from the
        // single-active customBgUrl/customPadUrl so a player upgrading from
        // v14 keeps their current import as the first library entry.
        if (version < 15 && state?.player) {
          if (!("customBgs" in state.player)) {
            state.player.customBgs = state.player.customBgUrl ? [state.player.customBgUrl] : [];
          }
          if (!("customPads" in state.player)) {
            state.player.customPads = state.player.customPadUrl ? [state.player.customPadUrl] : [];
          }
        }
        // v16: competitive LP is now ONLINE-only (vs-CPU gives XP, not LP).
        // Reset the local rank LP to the fresh start so it matches the global
        // ladder instead of reflecting old vs-CPU results.
        if (version < 16 && state?.player) {
          state.player.rankLp = 1000;
        }
        // v17: soft-currency éclats + craft poussière. Seed both at 0 so
        // upgrading players just start their economy fresh — no retroactive
        // gift for old wins (avoids over-stuffing the boutique on day 1).
        if (version < 17 && state?.player) {
          if (state.player.eclats === undefined) state.player.eclats = 0;
          if (state.player.dust === undefined) state.player.dust = 0;
        }
        // v18: codex completion tracker. Empty array — even players who
        // already own enough cards have to come claim the tier themselves
        // (the boutique tab makes that one tap, and avoids a silent grant).
        if (version < 18 && state?.player) {
          if (state.player.codexClaimed === undefined) state.player.codexClaimed = [];
        }
        // v19: per-card mastery XP. Empty map — old matches don't count.
        if (version < 19 && state?.player) {
          if (state.player.cardMastery === undefined) state.player.cardMastery = {};
        }
        // v20: seasons. Initialise the current season at "now" so existing
        // profiles get a fresh 30-day window starting on the next launch
        // (no surprise auto-reset on upgrade day).
        if (version < 20 && state?.player) {
          if (state.player.season === undefined) {
            state.player.season = { number: 1, startedAt: Date.now() };
          }
        }
        // v21: Classé (classic 1v1) gets its OWN local ranked ladder. Seed at
        // the 1000 Bronze entry and a fresh win/loss record so the new mode
        // starts everyone level — past vs-CPU wins don't retroactively rank.
        if (version < 21 && state?.player) {
          if (state.player.classeLp === undefined) state.player.classeLp = 1000;
          if (state.player.classeStats === undefined) {
            state.player.classeStats = { wins: 0, losses: 0, draws: 0 };
          }
        }
        // v22: per-premium-theme intensity slider. Default 1.0 = the
        // shipping look. The Profile UI lets the player dial each premium
        // theme up to 1.6 (denser FX) or down to 0.4 (subtler) so they can
        // tune the rain / petal / spark density to taste.
        if (version < 22 && state?.player) {
          if (state.player.premiumIntensity === undefined) {
            state.player.premiumIntensity = {};
          }
        }
        // Final pass — sanitise the persisted shape so a tampered
        // localStorage can never inject a payload that would crash the
        // app at render OR open a self-XSS via avatar URL.
        return sanitisePersisted(state) as AppState;
      },
      // Exclude `history` from the auto-persist payload. Zustand re-serialises
      // the WHOLE persisted shape on every set() call — at peak gameplay
      // (recordMatch + reward + streak in the same beat) that was rewriting
      // ~15-50 KB of JSON to localStorage on every action. Pulling history
      // out cuts the persisted blob to ~5 KB and the I/O drops ~80 %. The
      // history then rides a debounced side-channel writer (below) so it
      // still survives a reinstall, just no longer hot-path.
      partialize: (state) => ({
        player: state.player,
        onboarded: state.onboarded,
        locale: state.locale,
        serverConfig: state.serverConfig,
        // history intentionally omitted — see `historySidePersist` below.
      }) as unknown as AppState,
      // Hydrate history from its side channel on boot, since partialize
      // hides it from Zustand's own persist round-trip.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        try {
          const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
          if (raw) state.history = JSON.parse(raw) as MatchRecord[];
        } catch {
          // Bad JSON or storage exception → start with an empty history.
          // The mainline state stays valid; we just lose past matches.
        }
      },
    }
  )
);

/** localStorage key for the history side-channel (kept out of the main
 *  rpsls-app-state blob — see partialize above). */
const HISTORY_STORAGE_KEY = "rpsls-history";
/** Maximum delay between a recordMatch and the corresponding history flush.
 *  2 s is short enough that an app kill never loses more than the last
 *  match, long enough that a 5-burst (match end → reward → streak →
 *  mastery → quest claim) collapses into a single write. */
const HISTORY_FLUSH_DELAY_MS = 2_000;

let _historyFlushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleHistoryFlush() {
  if (_historyFlushTimer) return;
  _historyFlushTimer = setTimeout(() => {
    _historyFlushTimer = null;
    try {
      const h = useStore.getState().history;
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(h));
    } catch {
      // Quota exceeded or storage disabled — silently drop. The in-memory
      // history is still correct for the live session.
    }
  }, HISTORY_FLUSH_DELAY_MS);
}

// Subscribe once at module load: every change to history schedules a
// debounced flush. Same-tick bursts collapse into one write.
{
  let lastRef: MatchRecord[] | null = null;
  useStore.subscribe((s) => {
    if (s.history !== lastRef) {
      lastRef = s.history;
      scheduleHistoryFlush();
    }
  });
}

// Best-effort final flush on pagehide — covers the "user kills the app
// during the 2 s debounce window" case without blocking the close path.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (!_historyFlushTimer) return;
    clearTimeout(_historyFlushTimer);
    _historyFlushTimer = null;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(useStore.getState().history));
    } catch { /* ignore */ }
  });
}

/* ───────── Helpers ───────── */

const NICK_ADJECTIVES = [
  "Quantum", "Logical", "Chaotic", "Stellar", "Sneaky", "Vortex", "Plasma",
  "Cosmic", "Velvet", "Crystal", "Hyper", "Solar", "Neon", "Phantom", "Iron",
  "Silent", "Lunar", "Pixel", "Atomic", "Frosty",
];
const NICK_NOUNS = [
  "Wolf", "Falcon", "Lynx", "Phoenix", "Specter", "Comet", "Probe", "Echo",
  "Drake", "Hawk", "Lion", "Tiger", "Raven", "Orca", "Stag", "Kraken",
  "Mantis", "Otter", "Viper", "Owl",
];

export function randomNickname(): string {
  const a = NICK_ADJECTIVES[Math.floor(Math.random() * NICK_ADJECTIVES.length)];
  const n = NICK_NOUNS[Math.floor(Math.random() * NICK_NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${a}${n}${num}`;
}

