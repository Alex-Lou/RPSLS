/**
 * 46 cards — 4 rarities (15 base + 11 bonus Lot 1 + 20 bonus V3).
 * Deck of 8, hand of 3. Passive cards (kind: "passive") are equipped but never drawn.
 */

import type { CardId, CardRarity, RankedCard } from "./rankedTypes";

export const CARDS: Record<CardId, RankedCard> = {
  /* ⚪ COMMONS — 1 mana */
  aegis: {
    id: "aegis", cost: 1, rarity: "common",
    target: "lane", palette: "sky", glyph: "🛡️",
    nameKey: "ranked.cards.aegis.name", descKey: "ranked.cards.aegis.desc",
    targetHintKey: "ranked.cards.aegis.targetHint",
    art: "/Cards Bonus/aegis.png",
  },
  precision: {
    id: "precision", cost: 1, rarity: "common", voie: "scissors",
    target: "lane", palette: "emerald", glyph: "🎯",
    nameKey: "ranked.cards.precision.name", descKey: "ranked.cards.precision.desc",
    targetHintKey: "ranked.cards.precision.targetHint",
    art: "/Cards Bonus/precision.png",
  },
  anchor: {
    id: "anchor", cost: 1, rarity: "common", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.anchor.name", descKey: "ranked.cards.anchor.desc",
    targetHintKey: "ranked.cards.anchor.targetHint",
    art: "/Cards Bonus/anchor.png",
  },
  "second-wind": {
    id: "second-wind", cost: 1, rarity: "common", voie: "paper",
    target: "self", palette: "teal", glyph: "🩹",
    nameKey: "ranked.cards.second-wind.name", descKey: "ranked.cards.second-wind.desc",
    targetHintKey: "ranked.cards.second-wind.targetHint",
    art: "/Cards Bonus/second-wind.png",
  },
  prescience: {
    id: "prescience", cost: 1, rarity: "common", voie: "spock",
    target: "none", palette: "cyan", glyph: "🔮",
    nameKey: "ranked.cards.prescience.name", descKey: "ranked.cards.prescience.desc",
    targetHintKey: "ranked.cards.prescience.targetHint",
    art: "/Cards Bonus/prescience.png",
  },
  cadence: {
    id: "cadence", cost: 1, rarity: "common", kind: "passive",
    target: "none", palette: "teal", glyph: "⏳",
    nameKey: "ranked.cards.cadence.name", descKey: "ranked.cards.cadence.desc",
    targetHintKey: "ranked.cards.cadence.targetHint",
    art: "/Cards Bonus/cadence.png",
  },
  mascarade: {
    id: "mascarade", cost: 1, rarity: "common", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🎭",
    nameKey: "ranked.cards.mascarade.name", descKey: "ranked.cards.mascarade.desc",
    targetHintKey: "ranked.cards.mascarade.targetHint",
    art: "/Cards Bonus/mascarade.png",
  },
  boussole: {
    id: "boussole", cost: 1, rarity: "common",
    target: "none", palette: "sky", glyph: "🧭",
    nameKey: "ranked.cards.boussole.name", descKey: "ranked.cards.boussole.desc",
    targetHintKey: "ranked.cards.boussole.targetHint",
    art: "/Cards Bonus/boussole.png",
  },

  /* 🔵 RARES — 2 mana */
  surge: {
    id: "surge", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "amber", glyph: "⚡",
    nameKey: "ranked.cards.surge.name", descKey: "ranked.cards.surge.desc",
    targetHintKey: "ranked.cards.surge.targetHint",
    art: "/Cards Bonus/surge.png",
  },
  augur: {
    id: "augur", cost: 2, rarity: "rare", voie: "spock",
    target: "lane-reveal", palette: "violet", glyph: "👁️",
    nameKey: "ranked.cards.augur.name", descKey: "ranked.cards.augur.desc",
    targetHintKey: "ranked.cards.augur.targetHint",
    art: "/Cards Bonus/augur.png",
  },
  riposte: {
    id: "riposte", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "pink", glyph: "⚔️",
    nameKey: "ranked.cards.riposte.name", descKey: "ranked.cards.riposte.desc",
    targetHintKey: "ranked.cards.riposte.targetHint",
    art: "/Cards Bonus/riposte.png",
  },
  curse: {
    id: "curse", cost: 2, rarity: "rare",
    target: "lane", palette: "rose", glyph: "💀",
    nameKey: "ranked.cards.curse.name", descKey: "ranked.cards.curse.desc",
    targetHintKey: "ranked.cards.curse.targetHint",
    art: "/Cards Bonus/curse.png",
  },
  mirror: {
    id: "mirror", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "🪞",
    nameKey: "ranked.cards.mirror.name", descKey: "ranked.cards.mirror.desc",
    targetHintKey: "ranked.cards.mirror.targetHint",
    art: "/Cards Bonus/mirror.png",
  },
  sangsue: {
    id: "sangsue", cost: 2, rarity: "rare", voie: "paper",
    target: "lane", palette: "rose", glyph: "🩸",
    nameKey: "ranked.cards.sangsue.name", descKey: "ranked.cards.sangsue.desc",
    targetHintKey: "ranked.cards.sangsue.targetHint",
    art: "/Cards Bonus/sangsue.png",
  },
  rempart: {
    id: "rempart", cost: 2, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏰",
    nameKey: "ranked.cards.rempart.name", descKey: "ranked.cards.rempart.desc",
    targetHintKey: "ranked.cards.rempart.targetHint",
    art: "/Cards Bonus/rempart.png",
  },
  pillage: {
    id: "pillage", cost: 2, rarity: "rare", kind: "passive",
    target: "none", palette: "orange", glyph: "🧤",
    nameKey: "ranked.cards.pillage.name", descKey: "ranked.cards.pillage.desc",
    targetHintKey: "ranked.cards.pillage.targetHint",
    art: "/Cards Bonus/pillage.png",
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
    art: "/Cards Bonus/heist.png",
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
    art: "/Cards Bonus/Razzia.png",
  },
  // ── 6 arts orphelins câblés (Alex 2026-06-13) — usages inventés depuis le
  //    nom + l'image, validés "OUI GO". Effets Arena ; sans effet en Classé. ──
  surcharge: {
    id: "surcharge", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "amber", glyph: "⚡",
    nameKey: "ranked.cards.surcharge.name", descKey: "ranked.cards.surcharge.desc",
    targetHintKey: "ranked.cards.surcharge.targetHint",
    art: "/Cards Bonus/Surcharge.png",
  },
  toxine: {
    id: "toxine", cost: 2, rarity: "rare",
    target: "lane", palette: "lime", glyph: "☠️",
    nameKey: "ranked.cards.toxine.name", descKey: "ranked.cards.toxine.desc",
    targetHintKey: "ranked.cards.toxine.targetHint",
    art: "/Cards Bonus/Toxine.png",
  },
  echo: {
    id: "echo", cost: 2, rarity: "rare",
    target: "none", palette: "cyan", glyph: "🔊",
    nameKey: "ranked.cards.echo.name", descKey: "ranked.cards.echo.desc",
    targetHintKey: "ranked.cards.echo.targetHint",
    art: "/Cards Bonus/Echo.png",
  },
  rappel: {
    id: "rappel", cost: 3, rarity: "epic",
    target: "lane", palette: "violet", glyph: "↩️",
    nameKey: "ranked.cards.rappel.name", descKey: "ranked.cards.rappel.desc",
    targetHintKey: "ranked.cards.rappel.targetHint",
    art: "/Cards Bonus/Rappel.png",
  },
  "double-mot": {
    id: "double-mot", cost: 3, rarity: "epic", voie: "scissors",
    target: "lane", palette: "sky", glyph: "📜",
    nameKey: "ranked.cards.double-mot.name", descKey: "ranked.cards.double-mot.desc",
    targetHintKey: "ranked.cards.double-mot.targetHint",
    art: "/Cards Bonus/Double Mot.png",
  },
  chronomancien: {
    id: "chronomancien", cost: 2, rarity: "epic", voie: "spock",
    target: "self", palette: "indigo", glyph: "⏳",
    nameKey: "ranked.cards.chronomancien.name", descKey: "ranked.cards.chronomancien.desc",
    targetHintKey: "ranked.cards.chronomancien.targetHint",
    art: "/Cards Bonus/Chronomancien.png",
  },
  // ── ⚡ Cartes « À LA PIOCHE » (Cast When Drawn, Alex 2026-06-13) — se
  //    déclenchent au TIRAGE (cf. arenaCastOnDraw). cost 1 = cosmétique
  //    (GRATUITES, jamais jouées comme sorts) ; target "none" ; art glyph. ──
  "coup-de-bol": {
    id: "coup-de-bol", cost: 1, rarity: "common",
    target: "none", palette: "amber", glyph: "🎰",
    nameKey: "ranked.cards.coup-de-bol.name", descKey: "ranked.cards.coup-de-bol.desc",
    targetHintKey: "ranked.cards.coup-de-bol.targetHint",
    art: "/Cards Bonus/Coup de Bol.png",
  },
  "bouffee-air": {
    id: "bouffee-air", cost: 1, rarity: "common",
    target: "none", palette: "emerald", glyph: "💨",
    nameKey: "ranked.cards.bouffee-air.name", descKey: "ranked.cards.bouffee-air.desc",
    targetHintKey: "ranked.cards.bouffee-air.targetHint",
    art: "/Cards Bonus/Bouffée d'Air.png",
  },
  cafeine: {
    id: "cafeine", cost: 1, rarity: "common",
    target: "none", palette: "amber", glyph: "☕",
    nameKey: "ranked.cards.cafeine.name", descKey: "ranked.cards.cafeine.desc",
    targetHintKey: "ranked.cards.cafeine.targetHint",
    art: "/Cards Bonus/Caféine.png",
  },
  tuile: {
    id: "tuile", cost: 1, rarity: "common",
    target: "none", palette: "zinc", glyph: "🌧️",
    nameKey: "ranked.cards.tuile.name", descKey: "ranked.cards.tuile.desc",
    targetHintKey: "ranked.cards.tuile.targetHint",
    art: "/Cards Bonus/Tuile.png",
  },
  "eclair-genie": {
    id: "eclair-genie", cost: 1, rarity: "rare",
    target: "none", palette: "cyan", glyph: "💡",
    nameKey: "ranked.cards.eclair-genie.name", descKey: "ranked.cards.eclair-genie.desc",
    targetHintKey: "ranked.cards.eclair-genie.targetHint",
    art: "/Cards Bonus/Éclair de Génie.png",
  },
  "patate-chaude": {
    id: "patate-chaude", cost: 1, rarity: "rare",
    target: "none", palette: "orange", glyph: "🥔",
    nameKey: "ranked.cards.patate-chaude.name", descKey: "ranked.cards.patate-chaude.desc",
    targetHintKey: "ranked.cards.patate-chaude.targetHint",
    art: "/Cards Bonus/Patate Chaude.png",
  },
  "pile-ou-face": {
    id: "pile-ou-face", cost: 1, rarity: "rare",
    target: "none", palette: "fuchsia", glyph: "🪙",
    nameKey: "ranked.cards.pile-ou-face.name", descKey: "ranked.cards.pile-ou-face.desc",
    targetHintKey: "ranked.cards.pile-ou-face.targetHint",
    art: "/Cards Bonus/Pile ou Face.png",
  },
  "trefle-chance": {
    id: "trefle-chance", cost: 1, rarity: "epic",
    target: "none", palette: "lime", glyph: "🍀",
    nameKey: "ranked.cards.trefle-chance.name", descKey: "ranked.cards.trefle-chance.desc",
    targetHintKey: "ranked.cards.trefle-chance.targetHint",
    art: "/Cards Bonus/Trèfle Porte-Bonheur.png",
  },
  sursaut: {
    id: "sursaut", cost: 1, rarity: "epic",
    target: "none", palette: "rose", glyph: "💪",
    nameKey: "ranked.cards.sursaut.name", descKey: "ranked.cards.sursaut.desc",
    targetHintKey: "ranked.cards.sursaut.targetHint",
    art: "/Cards Bonus/Sursaut d'Orgueil.png",
  },
  tide: {
    id: "tide", cost: 3, rarity: "epic",
    target: "self", palette: "cyan", glyph: "🌊",
    nameKey: "ranked.cards.tide.name", descKey: "ranked.cards.tide.desc",
    targetHintKey: "ranked.cards.tide.targetHint",
    art: "/Cards Bonus/tide.png",
  },
  oracle: {
    id: "oracle", cost: 3, rarity: "epic",
    target: "lane-reveal-all", palette: "fuchsia", glyph: "👁️‍🗨️",
    nameKey: "ranked.cards.oracle.name", descKey: "ranked.cards.oracle.desc",
    targetHintKey: "ranked.cards.oracle.targetHint",
    art: "/Cards Bonus/oracle.png",
  },
  vortex: {
    id: "vortex", cost: 3, rarity: "epic",
    target: "lane-rotate", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.vortex.name", descKey: "ranked.cards.vortex.desc",
    targetHintKey: "ranked.cards.vortex.targetHint",
    art: "/Cards Bonus/vortex.png",
  },
  gambit: {
    id: "gambit", cost: 2, rarity: "epic",
    target: "gamble", palette: "rose", glyph: "🎲",
    nameKey: "ranked.cards.gambit.name", descKey: "ranked.cards.gambit.desc",
    targetHintKey: "ranked.cards.gambit.targetHint",
    art: "/Cards Bonus/gambit.png",
  },
  "trou-noir": {
    id: "trou-noir", cost: 3, rarity: "epic",
    target: "none", palette: "violet", glyph: "🕳️",
    nameKey: "ranked.cards.trou-noir.name", descKey: "ranked.cards.trou-noir.desc",
    targetHintKey: "ranked.cards.trou-noir.targetHint",
    art: "/Cards Bonus/trou-noir.png",
  },
  prophetie: {
    id: "prophetie", cost: 3, rarity: "epic", kind: "passive",
    target: "none", palette: "fuchsia", glyph: "📜",
    nameKey: "ranked.cards.prophetie.name", descKey: "ranked.cards.prophetie.desc",
    targetHintKey: "ranked.cards.prophetie.targetHint",
    art: "/Cards Bonus/prophetie.png",
  },
  conduit: {
    id: "conduit", cost: 3, rarity: "epic", kind: "passive",
    target: "none", palette: "cyan", glyph: "🔗",
    nameKey: "ranked.cards.conduit.name", descKey: "ranked.cards.conduit.desc",
    targetHintKey: "ranked.cards.conduit.targetHint",
    art: "/Cards Bonus/conduit.png",
  },

  /* 🟡 LEGENDARY — 4 mana */
  supernova: {
    id: "supernova", cost: 4, rarity: "legendary",
    target: "gamble", palette: "yellow", glyph: "💫",
    nameKey: "ranked.cards.supernova.name", descKey: "ranked.cards.supernova.desc",
    targetHintKey: "ranked.cards.supernova.targetHint",
    art: "/Cards Bonus/supernova.png",
  },
  trinite: {
    id: "trinite", cost: 4, rarity: "legendary",
    target: "none", palette: "amber", glyph: "🔱",
    nameKey: "ranked.cards.trinite.name", descKey: "ranked.cards.trinite.desc",
    targetHintKey: "ranked.cards.trinite.targetHint",
    art: "/Cards Bonus/trinite.png",
  },

  /* ───────────────────────────────────────────────────────────────────────
   * BONUS V3 — 20 new mechanics cards (see docs/CARTES_BONUS_V3.md)
   * ─────────────────────────────────────────────────────────────────────── */

  /* ⚪ V3 COMMONS — 1 mana */
  sablier: {
    id: "sablier", cost: 1, rarity: "common",
    target: "none", palette: "amber", glyph: "⏱️",
    nameKey: "ranked.cards.sablier.name", descKey: "ranked.cards.sablier.desc",
    targetHintKey: "ranked.cards.sablier.targetHint",
    art: "/Cards Bonus/sablier.png",
  },
  remanence: {
    id: "remanence", cost: 1, rarity: "common",
    target: "lane", palette: "fuchsia", glyph: "👻",
    nameKey: "ranked.cards.remanence.name", descKey: "ranked.cards.remanence.desc",
    targetHintKey: "ranked.cards.remanence.targetHint",
    art: "/Cards Bonus/remanence.png",
  },
  offre: {
    id: "offre", cost: 1, rarity: "common",
    target: "none", palette: "emerald", glyph: "🤝",
    nameKey: "ranked.cards.offre.name", descKey: "ranked.cards.offre.desc",
    targetHintKey: "ranked.cards.offre.targetHint",
    art: "/Cards Bonus/offre.png",
  },
  braise: {
    id: "braise", cost: 1, rarity: "common",
    target: "none", palette: "orange", glyph: "🔥",
    nameKey: "ranked.cards.braise.name", descKey: "ranked.cards.braise.desc",
    targetHintKey: "ranked.cards.braise.targetHint",
    art: "/Cards Bonus/braise.png",
  },
  echappee: {
    id: "echappee", cost: 1, rarity: "common", voie: "lizard",
    target: "lane", palette: "sky", glyph: "🏃",
    nameKey: "ranked.cards.echappee.name", descKey: "ranked.cards.echappee.desc",
    targetHintKey: "ranked.cards.echappee.targetHint",
    art: "/Cards Bonus/echappee.png",
  },

  /* 🔵 V3 RARES — 2 mana */
  "oracle-inverse": {
    id: "oracle-inverse", cost: 2, rarity: "rare",
    target: "none", palette: "fuchsia", glyph: "🔮",
    nameKey: "ranked.cards.oracle-inverse.name", descKey: "ranked.cards.oracle-inverse.desc",
    targetHintKey: "ranked.cards.oracle-inverse.targetHint",
    art: "/Cards Bonus/oracle-inverse.png",
  },
  fardeau: {
    id: "fardeau", cost: 2, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.fardeau.name", descKey: "ranked.cards.fardeau.desc",
    targetHintKey: "ranked.cards.fardeau.targetHint",
    art: "/Cards Bonus/fardeau.png",
  },
  crepuscule: {
    id: "crepuscule", cost: 2, rarity: "rare",
    target: "lane", palette: "amber", glyph: "🌅",
    nameKey: "ranked.cards.crepuscule.name", descKey: "ranked.cards.crepuscule.desc",
    targetHintKey: "ranked.cards.crepuscule.targetHint",
    art: "/Cards Bonus/crepuscule.png",
  },
  cascade: {
    id: "cascade", cost: 2, rarity: "rare",
    target: "none", palette: "sky", glyph: "💧",
    nameKey: "ranked.cards.cascade.name", descKey: "ranked.cards.cascade.desc",
    targetHintKey: "ranked.cards.cascade.targetHint",
    art: "/Cards Bonus/cascade.png",
  },
  "echo-temporel": {
    id: "echo-temporel", cost: 2, rarity: "rare",
    target: "none", palette: "violet", glyph: "🕐",
    nameKey: "ranked.cards.echo-temporel.name", descKey: "ranked.cards.echo-temporel.desc",
    targetHintKey: "ranked.cards.echo-temporel.targetHint",
    art: "/Cards Bonus/echo-temporel.png",
  },
  "ancre-temporelle": {
    id: "ancre-temporelle", cost: 2, rarity: "rare",
    target: "none", palette: "cyan", glyph: "⚓",
    nameKey: "ranked.cards.ancre-temporelle.name", descKey: "ranked.cards.ancre-temporelle.desc",
    targetHintKey: "ranked.cards.ancre-temporelle.targetHint",
    art: "/Cards Bonus/ancre-temporelle.png",
  },

  /* 🟣 V3 EPICS — 3 mana */
  metamorphose: {
    id: "metamorphose", cost: 3, rarity: "epic",
    target: "none", palette: "emerald", glyph: "🦋",
    nameKey: "ranked.cards.metamorphose.name", descKey: "ranked.cards.metamorphose.desc",
    targetHintKey: "ranked.cards.metamorphose.targetHint",
    art: "/Cards Bonus/metamorphose.png",
  },
  gaia: {
    id: "gaia", cost: 3, rarity: "epic", voie: "rock", kind: "passive",
    target: "none", palette: "emerald", glyph: "🛡️",
    nameKey: "ranked.cards.gaia.name", descKey: "ranked.cards.gaia.desc",
    targetHintKey: "ranked.cards.gaia.targetHint",
    art: "/Cards Bonus/gaia.png",
  },
  "marchand-ames": {
    id: "marchand-ames", cost: 3, rarity: "epic",
    target: "none", palette: "rose", glyph: "💀",
    nameKey: "ranked.cards.marchand-ames.name", descKey: "ranked.cards.marchand-ames.desc",
    targetHintKey: "ranked.cards.marchand-ames.targetHint",
    art: "/Cards Bonus/marchand-ames.png",
  },
  telepathie: {
    id: "telepathie", cost: 3, rarity: "epic",
    target: "none", palette: "violet", glyph: "🧠",
    nameKey: "ranked.cards.telepathie.name", descKey: "ranked.cards.telepathie.desc",
    targetHintKey: "ranked.cards.telepathie.targetHint",
    art: "/Cards Bonus/telepathie.png",
  },
  paradoxe: {
    id: "paradoxe", cost: 3, rarity: "epic",
    target: "none", palette: "cyan", glyph: "⏳",
    nameKey: "ranked.cards.paradoxe.name", descKey: "ranked.cards.paradoxe.desc",
    targetHintKey: "ranked.cards.paradoxe.targetHint",
    art: "/Cards Bonus/paradoxe.png",
  },
  benediction: {
    id: "benediction", cost: 3, rarity: "epic",
    target: "none", palette: "yellow", glyph: "✨",
    nameKey: "ranked.cards.benediction.name", descKey: "ranked.cards.benediction.desc",
    targetHintKey: "ranked.cards.benediction.targetHint",
    art: "/Cards Bonus/benediction.png",
  },

  /* 🟡 V3 LEGENDARIES — 4 mana */
  schrodinger: {
    id: "schrodinger", cost: 4, rarity: "legendary",
    target: "none", palette: "fuchsia", glyph: "📦",
    nameKey: "ranked.cards.schrodinger.name", descKey: "ranked.cards.schrodinger.desc",
    targetHintKey: "ranked.cards.schrodinger.targetHint",
    art: "/Cards Bonus/schrodinger.png",
  },
  juge: {
    id: "juge", cost: 4, rarity: "legendary", voie: "spock",
    target: "none", palette: "yellow", glyph: "⚖️",
    nameKey: "ranked.cards.juge.name", descKey: "ranked.cards.juge.desc",
    targetHintKey: "ranked.cards.juge.targetHint",
    art: "/Cards Bonus/juge.png",
  },
  genese: {
    id: "genese", cost: 4, rarity: "legendary", voie: "spock",
    target: "none", palette: "yellow", glyph: "🌟",
    nameKey: "ranked.cards.genese.name", descKey: "ranked.cards.genese.desc",
    targetHintKey: "ranked.cards.genese.targetHint",
    art: "/Cards Bonus/genese.png",
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
    art: "/Cards Bonus/finisher-forteresse.png",
  },
  "finisher-verger": {
    id: "finisher-verger", cost: 4, rarity: "legendary",
    target: "none", palette: "emerald", glyph: "🌿",
    nameKey: "ranked.cards.finisher-verger.name", descKey: "ranked.cards.finisher-verger.desc",
    targetHintKey: "ranked.cards.finisher-verger.targetHint",
    art: "/Cards Bonus/finisher-verger.png",
  },
  "finisher-lame": {
    id: "finisher-lame", cost: 4, rarity: "legendary",
    target: "none", palette: "rose", glyph: "⚔️",
    nameKey: "ranked.cards.finisher-lame.name", descKey: "ranked.cards.finisher-lame.desc",
    targetHintKey: "ranked.cards.finisher-lame.targetHint",
    art: "/Cards Bonus/finisher-lame.png",
  },
  "finisher-metamorphose": {
    id: "finisher-metamorphose", cost: 4, rarity: "legendary",
    target: "none", palette: "lime", glyph: "🐉",
    nameKey: "ranked.cards.finisher-metamorphose.name", descKey: "ranked.cards.finisher-metamorphose.desc",
    targetHintKey: "ranked.cards.finisher-metamorphose.targetHint",
    art: "/Cards Bonus/finisher-metamorphose.png",
  },
  "finisher-calcul": {
    id: "finisher-calcul", cost: 4, rarity: "legendary",
    target: "none", palette: "cyan", glyph: "🌠",
    nameKey: "ranked.cards.finisher-calcul.name", descKey: "ranked.cards.finisher-calcul.desc",
    targetHintKey: "ranked.cards.finisher-calcul.targetHint",
    art: "/Cards Bonus/finisher-calcul.png",
  },

  /* ──────────── Nouvelles cartes Constellation Pro (2026-06-12) ────────────
   * Art à générer (cf docs/NOUVELLES_CARTES_PRO.md) → art:null = glyph fallback
   * via CardImage en attendant. Effets Arena dans arenaPhase3Spells.ts. */
  "jet-caillou": {
    id: "jet-caillou", cost: 1, rarity: "common", voie: "rock",
    target: "lane", palette: "zinc", glyph: "⛰️",
    nameKey: "ranked.cards.jet-caillou.name", descKey: "ranked.cards.jet-caillou.desc",
    targetHintKey: "ranked.cards.jet-caillou.targetHint", art: "/Cards Bonus/Jet de Caillou.png",
  },
  /* ──── Voie MONTAGNE — cartes signature (Arena 2026-06-22, art:null = glyph) ──── */
  "eboulement": {
    id: "eboulement", cost: 2, rarity: "common", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.eboulement.name", descKey: "ranked.cards.eboulement.desc",
    targetHintKey: "ranked.cards.eboulement.targetHint", art: "/Cards Bonus/Éboulement.png",
  },
  "strate-vive": {
    id: "strate-vive", cost: 2, rarity: "rare", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🧱",
    nameKey: "ranked.cards.strate-vive.name", descKey: "ranked.cards.strate-vive.desc",
    targetHintKey: "ranked.cards.strate-vive.targetHint", art: "/Cards Bonus/Strate Vive.png",
  },
  "contrefort": {
    id: "contrefort", cost: 2, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏛️",
    nameKey: "ranked.cards.contrefort.name", descKey: "ranked.cards.contrefort.desc",
    targetHintKey: "ranked.cards.contrefort.targetHint", art: "/Cards Bonus/Contrefort.png",
  },
  "gardien-pierre": {
    id: "gardien-pierre", cost: 3, rarity: "rare", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🗿",
    nameKey: "ranked.cards.gardien-pierre.name", descKey: "ranked.cards.gardien-pierre.desc",
    targetHintKey: "ranked.cards.gardien-pierre.targetHint", art: "/Cards Bonus/Gardien de Pierre.png",
  },
  "veine-gaia": {
    id: "veine-gaia", cost: 3, rarity: "epic", voie: "rock",
    target: "none", palette: "emerald", glyph: "💚",
    nameKey: "ranked.cards.veine-gaia.name", descKey: "ranked.cards.veine-gaia.desc",
    targetHintKey: "ranked.cards.veine-gaia.targetHint", art: "/Cards Bonus/Veine de Gaïa.png",
  },
  /* ──── Voie MIRAGE — cartes signature (Arena 2026-06-22, art:null = glyph) ──── */
  "reflet-echo": {
    id: "reflet-echo", cost: 1, rarity: "common", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.reflet-echo.name", descKey: "ranked.cards.reflet-echo.desc",
    targetHintKey: "ranked.cards.reflet-echo.targetHint", art: "/Cards Bonus/Reflet-Écho.png",
  },
  "mascarade-enchainee": {
    id: "mascarade-enchainee", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "✨",
    nameKey: "ranked.cards.mascarade-enchainee.name", descKey: "ranked.cards.mascarade-enchainee.desc",
    targetHintKey: "ranked.cards.mascarade-enchainee.targetHint", art: "/Cards Bonus/Mascarade Enchaînée.png",
  },
  "fuite-masquee": {
    id: "fuite-masquee", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "💨",
    nameKey: "ranked.cards.fuite-masquee.name", descKey: "ranked.cards.fuite-masquee.desc",
    targetHintKey: "ranked.cards.fuite-masquee.targetHint", art: "/Cards Bonus/Fuite Masquée.png",
  },
  /* ──── Voie TRANCHANT — cartes signature (Arena 2026-06-22, art:null = glyph) ──── */
  "coup-de-taille": {
    id: "coup-de-taille", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "rose", glyph: "🗡️",
    nameKey: "ranked.cards.coup-de-taille.name", descKey: "ranked.cards.coup-de-taille.desc",
    targetHintKey: "ranked.cards.coup-de-taille.targetHint", art: "/Cards Bonus/Coup de Taille.png",
  },
  "acuite": {
    id: "acuite", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "rose", glyph: "🔪",
    nameKey: "ranked.cards.acuite.name", descKey: "ranked.cards.acuite.desc",
    targetHintKey: "ranked.cards.acuite.targetHint", art: "/Cards Bonus/Acuité.png",
  },
  "frenesie": {
    id: "frenesie", cost: 2, rarity: "rare", voie: "scissors",
    target: "none", palette: "rose", glyph: "⚔️",
    nameKey: "ranked.cards.frenesie.name", descKey: "ranked.cards.frenesie.desc",
    targetHintKey: "ranked.cards.frenesie.targetHint", art: "/Cards Bonus/Frénésie.png",
  },
  /* ──── Voie FORÊT — cartes signature (Arena 2026-06-23, art:null = glyph) ──── */
  "ramure": {
    id: "ramure", cost: 3, rarity: "rare", voie: "paper",
    target: "none", palette: "emerald", glyph: "🌿",
    nameKey: "ranked.cards.ramure.name", descKey: "ranked.cards.ramure.desc",
    targetHintKey: "ranked.cards.ramure.targetHint", art: "/Cards Bonus/Ramure.png",
  },
  "photosynthese": {
    id: "photosynthese", cost: 2, rarity: "rare", voie: "paper",
    target: "lane", palette: "emerald", glyph: "☀️",
    nameKey: "ranked.cards.photosynthese.name", descKey: "ranked.cards.photosynthese.desc",
    targetHintKey: "ranked.cards.photosynthese.targetHint", art: "/Cards Bonus/Photosynthèse.png",
  },
  "ronces": {
    id: "ronces", cost: 2, rarity: "common", voie: "paper",
    target: "lane", palette: "emerald", glyph: "🥀",
    nameKey: "ranked.cards.ronces.name", descKey: "ranked.cards.ronces.desc",
    targetHintKey: "ranked.cards.ronces.targetHint", art: "/Cards Bonus/Ronces.png",
  },
  /* ──── Voie COSMOS — cartes signature (Arena 2026-06-23, art:null = glyph) ──── */
  "dilatation-temporelle": {
    id: "dilatation-temporelle", cost: 1, rarity: "common", voie: "spock",
    target: "none", palette: "indigo", glyph: "⏳",
    nameKey: "ranked.cards.dilatation-temporelle.name", descKey: "ranked.cards.dilatation-temporelle.desc",
    targetHintKey: "ranked.cards.dilatation-temporelle.targetHint", art: "/Cards Bonus/Dilatation Temporelle.png",
  },
  "loi-de-causalite": {
    id: "loi-de-causalite", cost: 2, rarity: "rare", voie: "spock",
    target: "lane", palette: "indigo", glyph: "⚖️",
    nameKey: "ranked.cards.loi-de-causalite.name", descKey: "ranked.cards.loi-de-causalite.desc",
    targetHintKey: "ranked.cards.loi-de-causalite.targetHint", art: "/Cards Bonus/Loi de Causalité.png",
  },
  "convergence-cosmique": {
    id: "convergence-cosmique", cost: 4, rarity: "epic", voie: "spock",
    target: "none", palette: "indigo", glyph: "☄️",
    nameKey: "ranked.cards.convergence-cosmique.name", descKey: "ranked.cards.convergence-cosmique.desc",
    targetHintKey: "ranked.cards.convergence-cosmique.targetHint", art: "/Cards Bonus/Convergence Cosmique.png",
  },
  /* ──── Dégâts SIGNATURE par Voie (Arena 2026-06-23, art:null = glyph) ──── */
  "eboulis-final": {
    id: "eboulis-final", cost: 4, rarity: "epic", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏔️",
    nameKey: "ranked.cards.eboulis-final.name", descKey: "ranked.cards.eboulis-final.desc",
    targetHintKey: "ranked.cards.eboulis-final.targetHint", art: "/Cards Bonus/Éboulis Final.png",
  },
  "drain-vital": {
    id: "drain-vital", cost: 3, rarity: "rare", voie: "paper",
    target: "none", palette: "emerald", glyph: "🩸",
    nameKey: "ranked.cards.drain-vital.name", descKey: "ranked.cards.drain-vital.desc",
    targetHintKey: "ranked.cards.drain-vital.targetHint", art: "/Cards Bonus/Drain Vital.png",
  },
  "coup-dans-lombre": {
    id: "coup-dans-lombre", cost: 3, rarity: "epic", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🌑",
    nameKey: "ranked.cards.coup-dans-lombre.name", descKey: "ranked.cards.coup-dans-lombre.desc",
    targetHintKey: "ranked.cards.coup-dans-lombre.targetHint", art: "/Cards Bonus/Coup dans l'Ombre.png",
  },
  "intrication-quantique": {
    id: "intrication-quantique", cost: 3, rarity: "rare", voie: "spock",
    target: "none", palette: "indigo", glyph: "⚛️",
    nameKey: "ranked.cards.intrication-quantique.name", descKey: "ranked.cards.intrication-quantique.desc",
    targetHintKey: "ranked.cards.intrication-quantique.targetHint", art: "/Cards Bonus/Intrication Quantique.png",
  },
  "taillade-mortelle": {
    id: "taillade-mortelle", cost: 4, rarity: "legendary", voie: "scissors",
    target: "none", palette: "rose", glyph: "⚡",
    nameKey: "ranked.cards.taillade-mortelle.name", descKey: "ranked.cards.taillade-mortelle.desc",
    targetHintKey: "ranked.cards.taillade-mortelle.targetHint", art: "/Cards Bonus/Taillade Mortelle.png",
  },
  "seve": {
    id: "seve", cost: 1, rarity: "common", voie: "paper",
    target: "lane", palette: "emerald", glyph: "🌱",
    nameKey: "ranked.cards.seve.name", descKey: "ranked.cards.seve.desc",
    targetHintKey: "ranked.cards.seve.targetHint", art: "/Cards Bonus/Sève.png",
  },
  "coup-oeil": {
    id: "coup-oeil", cost: 1, rarity: "common", voie: "spock",
    target: "none", palette: "cyan", glyph: "🔍",
    nameKey: "ranked.cards.coup-oeil.name", descKey: "ranked.cards.coup-oeil.desc",
    targetHintKey: "ranked.cards.coup-oeil.targetHint", art: "/Cards Bonus/Coup d'Œil.png",
  },
  "permutation": {
    id: "permutation", cost: 2, rarity: "rare",
    target: "lane", palette: "indigo", glyph: "🔄",
    nameKey: "ranked.cards.permutation.name", descKey: "ranked.cards.permutation.desc",
    targetHintKey: "ranked.cards.permutation.targetHint", art: "/Cards Bonus/Permutation.png",
  },
  "toile-gluante": {
    id: "toile-gluante", cost: 2, rarity: "rare",
    target: "lane", palette: "lime", glyph: "🕸️",
    nameKey: "ranked.cards.toile-gluante.name", descKey: "ranked.cards.toile-gluante.desc",
    targetHintKey: "ranked.cards.toile-gluante.targetHint", art: "/Cards Bonus/Toile Gluante.png",
  },
  "reverberation": {
    id: "reverberation", cost: 2, rarity: "rare",
    target: "none", palette: "fuchsia", glyph: "🔊",
    nameKey: "ranked.cards.reverberation.name", descKey: "ranked.cards.reverberation.desc",
    targetHintKey: "ranked.cards.reverberation.targetHint", art: "/Cards Bonus/Réverbération.png",
  },
  "gravite": {
    id: "gravite", cost: 3, rarity: "epic", voie: "spock",
    target: "none", palette: "indigo", glyph: "🌑",
    nameKey: "ranked.cards.gravite.name", descKey: "ranked.cards.gravite.desc",
    targetHintKey: "ranked.cards.gravite.targetHint", art: "/Cards Bonus/Gravité.png",
  },
  "doppelganger": {
    id: "doppelganger", cost: 3, rarity: "epic",
    target: "none", palette: "sky", glyph: "👥",
    nameKey: "ranked.cards.doppelganger.name", descKey: "ranked.cards.doppelganger.desc",
    targetHintKey: "ranked.cards.doppelganger.targetHint", art: "/Cards Bonus/Doppelgänger.png",
  },
  "purge": {
    id: "purge", cost: 3, rarity: "epic",
    target: "none", palette: "amber", glyph: "🧹",
    nameKey: "ranked.cards.purge.name", descKey: "ranked.cards.purge.desc",
    targetHintKey: "ranked.cards.purge.targetHint", art: "/Cards Bonus/Purge.png",
  },
  "roue-destin": {
    id: "roue-destin", cost: 4, rarity: "legendary",
    target: "gamble", palette: "rose", glyph: "🎡",
    nameKey: "ranked.cards.roue-destin.name", descKey: "ranked.cards.roue-destin.desc",
    targetHintKey: "ranked.cards.roue-destin.targetHint", art: "/Cards Bonus/Roue du destin.png",
  },
  "phenix": {
    id: "phenix", cost: 4, rarity: "legendary",
    target: "none", palette: "orange", glyph: "🔥",
    nameKey: "ranked.cards.phenix.name", descKey: "ranked.cards.phenix.desc",
    targetHintKey: "ranked.cards.phenix.targetHint", art: "/Cards Bonus/Fénix.png",
  },
  "singularite": {
    id: "singularite", cost: 4, rarity: "legendary",
    target: "none", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.singularite.name", descKey: "ranked.cards.singularite.desc",
    targetHintKey: "ranked.cards.singularite.targetHint", art: "/Cards Bonus/Singularité.png",
  },

  /* ── ⚗️ Cartes de FUSION (Forge Arena 2026-06-13) — kind:"fusion" :
   *    créées par la Forge uniquement, exclues collection/decks/packs.
   *    Coût = somme des 2 ingrédients − 1 (capé à 4). ── */
  "frappe-parfaite": {
    id: "frappe-parfaite", cost: 2, rarity: "rare", kind: "fusion",
    target: "lane", palette: "amber", glyph: "🎯",
    nameKey: "ranked.cards.frappe-parfaite.name", descKey: "ranked.cards.frappe-parfaite.desc",
    targetHintKey: "ranked.cards.frappe-parfaite.targetHint", art: "/Cards Bonus/Frappe parfaite.png",
  },
  "bastion": {
    id: "bastion", cost: 1, rarity: "rare", kind: "fusion",
    target: "lane", palette: "sky", glyph: "🏰",
    nameKey: "ranked.cards.bastion.name", descKey: "ranked.cards.bastion.desc",
    targetHintKey: "ranked.cards.bastion.targetHint", art: "/Cards Bonus/BASTION.png",
  },
  "avalanche": {
    id: "avalanche", cost: 1, rarity: "rare", kind: "fusion",
    target: "none", palette: "zinc", glyph: "🏔️",
    nameKey: "ranked.cards.avalanche.name", descKey: "ranked.cards.avalanche.desc",
    targetHintKey: "ranked.cards.avalanche.targetHint", art: "/Cards Bonus/AVALANCHE.png",
  },
  "source-vitale": {
    id: "source-vitale", cost: 1, rarity: "rare", kind: "fusion",
    target: "lane", palette: "emerald", glyph: "⛲",
    nameKey: "ranked.cards.source-vitale.name", descKey: "ranked.cards.source-vitale.desc",
    targetHintKey: "ranked.cards.source-vitale.targetHint", art: "/Cards Bonus/SOURCE VITALE.png",
  },
  "omniscience": {
    id: "omniscience", cost: 2, rarity: "epic", kind: "fusion",
    target: "none", palette: "cyan", glyph: "👁️",
    nameKey: "ranked.cards.omniscience.name", descKey: "ranked.cards.omniscience.desc",
    targetHintKey: "ranked.cards.omniscience.targetHint", art: "/Cards Bonus/OMNISCIENCE.png",
  },
  "cocon": {
    id: "cocon", cost: 3, rarity: "epic", kind: "fusion",
    target: "lane", palette: "lime", glyph: "🛡",
    nameKey: "ranked.cards.cocon.name", descKey: "ranked.cards.cocon.desc",
    targetHintKey: "ranked.cards.cocon.targetHint", art: "/Cards Bonus/cocon.png",
  },
  "apocalypse": {
    id: "apocalypse", cost: 4, rarity: "legendary", kind: "fusion",
    target: "none", palette: "rose", glyph: "☄️",
    nameKey: "ranked.cards.apocalypse.name", descKey: "ranked.cards.apocalypse.desc",
    targetHintKey: "ranked.cards.apocalypse.targetHint", art: "/Cards Bonus/APOCALYPSE.png",
  },
  "imposteur": {
    id: "imposteur", cost: 3, rarity: "legendary", voie: "lizard", kind: "fusion",
    target: "none", palette: "violet", glyph: "🎭",
    nameKey: "ranked.cards.imposteur.name", descKey: "ranked.cards.imposteur.desc",
    targetHintKey: "ranked.cards.imposteur.targetHint", art: "/Cards Bonus/IMPOSTEUR.png",
  },
};

