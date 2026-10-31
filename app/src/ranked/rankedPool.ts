import { PRO_CARDS } from "./cardCatalog/proCards";
import type { CardId } from "./rankedTypes";

/** Cartes des catalogues Base/V3 dont l'effet n'existe qu'en Constellation Pro :
 *  effets Arena, cartes « à la pioche » (arenaCastOnDraw) et Finishers. */
const ARENA_ONLY_IDS: readonly CardId[] = [
  "razzia", "surcharge", "toxine", "echo", "rappel", "double-mot", "chronomancien",
  "coup-de-bol", "bouffee-air", "cafeine", "tuile", "eclair-genie", "patate-chaude",
  "pile-ou-face", "trefle-chance", "sursaut",
  "finisher-forteresse", "finisher-verger", "finisher-lame", "finisher-metamorphose", "finisher-calcul",
];

const NOT_IN_RANKED: ReadonlySet<string> = new Set([...Object.keys(PRO_CARDS), ...ARENA_ONLY_IDS]);

/** Cartes proposées au deck Constellation Classée : celles que son moteur
 *  implémente (les autres coûteraient du mana sans rien faire). */
export function isRankedDeckable(id: CardId): boolean {
  return !NOT_IN_RANKED.has(id);
}
