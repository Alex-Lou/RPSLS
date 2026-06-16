import { starterDeck, shuffle, STARTING_HAND, CARDS, isPassiveCard } from "../cards";
import type { CardId, RankedBattleState } from "../rankedTypes";

/** Helpers PURS extraits VERBATIM de RankedGame (lignes 94-140). Zéro
 *  dépendance React — déplacement mécanique pour alléger l'orchestrateur. */

export function makeBattle(savedDeck?: string[]): RankedBattleState {
  const cleaned = (savedDeck ?? []).filter(
    (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
  );
  const source = cleaned.length > 0 ? cleaned : starterDeck();
  // Passives are pulled OUT of the draw pile — they're always-on for the whole
  // match and never enter the hand. Everything else is the shuffled draw deck.
  const passives = source.filter(isPassiveCard);
  const drawSource = source.filter((id) => !isPassiveCard(id));
  return {
    deck: shuffle(drawSource),
    hand: [],
    discard: [],
    usedOneShotCards: [],
    passives,
    oppHandSize: STARTING_HAND,
    roundWinsA: 0,
    roundWinsB: 0,
    roundsPlayed: 0,
    bonusHistory: [],
  };
}

/** Pick the lowest-rarity (then random) sacrificial card in a hand, excluding
 *  the card being played itself. Used by Métamorphose. */
export function pickSacrifice(hand: CardId[], exclude: CardId): CardId | null {
  const pool = hand.filter((c) => c !== exclude);
  if (pool.length === 0) return null;
  const order: CardId[] = pool.slice().sort((a, b) => {
    const ra = ["common", "rare", "epic", "legendary"].indexOf(CARDS[a].rarity);
    const rb = ["common", "rare", "epic", "legendary"].indexOf(CARDS[b].rarity);
    return ra - rb;
  });
  return order[0];
}

/** Rarity ladder: returns the rarity one tier above (legendary loops to itself
 *  per the design — sacrificing a legendary draws TWO of the same tier). */
export function nextRarityUp(r: "common" | "rare" | "epic" | "legendary"): "common" | "rare" | "epic" | "legendary" {
  return r === "common" ? "rare" : r === "rare" ? "epic" : "legendary";
}

export function removeFirst<T>(arr: T[], v: T): T[] {
  const i = arr.indexOf(v);
  if (i === -1) return arr;
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}
