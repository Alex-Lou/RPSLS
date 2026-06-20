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
// MATCH EN PHASES (Alex 2026-06-17) : main de départ 0 → l'OUVERTURE (T1-3) est
// invocations RPSLS SEULEMENT, zéro carte. Les cartes se débloquent ensuite par
// PALIERS (« chute de deck »), cf. arenaHandCap + advanceToNextTurn.
export const STARTING_HAND_SIZE = 0;

/** OUVERTURE : nombre de tours « invocations seulement » avant le 1er déblocage
 *  de cartes (Alex 2026-06-17 « les 3 premiers tours pour les premiers moves »). */
export const OPENING_TURNS = 3;

/** PLAFOND DE MAIN par PHASE (Alex 2026-06-17). T1-3 = 0 (ouverture, moves only).
 *  Puis 5 au tour 4 (Alex « 5 cartes pour commencer sinon plus rien dès le 3e
 *  tour, ils vont tout claquer »), +1 tous les 3 tours (T7=6, T10=7…), plafonné
 *  à HAND_CAP. À chaque hausse de palier, advanceToNextTurn fait une « chute de
 *  deck » qui remplit jusqu'au cap. */
export function arenaHandCap(turn: number): number {
  if (turn <= OPENING_TURNS) return 0;
  return Math.min(HAND_CAP, 5 + Math.floor((turn - OPENING_TURNS - 1) / 3));
}
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
 *  (sudden-death fail-safe so an over-defensive match still ends).
 *  30→15 (Alex 2026-06-17, rethink Phase 0/1) : borne le late-game qui
 *  s'éternisait en RPSLS pur (decks secs dès T6-8). Filet réversible ; la vraie
 *  horloge léthale = la fatigue douce (Phase 1, deck sec → dégâts croissants).
 *  Cf. ARENA-RETHINK.md. */
export const TURN_HARD_CAP = 15;
