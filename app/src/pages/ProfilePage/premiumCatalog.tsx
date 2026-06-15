import { motion } from "motion/react";
import { type PremiumSet } from "../../ui/PremiumPurchaseModal";

/** Accent palette + emblem for the lightweight purchase-modal preview tile.
 *  Mirrors each set's `accent` in themes.ts. Kept local so the preview never
 *  pulls in a live backdrop. */
const PREVIEW_ACCENTS: Record<string, { from: string; to: string; bg: string; emoji: string }> = {
  eclipse:    { from: "#d4a745", to: "#8b7fcf", bg: "#06050e", emoji: "🌑" },
  phantom:    { from: "#5a7a9a", to: "#8a9bb5", bg: "#0c0e14", emoji: "👻" },
  emberforge: { from: "#ff6a14", to: "#ff9426", bg: "#0a0503", emoji: "🔥" },
  tempus:     { from: "#b8956a", to: "#d4a76a", bg: "#0a0703", emoji: "⏳" },
  storm:      { from: "#4af0ff", to: "#a078ff", bg: "#060a16", emoji: "⚡" },
  quartz:     { from: "#c8aef0", to: "#f6a5b8", bg: "#1a142a", emoji: "💠" },
  // 2026-06-07 lineup
  coral:      { from: "#ff6b6b", to: "#4ecdc4", bg: "#0a1628", emoji: "🪸" },
  rust:       { from: "#d2691e", to: "#8b4513", bg: "#0a0502", emoji: "🏭" },
  void:       { from: "#ffffff", to: "#666666", bg: "#000000", emoji: "◼️" },
  prism:      { from: "#ffffff", to: "#8b5cf6", bg: "#050510", emoji: "💎" },
  ink:        { from: "#1a1a1a", to: "#8c8c8c", bg: "#f5f0e8", emoji: "🖋️" },
  bloom:      { from: "#ff7eb3", to: "#81c784", bg: "#f0f4f0", emoji: "🌸" },
};

/** PremiumPreviewTile — lightweight, ZERO-WebGL preview for the purchase
 *  modal. Two earlier attempts mounted a live <ThemedBackdrop> here, which
 *  spawned a SECOND WebGL context (the first being the full-screen peek the
 *  modal opens over) and crashed mobile GPUs. The player already sees the
 *  real animated backdrop full-screen in the peek; this tile just needs to
 *  evoke the set with its accent gradient + emblem. Pure CSS / motion. */
function PremiumPreviewTile({ setId }: { setId: string }) {
  const a = PREVIEW_ACCENTS[setId] ?? PREVIEW_ACCENTS.eclipse;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: a.bg }}>
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(120% 90% at 18% 12%, ${a.from}cc, transparent 55%),` +
            `radial-gradient(120% 90% at 86% 92%, ${a.to}aa, transparent 55%)`,
        }}
        animate={{ opacity: [0.72, 1, 0.72], scale: [1, 1.06, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Diagonal shimmer sweep — sells "premium sheen". */}
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{ background: `linear-gradient(105deg, transparent, ${a.from}40, transparent)` }}
        animate={{ x: ["-160%", "360%"] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.0 }}
      />
      {/* Watermark emblem. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl opacity-25 select-none"
              style={{ filter: `drop-shadow(0 0 26px ${a.from})` }}>
          {a.emoji}
        </span>
      </div>
    </div>
  );
}

/** Premium catalogue — single source of truth for the boutique. Preview is a
 *  lightweight CSS tile (NOT a live backdrop — see PremiumPreviewTile). The
 *  full animated scene is shown in the full-screen peek the player reaches
 *  before this modal. Add a new set: drop an entry here + register the
 *  background id with `premiumSetId: "<id>"` in themes.ts + an accent in
 *  PREVIEW_ACCENTS above. */
export const PREMIUM_SETS: Record<string, PremiumSet> = {
  quartz: {
    id: "quartz",
    name: "Quartz",
    tagline: "Éclats cristallins prismatiques, un monde glaciaire et doux.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="quartz" />,
  },
  eclipse: {
    id: "eclipse",
    name: "Eclipse",
    tagline: "Couronne solaire, anneau de diamant, vide onyx percé d'or.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="eclipse" />,
  },
  phantom: {
    id: "phantom",
    name: "Phantom Realm",
    tagline: "Brume spectrale, larmes fantômes, volutes argentées.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="phantom" />,
  },
  emberforge: {
    id: "emberforge",
    name: "Ember Forge",
    tagline: "Forge naine, rivières de braise, cuivre martelé incandescent.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="emberforge" />,
  },
  tempus: {
    id: "tempus",
    name: "Tempus Aeternum",
    tagline: "Sables du temps, engrenages antiques, sablier sépia éternel.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="tempus" />,
  },
  storm: {
    id: "storm",
    name: "Tempest Fury",
    tagline: "Foudre déchirante, rideaux de pluie, nuages d'orage grondants.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="storm" />,
  },
  // ── 2026-06-07 lineup. Prices follow the design doc:
  //    Coral / Rust / Bloom / Prism = 700-800 (rich animation)
  //    Void / Ink = 900 (light-mode UI work on top of the scene) ──
  coral: {
    id: "coral",
    name: "Coral Reef",
    tagline: "Récif bioluminescent, anémones pulsantes, bancs de poissons.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="coral" />,
  },
  rust: {
    id: "rust",
    name: "Rust",
    tagline: "Déclin industriel, poutres rouillées, étincelles de soudure.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="rust" />,
  },
  void: {
    id: "void",
    name: "Void",
    tagline: "Géométrie pure, vide absolu, l'anti-spectacle.",
    cost: 900,
    previewArt: <PremiumPreviewTile setId="void" />,
  },
  prism: {
    id: "prism",
    name: "Prism",
    tagline: "Laboratoire de lumière, faisceaux spectraux décomposés.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="prism" />,
  },
  ink: {
    id: "ink",
    name: "Ink (Sumi-e)",
    tagline: "Calligraphie japonaise, encre noire sur papier de riz.",
    cost: 900,
    previewArt: <PremiumPreviewTile setId="ink" />,
  },
  bloom: {
    id: "bloom",
    name: "Bloom Garden",
    tagline: "Jardin infini, pétales en spirale, lucioles, fleurs qui s'ouvrent.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="bloom" />,
  },
};
