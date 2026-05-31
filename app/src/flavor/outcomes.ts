/**
 * outcomes.ts — multi-variant narration for the 10 RPSLS move pairs.
 *
 * The engine (lanesEngine.ts) still returns ONE canonical verb in the
 * Outcome so old code keeps working — this file layers variants on top.
 * `pickOutcomeVerb(canonical)` returns a key the UI feeds to `t(...)` so
 * each reveal can read a little differently without changing the rules.
 *
 * Keys follow the pattern `verb.<canonical>` (the existing baseline) or
 * `verb.<canonical>.altN` for variants. i18n.ts holds the EN + FR
 * strings; locales without a variant fall back to the canonical.
 */

import type { Move } from "../game";

/** Number of variants per canonical verb (canonical itself + .alt1..alt3). */
const VARIANT_COUNT = 4;

/** The 10 unique winning verbs from RPSLS rules (mirrors lanesEngine RULES). */
export const CANONICAL_VERBS = [
  "cuts", "decapitates", "covers", "disproves",
  "crushes", "poisons", "eats", "vaporizes", "smashes",
] as const;

export type CanonicalVerb = typeof CANONICAL_VERBS[number];

/**
 * Return one of the available i18n keys for `canonical`. Uses Math.random
 * so each call is independent — caller should remember the pick if it
 * needs the same phrase shown twice (e.g. reveal then verdict line).
 */
export function pickOutcomeKey(canonical: string): string {
  const variant = Math.floor(Math.random() * VARIANT_COUNT);
  return variant === 0
    ? `verb.${canonical.toLowerCase()}`
    : `verb.${canonical.toLowerCase()}.alt${variant}`;
}

/** True when (winner, loser) is the well-known RPSLS pair — useful for
 *  consumers that want to label "favoured" verbs vs the generic
 *  fallback. */
export function isCanonicalPair(winner: Move, loser: Move): boolean {
  return RPSLS_VERBS[winner]?.[loser] !== undefined;
}

/** Mirror of the engine's RULES, exported here so consumers (combo banners,
 *  end-phrases) can ask "what verb did move X use vs Y?" without importing
 *  the engine. */
export const RPSLS_VERBS: Partial<Record<Move, Partial<Record<Move, CanonicalVerb>>>> = {
  scissors: { paper: "cuts",       lizard: "decapitates" },
  paper:    { rock: "covers",      spock: "disproves" },
  rock:     { scissors: "crushes", lizard: "crushes" },
  lizard:   { spock: "poisons",    paper: "eats" },
  spock:    { rock: "vaporizes",   scissors: "smashes" },
};
