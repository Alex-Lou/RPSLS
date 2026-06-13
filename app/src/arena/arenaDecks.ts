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
import { isCastOnDraw } from "./arenaCastOnDraw";
import { cpuCanPlay } from "./arenaAI";
import { isFinisherCard } from "./arenaFinishers";
import { CARDS } from "../ranked/cards";
import type { TurnIntent } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

/** True si la carte peut être placée dans un deck (player ou CPU).
 *  Les Finishers Constellation Pro sont injectés UNIQUEMENT à 3⭐ via
 *  arenaRules.applySummons — pas drawables, pas draftables. */
export function isDeckable(id: CardId): boolean {
  // Cartes « à la pioche » (Cast When Drawn) : DECKABLES mais PAS des sorts —
  // arenaSupported reste false (→ playCard les bloque comme sorts), donc on les
  // autorise explicitement ici. Cf. arenaCastOnDraw.
  if (isCastOnDraw(id)) return true;
  // kind:"fusion" (Forge 2026-06-13) : créées en partie uniquement — jamais
  // draftables ni deckables.
  return arenaSupported(id) && !isFinisherCard(id) && CARDS[id]?.kind !== "fusion";
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
  // Pour chaque rareté du joueur, pige N cartes. PARITÉ ÉCONOMIE 2026-06-13 :
  // plafonds de copies par rareté identiques au joueur (RARITY_COPIES 3/2/2/1),
  // + overrides 1 copie oracle/heist (récurrence, Alex 2026-06-12).
  const SINGLE_COPY_CARDS = new Set<CardId>(["oracle", "heist"]);
  const out: CardId[] = [];
  const inOut = new Map<CardId, number>();
  const tryAdd = (id: CardId, max: number): boolean => {
    const cur = inOut.get(id) ?? 0;
    const rarityCap = SINGLE_COPY_CARDS.has(id) ? 1 : (RARITY_COPIES[CARDS[id]?.rarity ?? "common"] ?? 1);
    const cap = Math.min(max, rarityCap);
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
    // 3e passe : 3e copie (communes uniquement via rarityCap) si besoin
    for (const c of pool) {
      if (added >= need) break;
      if (tryAdd(c, 3)) added++;
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
/** Copies par RARETÉ (Alex 2026-06-13 économie expert, validée) : standard
 *  CCG — les communes portent la consistance, les légendaires sont des
 *  MOMENTS (1 copie + exil au cast, cf. HeroState.exiled). */
export const RARITY_COPIES: Record<string, number> = {
  common: 3, rare: 2, epic: 2, legendary: 1,
};

/** CAP de cartes LÉGENDAIRES autorisées dans un deck ARENA (Alex 2026-06-13
 *  « pas 4 légendaires en repioche, équité ») — au-delà, le surplus est retiré
 *  au build (buildPlayerDeck, donc le CPU mirror est capé aussi → parité) ET
 *  bloqué dans le DeckManager. Tunable d'un seul chiffre. */
export const ARENA_LEGENDARY_CAP = 2;

export function buildPlayerDeck(saved: CardId[] | undefined): CardId[] {
  // REFONTE Alex 2026-06-12 : le deck RESPECTE les choix du joueur (zéro
  // carte parasite). ÉCONOMIE 2026-06-13 : chaque carte choisie est étendue
  // en N copies selon sa rareté (3/2/2/1) → un deck de 8 choix ≈ 16-20
  // cartes ; la stratégie vit dans le RATIO de raretés choisi.
  // oracle/heist : override 1 copie (récurrence "cheaté", Alex 2026-06-12).
  const SINGLE_COPY_CARDS = new Set<CardId>(["oracle", "heist"]);
  // Cartes capables d'entamer le HÉROS adverse même board plein.
  const REACH_CARDS = new Set<CardId>(["supernova", "heist", "singularite"]);
  const counts = new Map<CardId, number>();
  const out: CardId[] = [];
  const copiesFor = (c: CardId): number =>
    SINGLE_COPY_CARDS.has(c) ? 1 : (RARITY_COPIES[CARDS[c]?.rarity ?? "common"] ?? 1);
  const tryPush = (c: CardId): boolean => {
    const cur = counts.get(c) ?? 0;
    if (cur >= copiesFor(c)) return false;
    out.push(c);
    counts.set(c, cur + 1);
    return true;
  };
  // 1) Les CHOIX du joueur, étendus en copies-par-rareté. CAP LÉGENDAIRES
  //    (Alex 2026-06-13 équité) : on garde au plus ARENA_LEGENDARY_CAP
  //    légendaires (les 1res choisies, ordre deck) ; le surplus est retiré.
  const isLegend = (c: CardId) => CARDS[c]?.rarity === "legendary";
  let legKept = 0;
  const chosen = [...new Set((saved ?? []).filter(isDeckable))].filter((c) => {
    if (!isLegend(c)) return true;
    if (legKept >= ARENA_LEGENDARY_CAP) return false; // surplus de légendaires retiré
    legKept += 1;
    return true;
  });
  for (const c of chosen) {
    for (let k = 0; k < copiesFor(c); k++) tryPush(c);
  }
  // 2) Filet de portée : 1 carte reach garantie SEULEMENT si aucune présente —
  //    supernova (légendaire) si on est SOUS le cap, sinon heist (épique) pour
  //    ne pas dépasser ARENA_LEGENDARY_CAP.
  if (!out.some((c) => REACH_CARDS.has(c))) {
    tryPush(out.filter(isLegend).length < ARENA_LEGENDARY_CAP ? "supernova" : "heist");
  }
  // 3) ANTI-POINT-MORT (Alex : "aucun point mort, coincé") : l'exil des
  //    légendaires retire des cartes du cycle — si le deck choisi est trop
  //    légendaire-lourd, le pool recyclable peut s'assécher. Garantie : au
  //    moins 6 cartes NON-légendaires dans le deck, complétées en communes
  //    neutres si besoin (filler NÉCESSAIRE, donc légitime).
  const FILLER: CardId[] = ["aegis", "precision", "second-wind", "surge", "augur", "anchor", "tide", "curse", "mirror"];
  const nonLegendary = () => out.filter((c) => CARDS[c]?.rarity !== "legendary").length;
  for (const f of FILLER) {
    if (nonLegendary() >= 6) break;
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
