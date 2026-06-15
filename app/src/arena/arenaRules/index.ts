/**
 * Constellation Pro — pure rules engine.
 *
 * Everything here is a pure function on BoardState: no React, no refs, no
 * I/O. The resolver below takes a snapshot of the board + both sides'
 * TurnIntent, applies spells → summons → combat → HP check, and returns
 * the new board. UI animates from the diff.
 *
 * Resolver order (per turn, AFTER both sides locked):
 *   1. Spells fire — defensive (Aegis, Anchor, Riposte) before offensive
 *      (Curse, Heist, Supernova). Same-priority both-side spells fire in
 *      parallel (state taken AT THE START of the spell phase).
 *   2. Summons land — new creatures arrive on their lanes; if the lane is
 *      already occupied by an ALLIED creature, the new one REPLACES (old
 *      dies silently, no damage taken).
 *   3. Combat — each lane resolves 1v1 (or attacker→hero if undefended)
 *      simultaneously. Both creatures take damage at the same step; one
 *      can die "to" a corpse and still trigger Riposte.
 *   4. HP check — if either hero ≤ 0, phase becomes "match-end".
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked combat formulas.
 *
 * Découpé par responsabilité ; ce barrel ré-exporte tout verbatim pour que le
 * specifier "./arenaRules" reste identique pour les 9 consommateurs :
 *   - heroCreature : primitives feuilles hero/créature (importées par arenaCombat)
 *   - boardInit    : init board/deck + mulligans + pioche
 *   - resolver     : pipeline de tour (sorts → summons → combat → settle)
 *   - lifecycle    : avance de tour + résultat de match
 */

export * from "./heroCreature";
export * from "./boardInit";
export * from "./resolver";
export * from "./lifecycle";
// resolveCombat / resolveLaneCombatAt vivent dans ./arenaCombat (déplacés
// 2026-06-09 quand arenaRules dépassait 700 l). Re-exportés ici pour préserver
// le contract des callsites qui importent depuis "./arenaRules". heroCreature
// (re-exporté ci-dessus AVANT) fournit à arenaCombat ses primitives feuilles
// → le cycle arenaRules<->arenaCombat reste sain.
export { resolveCombat, resolveLaneCombatAt } from "../arenaCombat";
