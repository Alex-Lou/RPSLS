import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Move } from "./game";
import type { MatchRecord, PadId, Player, ThemeId } from "./types";
import type { Locale } from "./i18n";

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
    createdAt: Date.now(),
  };
}

interface AppState {
  player: Player;
  history: MatchRecord[];
  onboarded: boolean;
  locale: Locale;

  updateProfile: (patch: Partial<Pick<Player, "nickname" | "avatar" | "themeId" | "padId" | "difficulty">>) => void;
  recordMatch: (m: MatchRecord) => void;
  claimQuest: (id: string, xpReward: number, lpReward?: number) => void;
  recordDailyComplete: (date: string) => void;
  setOnboarded: (value: boolean) => void;
  setLocale: (locale: Locale) => void;
  resetProfile: () => void;
}

function detectLocale(): Locale {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  const code = nav.slice(0, 2).toLowerCase();
  if (code === "fr" || code === "es" || code === "de" || code === "it") return code;
  return "en";
}

const HISTORY_LIMIT = 100;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      player: defaultPlayer(),
      history: [],
      onboarded: false,
      locale: detectLocale(),

      setOnboarded: (value) => set({ onboarded: value }),
      setLocale: (locale) => set({ locale }),

      updateProfile: (patch) =>
        set((s) => ({ player: { ...s.player, ...patch } })),

      recordMatch: (m) =>
        set((s) => {
          const p = structuredClone(s.player);
          p.xp = Math.max(0, p.xp + m.xpDelta);
          p.rankLp = Math.max(0, p.rankLp + m.lpDelta);
          if (m.outcome === "win") p.stats.wins++;
          else if (m.outcome === "loss") p.stats.losses++;
          else p.stats.draws++;
          for (const r of m.rounds) {
            const k = r.playerMove as Move;
            p.stats.byMove[k].picked++;
            if (r.result === "win") p.stats.byMove[k].won++;
          }
          return {
            player: p,
            history: [m, ...s.history].slice(0, HISTORY_LIMIT),
          };
        }),

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
    }),
    {
      name: "rpsls-app-state",
      version: 8,
      migrate: (persisted: unknown, version: number): AppState => {
        const state = persisted as {
          player?: Partial<Player> & { customVariants?: unknown };
          history?: MatchRecord[];
          onboarded?: boolean;
          locale?: Locale;
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
        return state as AppState;
      },
    }
  )
);

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

/** Convenience selectors */
export function setTheme(themeId: ThemeId) {
  useStore.getState().updateProfile({ themeId });
}

export function setPad(padId: PadId) {
  useStore.getState().updateProfile({ padId });
}
