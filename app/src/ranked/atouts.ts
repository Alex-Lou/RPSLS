/**
 * Atouts — light, mana-free perks for the Classé 1v1 mode.
 *
 * The player picks 2 before a match; each is usable once. Two are "manual"
 * (tapped during the pick) and two are "auto" (fire on the first lost round).
 * Deliberately simpler than the Constellation Ranked cards — the 1v1 rhythm
 * wants a single tactical beat, not a deck + mana economy.
 */

export type AtoutId = "lecture" | "vabanque" | "garde" | "contre";

export interface AtoutDef {
  id: AtoutId;
  glyph: string;
  label: string;
  desc: string;
  /** manual = player taps it during the pick; auto = triggers on a lost round. */
  kind: "manual" | "auto";
}

export const ATOUTS: AtoutDef[] = [
  { id: "lecture",  glyph: "🔮", label: "Lecture",   desc: "Révèle le coup probable de l'adversaire.", kind: "manual" },
  { id: "vabanque", glyph: "⚡", label: "Va-banque", desc: "La manche en cours vaut 2 points.",       kind: "manual" },
  { id: "garde",    glyph: "🛡️", label: "Garde",     desc: "Annule ta 1ʳᵉ manche perdue (→ nul).",     kind: "auto" },
  { id: "contre",   glyph: "🔁", label: "Contre",    desc: "Rejoue ta 1ʳᵉ manche perdue (nouveau tirage adverse).", kind: "auto" },
];

export const ATOUTS_BY_ID: Record<AtoutId, AtoutDef> =
  Object.fromEntries(ATOUTS.map((a) => [a.id, a])) as Record<AtoutId, AtoutDef>;

export const MAX_ATOUTS = 2;
