/**
 * Catalogue — nouvelles cartes Constellation Pro + cartes signature par Voie.
 * Tranche de CARDS (cards.ts) : l'ORDRE des tranches et des clés compte
 * (ordre d'itération de CARDS → decks, hash online). Ne pas réordonner.
 */

import type { CardId, RankedCard } from "../rankedTypes";

export const PRO_CARDS = {
  /* ──────────── Nouvelles cartes Constellation Pro (2026-06-12) ────────────
   * Art à générer (cf docs/NOUVELLES_CARTES_PRO.md) → art:null = glyph fallback
   * via CardImage en attendant. Effets Arena dans arenaPhase3Spells.ts. */
  "jet-caillou": {
    id: "jet-caillou", cost: 1, rarity: "common", voie: "rock",
    target: "lane", palette: "zinc", glyph: "⛰️",
    nameKey: "ranked.cards.jet-caillou.name", descKey: "ranked.cards.jet-caillou.desc",
    targetHintKey: "ranked.cards.jet-caillou.targetHint", art: "/Cards Bonus/Jet de Caillou.webp",
  },
  /* ──── Voie MONTAGNE — cartes signature (Arena 2026-06-22, art:null = glyph) ──── */
  "eboulement": {
    id: "eboulement", cost: 2, rarity: "common", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.eboulement.name", descKey: "ranked.cards.eboulement.desc",
    targetHintKey: "ranked.cards.eboulement.targetHint", art: "/Cards Bonus/Éboulement.webp",
  },
  "strate-vive": {
    id: "strate-vive", cost: 2, rarity: "rare", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🧱",
    nameKey: "ranked.cards.strate-vive.name", descKey: "ranked.cards.strate-vive.desc",
    targetHintKey: "ranked.cards.strate-vive.targetHint", art: "/Cards Bonus/Strate Vive.webp",
  },
  "contrefort": {
    id: "contrefort", cost: 2, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏛️",
    nameKey: "ranked.cards.contrefort.name", descKey: "ranked.cards.contrefort.desc",
    targetHintKey: "ranked.cards.contrefort.targetHint", art: "/Cards Bonus/Contrefort.webp",
  },
  "gardien-pierre": {
    id: "gardien-pierre", cost: 3, rarity: "rare", voie: "rock",
    target: "lane", palette: "zinc", glyph: "🗿",
    nameKey: "ranked.cards.gardien-pierre.name", descKey: "ranked.cards.gardien-pierre.desc",
    targetHintKey: "ranked.cards.gardien-pierre.targetHint", art: "/Cards Bonus/Gardien de Pierre.webp",
  },
  "veine-gaia": {
    id: "veine-gaia", cost: 3, rarity: "epic", voie: "rock",
    target: "none", palette: "emerald", glyph: "💚",
    nameKey: "ranked.cards.veine-gaia.name", descKey: "ranked.cards.veine-gaia.desc",
    targetHintKey: "ranked.cards.veine-gaia.targetHint", art: "/Cards Bonus/Veine de Gaïa.webp",
  },
  "barricade": {
    // Anti-aggro (Alex 2026-06-30) — art à fournir ; glyph fallback (art:null) en attendant.
    id: "barricade", cost: 1, rarity: "common", voie: "rock",
    target: "none", palette: "zinc", glyph: "🚧",
    nameKey: "ranked.cards.barricade.name", descKey: "ranked.cards.barricade.desc",
    targetHintKey: "ranked.cards.barricade.targetHint", art: "/Cards Bonus/Barricade.webp",
  },
  "ecrasement": {
    // Anti-heal / perce-mur Forêt (Alex 2026-06-30) — art à fournir, glyph fallback.
    id: "ecrasement", cost: 3, rarity: "epic", voie: "rock",
    target: "none", palette: "zinc", glyph: "🗿",
    nameKey: "ranked.cards.ecrasement.name", descKey: "ranked.cards.ecrasement.desc",
    targetHintKey: "ranked.cards.ecrasement.targetHint", art: "/Cards Bonus/Écrasement Tellurique.webp",
  },
  "veine-minerale": {
    // Pioche (comble le zéro-draw du kit) — art à fournir, glyph fallback.
    id: "veine-minerale", cost: 2, rarity: "common", voie: "rock",
    target: "none", palette: "zinc", glyph: "⛏️",
    nameKey: "ranked.cards.veine-minerale.name", descKey: "ranked.cards.veine-minerale.desc",
    targetHintKey: "ranked.cards.veine-minerale.targetHint", art: "/Cards Bonus/Prospection.webp",
  },
  "grondement": {
    // Aura : 2e axe de dégâts récurrent (anti back-load) — art à fournir, glyph fallback.
    id: "grondement", cost: 3, rarity: "rare", voie: "rock",
    target: "none", palette: "zinc", glyph: "🌋",
    nameKey: "ranked.cards.grondement.name", descKey: "ranked.cards.grondement.desc",
    targetHintKey: "ranked.cards.grondement.targetHint", art: "/Cards Bonus/Grondement.webp",
  },
  /* ──── Voie MIRAGE — cartes signature (Arena 2026-06-22, art:null = glyph) ──── */
  "reflet-echo": {
    id: "reflet-echo", cost: 1, rarity: "common", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.reflet-echo.name", descKey: "ranked.cards.reflet-echo.desc",
    targetHintKey: "ranked.cards.reflet-echo.targetHint", art: "/Cards Bonus/Reflet-Écho.webp",
  },
  "mascarade-enchainee": {
    id: "mascarade-enchainee", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "✨",
    nameKey: "ranked.cards.mascarade-enchainee.name", descKey: "ranked.cards.mascarade-enchainee.desc",
    targetHintKey: "ranked.cards.mascarade-enchainee.targetHint", art: "/Cards Bonus/Mascarade Enchaînée.webp",
  },
  "fuite-masquee": {
    id: "fuite-masquee", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "💨",
    nameKey: "ranked.cards.fuite-masquee.name", descKey: "ranked.cards.fuite-masquee.desc",
    targetHintKey: "ranked.cards.fuite-masquee.targetHint", art: "/Cards Bonus/Fuite Masquée.webp",
  },
  /* ──── Voie TRANCHANT — cartes signature (Arena 2026-06-22, art:null = glyph) ──── */
  "coup-de-taille": {
    id: "coup-de-taille", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "rose", glyph: "🗡️",
    nameKey: "ranked.cards.coup-de-taille.name", descKey: "ranked.cards.coup-de-taille.desc",
    targetHintKey: "ranked.cards.coup-de-taille.targetHint", art: "/Cards Bonus/Coup de Taille.webp",
  },
  "acuite": {
    id: "acuite", cost: 2, rarity: "rare", voie: "scissors",
    target: "lane", palette: "rose", glyph: "🔪",
    nameKey: "ranked.cards.acuite.name", descKey: "ranked.cards.acuite.desc",
    targetHintKey: "ranked.cards.acuite.targetHint", art: "/Cards Bonus/Acuité.webp",
  },
  "frenesie": {
    id: "frenesie", cost: 2, rarity: "rare", voie: "scissors",
    target: "none", palette: "rose", glyph: "⚔️",
    nameKey: "ranked.cards.frenesie.name", descKey: "ranked.cards.frenesie.desc",
    targetHintKey: "ranked.cards.frenesie.targetHint", art: "/Cards Bonus/Frénésie.webp",
  },
  "estafilade": {
    // Reach (Alex 2026-06-30) — art à fournir, glyph fallback.
    id: "estafilade", cost: 1, rarity: "common", voie: "scissors",
    target: "lane", palette: "rose", glyph: "🪒",
    nameKey: "ranked.cards.estafilade.name", descKey: "ranked.cards.estafilade.desc",
    targetHintKey: "ranked.cards.estafilade.targetHint", art: "/Cards Bonus/Estafilade.webp",
  },
  "saignee": {
    // Card-advantage aggro — art à fournir, glyph fallback.
    id: "saignee", cost: 2, rarity: "rare", voie: "scissors",
    target: "none", palette: "rose", glyph: "🩸",
    nameKey: "ranked.cards.saignee.name", descKey: "ranked.cards.saignee.desc",
    targetHintKey: "ranked.cards.saignee.targetHint", art: "/Cards Bonus/Saignée.webp",
  },
  "fureur-emoussee": {
    // Payoff Émoussé — art à fournir, glyph fallback.
    id: "fureur-emoussee", cost: 1, rarity: "common", voie: "scissors",
    target: "none", palette: "rose", glyph: "💢",
    nameKey: "ranked.cards.fureur-emoussee.name", descKey: "ranked.cards.fureur-emoussee.desc",
    targetHintKey: "ranked.cards.fureur-emoussee.targetHint", art: "/Cards Bonus/Fureur Émoussée.webp",
  },
  /* ──── Voie FORÊT — cartes signature (Arena 2026-06-23, art:null = glyph) ──── */
  "ramure": {
    id: "ramure", cost: 3, rarity: "rare", voie: "paper",
    target: "none", palette: "emerald", glyph: "🌿",
    nameKey: "ranked.cards.ramure.name", descKey: "ranked.cards.ramure.desc",
    targetHintKey: "ranked.cards.ramure.targetHint", art: "/Cards Bonus/Ramure.webp",
  },
  "photosynthese": {
    id: "photosynthese", cost: 2, rarity: "rare", voie: "paper",
    target: "lane", palette: "emerald", glyph: "☀️",
    nameKey: "ranked.cards.photosynthese.name", descKey: "ranked.cards.photosynthese.desc",
    targetHintKey: "ranked.cards.photosynthese.targetHint", art: "/Cards Bonus/Photosynthèse.webp",
  },
  "ronces": {
    id: "ronces", cost: 2, rarity: "common", voie: "paper",
    target: "lane", palette: "emerald", glyph: "🥀",
    nameKey: "ranked.cards.ronces.name", descKey: "ranked.cards.ronces.desc",
    targetHintKey: "ranked.cards.ronces.targetHint", art: "/Cards Bonus/Ronces.webp",
  },
  "greffe": {
    // Pioche flavor Forêt (Alex 2026-06-30) — texture non-soin + profondeur deck ; art à fournir.
    id: "greffe", cost: 1, rarity: "common", voie: "paper",
    target: "none", palette: "emerald", glyph: "🌱",
    nameKey: "ranked.cards.greffe.name", descKey: "ranked.cards.greffe.desc",
    targetHintKey: "ranked.cards.greffe.targetHint", art: "/Cards Bonus/Greffe.webp",
  },
  /* ──── Voie COSMOS — cartes signature (Arena 2026-06-23, art:null = glyph) ──── */
  "dilatation-temporelle": {
    id: "dilatation-temporelle", cost: 1, rarity: "common", voie: "spock",
    target: "none", palette: "indigo", glyph: "⏳",
    nameKey: "ranked.cards.dilatation-temporelle.name", descKey: "ranked.cards.dilatation-temporelle.desc",
    targetHintKey: "ranked.cards.dilatation-temporelle.targetHint", art: "/Cards Bonus/Dilatation Temporelle.webp",
  },
  "loi-de-causalite": {
    id: "loi-de-causalite", cost: 2, rarity: "rare", voie: "spock",
    target: "lane", palette: "indigo", glyph: "⚖️",
    nameKey: "ranked.cards.loi-de-causalite.name", descKey: "ranked.cards.loi-de-causalite.desc",
    targetHintKey: "ranked.cards.loi-de-causalite.targetHint", art: "/Cards Bonus/Loi de Causalité.webp",
  },
  "convergence-cosmique": {
    id: "convergence-cosmique", cost: 4, rarity: "epic", voie: "spock",
    target: "none", palette: "indigo", glyph: "☄️",
    nameKey: "ranked.cards.convergence-cosmique.name", descKey: "ranked.cards.convergence-cosmique.desc",
    targetHintKey: "ranked.cards.convergence-cosmique.targetHint", art: "/Cards Bonus/Convergence Cosmique.webp",
  },
  /* ──── Dégâts SIGNATURE par Voie (Arena 2026-06-23, art:null = glyph) ──── */
  "eboulis-final": {
    id: "eboulis-final", cost: 4, rarity: "epic", voie: "rock",
    target: "none", palette: "zinc", glyph: "🏔️",
    nameKey: "ranked.cards.eboulis-final.name", descKey: "ranked.cards.eboulis-final.desc",
    targetHintKey: "ranked.cards.eboulis-final.targetHint", art: "/Cards Bonus/Éboulis Final.webp",
  },
  "drain-vital": {
    id: "drain-vital", cost: 3, rarity: "rare", voie: "paper",
    target: "none", palette: "emerald", glyph: "🩸",
    nameKey: "ranked.cards.drain-vital.name", descKey: "ranked.cards.drain-vital.desc",
    targetHintKey: "ranked.cards.drain-vital.targetHint", art: "/Cards Bonus/Drain Vital.webp",
  },
  "coup-dans-lombre": {
    id: "coup-dans-lombre", cost: 3, rarity: "epic", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🌑",
    nameKey: "ranked.cards.coup-dans-lombre.name", descKey: "ranked.cards.coup-dans-lombre.desc",
    targetHintKey: "ranked.cards.coup-dans-lombre.targetHint", art: "/Cards Bonus/Coup dans l'Ombre.webp",
  },
  // ── Voie Mirage — nouvelles cartes (Alex 2026-06-28) ──
  "derobade": {
    id: "derobade", cost: 1, rarity: "common", voie: "lizard",
    target: "lane", palette: "cyan", glyph: "🌫️",
    nameKey: "ranked.cards.derobade.name", descKey: "ranked.cards.derobade.desc",
    targetHintKey: "ranked.cards.derobade.targetHint", art: "/Cards Bonus/derobade.webp",
  },
  "frappe-spectrale": {
    id: "frappe-spectrale", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "indigo", glyph: "👻",
    nameKey: "ranked.cards.frappe-spectrale.name", descKey: "ranked.cards.frappe-spectrale.desc",
    targetHintKey: "ranked.cards.frappe-spectrale.targetHint", art: "/Cards Bonus/frappe-spectrale.webp",
  },
  "sillage-spectral": {
    id: "sillage-spectral", cost: 2, rarity: "rare", voie: "lizard",
    target: "none", palette: "violet", glyph: "🌀",
    nameKey: "ranked.cards.sillage-spectral.name", descKey: "ranked.cards.sillage-spectral.desc",
    targetHintKey: "ranked.cards.sillage-spectral.targetHint", art: "/Cards Bonus/sillage-spectral.webp",
  },
  "faux-semblant": {
    id: "faux-semblant", cost: 3, rarity: "epic", voie: "lizard",
    target: "lane", palette: "violet", glyph: "🎭",
    nameKey: "ranked.cards.faux-semblant.name", descKey: "ranked.cards.faux-semblant.desc",
    targetHintKey: "ranked.cards.faux-semblant.targetHint", art: "/Cards Bonus/faux-semblant.webp",
  },
  "nuee-spectrale": {
    id: "nuee-spectrale", cost: 4, rarity: "legendary", voie: "lizard",
    target: "none", palette: "indigo", glyph: "🌠",
    nameKey: "ranked.cards.nuee-spectrale.name", descKey: "ranked.cards.nuee-spectrale.desc",
    targetHintKey: "ranked.cards.nuee-spectrale.targetHint", art: "/Cards Bonus/nuee-spectrale.webp",
  },
  "eclipse": {
    id: "eclipse", cost: 2, rarity: "rare", voie: "lizard",
    target: "lane", palette: "violet", glyph: "🌘",
    nameKey: "ranked.cards.eclipse.name", descKey: "ranked.cards.eclipse.desc",
    targetHintKey: "ranked.cards.eclipse.targetHint", art: "/Cards Bonus/eclipse.webp",
  },
  "intrication-quantique": {
    id: "intrication-quantique", cost: 3, rarity: "rare", voie: "spock",
    target: "none", palette: "indigo", glyph: "⚛️",
    nameKey: "ranked.cards.intrication-quantique.name", descKey: "ranked.cards.intrication-quantique.desc",
    targetHintKey: "ranked.cards.intrication-quantique.targetHint", art: "/Cards Bonus/Intrication Quantique.webp",
  },
  "taillade-mortelle": {
    id: "taillade-mortelle", cost: 4, rarity: "legendary", voie: "scissors",
    target: "none", palette: "rose", glyph: "⚡",
    nameKey: "ranked.cards.taillade-mortelle.name", descKey: "ranked.cards.taillade-mortelle.desc",
    targetHintKey: "ranked.cards.taillade-mortelle.targetHint", art: "/Cards Bonus/Taillade Mortelle.webp",
  },
  "seve": {
    id: "seve", cost: 1, rarity: "common", voie: "paper",
    target: "lane", palette: "emerald", glyph: "🌱",
    nameKey: "ranked.cards.seve.name", descKey: "ranked.cards.seve.desc",
    targetHintKey: "ranked.cards.seve.targetHint", art: "/Cards Bonus/Sève.webp",
  },
  "coup-oeil": {
    id: "coup-oeil", cost: 1, rarity: "common", voie: "spock",
    target: "none", palette: "cyan", glyph: "🔍",
    nameKey: "ranked.cards.coup-oeil.name", descKey: "ranked.cards.coup-oeil.desc",
    targetHintKey: "ranked.cards.coup-oeil.targetHint", art: "/Cards Bonus/Coup d'Œil.webp",
  },
  "permutation": {
    id: "permutation", cost: 2, rarity: "rare",
    target: "lane", palette: "indigo", glyph: "🔄",
    nameKey: "ranked.cards.permutation.name", descKey: "ranked.cards.permutation.desc",
    targetHintKey: "ranked.cards.permutation.targetHint", art: "/Cards Bonus/Permutation.webp",
  },
  "toile-gluante": {
    id: "toile-gluante", cost: 2, rarity: "rare",
    target: "lane", palette: "lime", glyph: "🕸️",
    nameKey: "ranked.cards.toile-gluante.name", descKey: "ranked.cards.toile-gluante.desc",
    targetHintKey: "ranked.cards.toile-gluante.targetHint", art: "/Cards Bonus/Toile Gluante.webp",
  },
  "reverberation": {
    id: "reverberation", cost: 2, rarity: "rare",
    target: "none", palette: "fuchsia", glyph: "🔊",
    nameKey: "ranked.cards.reverberation.name", descKey: "ranked.cards.reverberation.desc",
    targetHintKey: "ranked.cards.reverberation.targetHint", art: "/Cards Bonus/Réverbération.webp",
  },
  "gravite": {
    id: "gravite", cost: 3, rarity: "epic", voie: "spock",
    target: "none", palette: "indigo", glyph: "🌑",
    nameKey: "ranked.cards.gravite.name", descKey: "ranked.cards.gravite.desc",
    targetHintKey: "ranked.cards.gravite.targetHint", art: "/Cards Bonus/Gravité.webp",
  },
  "doppelganger": {
    id: "doppelganger", cost: 3, rarity: "epic",
    target: "none", palette: "sky", glyph: "👥",
    nameKey: "ranked.cards.doppelganger.name", descKey: "ranked.cards.doppelganger.desc",
    targetHintKey: "ranked.cards.doppelganger.targetHint", art: "/Cards Bonus/Doppelgänger.webp",
  },
  "purge": {
    id: "purge", cost: 3, rarity: "epic",
    target: "none", palette: "amber", glyph: "🧹",
    nameKey: "ranked.cards.purge.name", descKey: "ranked.cards.purge.desc",
    targetHintKey: "ranked.cards.purge.targetHint", art: "/Cards Bonus/Purge.webp",
  },
  "roue-destin": {
    id: "roue-destin", cost: 4, rarity: "legendary",
    target: "gamble", palette: "rose", glyph: "🎡",
    nameKey: "ranked.cards.roue-destin.name", descKey: "ranked.cards.roue-destin.desc",
    targetHintKey: "ranked.cards.roue-destin.targetHint", art: "/Cards Bonus/Roue du destin.webp",
  },
  "phenix": {
    id: "phenix", cost: 4, rarity: "legendary",
    target: "none", palette: "orange", glyph: "🔥",
    nameKey: "ranked.cards.phenix.name", descKey: "ranked.cards.phenix.desc",
    targetHintKey: "ranked.cards.phenix.targetHint", art: "/Cards Bonus/Fénix.webp",
  },
  "singularite": {
    id: "singularite", cost: 4, rarity: "legendary",
    target: "none", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.singularite.name", descKey: "ranked.cards.singularite.desc",
    targetHintKey: "ranked.cards.singularite.targetHint", art: "/Cards Bonus/Singularité.webp",
  },
} satisfies Partial<Record<CardId, RankedCard>>;