/** Toutes les cartes COLLECTIONNABLES. kind:"fusion" exclu À LA SOURCE
 *  (Forge 2026-06-13) : un seul filtre couvre packs (economy), boutique,
 *  collection, DeckManager, Codex — les cartes fusionnées n'existent
 *  qu'EN PARTIE, via la Forge. */
export const ALL_CARD_IDS: CardId[] = (Object.keys(CARDS) as CardId[]).filter(
  (id) => CARDS[id].kind !== "fusion",
);

/** True for cards whose effect is permanently active while equipped — they are
 *  never drawn into the hand (see makeBattle / RankedBattleState.passives). */
export function isPassiveCard(id: CardId): boolean {
  return CARDS[id].kind === "passive";
}

export const RARITY_ORDER: CardRarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_COLOR: Record<CardRarity, string> = {
  common: "text-zinc-400",
  rare: "text-blue-400",
  epic: "text-violet-400",
  legendary: "text-amber-400",
};

export const RARITY_BG: Record<CardRarity, string> = {
  common: "from-zinc-600 to-zinc-800",
  rare: "from-blue-500 to-cyan-600",
  epic: "from-violet-500 to-fuchsia-600",
  legendary: "from-amber-400 to-orange-500",
};

/* ──────────── Deck helpers ──────────── */

