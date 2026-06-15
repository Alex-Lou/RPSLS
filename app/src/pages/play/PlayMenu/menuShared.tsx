import type { GameMode } from "../../../types";

/* ─────────── Zone menu — coutures partagées ─────────── */

// "online" + "constellation" are UI-only home cards. Constellation routes to
// a local vs-CPU 3-lanes match; the real GameMode union covers CPU/hotseat
// recorded matches.
export type ModeCardId = GameMode | "online" | "constellation" | "ranked_constellation" | "arena_pro";

// Ordre 3×2 (Alex 2026-06-12) — familles + complexité croissante :
//   Entraînement      | En ligne
//   Classé            | Constellation Classique
//   Constellation Cl. | Constellation Pro
export const ALL_CARDS: ModeCardId[] = [
  "training", "online", "ranked", "constellation", "ranked_constellation", "arena_pro",
];

// Hand-drawn icons that replace the emoji on each mode tile. Lives in
// public/MenuIcons (renamed to kebab-case to dodge URL-encoding traps).
export const MODE_ICONS: Record<ModeCardId, string> = {
  training:             "/MenuIcons/entrainement.png",
  casual:               "/MenuIcons/detendu.png",
  ranked:               "/MenuIcons/classe.png",
  hotseat:              "/MenuIcons/hot-seat.png",
  online:               "/MenuIcons/en-ligne.png",
  constellation:        "/MenuIcons/constellation.png",
  ranked_constellation: "/MenuIcons/constellation.png", // Phase A: reuse art with a distinct tint.
  arena_pro:            "/MenuIcons/constellation.png", // Reuse for MVP; bespoke art in Phase 2.
};

/** Per-mode accent for the two tiles that otherwise fell through to the plain
 *  generic style (Entraînement, Classé) — every menu card now has its own
 *  coloured identity. Fixed hues (not theme tokens) on purpose: each mode must
 *  be recognisable at a glance, like online/constellation already are.
 *
 *  ⚠️ Each accent string is layered ON TOP of TILE_BASE (an opaque, theme-aware
 *  `bg-surface` substrate). Without that base the faint /15-/22 tint sat
 *  directly over the animated WebGL backdrop → titles drowned mid-flash. With
 *  it, the colour reads as a tasteful wash over a readable panel. */
export const TILE_ACCENT: Partial<Record<ModeCardId, string>> = {
  training:
    "border-emerald-400/30 from-emerald-500/22 via-teal-500/14 to-cyan-500/22 " +
    "hover:from-emerald-500/32 hover:via-teal-500/24 hover:to-cyan-500/32 hover:border-emerald-400/60 shadow-lg shadow-emerald-500/10",
  ranked:
    "border-sky-400/30 from-sky-500/22 via-indigo-500/14 to-blue-500/22 " +
    "hover:from-sky-500/32 hover:via-indigo-500/24 hover:to-blue-500/32 hover:border-sky-400/60 shadow-lg shadow-sky-500/10",
};

/** Readable substrate shared by every menu tile. `bg-surface-raised` is the
 *  most opaque semantic theme token (App.css): ~90 % on calm backgrounds, 94 %
 *  under `.theme-flashy`, 96 % under `.theme-light`. We pick the raised tier (not
 *  plain `bg-surface`, ~72 % on calm) on purpose: several animated scenes are
 *  bright yet NOT flagged `flashy` (volcanic lava, quantum filaments, Emberforge
 *  embers), so they'd keep the 72 % base — and at 72 % a full-screen flash drags
 *  small muted descriptions below AA contrast. 90 %+ everywhere guarantees the
 *  titles/descriptions stay legible over ANY backdrop, flagged or not, while the
 *  ~6-10 % bleed + the colour tint keep the cards from going flat ("équilibre").
 *
 *  The per-card colour gradient is painted on top via `bg-gradient-to-br` (a
 *  background-IMAGE, so it composites over this background-COLOR base without
 *  fighting it).
 *
 *  No `backdrop-blur` on purpose: with a 90 %+ base the blur buys almost no
 *  readability while costing a GPU filter pass per tile — 60 fps is
 *  non-negotiable on device. */
export const TILE_BASE = "bg-surface-raised bg-gradient-to-br";

/** Scroll du menu principal BLOQUÉ (Alex 2026-06-12) : tout doit tenir sur
 *  une page sans scroller. Repasser à false pour ré-autoriser le scroll. */
export const MENU_SCROLL_LOCKED = true;

/** Renders the mode tile icon — a PNG from /MenuIcons, sized to match the
 *  emoji it replaced (~36px, with breathing margins for the tile). */
export function ModeIcon({ mode }: { mode: ModeCardId }) {
  return (
    <img
      src={MODE_ICONS[mode]}
      alt=""
      className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
    />
  );
}
