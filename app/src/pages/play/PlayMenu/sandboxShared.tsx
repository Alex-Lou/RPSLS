import type { Difficulty } from "../../../types";
import type { ModeCardId } from "./menuShared";

/* ─────────── Entraînement / Constellation — données partagées ─────────── */

export type SandboxMode = "classic" | "lanes" | "cards";

// Same icons + names as the main menu tiles, so the sandbox feels consistent.
export const SANDBOX_MODES: { id: SandboxMode; icon: ModeCardId; label: string; tag: string }[] = [
  { id: "classic", icon: "ranked",               label: "Classique",            tag: "Duel 1 v 1 — premier à la majorité des manches." },
  { id: "lanes",   icon: "constellation",        label: "Constellation",        tag: "3 couloirs joués en parallèle contre l'IA." },
  { id: "cards",   icon: "ranked_constellation", label: "Constellation Ranked", tag: "Mana, deck & cartes bonus. Ouvre le lobby + tournoi." },
];

export const DIFFS_META: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy",   label: "Facile",    hint: "L'IA joue souvent dans ton jeu — pour s'échauffer." },
  { id: "normal", label: "Normal",    hint: "Aléatoire pondéré selon l'humeur — combat équitable." },
  { id: "hard",   label: "Difficile", hint: "L'IA lit tes derniers coups et contre tes habitudes." },
];

export const MAX_WIN_TO = 9;