export const DECK_SIZE = 8;
export const HAND_CAP = 3;
export const STARTING_HAND = 3;

/** Default starter deck (all commons + the 3 original rares). */
/** Default starter deck — 8 cards. Only 1 Augur (intel is rare). */
export function starterDeck(): CardId[] {
  return ["aegis", "precision", "anchor", "second-wind", "surge", "augur", "surge", "curse"];
}

/** Cards every new player owns at first launch (6 commons + first rares). SINGLE
 *  SOURCE — was duplicated in store.defaultPlayer (cardCollection) and DeckManager
 *  (STARTER_CARDS); overlaps the server's WELCOME_CARDS starter subset. */
export const STARTER_COLLECTION: CardId[] = ["aegis", "precision", "anchor", "second-wind", "surge", "augur"];

/** Default 6-card Classé deck for a fresh / wiped profile. */
export const DEFAULT_RANKED_DECK: CardId[] = ["aegis", "precision", "surge", "augur", "anchor", "second-wind"];

/** Default 10-card Arena (Constellation Pro) deck for a fresh / wiped profile. */
export const DEFAULT_ARENA_DECK: CardId[] = [
  "aegis", "precision", "surge", "augur", "anchor", "second-wind", "heist", "supernova", "seve", "jet-caillou",
];

