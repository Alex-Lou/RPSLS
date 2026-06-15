/**
 * Constellation Pro — pure types for the mini-CCG mode.
 *
 * Separate from the Ranked types (`ranked/rankedTypes.ts`) because the
 * game shape is fundamentally different: persistent creatures on lanes,
 * hero HP instead of round wins, simultaneous turn loop with mana that
 * scales 1→10.
 *
 * Re-uses the existing CardId union from rankedTypes — the 46 cards
 * become "spells" with a separate effect table (see arenaCardEffects).
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked design.
 *
 * Découpé par responsabilité ; ce barrel ré-exporte tout verbatim (`export *`)
 * pour que le specifier `./arenaTypes` reste identique pour les 28 consommateurs :
 *   - constants : économie/règles du match (HP, mana, lanes, caps)
 *   - hero      : Side, personas CPU, Cast-When-Drawn, HeroState
 *   - creatures : stats/passifs/design-notes par symbole + Creature + LaneState
 *   - board     : intents de tour + BoardState + ArenaPhase + résultat
 *   - targeting : tables + fonctions de ciblage UI + table de contre RPSLS
 */

export * from "./constants";
export * from "./hero";
export * from "./creatures";
export * from "./board";
export * from "./targeting";
