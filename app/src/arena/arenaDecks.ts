/**
 * Arena deck construction helpers.
 *
 * Extracted from ArenaGame.tsx so the orchestrator stays under the
 * 400-line ceiling. Two responsibilities:
 *   1. CPU_ARENA_DECK — the curated 12-card hand pool the bot draws from
 *      every Arena match. Picked to give the CPU one card of every
 *      Phase-1 archetype so its turns feel varied.
 *   2. buildPlayerDeck — sanitise the player's saved Ranked deck for use
 *      in Arena: drops cards that don't yet have an Arena adaptation,
 *      pads the result with a fallback filler so the hand has something
 *      to draw even if the saved deck is sparse / unsupported.
 *   3. removeSpentCards — strip the spells a side just committed from
 *      their hand BEFORE the resolver runs, so the next-turn draw starts
 *      from a clean post-play hand.
 */

import { arenaSupported } from "./arenaCardEffects";
import type { TurnIntent } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

/** CPU's curated Arena deck — one card per Phase-1 archetype so the bot's
 *  turns stay varied. (Passives are filtered out by arenaSupported anyway,
 *  but we list explicit IDs here for readability.) */
export const CPU_ARENA_DECK: CardId[] = [
  "aegis", "precision", "anchor", "second-wind",
  "surge", "augur", "curse", "mirror",
  "heist", "tide", "oracle", "supernova",
  // Alex feedback 2026-06-09 : match plus long, plus de matière à jouer.
  // Padding pour égaler la nouvelle taille de deck joueur (12).
];

/** Build the player's Arena deck from their saved Ranked deck. Drops cards
 *  without an Arena adaptation, then pads with a sensible default if the
 *  resulting deck is too short to draw meaningfully.
 *
 *  CRITICAL BALANCE: the filler MUST include at least one direct-damage
 *  spell (Heist, Supernova) so the player has a way to push lethal even
 *  when every lane has an opp creature blocking the path. Without this,
 *  the CPU's "always-summon" fill of all 3 lanes leaves the player with
 *  ZERO way to damage the opp hero (Alex's "opp ne perd jamais de vie"
 *  symptom). Direct-damage spells fix that. */
export function buildPlayerDeck(saved: CardId[] | undefined): CardId[] {
  const FILLER: CardId[] = [
    // Defensive / buffs
    "aegis", "precision", "anchor", "second-wind",
    // Direct damage / reach (KEEP — without these the player can't push lethal)
    "heist", "supernova",
    // Tempo / draw / control
    "surge", "curse", "mirror", "tide",
  ];
  // Alex feedback 2026-06-09 : "à court de jeu/fun" → bumped deck size
  // 8 → 12 pour garantir plus de matière en pioche. Avec STARTING_HAND_SIZE=5
  // et pioche 2/tour, le deck est consommé sur ~6-7 tours puis on reshuffle
  // le discard, ce qui donne 12-14 tours d'activité avant reshuffle.
  const DECK_SIZE = 12;
  const base = (saved ?? []).filter(arenaSupported);
  // Force-include direct damage so the player can push lethal even if
  // all lanes have an opp creature blocking the path.
  const enforced = base.slice();
  if (!enforced.includes("heist") && enforced.length < DECK_SIZE) enforced.push("heist");
  if (!enforced.includes("supernova") && enforced.length < DECK_SIZE) enforced.push("supernova");
  // Top up with filler — duplicates allowed for variety.
  const out = enforced.slice();
  for (const f of FILLER) {
    if (out.length >= DECK_SIZE) break;
    out.push(f);
  }
  // If FILLER ran dry (shouldn't), pad with first card to reach size.
  while (out.length < DECK_SIZE && out.length > 0) out.push(out[0]);
  return out;
}

/** Strip cards the side committed (spells) from their hand BEFORE the
 *  resolver runs. Summons are RPSLS moves, not cards in hand — they
 *  don't need to be removed. */
export function removeSpentCards(hand: CardId[], intent: TurnIntent): CardId[] {
  let out = hand.slice();
  for (const s of intent.spells) {
    const i = out.indexOf(s.id);
    if (i >= 0) out = [...out.slice(0, i), ...out.slice(i + 1)];
  }
  return out;
}
