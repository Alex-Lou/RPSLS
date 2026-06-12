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
import { cpuCanPlay } from "./arenaAI";
import { isFinisherCard } from "./arenaFinishers";
import { CARDS } from "../ranked/cards";
import type { TurnIntent } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

/** True si la carte peut être placée dans un deck (player ou CPU).
 *  Les Finishers Constellation Pro sont injectés UNIQUEMENT à 3⭐ via
 *  arenaRules.applySummons — pas drawables, pas draftables. */
export function isDeckable(id: CardId): boolean {
  return arenaSupported(id) && !isFinisherCard(id);
}

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
  // Pool de cartes Arena-supported par rareté — restreint aux cartes que le
  // cerveau CPU sait jouer (cpuCanPlay) : une carte que buildSpellTarget ne
  // cible jamais serait une carte MORTE dans la main du CPU.
  const pools: Record<string, CardId[]> = { common: [], rare: [], epic: [], legendary: [] };
  for (const id of Object.keys(CARDS) as CardId[]) {
    if (!isDeckable(id) || !cpuCanPlay(id)) continue;
    const card = CARDS[id];
    pools[card.rarity].push(id);
  }
  // Pour chaque rareté du joueur, pige N cartes (doublon autorisé jusqu'à 2).
  // Cartes plafonnées à 1 copie : cf. SINGLE_COPY_CARDS (parité player/CPU).
  // oracle (pioche 3) + heist (vol) ajoutés (Alex 2026-06-12 "reviennent trop
  // souvent, un peu cheaté") : 2 copies dans un deck de 14 + reshuffle = récurrence
  // trop forte de ces 2 cartes à fort impact.
  const SINGLE_COPY_CARDS = new Set<CardId>(["supernova", "oracle", "heist"]);
  const out: CardId[] = [];
  const inOut = new Map<CardId, number>();
  const tryAdd = (id: CardId, max: number): boolean => {
    const cur = inOut.get(id) ?? 0;
    const cap = SINGLE_COPY_CARDS.has(id) ? Math.min(max, 1) : max;
    if (cur >= cap) return false;
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
  // REFONTE Alex 2026-06-12 "j'ai des cartes que je n'ai PAS DU TOUT choisies
  // (grave erreur)". Avant : on bourrait jusqu'à 14 avec un gros FILLER +
  // force heist/supernova/augur → ~6 cartes parasites non choisies. Désormais
  // le deck RESPECTE les choix du joueur :
  //   1) deck = SES cartes (Arena-supportées) de son deck Ranked.
  //   2) on garantit UNE SEULE carte de "portée" (reach) s'il n'en a aucune —
  //      sinon impossible d'entamer le héros adverse quand le board est plein
  //      ("opp ne perd jamais de PV").
  //   3) filler MINIMAL seulement si le deck filtré est sous le plancher
  //      jouable (joueur sans deck Arena, ou cartes non adaptées). Un vrai
  //      deck Arena ne montre QUE ses choix.
  const MIN_PLAYABLE = 8; // plancher anti-pénurie (≈ taille d'un deck Ranked)
  const MAX_COPIES = 2;
  // oracle/heist/supernova à 1 copie (récurrence + lethal — cf. Alex 2026-06-12).
  const SINGLE_COPY_CARDS = new Set<CardId>(["supernova", "oracle", "heist"]);
  // Cartes capables d'entamer le HÉROS adverse même board plein.
  const REACH_CARDS = new Set<CardId>(["supernova", "heist"]);
  const counts = new Map<CardId, number>();
  const out: CardId[] = [];
  const tryPush = (c: CardId): boolean => {
    const cur = counts.get(c) ?? 0;
    const cap = SINGLE_COPY_CARDS.has(c) ? 1 : MAX_COPIES;
    if (cur >= cap) return false;
    out.push(c);
    counts.set(c, cur + 1);
    return true;
  };
  // 1) Les CHOIX du joueur (cartes Arena-supportées de son deck).
  const chosen = (saved ?? []).filter(isDeckable);
  for (const c of chosen) tryPush(c);
  // 2) Filet de portée : 1 carte reach garantie SEULEMENT si aucune présente.
  if (!out.some((c) => REACH_CARDS.has(c))) tryPush("supernova");
  // 3) Plancher : filler minimal uniquement si le deck est trop maigre.
  const FILLER: CardId[] = ["aegis", "precision", "second-wind", "surge", "augur", "anchor", "tide", "curse", "mirror"];
  for (const f of FILLER) {
    if (out.length >= MIN_PLAYABLE) break;
    tryPush(f);
  }
  return out;
}

/** Strip cards the side committed (spells) from their hand BEFORE the
 *  resolver runs. Summons are RPSLS moves, not cards in hand — they
 *  don't need to be removed.
 *
 *  Alex feedback 2026-06-09 round 7 : log explicite des cartes consommées
 *  pour debug "carte ne se retire pas de la main" — chaque cast doit
 *  consommer 1 copie. Si l'intent contient N copies du même id, removeSpent
 *  doit consommer N copies différentes. */
export function removeSpentCards(hand: CardId[], intent: TurnIntent): CardId[] {
  return removeSpentCardsDetailed(hand, intent).hand;
}

/** Variante qui retourne AUSSI les cartes réellement consommées (Alex
 *  2026-06-11) — utilisé pour les recycler vers la défausse (la pioche
 *  reshuffle la défausse quand le deck est vide → le deck cycle, plus de
 *  "à court de cartes"). */
export function removeSpentCardsDetailed(hand: CardId[], intent: TurnIntent): { hand: CardId[]; spent: CardId[] } {
  let out = hand.slice();
  const consumed: CardId[] = [];
  const spent: CardId[] = [];
  for (const s of intent.spells) {
    const i = out.indexOf(s.id);
    if (i >= 0) {
      out = [...out.slice(0, i), ...out.slice(i + 1)];
      consumed.push(s.id);
      spent.push(s.id);
    } else {
      consumed.push(`MISSING:${s.id}` as CardId);
    }
  }
  if (consumed.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[arena:hand] consumed cards=[${consumed.join(",")}] hand was=${hand.length} now=${out.length}`);
  }
  return { hand: out, spent };
}
