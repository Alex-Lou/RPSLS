import type { CardId, CardRarity } from "../rankedTypes";

// Taille du deck PAR MODE (Alex 2026-06-13) : Classé = 6, Pro = 8. Decks
// SÉPARÉS dans le store (rankedDeck / arenaDeck) → éditer l'un n'écrase pas
// l'autre. Calculée dans le composant à partir de la prop `mode`.
export const SLOTS_BY_MODE = { ranked: 6, arena: 10 } as const;

/** Compact French labels per rarity for the filter tabs. */
export const RARITY_FR: Record<CardRarity, string> = {
  common: "Communes",
  rare: "Rares",
  epic: "Épiques",
  legendary: "Légendaires",
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

export const UNLOCK_HINTS: Partial<Record<CardId, string>> = {
  mirror: "Gagne 3 matchs en mode classé",
  riposte: "Gagne 5 matchs en mode classé",
  curse: "Gagne 10 matchs en mode classé",
  gambit: "Atteins 1200 LP",
  heist: "Atteins le rang Silver",
  tide: "Gagne un tournoi",
  oracle: "Atteins le rang Gold",
  vortex: "Fais 3 sweeps (3-0) en mode classé",
  supernova: "Atteins le rang Platinum",
  // Bonus cards — obtained through the boutique (packs / forge).
  prescience: "Ouvre des packs à la boutique",
  cadence: "Ouvre des packs à la boutique",
  mascarade: "Ouvre des packs à la boutique",
  boussole: "Ouvre des packs à la boutique",
  sangsue: "Ouvre des packs ou forge-la",
  rempart: "Ouvre des packs ou forge-la",
  pillage: "Ouvre des packs ou forge-la",
  "trou-noir": "Ouvre des packs ou forge-la",
  prophetie: "Ouvre des packs ou forge-la",
  conduit: "Ouvre des packs ou forge-la",
  trinite: "Pack rare ou forge légendaire",
  // V3 bonus cards — same pack/forge economy as Lot 1.
  sablier: "Ouvre des packs à la boutique",
  remanence: "Ouvre des packs à la boutique",
  offre: "Ouvre des packs à la boutique",
  braise: "Ouvre des packs à la boutique",
  echappee: "Ouvre des packs à la boutique",
  "oracle-inverse": "Ouvre des packs ou forge-la",
  fardeau: "Ouvre des packs ou forge-la",
  crepuscule: "Ouvre des packs ou forge-la",
  cascade: "Ouvre des packs ou forge-la",
  "echo-temporel": "Ouvre des packs ou forge-la",
  "ancre-temporelle": "Ouvre des packs ou forge-la",
  metamorphose: "Ouvre des packs ou forge-la",
  gaia: "Ouvre des packs ou forge-la",
  "marchand-ames": "Ouvre des packs ou forge-la",
  telepathie: "Ouvre des packs ou forge-la",
  paradoxe: "Ouvre des packs ou forge-la",
  benediction: "Ouvre des packs ou forge-la",
  schrodinger: "Pack rare ou forge légendaire",
  juge: "Pack rare ou forge légendaire",
  genese: "Pack rare ou forge légendaire",
};
