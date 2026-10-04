import type { CardId, CardRarity } from "../rankedTypes";

// Taille du deck PAR MODE (Alex 2026-06-13) : Classé = 6, Pro = 8. Decks
// SÉPARÉS dans le store (rankedDeck / arenaDeck) → éditer l'un n'écrase pas
// l'autre. Calculée dans le composant à partir de la prop `mode`.
export const SLOTS_BY_MODE = { ranked: 6, arena: 10 } as const;

/** i18n keys of the singular rarity labels (card chips, detail sheet). */
export const RARITY_KEY: Record<CardRarity, string> = {
  common: "ranked.rarity.common",
  rare: "ranked.rarity.rare",
  epic: "ranked.rarity.epic",
  legendary: "ranked.rarity.legendary",
};

/** i18n keys of the compact (plural) rarity labels for the filter tabs. */
export const RARITY_TAB_KEY: Record<CardRarity, string> = {
  common: "deck.rarityTab.common",
  rare: "deck.rarityTab.rare",
  epic: "deck.rarityTab.epic",
  legendary: "deck.rarityTab.legendary",
};

/** Dot color per rarity — used in tab pills and section dividers. */
export const RARITY_DOT: Record<CardRarity, string> = {
  common: "bg-zinc-400",
  rare: "bg-blue-400",
  epic: "bg-violet-400",
  legendary: "bg-amber-400",
};

/** Tab pill ring color when ACTIVE (mirrors RARITY_DOT). */
export const RARITY_RING: Record<CardRarity, string> = {
  common: "ring-zinc-400/60 bg-zinc-400/15 text-zinc-100",
  rare: "ring-blue-400/60 bg-blue-400/15 text-blue-100",
  epic: "ring-violet-400/60 bg-violet-400/15 text-violet-100",
  legendary: "ring-amber-400/60 bg-amber-400/15 text-amber-100",
};

/** i18n keys of the unlock hints shown on locked cards. */
export const UNLOCK_HINTS: Partial<Record<CardId, string>> = {
  mirror: "deck.unlock.win3",
  riposte: "deck.unlock.win5",
  curse: "deck.unlock.win10",
  gambit: "deck.unlock.lp1200",
  heist: "deck.unlock.silver",
  tide: "deck.unlock.tournament",
  oracle: "deck.unlock.gold",
  vortex: "deck.unlock.sweeps3",
  supernova: "deck.unlock.platinum",
  // Bonus cards — obtained through the boutique (packs / forge).
  prescience: "deck.unlock.packs",
  cadence: "deck.unlock.packs",
  mascarade: "deck.unlock.packs",
  boussole: "deck.unlock.packs",
  sangsue: "deck.unlock.packsOrForge",
  rempart: "deck.unlock.packsOrForge",
  pillage: "deck.unlock.packsOrForge",
  "trou-noir": "deck.unlock.packsOrForge",
  prophetie: "deck.unlock.packsOrForge",
  conduit: "deck.unlock.packsOrForge",
  trinite: "deck.unlock.rarePackOrForge",
  // V3 bonus cards — same pack/forge economy as Lot 1.
  sablier: "deck.unlock.packs",
  remanence: "deck.unlock.packs",
  offre: "deck.unlock.packs",
  braise: "deck.unlock.packs",
  echappee: "deck.unlock.packs",
  "oracle-inverse": "deck.unlock.packsOrForge",
  fardeau: "deck.unlock.packsOrForge",
  crepuscule: "deck.unlock.packsOrForge",
  cascade: "deck.unlock.packsOrForge",
  "echo-temporel": "deck.unlock.packsOrForge",
  "ancre-temporelle": "deck.unlock.packsOrForge",
  metamorphose: "deck.unlock.packsOrForge",
  gaia: "deck.unlock.packsOrForge",
  "marchand-ames": "deck.unlock.packsOrForge",
  telepathie: "deck.unlock.packsOrForge",
  paradoxe: "deck.unlock.packsOrForge",
  benediction: "deck.unlock.packsOrForge",
  schrodinger: "deck.unlock.rarePackOrForge",
  juge: "deck.unlock.rarePackOrForge",
  genese: "deck.unlock.rarePackOrForge",
};