export function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function drawN(
  deck: CardId[], hand: CardId[], discard: CardId[],
  n: number, capHand: number = HAND_CAP,
): { deck: CardId[]; hand: CardId[]; discard: CardId[]; drawn: CardId[] } {
  let workingDeck = deck.slice();
  let workingDiscard = discard.slice();
  const newHand = hand.slice();
  const drawn: CardId[] = [];
  const room = Math.max(0, capHand - newHand.length);
  const toDraw = Math.min(n, room);
  for (let i = 0; i < toDraw; i++) {
    if (workingDeck.length === 0) {
      if (workingDiscard.length === 0) break;
      workingDeck = shuffle(workingDiscard);
      workingDiscard = [];
    }
    const card = workingDeck.shift()!;
    drawn.push(card);
    newHand.push(card);
  }
  return { deck: workingDeck, hand: newHand, discard: workingDiscard, drawn };
}

/** Discard a random card from hand. Epics/legendaries go to usedOneShotCards instead. */
export function discardRandom(
  hand: CardId[], discard: CardId[], usedOneShotCards: CardId[],
): { hand: CardId[]; discard: CardId[]; usedOneShotCards: CardId[] } {
  if (hand.length === 0) return { hand, discard, usedOneShotCards };
  const idx = Math.floor(Math.random() * hand.length);
  const card = hand[idx];
  const rarity = CARDS[card].rarity;
  const isOneShot = rarity === "epic" || rarity === "legendary";
  return {
    hand: [...hand.slice(0, idx), ...hand.slice(idx + 1)],
    discard: isOneShot ? discard : [...discard, card],
    usedOneShotCards: isOneShot ? [...usedOneShotCards, card] : usedOneShotCards,
  };
}
