/**
 * Catalogue — cartes BONUS V3 + finishers Constellation Pro.
 * Tranche de CARDS (cards.ts) : l'ORDRE des tranches et des clés compte
 * (ordre d'itération de CARDS → decks, hash online). Ne pas réordonner.
 */

import type { CardId, RankedCard } from "../rankedTypes";

export const V3_CARDS = {
  /* ───────────────────────────────────────────────────────────────────────
   * BONUS V3 — 20 new mechanics cards (see docs/CARTES_BONUS_V3.md)
   * ─────────────────────────────────────────────────────────────────────── */

  /* ⚪ V3 COMMONS — 1 mana */
  sablier: {
    id: "sablier", cost: 1, rarity: "common",
    target: "none", palette: "amber", glyph: "⏱️",
    nameKey: "ranked.cards.sablier.name", descKey: "ranked.cards.sablier.desc",
    targetHintKey: "ranked.cards.sablier.targetHint",
    art: "/Cards Bonus/sablier.webp",
  },
  remanence: {
    id: "remanence", cost: 1, rarity: "common",
    target: "lane", palette: "fuchsia", glyph: "👻",
    nameKey: "ranked.cards.remanence.name", descKey: "ranked.cards.remanence.desc",
    targetHintKey: "ranked.cards.remanence.targetHint",
    art: "/Cards Bonus/remanence.webp",
  },
  offre: {
    id: "offre", cost: 1, rarity: "common",
    target: "none", palette: "emerald", glyph: "🤝",
    nameKey: "ranked.cards.offre.name", descKey: "ranked.cards.offre.desc",
    targetHintKey: "ranked.cards.offre.targetHint",
    art: "/Cards Bonus/offre.webp",
  },
  braise: {
    id: "braise", cost: 1, rarity: "common",
    target: "none", palette: "orange", glyph: "🔥",
    nameKey: "ranked.cards.braise.name", descKey: "ranked.cards.braise.desc",
    targetHintKey: "ranked.cards.braise.targetHint",
    art: "/Cards Bonus/braise.webp",
  },
  echappee: {
    id: "echappee", cost: 1, rarity: "common", voie: "lizard",
    target: "lane", palette: "sky", glyph: "🏃",
    nameKey: "ranked.cards.echappee.name", descKey: "ranked.cards.echappee.desc",
    targetHintKey: "ranked.cards.echappee.targetHint",
    art: "/Cards Bonus/echappee.webp",
  },

  /* 🔵 V3 RARES — 2 mana */
  "oracle-inverse": {
    id: "oracle-inverse", cost: 2, rarity: "rare",
    target: "none", palette: "fuchsia", glyph: "🔮",
    nameKey: "ranked.cards.oracle-inverse.name", descKey: "ranked.cards.oracle-inverse.desc",
    targetHintKey: "ranked.cards.oracle-inverse.targetHint",
    art: "/Cards Bonus/oracle-inverse.webp",
  },
  fardeau: {
    id: "fardeau", cost: 2, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.fardeau.name", descKey: "ranked.cards.fardeau.desc",
    targetHintKey: "ranked.cards.fardeau.targetHint",
    art: "/Cards Bonus/fardeau.webp",
  },
  crepuscule: {
    id: "crepuscule", cost: 2, rarity: "rare",
    target: "lane", palette: "amber", glyph: "🌅",
    nameKey: "ranked.cards.crepuscule.name", descKey: "ranked.cards.crepuscule.desc",
    targetHintKey: "ranked.cards.crepuscule.targetHint",
    art: "/Cards Bonus/crepuscule.webp",
  },
  cascade: {
    id: "cascade", cost: 2, rarity: "rare",
    target: "none", palette: "sky", glyph: "💧",
    nameKey: "ranked.cards.cascade.name", descKey: "ranked.cards.cascade.desc",
    targetHintKey: "ranked.cards.cascade.targetHint",
    art: "/Cards Bonus/cascade.webp",
  },
  "echo-temporel": {
    id: "echo-temporel", cost: 2, rarity: "rare",
    target: "none", palette: "violet", glyph: "🕐",
    nameKey: "ranked.cards.echo-temporel.name", descKey: "ranked.cards.echo-temporel.desc",
    targetHintKey: "ranked.cards.echo-temporel.targetHint",
    art: "/Cards Bonus/echo-temporel.webp",
  },
  "ancre-temporelle": {
    id: "ancre-temporelle", cost: 2, rarity: "rare",
    target: "none", palette: "cyan", glyph: "⚓",
    nameKey: "ranked.cards.ancre-temporelle.name", descKey: "ranked.cards.ancre-temporelle.desc",
    targetHintKey: "ranked.cards.ancre-temporelle.targetHint",
    art: "/Cards Bonus/ancre-temporelle.webp",
  },

  /* 🟣 V3 EPICS — 3 mana */
  metamorphose: {
    id: "metamorphose", cost: 3, rarity: "epic",
    target: "none", palette: "emerald", glyph: "🦋",
    nameKey: "ranked.cards.metamorphose.name", descKey: "ranked.cards.metamorphose.desc",
    targetHintKey: "ranked.cards.metamorphose.targetHint",
    art: "/Cards Bonus/metamorphose.webp",
  },
  gaia: {
    id: "gaia", cost: 3, rarity: "epic", voie: "rock", kind: "passive",
    target: "none", palette: "emerald", glyph: "🛡️",
    nameKey: "ranked.cards.gaia.name", descKey: "ranked.cards.gaia.desc",
    targetHintKey: "ranked.cards.gaia.targetHint",
    art: "/Cards Bonus/gaia.webp",
  },
  "marchand-ames": {
    id: "marchand-ames", cost: 3, rarity: "epic",
    target: "none", palette: "rose", glyph: "💀",
    nameKey: "ranked.cards.marchand-ames.name", descKey: "ranked.cards.marchand-ames.desc",
    targetHintKey: "ranked.cards.marchand-ames.targetHint",
    art: "/Cards Bonus/marchand-ames.webp",
  },
  telepathie: {
    id: "telepathie", cost: 3, rarity: "epic",
    target: "none", palette: "violet", glyph: "🧠",
    nameKey: "ranked.cards.telepathie.name", descKey: "ranked.cards.telepathie.desc",
    targetHintKey: "ranked.cards.telepathie.targetHint",
    art: "/Cards Bonus/telepathie.webp",
  },
  paradoxe: {
    id: "paradoxe", cost: 3, rarity: "epic",
    target: "none", palette: "cyan", glyph: "⏳",
    nameKey: "ranked.cards.paradoxe.name", descKey: "ranked.cards.paradoxe.desc",
    targetHintKey: "ranked.cards.paradoxe.targetHint",
    art: "/Cards Bonus/paradoxe.webp",
  },
  benediction: {
    id: "benediction", cost: 3, rarity: "epic",
    target: "none", palette: "yellow", glyph: "✨",
    nameKey: "ranked.cards.benediction.name", descKey: "ranked.cards.benediction.desc",
    targetHintKey: "ranked.cards.benediction.targetHint",
    art: "/Cards Bonus/benediction.webp",
  },

  /* 🟡 V3 LEGENDARIES — 4 mana */
  schrodinger: {
    id: "schrodinger", cost: 4, rarity: "legendary",
    target: "none", palette: "fuchsia", glyph: "📦",
    nameKey: "ranked.cards.schrodinger.name", descKey: "ranked.cards.schrodinger.desc",
    targetHintKey: "ranked.cards.schrodinger.targetHint",
    art: "/Cards Bonus/schrodinger.webp",
  },
  juge: {
    id: "juge", cost: 4, rarity: "legendary", voie: "spock",
    target: "none", palette: "yellow", glyph: "⚖️",
    nameKey: "ranked.cards.juge.name", descKey: "ranked.cards.juge.desc",
    targetHintKey: "ranked.cards.juge.targetHint",
    art: "/Cards Bonus/juge.webp",
  },
  genese: {
    id: "genese", cost: 4, rarity: "legendary", voie: "spock",
    target: "none", palette: "yellow", glyph: "🌟",
    nameKey: "ranked.cards.genese.name", descKey: "ranked.cards.genese.desc",
    targetHintKey: "ranked.cards.genese.targetHint",
    art: "/Cards Bonus/genese.webp",
  },

  /* ✦ FINISHERS Constellation Pro — 1× par match, injectés à 3⭐, cost 4 mais
     l'effet justifie le prix (impact massif sur le board ou le hero pour le
     reste du match). Pro-only : arenaSupported() permet le cast en mode Pro
     uniquement. Glyphs emoji en placeholder (art final à faire). */
  "finisher-forteresse": {
    id: "finisher-forteresse", cost: 4, rarity: "legendary",
    target: "none", palette: "amber", glyph: "🛡️",
    nameKey: "ranked.cards.finisher-forteresse.name", descKey: "ranked.cards.finisher-forteresse.desc",
    targetHintKey: "ranked.cards.finisher-forteresse.targetHint",
    art: "/Cards Bonus/finisher-forteresse.webp",
  },
  "finisher-verger": {
    id: "finisher-verger", cost: 4, rarity: "legendary",
    target: "none", palette: "emerald", glyph: "🌿",
    nameKey: "ranked.cards.finisher-verger.name", descKey: "ranked.cards.finisher-verger.desc",
    targetHintKey: "ranked.cards.finisher-verger.targetHint",
    art: "/Cards Bonus/finisher-verger.webp",
  },
  "finisher-lame": {
    id: "finisher-lame", cost: 4, rarity: "legendary",
    target: "none", palette: "rose", glyph: "⚔️",
    nameKey: "ranked.cards.finisher-lame.name", descKey: "ranked.cards.finisher-lame.desc",
    targetHintKey: "ranked.cards.finisher-lame.targetHint",
    art: "/Cards Bonus/finisher-lame.webp",
  },
  "finisher-metamorphose": {
    id: "finisher-metamorphose", cost: 4, rarity: "legendary",
    target: "none", palette: "lime", glyph: "🐉",
    nameKey: "ranked.cards.finisher-metamorphose.name", descKey: "ranked.cards.finisher-metamorphose.desc",
    targetHintKey: "ranked.cards.finisher-metamorphose.targetHint",
    art: "/Cards Bonus/finisher-metamorphose.webp",
  },
  "finisher-calcul": {
    id: "finisher-calcul", cost: 4, rarity: "legendary",
    target: "none", palette: "cyan", glyph: "🌠",
    nameKey: "ranked.cards.finisher-calcul.name", descKey: "ranked.cards.finisher-calcul.desc",
    targetHintKey: "ranked.cards.finisher-calcul.targetHint",
    art: "/Cards Bonus/finisher-calcul.webp",
  },
} satisfies Partial<Record<CardId, RankedCard>>;
