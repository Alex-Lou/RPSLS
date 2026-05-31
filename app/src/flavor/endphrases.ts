/**
 * endphrases.ts — flavor phrases for the cinematic match-end screen.
 *
 * Picks vary by situation:
 *   - sweep            : you won every round (3-0 in a Bo5)
 *   - dominant         : you won by 2+ rounds
 *   - close            : you won by 1 round
 *   - comeback         : you won after trailing at the halfway mark*
 *   - dominated        : you lost by 2+ rounds
 *   - tight-loss       : you lost by 1 round
 *   - forfeit-win      : opponent forfeited
 *   - forfeit-loss     : you forfeited (matches end-of-match handler)
 *   - draw             : tied score (rare — Bo5 ends in odd score)
 *
 * (* comeback is approximated for now from the final score; an exact
 *    "trailed at halfway" check would need historical scores threaded
 *    through CinematicMatchEnd — kept simple.)
 *
 * Helpers return i18n keys; i18n.ts holds the EN/FR strings.
 */

export type EndSituation =
  | "sweep"
  | "dominant"
  | "close"
  | "comeback"
  | "dominated"
  | "tight-loss"
  | "forfeit-win"
  | "forfeit-loss"
  | "draw";

const VARIANT_COUNT = 3;

/** Classify the match outcome into a situation tag the flavor layer can
 *  read. Pure function of the final score + forfeit flag. */
export function classifyEnd(opts: {
  youScore: number;
  oppScore: number;
  bestOf: number;
  forfeit: boolean;
  forfeitByYou?: boolean;
}): EndSituation {
  if (opts.forfeit) {
    return opts.forfeitByYou ? "forfeit-loss" : "forfeit-win";
  }
  const diff = opts.youScore - opts.oppScore;
  const target = Math.ceil(opts.bestOf / 2);
  if (opts.youScore === target && opts.oppScore === 0) return "sweep";
  if (diff >= 2) return "dominant";
  if (diff === 1) return "close";
  if (diff === 0) return "draw";
  if (diff === -1) return "tight-loss";
  return "dominated";
}

/** Return an i18n key for the subtitle line shown under the big
 *  VICTOIRE / DÉFAITE wordmark. Variants per situation rotate. */
export function pickEndSubtitleKey(situation: EndSituation): string {
  const v = Math.floor(Math.random() * VARIANT_COUNT);
  return v === 0
    ? `endphrase.${situation}`
    : `endphrase.${situation}.alt${v}`;
}
