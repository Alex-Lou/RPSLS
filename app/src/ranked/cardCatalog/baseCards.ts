/**
 * Catalogue — cartes de base (commons → legendary, Lot 1 + arts orphelins + « à la pioche »).
 * Tranche de CARDS (cards.ts) : l'ORDRE des tranches et des clés compte
 * (ordre d'itération de CARDS → decks, hash online). Ne pas réordonner.
 */

import type { CardId, RankedCard } from "../rankedTypes";

export const BASE_CARDS = {
  /* ⚪ COMMONS — 1 mana */
  aegis: {
    id: "aegis", cost: 1, rarity: "common",
    target: "lane", palette: "sky", glyph: "🛡️",
    nameKey: "ranked.cards.aegis.name", descKey: "ranked.cards.aegis.desc",
    targetHintKey: "ranked.cards.aegis.targetHint",
    art: "/Cards Bonus/aegis.webp",
  },
  precision: {
    id: "precision", cost: 1, rarity: "common", voie: "scissors",
    target: "lane", palette: "emerald", glyph: "🎯",
    nameKey: "ranked.cards.precision.name", descKey: "ranked.cards.precision.desc",
    targetHintKey: "ranked.cards.precision.targetHint",
    art: "/Cards Bonus/precision.webp",
  },
  anchor: {
    id: "anchor", cost: 1, rarity: "common", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.anchor.name", descKey: "ranked.cards.anchor.desc",
    targetHintKey: "ranked.cards.anchor.targetHint",
    art: "/Cards Bonus/anchor.webp",
  },
  "second-wind": {
    id: "second-wind", cost: 1, rarity: "common", voie: "paper",
    target: "self", palette: "teal", glyph: "🩹",
    nameKey: "ranked.cards.second-wind.name", descKey: "ranked.cards.second-wind.desc",
    targetHintKey: "ranked.cards.second-wind.targetHint",
    art: "/Cards Bonus/second-wind.webp",
  },
  prescience: {
    id: "prescience", cost: 1, rarity: "common", voie: "lizard",
    target: "none", palette: "cyan", glyph: "🔮",
    nameKey: "ranked.cards.prescience.name", descKey: "ranked.cards.prescience.desc",
    targetHintKey: "ranked.cards.prescience.targetHint",
    art: "/Cards Bonus/prescience.webp",
  },
  cadence: {
    id: "cadence", cost: 1, rarity: "common", kind: "passive",
    target: "none", palette: "teal", glyph: "⏳",
    nameKey: "ranked.cards.cadence.name", descKey: "ranked.cards.cadence.desc",
    targetHintKey: "ranked.cards.cadence.targetHint",
    art: "/Cards Bonus/cadence.webp",
  },
  mascarade: {
    id: "mascarade", cost: 1, rarity: "common", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🎭",
    nameKey: "ranked.cards.mascarade.name", descKey: "ranked.cards.mascarade.desc",
    targetHintKey: "ranked.cards.mascarade.targetHint",
    art: "/Cards Bonus/mascarade.webp",
  },
  boussole: {
    id: "boussole", cost: 1, rarity: "common",
    target: "none", palette: "sky", glyph: "🧭",
    nameKey: "ranked.cards.boussole.name", descKey: "ranked.cards.boussole.desc",
    targetHintKey: "ranked.cards.boussole.targetHint",
    art: "/Cards Bonus/boussole.webp",
  },

  /* 🔵 RARES — 2 mana */
  surge: {
    id: "surge", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "amber", glyph: "⚡",
    nameKey: "ranked.cards.surge.name", descKey: "ranked.cards.surge.desc",
    targetHintKey: "ranked.cards.surge.targetHint",
    art: "/Cards Bonus/surge.webp",
  },
  augur: {
    id: "augur", cost: 2, rarity: "rare", voie: "spock",
    target: "lane-reveal", palette: "violet", glyph: "👁️",
    nameKey: "ranked.cards.augur.name", descKey: "ranked.cards.augur.desc",
    targetHintKey: "ranked.cards.augur.targetHint",
    art: "/Cards Bonus/augur.webp",
  },
  riposte: {
    id: "riposte", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "pink", glyph: "⚔️",
    nameKey: "ranked.cards.riposte.name", descKey: "ranked.cards.riposte.desc",
    targetHintKey: "ranked.cards.riposte.targetHint",
    art: "/Cards Bonus/riposte.webp",
  },
  curse: {
    id: "curse", cost: 2, rarity: "rare",
    target: "lane", palette: "rose", glyph: "💀",
    nameKey: "ranked.cards.curse.name", descKey: "ranked.cards.curse.desc",
    targetHintKey: "ranked.cards.curse.targetHint",
    art: "/Cards Bonus/curse.webp",
  },
  mirror: {
    id: "mirror", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "🪞",
    nameKey: "ranked.cards.mirror.name", descKey: "ranked.cards.mirror.desc",
    targetHintKey: "ranked.cards.mirror.targetHint",
    art: "/Cards Bonus/mirror.webp",
  },
  sangsue: {
    id: "sangsue", cost: 2, rarity: "rare", voie: "paper",
    target: "lane", palette: "rose", glyph: "🩸",
    nameKey: "ranked.cards.sangsue.name", descKey: "ranked.cards.sangsue.desc",
    targetHintKey: "ranked.cards.sangsue.targetHint",
    art: "/Cards Bonus/sangsue.webp",
  },
  rempart: {
    id: "rempart", cost: 2, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏰",
    nameKey: "ranked.cards.rempart.name", descKey: "ranked.cards.rempart.desc",
    targetHintKey: "ranked.cards.rempart.targetHint",
    art: "/Cards Bonus/rempart.webp",
  },
  pillage: {
    id: "pillage", cost: 2, rarity: "rare", kind: "passive",
    target: "none", palette: "orange", glyph: "🧤",
    nameKey: "ranked.cards.pillage.name", descKey: "ranked.cards.pillage.desc",
    targetHintKey: "ranked.cards.pillage.targetHint",
    art: "/Cards Bonus/pillage.webp",
  },

  /* 🟣 EPICS — 3 mana */
  heist: {
    // Round 9 fix Alex point #4 : Heist target était "lane" mais applyHeist
    // ignore la lane (damage hero direct + draw 1). Changé en "none" pour
    // que l'effet soit immédiat sans cible — cohérent avec la mécanique.
    id: "heist", cost: 3, rarity: "epic",
    target: "none", palette: "orange", glyph: "🏴‍☠️",
    nameKey: "ranked.cards.heist.name", descKey: "ranked.cards.heist.desc",
    targetHintKey: "ranked.cards.heist.targetHint",
    art: "/Cards Bonus/heist.webp",
  },
  razzia: {
    // RAZZIA (Alex 2026-06-13) — vole la carte sur la FORGE adverse (déjà
    // forgée/déposée et non récupérée). Légendaire → EXILÉE après usage
    // (1×/partie, c'est un MOMENT). Effet immédiat, pas de cible (auto sur la
    // forge adverse). Sans forge adverse remplie : sans effet. (« pillage » est
    // déjà pris par un PASSIF — d'où « razzia ».)
    id: "razzia", cost: 2, rarity: "legendary",
    target: "none", palette: "fuchsia", glyph: "🗝️",
    nameKey: "ranked.cards.razzia.name", descKey: "ranked.cards.razzia.desc",
    targetHintKey: "ranked.cards.razzia.targetHint",
    art: "/Cards Bonus/Razzia.webp",
  },
  // ── 6 arts orphelins câblés (Alex 2026-06-13) — usages inventés depuis le
  //    nom + l'image, validés "OUI GO". Effets Arena ; sans effet en Classé. ──
  surcharge: {
    id: "surcharge", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "amber", glyph: "⚡",
    nameKey: "ranked.cards.surcharge.name", descKey: "ranked.cards.surcharge.desc",
    targetHintKey: "ranked.cards.surcharge.targetHint",
    art: "/Cards Bonus/Surcharge.webp",
  },
  toxine: {
    id: "toxine", cost: 2, rarity: "rare",
    target: "lane", palette: "lime", glyph: "☠️",
    nameKey: "ranked.cards.toxine.name", descKey: "ranked.cards.toxine.desc",
    targetHintKey: "ranked.cards.toxine.targetHint",
    art: "/Cards Bonus/Toxine.webp",
  },
  echo: {
    id: "echo", cost: 2, rarity: "rare",
    target: "none", palette: "cyan", glyph: "🔊",
    nameKey: "ranked.cards.echo.name", descKey: "ranked.cards.echo.desc",
    targetHintKey: "ranked.cards.echo.targetHint",
    art: "/Cards Bonus/Echo.webp",
  },
  rappel: {
    id: "rappel", cost: 3, rarity: "epic",
    target: "lane", palette: "violet", glyph: "↩️",
    nameKey: "ranked.cards.rappel.name", descKey: "ranked.cards.rappel.desc",
    targetHintKey: "ranked.cards.rappel.targetHint",
    art: "/Cards Bonus/Rappel.webp",
  },
  "double-mot": {
    id: "double-mot", cost: 3, rarity: "epic", voie: "scissors",
    target: "lane", palette: "sky", glyph: "📜",
    nameKey: "ranked.cards.double-mot.name", descKey: "ranked.cards.double-mot.desc",
    targetHintKey: "ranked.cards.double-mot.targetHint",
    art: "/Cards Bonus/Double Mot.webp",
  },
  chronomancien: {
    id: "chronomancien", cost: 2, rarity: "epic", voie: "spock",
    target: "self", palette: "indigo", glyph: "⏳",
    nameKey: "ranked.cards.chronomancien.name", descKey: "ranked.cards.chronomancien.desc",
    targetHintKey: "ranked.cards.chronomancien.targetHint",
    art: "/Cards Bonus/Chronomancien.webp",
  },
  // ── ⚡ Cartes « À LA PIOCHE » (Cast When Drawn, Alex 2026-06-13) — se
  //    déclenchent au TIRAGE (cf. arenaCastOnDraw). cost 1 = cosmétique
  //    (GRATUITES, jamais jouées comme sorts) ; target "none" ; art glyph. ──
  "coup-de-bol": {
    id: "coup-de-bol", cost: 1, rarity: "common",
    target: "none", palette: "amber", glyph: "🎰",
    nameKey: "ranked.cards.coup-de-bol.name", descKey: "ranked.cards.coup-de-bol.desc",
    targetHintKey: "ranked.cards.coup-de-bol.targetHint",
    art: "/Cards Bonus/Coup de Bol.webp",
  },
  "bouffee-air": {
    id: "bouffee-air", cost: 1, rarity: "common",
    target: "none", palette: "emerald", glyph: "💨",
    nameKey: "ranked.cards.bouffee-air.name", descKey: "ranked.cards.bouffee-air.desc",
    targetHintKey: "ranked.cards.bouffee-air.targetHint",
    art: "/Cards Bonus/Bouffée d'Air.webp",
  },
  cafeine: {
    id: "cafeine", cost: 1, rarity: "common",
    target: "none", palette: "amber", glyph: "☕",
    nameKey: "ranked.cards.cafeine.name", descKey: "ranked.cards.cafeine.desc",
    targetHintKey: "ranked.cards.cafeine.targetHint",
    art: "/Cards Bonus/Caféine.webp",
  },
  tuile: {
    id: "tuile", cost: 1, rarity: "common",
    target: "none", palette: "zinc", glyph: "🌧️",
    nameKey: "ranked.cards.tuile.name", descKey: "ranked.cards.tuile.desc",
    targetHintKey: "ranked.cards.tuile.targetHint",
    art: "/Cards Bonus/Tuile.webp",
  },
  "eclair-genie": {
    id: "eclair-genie", cost: 1, rarity: "rare",
    target: "none", palette: "cyan", glyph: "💡",
    nameKey: "ranked.cards.eclair-genie.name", descKey: "ranked.cards.eclair-genie.desc",
    targetHintKey: "ranked.cards.eclair-genie.targetHint",
    art: "/Cards Bonus/Éclair de Génie.webp",
  },
  "patate-chaude": {
    id: "patate-chaude", cost: 1, rarity: "rare",
    target: "none", palette: "orange", glyph: "🥔",
    nameKey: "ranked.cards.patate-chaude.name", descKey: "ranked.cards.patate-chaude.desc",
    targetHintKey: "ranked.cards.patate-chaude.targetHint",
    art: "/Cards Bonus/Patate Chaude.webp",
  },
  "pile-ou-face": {
    id: "pile-ou-face", cost: 1, rarity: "rare",
    target: "none", palette: "fuchsia", glyph: "🪙",
    nameKey: "ranked.cards.pile-ou-face.name", descKey: "ranked.cards.pile-ou-face.desc",
    targetHintKey: "ranked.cards.pile-ou-face.targetHint",
    art: "/Cards Bonus/Pile ou Face.webp",
  },
  "trefle-chance": {
    id: "trefle-chance", cost: 1, rarity: "epic",
    target: "none", palette: "lime", glyph: "🍀",
    nameKey: "ranked.cards.trefle-chance.name", descKey: "ranked.cards.trefle-chance.desc",
    targetHintKey: "ranked.cards.trefle-chance.targetHint",
    art: "/Cards Bonus/Trèfle Porte-Bonheur.webp",
  },
  sursaut: {
    id: "sursaut", cost: 1, rarity: "epic",
    target: "none", palette: "rose", glyph: "💪",
    nameKey: "ranked.cards.sursaut.name", descKey: "ranked.cards.sursaut.desc",
    targetHintKey: "ranked.cards.sursaut.targetHint",
    art: "/Cards Bonus/Sursaut d'Orgueil.webp",
  },
  tide: {
    id: "tide", cost: 3, rarity: "epic",
    target: "self", palette: "cyan", glyph: "🌊",
    nameKey: "ranked.cards.tide.name", descKey: "ranked.cards.tide.desc",
    targetHintKey: "ranked.cards.tide.targetHint",
    art: "/Cards Bonus/tide.webp",
  },
  oracle: {
    id: "oracle", cost: 3, rarity: "epic",
    target: "lane-reveal-all", palette: "fuchsia", glyph: "👁️‍🗨️",
    nameKey: "ranked.cards.oracle.name", descKey: "ranked.cards.oracle.desc",
    targetHintKey: "ranked.cards.oracle.targetHint",
    art: "/Cards Bonus/oracle.webp",
  },
  vortex: {
    id: "vortex", cost: 3, rarity: "epic",
    target: "lane-rotate", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.vortex.name", descKey: "ranked.cards.vortex.desc",
    targetHintKey: "ranked.cards.vortex.targetHint",
    art: "/Cards Bonus/vortex.webp",
  },
  gambit: {
    id: "gambit", cost: 2, rarity: "epic",
    target: "gamble", palette: "rose", glyph: "🎲",
    nameKey: "ranked.cards.gambit.name", descKey: "ranked.cards.gambit.desc",
    targetHintKey: "ranked.cards.gambit.targetHint",
    art: "/Cards Bonus/gambit.webp",
  },
  "trou-noir": {
    id: "trou-noir", cost: 3, rarity: "epic",
    target: "none", palette: "violet", glyph: "🕳️",
    nameKey: "ranked.cards.trou-noir.name", descKey: "ranked.cards.trou-noir.desc",
    targetHintKey: "ranked.cards.trou-noir.targetHint",
    art: "/Cards Bonus/trou-noir.webp",
  },
  prophetie: {
    id: "prophetie", cost: 3, rarity: "epic", kind: "passive",
    target: "none", palette: "fuchsia", glyph: "📜",
    nameKey: "ranked.cards.prophetie.name", descKey: "ranked.cards.prophetie.desc",
    targetHintKey: "ranked.cards.prophetie.targetHint",
    art: "/Cards Bonus/prophetie.webp",
  },
  conduit: {
    id: "conduit", cost: 3, rarity: "epic", kind: "passive",
    target: "none", palette: "cyan", glyph: "🔗",
    nameKey: "ranked.cards.conduit.name", descKey: "ranked.cards.conduit.desc",
    targetHintKey: "ranked.cards.conduit.targetHint",
    art: "/Cards Bonus/conduit.webp",
  },

  /* 🟡 LEGENDARY — 4 mana */
  supernova: {
    id: "supernova", cost: 4, rarity: "legendary",
    target: "gamble", palette: "yellow", glyph: "💫",
    nameKey: "ranked.cards.supernova.name", descKey: "ranked.cards.supernova.desc",
    targetHintKey: "ranked.cards.supernova.targetHint",
    art: "/Cards Bonus/supernova.webp",
  },
  trinite: {
    id: "trinite", cost: 4, rarity: "legendary",
    target: "none", palette: "amber", glyph: "🔱",
    nameKey: "ranked.cards.trinite.name", descKey: "ranked.cards.trinite.desc",
    targetHintKey: "ranked.cards.trinite.targetHint",
    art: "/Cards Bonus/trinite.webp",
  },
} satisfies Partial<Record<CardId, RankedCard>>;
