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

import { BG_DEFAULT_THEME, PAD_DEFAULT_BG } from "../theme/themes";

/** Fonds FREE — le CPU ne doit jamais montrer un set premium que le joueur
 *  local ne possède pas (sinon "céder le terrain" plante visuellement). */
const FREE_BGS: BackgroundId[] = ["nebula", "galaxy", "aurora", "holy", "quantum", "grid", "casino", "volcanic", "abyss"];

/** Bundles cohérents pad+fond+thème (Alex 2026-06-13 : "les CPU = 1 pad = son
 *  apparence affiliée, PAS de mélange ; le mix & match reste réservé aux vrais
 *  joueurs"). Construits depuis le pairing EXISTANT pad↔fond (PAD_DEFAULT_BG)
 *  + fond→thème (BG_DEFAULT_THEME) : tout est assorti par construction, et
 *  chaque pad n'apparaît qu'une fois → 1 pad = 1 apparence, garanti. */
const PERSONA_BUNDLES: { themeId: ThemeId; padId: PadId; backgroundId: BackgroundId }[] =
  (Object.entries(PAD_DEFAULT_BG) as [PadId, BackgroundId][])
    .filter(([, bg]) => FREE_BGS.includes(bg) && !!BG_DEFAULT_THEME[bg])
    .map(([padId, backgroundId]) => ({ padId, backgroundId, themeId: BG_DEFAULT_THEME[backgroundId]! }));

/** Portraits CPU (Alex 2026-06-13 : « ajouter des icônes aux CPU plutôt que
 *  les émoticônes pourries »). Pool = les 13 hero_*.png — vrais portraits, pas
 *  d'emoji 🤖. Assigné par hash du nom → le même adversaire garde son visage. */
const CPU_AVATARS: string[] = [
  "hero_knight", "hero_king", "hero_oracle", "hero_sage", "hero_royal", "hero_guardian",
  "hero_serpent", "hero_fox", "hero_frost", "hero_elf", "hero_jester", "hero_shard", "hero_zen",
].map((n) => `/Profile miniatures/${n}.png`);

export interface OppPersona {
  themeId: ThemeId;
  padId: PadId;
  backgroundId: BackgroundId;
  /** Chemin du portrait CPU (hero_*.png) — toujours une image, jamais d'emoji. */
  avatar: string;
}

export function oppPersona(name: string): OppPersona {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  // Second hash (graine différente) → l'avatar varie indépendamment du bundle
  // pad/fond/thème : deux noms au même bundle gardent des visages distincts.
  let h2 = 0;
  for (let i = 0; i < name.length; i++) h2 = (h2 * 131 + name.charCodeAt(i) * 7 + 13) >>> 0;
  const avatar = CPU_AVATARS[h2 % CPU_AVATARS.length];
  // UN bundle entier par persona → pad + fond + thème toujours cohérents.
  if (PERSONA_BUNDLES.length > 0) return { ...PERSONA_BUNDLES[h % PERSONA_BUNDLES.length], avatar };
  return { themeId: "violet", padId: "cosmos", backgroundId: "nebula", avatar }; // filet (jamais atteint)
}
