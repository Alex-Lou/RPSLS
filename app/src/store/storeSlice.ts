import type { StateCreator } from "zustand";
import type { Move } from "../engine/game";
import type { MatchRecord } from "../types";
import { CLASSE_LP, classeLpDelta } from "../types";
import { todayDateKey } from "../engine/daily";
import { clearAnchor } from "../online/playerAnchor";
import { abandonPenaltyLp, activeAbandonCount, nextAbandon } from "../match/forfeit";
import { nextStreak, streakBonusXp } from "../match/streak";
import {
  ARENA_ECLATS,
  ARENA_XP,
  SEASON_DURATION_MS,
  eclatsReward,
  masteryXpForMatch,
  seasonRewardForLp,
  softResetLp,
} from "../engine/economy";
import type { AppState } from "./storeTypes";
import { defaultPlayer, detectLocale, defaultServerConfig, HISTORY_LIMIT } from "./storeDefaults";
import { applyRankedUnlocks } from "./rankedUnlocks";
import { enqueueCpuReward, enqueueUnlocks } from "../online/wallet";

export const createSlice: StateCreator<AppState> = (set, get) => ({
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

  recordMatch: (m) => {
    const before = get().player.cardCollection ?? [];
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
    });
    // Portefeuille actif : le gain local ci-dessus n'est qu'un affichage
    // optimiste. Un match arbitré par le serveur (vs humain en ligne) est crédité
    // par le serveur lui-même ; tout le reste (CPU, hotseat) est RÉCLAMÉ au
    // serveur, qui applique barème + plafond quotidien.
    const serverRefereed = m.opponent.kind === "human" && m.mode !== "hotseat";
    if (!serverRefereed && !m.forfeit && eclatsReward(m.mode, m.outcome) > 0) {
      enqueueCpuReward(m.mode, m.outcome);
    }
    enqueueUnlocks((get().player.cardCollection ?? []).filter((id) => !before.includes(id)));
  },

  // Ladder Classé SEUL (classeLp + classeStats), sans toucher rankLp/xp/history —
  // le match online correspondant est déjà enregistré (mode "online", rankLp
  // serveur). Miroir exact de la branche `m.mode === "ranked"` de recordMatch.
  recordClasseOutcome: (outcome, forfeit) =>
    set((s) => {
      const p = structuredClone(s.player);
      const dLp = forfeit ? CLASSE_LP.forfeit : classeLpDelta(outcome);
      p.classeLp = Math.max(0, (p.classeLp ?? 1000) + dLp);
      if (!forfeit) {
        const cs = p.classeStats ?? { wins: 0, losses: 0, draws: 0 };
        if (outcome === "win") cs.wins++;
        else if (outcome === "loss") cs.losses++;
        else cs.draws++;
        p.classeStats = cs;
      }
      return { player: p };
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
  recordArenaMatch: (outcome, meta) => {
    const before = get().player.cardCollection ?? [];
    set((s) => {
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
      const reward = ARENA_ECLATS[outcome];
      const xpDelta = meta?.forfeit ? 0 : ARENA_XP[outcome];
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
        xpDelta,
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
          xp: Math.max(0, s.player.xp + xpDelta),
          eclats: (s.player.eclats ?? 0) + reward,
          cardCollection,
        },
        history: newHistory,
      };
    });
    // Portefeuille actif : un match Arena EN LIGNE est crédité par le serveur
    // (fin de match ccg) ; contre le CPU, le gain est réclamé (cf. recordMatch).
    if (!meta?.online) enqueueCpuReward("arena", outcome);
    enqueueUnlocks((get().player.cardCollection ?? []).filter((id) => !before.includes(id)));
  },

  restoreHistory: (h) => set({ history: h }),
  // Editing a deck stamps `syncedAt`: it marks this install as "no longer a
  // blank slate", so mergeServerState's fresh-install gate can't silently
  // replace a deliberately-chosen deck with the cloud copy before the first
  // sync lands (Alex audit 2026-06-14).
  setRankedDeck: (deck) => set((s) => ({
    player: { ...s.player, rankedDeck: deck, syncedAt: Date.now() },
  })),
  setArenaDeck: (deck) => set((s) => ({
    player: { ...s.player, arenaDeck: deck, syncedAt: Date.now() },
  })),
  setArenaVoieDeck: (voie, deck) => set((s) => ({
    player: {
      ...s.player,
      arenaDeckByVoie: { ...(s.player.arenaDeckByVoie ?? {}), [voie]: deck },
      syncedAt: Date.now(),
    },
  })),
  setArenaAffinity: (affinity) => set((s) => ({
    player: { ...s.player, arenaAffinity: affinity },
  })),

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
    // Portefeuille actif : la saison est cadencée et versée par le SERVEUR
    // (horloge serveur) — cf. online/wallet.ts, qui pose `seasonRollover`.
    if (player.walletActive) return null;
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

  seasonRollover: null,
  setSeasonRollover: (r) => set({ seasonRollover: r }),

  applyServerSync: (patch) =>
    set((s) => ({ player: { ...s.player, ...patch } })),
  logout: () => {
    // Break the durable account link so the next boot doesn't restore it,
    // then become a fresh guest. The account's data stays in the cloud
    // (under its own player_id) — logging back in restores everything.
    void clearAnchor();
    set({ player: defaultPlayer(), history: [] });
  },
  revokePremiumSet: (setId) =>
    set((s) => ({
      player: {
        ...s.player,
        ownedPremiumSets: (s.player.ownedPremiumSets ?? []).filter((id) => id !== setId),
      },
    })),
});
