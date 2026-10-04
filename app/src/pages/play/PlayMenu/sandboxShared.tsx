import type { Difficulty } from "../../../types";
import type { ModeCardId } from "./menuShared";

/* ─────────── Entraînement / Constellation — données partagées ─────────── */

export type SandboxMode = "classic" | "lanes" | "cards";

// Same icons + names as the main menu tiles, so the sandbox feels consistent.
// Libellés = clés i18n (traduites au rendu via t()).
export const SANDBOX_MODES: { id: SandboxMode; icon: ModeCardId; labelKey: string; tagKey: string }[] = [
  { id: "classic", icon: "ranked",               labelKey: "sandbox.mode.classic",      tagKey: "sandbox.mode.classic.tag" },
  { id: "lanes",   icon: "constellation",        labelKey: "mode.constellation",        tagKey: "sandbox.mode.lanes.tag" },
  { id: "cards",   icon: "ranked_constellation", labelKey: "mode.ranked_constellation", tagKey: "sandbox.mode.cards.tag" },
];

/** Difficultés : libellé `diff.<id>`, aide `diff.<id>.desc`. */
export const DIFFS_META: { id: Difficulty }[] = [
  { id: "easy" },
  { id: "normal" },
  { id: "hard" },
];

export const MAX_WIN_TO = 9;
