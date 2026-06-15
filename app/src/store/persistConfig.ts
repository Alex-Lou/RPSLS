import type { PersistOptions } from "zustand/middleware";
import type { MatchRecord, Player } from "../types";
import type { Locale } from "../i18n";
import { sanitisePersisted } from "./storeMigrationGuard";
import type { AppState, ServerConfig } from "./storeTypes";
import { detectLocale, defaultServerConfig, DEFAULT_CLOUD_URL } from "./storeDefaults";
import { HISTORY_STORAGE_KEY } from "./historySideChannel";

export const persistOptions: PersistOptions<AppState> = {
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
  // SECURITY: run the persisted-state guard on EVERY hydration, not only on a
  // version bump. Zustand calls `migrate` ONLY when the stored `version`
  // differs from ours, so a tampered localStorage that keeps the current
  // version would otherwise skip sanitisePersisted entirely — and with it
  // every guard (avatar / claimToken / custom image URLs / enum fallbacks).
  // `merge` runs on each boot, so the guard always fires. (migrate keeps its
  // own call for the upgrade path; sanitisePersisted is idempotent.)
  merge: (persisted, current) =>
    ({ ...(current as object), ...(sanitisePersisted(persisted) as object) }) as AppState,
};
