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
import { CARDS } from "../ranked/cards";
import type { TurnIntent } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

/** CPU's curated Arena deck — fallback static deck if buildCpuDeckMirroring
 *  ne reçoit pas de playerDeck. Sinon utilisé via la version dynamique
 *  qui mimique la rareté du joueur (Alex feedback équité 2026-06-09). */
export const CPU_ARENA_DECK: CardId[] = [
  "aegis", "precision", "anchor", "second-wind",
  "surge", "augur", "curse", "mirror",
  "heist", "tide", "oracle", "supernova",
];

/** Alex feedback équité 2026-06-09 : "le cpu devra avoir autant de cartes
 *  de chaque rang que le joueur" — buildCpuDeckMirroring construit un
 *  deck CPU qui match la distribution de raretés (common/rare/epic/legendary)
 *  du deck joueur, mais avec cartes potentiellement différentes.
 *
 *  Algo : compte les raretés du playerDeck, pour chaque rareté pige des
 *  cartes Arena-supportées dans la même rareté (random, sans replacement
 *  jusqu'à atteindre le count). Si la pool d'une rareté donnée est plus
 *  petite que le count requis, on accepte les doublons jusqu'à 2 copies.
 *  Si encore insuffisant, on complète avec d'autres raretés (downgrade
 *  préféré pour ne pas exploser la power level). */
export function buildCpuDeckMirroring(playerDeck: CardId[]): CardId[] {
  // Comptage des raretés du joueur (cartes Arena-supported uniquement).
  const counts: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const id of playerDeck) {
    const card = CARDS[id];
    if (!card) continue;
    counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
  }
  // Pool de cartes Arena-supported par rareté.
  const pools: Record<string, CardId[]> = { common: [], rare: [], epic: [], legendary: [] };
  for (const id of Object.keys(CARDS) as CardId[]) {
    if (!arenaSupported(id)) continue;
    const card = CARDS[id];
    pools[card.rarity].push(id);
  }
  // Pour chaque rareté du joueur, pige N cartes (doublon autorisé jusqu'à 2).
  const out: CardId[] = [];
  const inOut = new Map<CardId, number>();
  const tryAdd = (id: CardId, max: number): boolean => {
    const cur = inOut.get(id) ?? 0;
    if (cur >= max) return false;
    out.push(id);
    inOut.set(id, cur + 1);
    return true;
  };
  for (const rarity of ["legendary", "epic", "rare", "common"] as const) {
    const need = counts[rarity];
    const pool = pools[rarity].slice();
    // Shuffle simple in-place pour pige random.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let added = 0;
    // 1re passe : 1 copie par carte
    for (const c of pool) {
      if (added >= need) break;
      if (tryAdd(c, 1)) added++;
    }
    // 2e passe : 2e copie si encore besoin
    for (const c of pool) {
      if (added >= need) break;
      if (tryAdd(c, 2)) added++;
    }
    // 3e passe : downgrade depuis une rareté supérieure si pool épuisée
    if (added < need) {
      const downgradeOrder = (
        rarity === "legendary" ? ["epic", "rare", "common"] :
        rarity === "epic" ? ["rare", "common"] :
        rarity === "rare" ? ["common"] : []
      ) as ("common" | "rare" | "epic")[];
      for (const downR of downgradeOrder) {
        const downPool = pools[downR].slice();
        for (const c of downPool) {
          if (added >= need) break;
          if (tryAdd(c, 2)) added++;
        }
        if (added >= need) break;
      }
    }
  }
  return out;
}

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
  // Alex feedback 2026-06-09 : "Précision en boucle infinie" — cause = le
  // deck contenait plusieurs copies de la même carte (saved + FILLER non
  // dédupliqués). Avec MAX_COPIES = 2, une carte ne peut être tirée que
  // 2 fois par run (avec reshuffle après discard), pas en boucle infinie.
  const DECK_SIZE = 12;
  const MAX_COPIES = 2;
  const counts = new Map<CardId, number>();
  const out: CardId[] = [];
  const tryPush = (c: CardId): void => {
    if (out.length >= DECK_SIZE) return;
    const cur = counts.get(c) ?? 0;
    if (cur >= MAX_COPIES) return;
    out.push(c);
    counts.set(c, cur + 1);
  };
  // Pass 1 : the saved Ranked deck (1 copy each at most).
  const base = (saved ?? []).filter(arenaSupported);
  for (const c of base) tryPush(c);
  // Force-include direct damage so the player can push lethal even when
  // all lanes are creature-blocked.
  tryPush("heist");
  tryPush("supernova");
  // Pass 2 : top up with FILLER (1 copy each).
  for (const f of FILLER) tryPush(f);
  // Pass 3 : if still under size, allow 2nd copies of FILLER.
  for (const f of FILLER) {
    if (out.length >= DECK_SIZE) break;
    tryPush(f);
  }
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
