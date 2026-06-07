/**
 * personaSeed — deterministic cosmetic persona for an opponent by name.
 *
 * Used by the pre-match prep screen so the same opponent always shows the
 * same arena (theme + pad + backdrop). Lives in its own file because both
 * the local tournament (PlayPage) and the online lanes flow (OnlinePage)
 * need it — the prep screen UX is identical, only the message plumbing
 * differs.
 *
 * Backdrops are picked from the FREE coded scenes so "ceding the field"
 * never depends on the opponent owning a premium set the local player can't
 * see.
 */

import type { BackgroundId, PadId, ThemeId } from "../types";

const PERSONA_THEMES: ThemeId[] = ["violet", "neon", "sunset", "forest", "ocean", "ember", "aurora", "gold", "cyber", "rose"];
const PERSONA_PADS: PadId[] = ["chalkboard", "vintage", "cosmos", "galaxy", "neon", "comics", "cyberpunk", "holy", "quantum", "casino"];
const PERSONA_BGS: BackgroundId[] = ["nebula", "galaxy", "aurora", "holy", "quantum", "grid", "casino", "volcanic", "abyss"];

export function oppPersona(name: string): { themeId: ThemeId; padId: PadId; backgroundId: BackgroundId } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return {
    themeId: PERSONA_THEMES[h % PERSONA_THEMES.length],
    padId: PERSONA_PADS[(h >> 3) % PERSONA_PADS.length],
    backgroundId: PERSONA_BGS[(h >> 7) % PERSONA_BGS.length],
  };
}
