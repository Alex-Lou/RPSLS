/* ───────────────────────── Hero ───────────────────────── */

export const HERO_MAX_HP = 20;
// Alex feedback 2026-06-09 G : "repenser le fun, parties s'épuisent vite"
// → MANA_CAP 10→8 pour rendre les ressources plus précieuses, le tempo
// du match plus serré (max ATK lift à T8 au lieu de T10).
export const MANA_CAP = 8;
export const LANE_COUNT = 3;
// Alex feedback 2026-06-09 : "trop de cartes dans la main, slide pas dispo"
// → HAND_CAP 10 → 7 pour réduire la surcharge visuelle. Le hand strip
// gère le slide horizontal natif (overflow-x-auto + touch-action: pan-x)
// donc 7 cartes max est confortable sans débordement.
export const HAND_CAP = 7;
export const STARTING_HAND_SIZE = 5;
/** Coût en mana pour RÉCUPÉRER vers la main la carte FUSIONNÉE de SA forge (Alex
 *  2026-06-13, option B). Crée un EMPÊCHEMENT (mana serré → fusion coincée sur la
 *  forge) ET une OPPORTUNITÉ DE VOL (tant qu'elle traîne, la Razzia adverse peut
 *  la rafler). DÉPÔT, FUSION et reprise d'un simple dépôt restent GRATUITS ; seule
 *  la sortie du PAYOFF (la carte fusionnée) se paie. */
export const FORGE_RECOVER_COST = 1;
// CAPS LEVÉS (Alex 2026-06-13 "CCG expert — pas de limites quand pas
// nécessaires") : le MANA est désormais L'UNIQUE limite du tour, comme dans
// tout CCG mature (Hearthstone n'a aucun cap de sorts/tour). 99 = inerte ;
// la plomberie (addSpell + truncateIntentByCaps, SOURCE UNIQUE partagée
// UI/engine/IA) est conservée — re-serrer ici suffit si un abus émerge.
export const MAX_SPELLS_PER_TURN = 99;
export const UTILITY_SPELLS_PER_TURN = 99;
/** Soft cap on turns — if neither hero is dead by then, the lower-HP loses
 *  (sudden-death fail-safe so an over-defensive match still ends). */
export const TURN_HARD_CAP = 30;
