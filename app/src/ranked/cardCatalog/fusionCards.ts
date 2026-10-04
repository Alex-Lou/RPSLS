/**
 * Catalogue — cartes de FUSION (Forge Arena, kind:"fusion").
 * Tranche de CARDS (cards.ts) : l'ORDRE des tranches et des clés compte
 * (ordre d'itération de CARDS → decks, hash online). Ne pas réordonner.
 */

import type { CardId, RankedCard } from "../rankedTypes";

export const FUSION_CARDS = {
  /* ── ⚗️ Cartes de FUSION (Forge Arena 2026-06-13) — kind:"fusion" :
   *    créées par la Forge uniquement, exclues collection/decks/packs.
   *    Coût = somme des 2 ingrédients − 1 (capé à 4). ── */
  "frappe-parfaite": {
    id: "frappe-parfaite", cost: 2, rarity: "rare", kind: "fusion",
    target: "lane", palette: "amber", glyph: "🎯",
    nameKey: "ranked.cards.frappe-parfaite.name", descKey: "ranked.cards.frappe-parfaite.desc",
    targetHintKey: "ranked.cards.frappe-parfaite.targetHint", art: "/Cards Bonus/Frappe parfaite.webp",
  },
  "bastion": {
    id: "bastion", cost: 2, rarity: "rare", kind: "fusion", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🏰",
    nameKey: "ranked.cards.bastion.name", descKey: "ranked.cards.bastion.desc",
    targetHintKey: "ranked.cards.bastion.targetHint", art: "/Cards Bonus/BASTION.webp",
  },
  "avalanche": {
    id: "avalanche", cost: 1, rarity: "rare", kind: "fusion", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏔️",
    nameKey: "ranked.cards.avalanche.name", descKey: "ranked.cards.avalanche.desc",
    targetHintKey: "ranked.cards.avalanche.targetHint", art: "/Cards Bonus/AVALANCHE.webp",
  },
  "citadelle": {
    id: "citadelle", cost: 3, rarity: "epic", kind: "fusion", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏯",
    nameKey: "ranked.cards.citadelle.name", descKey: "ranked.cards.citadelle.desc",
    targetHintKey: "ranked.cards.citadelle.targetHint", art: "/Cards Bonus/Citadelle.webp",
  },
  "cataclysme": {
    id: "cataclysme", cost: 4, rarity: "legendary", kind: "fusion", voie: "rock",
    target: "none", palette: "zinc", glyph: "⛰️",
    nameKey: "ranked.cards.cataclysme.name", descKey: "ranked.cards.cataclysme.desc",
    targetHintKey: "ranked.cards.cataclysme.targetHint", art: "/Cards Bonus/Cataclysme.webp",
  },
  "estocade": {
    id: "estocade", cost: 3, rarity: "epic", kind: "fusion", voie: "scissors",
    target: "none", palette: "rose", glyph: "⚔️",
    nameKey: "ranked.cards.estocade.name", descKey: "ranked.cards.estocade.desc",
    targetHintKey: "ranked.cards.estocade.targetHint", art: "/Cards Bonus/Estocade.webp",
  },
  "source-vitale": {
    id: "source-vitale", cost: 1, rarity: "rare", kind: "fusion",
    target: "lane", palette: "emerald", glyph: "⛲",
    nameKey: "ranked.cards.source-vitale.name", descKey: "ranked.cards.source-vitale.desc",
    targetHintKey: "ranked.cards.source-vitale.targetHint", art: "/Cards Bonus/SOURCE VITALE.webp",
  },
  "bosquet-epineux": {
    // Fusion ronces+photosynthese (Alex 2026-06-30) — gardien épineux fortifié ; art à fournir.
    id: "bosquet-epineux", cost: 3, rarity: "epic", kind: "fusion", voie: "paper",
    target: "lane", palette: "emerald", glyph: "🌳",
    nameKey: "ranked.cards.bosquet-epineux.name", descKey: "ranked.cards.bosquet-epineux.desc",
    targetHintKey: "ranked.cards.bosquet-epineux.targetHint", art: "/Cards Bonus/Bosquet Épineux.webp",
  },
  "effacement": {
    // Fusion loi-de-causalité+trou-noir (Alex 2026-06-30) — contrôle total ; art à fournir.
    id: "effacement", cost: 4, rarity: "epic", kind: "fusion", voie: "spock",
    target: "lane", palette: "indigo", glyph: "⬛",
    nameKey: "ranked.cards.effacement.name", descKey: "ranked.cards.effacement.desc",
    targetHintKey: "ranked.cards.effacement.targetHint", art: "/Cards Bonus/Effacement.webp",
  },
  "omniscience": {
    id: "omniscience", cost: 2, rarity: "epic", kind: "fusion",
    target: "none", palette: "cyan", glyph: "👁️",
    nameKey: "ranked.cards.omniscience.name", descKey: "ranked.cards.omniscience.desc",
    targetHintKey: "ranked.cards.omniscience.targetHint", art: "/Cards Bonus/OMNISCIENCE.webp",
  },
  "cocon": {
    id: "cocon", cost: 3, rarity: "epic", kind: "fusion",
    target: "lane", palette: "lime", glyph: "🛡",
    nameKey: "ranked.cards.cocon.name", descKey: "ranked.cards.cocon.desc",
    targetHintKey: "ranked.cards.cocon.targetHint", art: "/Cards Bonus/cocon.webp",
  },
  "apocalypse": {
    id: "apocalypse", cost: 4, rarity: "legendary", kind: "fusion",
    target: "none", palette: "rose", glyph: "☄️",
    nameKey: "ranked.cards.apocalypse.name", descKey: "ranked.cards.apocalypse.desc",
    targetHintKey: "ranked.cards.apocalypse.targetHint", art: "/Cards Bonus/APOCALYPSE.webp",
  },
  "imposteur": {
    id: "imposteur", cost: 3, rarity: "legendary", voie: "lizard", kind: "fusion",
    target: "none", palette: "violet", glyph: "🎭",
    nameKey: "ranked.cards.imposteur.name", descKey: "ranked.cards.imposteur.desc",
    targetHintKey: "ranked.cards.imposteur.targetHint", art: "/Cards Bonus/IMPOSTEUR.webp",
  },
  // ── Fusions Voie Mirage (Alex 2026-06-28) ──
  "galerie-des-glaces": {
    id: "galerie-des-glaces", cost: 2, rarity: "epic", voie: "lizard", kind: "fusion",
    target: "none", palette: "cyan", glyph: "🪞",
    nameKey: "ranked.cards.galerie-des-glaces.name", descKey: "ranked.cards.galerie-des-glaces.desc",
    targetHintKey: "ranked.cards.galerie-des-glaces.targetHint", art: "/Cards Bonus/galerie-des-glaces.webp",
  },
  "mascarade-souveraine": {
    id: "mascarade-souveraine", cost: 3, rarity: "epic", voie: "lizard", kind: "fusion",
    target: "lane", palette: "violet", glyph: "👑",
    nameKey: "ranked.cards.mascarade-souveraine.name", descKey: "ranked.cards.mascarade-souveraine.desc",
    targetHintKey: "ranked.cards.mascarade-souveraine.targetHint", art: "/Cards Bonus/mascarade-souveraine.webp",
  },
  "apotheose-spectrale": {
    id: "apotheose-spectrale", cost: 4, rarity: "legendary", voie: "lizard", kind: "fusion",
    target: "none", palette: "indigo", glyph: "🌌",
    nameKey: "ranked.cards.apotheose-spectrale.name", descKey: "ranked.cards.apotheose-spectrale.desc",
    targetHintKey: "ranked.cards.apotheose-spectrale.targetHint", art: "/Cards Bonus/apotheose-spectrale.webp",
  },
} satisfies Partial<Record<CardId, RankedCard>>;
