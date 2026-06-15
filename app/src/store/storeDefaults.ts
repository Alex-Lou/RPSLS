import type { Player } from "../types";
import type { Locale } from "../i18n";
import { STARTER_COLLECTION, DEFAULT_RANKED_DECK, DEFAULT_ARENA_DECK } from "../ranked/cards";
import type { ServerConfig } from "./storeTypes";

export const emptyByMove = () => ({
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
    cardCollection: [...STARTER_COLLECTION],
    rankedDeck: [...DEFAULT_RANKED_DECK],
    arenaDeck: [...DEFAULT_ARENA_DECK],
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

export function detectLocale(): Locale {
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

export const HISTORY_LIMIT = 100;

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
