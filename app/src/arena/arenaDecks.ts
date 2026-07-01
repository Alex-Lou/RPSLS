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
import { SIGNATURE_DECK } from "./arenaVoies";
import type { TurnIntent } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";

/** Cartes VOLONTAIREMENT exclues du Pro/Arène (Alex 2026-07). Augure révèle la
 *  MAIN adverse : pertinent en Classé (tu peux anticiper la carte qu'il jouera)
 *  mais TROMPEUR en Pro, où les « coups » sont des invocations RPSLS (mana), PAS
 *  des cartes en main → voir sa main ne prédit RIEN. Reste pleinement jouable en
 *  Classé (isDeckable est PUREMENT arène). Point d'exclusion UNIQUE : couvre le
 *  deck joueur, le deck CPU ET l'éditeur (DeckManager) d'un seul coup. */
const ARENA_EXCLUDED = new Set<CardId>(["augur"]);

/** True si la carte peut être placée dans un deck (player ou CPU).
 *  Les Finishers Constellation Pro sont injectés UNIQUEMENT à 3⭐ via
 *  arenaRules.applySummons — pas drawables, pas draftables. */
export function isDeckable(id: CardId): boolean {
  if (ARENA_EXCLUDED.has(id)) return false;
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

/** Deck SIGNATURE du CPU (Alex 2026-06-24 « archétype vs archétype ») : le CPU
 *  joue le MÊME deck signature curé que le joueur pour sa Voie, au lieu d'un pool
 *  de neutres mirroir-rareté qui lui donnait des cartes HORS-THÈME (ex. trou-noir
 *  sur un Tranchant). Filtré aux cartes que l'IA sait jouer (cpuCanPlay) → zéro
 *  carte morte ; étendu en copies-par-rareté + cap légendaires (parité joueur).
 *  Les neutres restants (supernova/heist…) ne lui sont plus auto-injectés : il
 *  pousse via la carte DÉGÂTS signature de sa Voie. */
export function buildCpuSignatureDeck(affinity: Move): CardId[] {
  const SINGLE_COPY_CARDS = new Set<CardId>(["oracle", "heist"]);
  const sig = (SIGNATURE_DECK[affinity] ?? []).filter((c) => isDeckable(c) && cpuCanPlay(c));
  const out: CardId[] = [];
  let legKept = 0;
  for (const c of sig) {
    if (CARDS[c]?.rarity === "legendary") {
      if (legKept >= ARENA_LEGENDARY_CAP) continue; // surplus de légendaires retiré
      legKept += 1;
    }
    const copies = SINGLE_COPY_CARDS.has(c) ? 1 : (RARITY_COPIES[CARDS[c]?.rarity ?? "common"] ?? 1);
    for (let k = 0; k < copies; k++) out.push(c);
  }
  return out;
}

/** Alex feedback équité 2026-06-09 : "le cpu devra avoir autant de cartes
 *  de chaque rang que le joueur" — buildCpuDeckMirroring construit un
 *  deck CPU qui match la distribution de raretés (common/rare/epic/legendary)
 *  du deck joueur, mais avec cartes potentiellement différentes. FALLBACK
 *  désormais : utilisé seulement si la Voie CPU n'a pas de deck signature.
 *
 *  Algo : compte les raretés du playerDeck, pour chaque rareté pige des
 *  cartes Arena-supportées dans la même rareté (random, sans replacement
 *  jusqu'à atteindre le count). Si la pool d'une rareté donnée est plus
 *  petite que le count requis, on accepte les doublons jusqu'à 2 copies.
 *  Si encore insuffisant, on complète avec d'autres raretés (downgrade
 *  préféré pour ne pas exploser la power level). */
export function buildCpuDeckMirroring(playerDeck: CardId[], cpuAffinity?: Move): CardId[] {
  // ARCHÉTYPE vs ARCHÉTYPE (Alex 2026-06-24) : si la Voie CPU a un deck SIGNATURE,
  // le CPU le joue (comme le joueur) plutôt que le pool mirroir-rareté qui mélangeait
  // toutes les neutres (trou-noir, supernova…) hors de son thème. Garde-fou : si la
  // signature donne moins de 6 cartes (ne devrait pas), on retombe sur le mirroir.
  if (cpuAffinity) {
    const sig = buildCpuSignatureDeck(cpuAffinity);
    if (sig.length >= 6) return sig;
  }
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
    // ORIENTÉ VOIE (Phase B) symétrique au joueur : le CPU n'utilise JAMAIS une
    // carte d'une AUTRE Voie que la sienne (les neutres + ses signatures restent).
    if (card.voie && card.voie !== cpuAffinity) continue;
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
    // Signatures de la Voie CPU EN PREMIER (tri stable) → archétype vs archétype.
    pool.sort((a, b) =>
      (cpuAffinity && CARDS[a]?.voie === cpuAffinity ? 0 : 1) - (cpuAffinity && CARDS[b]?.voie === cpuAffinity ? 0 : 1),
    );
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

/** Source du deck Arène pour une Voie (Alex 2026-06-22 « deck signature
 *  MODIFIABLE ») : deck CUSTOM édité par le joueur pour CETTE Voie > deck
 *  SIGNATURE curé par défaut > deck arène libre (legacy/fallback). Partagée par
 *  le build de match (ArenaGame) ET l'éditeur (DeckManager) pour rester cohérent. */
/** Multiset d'ids (ordre indifférent) — détecte un deck custom qui n'est qu'une
 *  COPIE de la signature (un « Sauvegarder » sans édition). */
function sameCards(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

export function resolveArenaDeckSource(
  affinity: Move | undefined,
  byVoie: Partial<Record<Move, string[]>> | undefined,
  fallback: string[] | undefined,
): CardId[] {
  if (affinity) {
    const sig = SIGNATURE_DECK[affinity];
    const custom = byVoie?.[affinity];
    // ROBUSTESSE (Alex 2026-06-23 « le deck ne change pas ») : le custom n'est
    // retenu que s'il DIFFÈRE réellement de la signature. Un « Sauvegarder » sans
    // édition (custom == signature) ne doit PAS figer la signature, sinon un futur
    // rééquilibrage de celle-ci n'atteindrait jamais ce joueur.
    if (custom && custom.length > 0 && !(sig && sameCards(custom, sig))) {
      return custom as CardId[];
    }
    if (sig) return sig;
  }
  return (fallback ?? []) as CardId[];
}

export function buildPlayerDeck(saved: CardId[] | undefined, affinity?: Move): CardId[] {
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
  // DECK PAR VOIE (Alex 2026-06-22) : `saved` est DÉJÀ résolu par l'appelant via
  // resolveArenaDeckSource (deck CUSTOM édité de la Voie > deck SIGNATURE curé >
  // deck libre). buildPlayerDeck se contente d'étendre cette source par rareté.
  const source = saved;
  const chosen = [...new Set((source ?? []).filter(isDeckable))].filter((c) => {
    if (!isLegend(c)) return true;
    if (legKept >= ARENA_LEGENDARY_CAP) return false; // surplus de légendaires retiré
    legKept += 1;
    return true;
  });
  for (const c of chosen) {
    for (let k = 0; k < copiesFor(c); k++) tryPush(c);
  }
  // 2) Filet de portée : 1 carte reach garantie SEULEMENT si aucune présente.
  //    HEIST (épique) au lieu de supernova (Alex 2026-06-17 « je vois supernova
  //    trop facilement ») : on n'IMPOSE plus la légendaire — le joueur peut
  //    toujours CHOISIR supernova dans son deck, mais elle n'est plus auto-
  //    injectée. heist garde la portée (entame le héros board plein) sans flooder.
  if (!out.some((c) => REACH_CARDS.has(c))) {
    tryPush("heist");
  }
  // 3) ANTI-POINT-MORT SEULEMENT (Alex 2026-06-17 « trop de cartes/variétés =
  //    dégueulis sans stratégie, je veux un CHALLENGE ») : on NE gonfle PLUS le
  //    deck. Un deck normal reste COHÉRENT (TES choix, pas un sac de cartes
  //    random) → la rareté/gestion vient de la pioche lente (1/tour), pas d'un
  //    deck géant. On garantit juste un MINIMUM de 6 cartes NON-légendaires si le
  //    deck choisi est trop léger / légendaire-lourd (l'exil des légendaires
  //    assèche le pool sinon), complété par des cartes DISTINCTES variées (jamais
  //    de copie en plus). Le CPU mirror raisonne par RARETÉ → parité préservée.
  const have = new Set<CardId>(out);
  // ORIENTÉ VOIE (Phase B, Alex 2026-06-17) : on EXCLUT toute carte d'une AUTRE
  // Voie et on PRIORISE les SIGNATURES de ta Voie (voie===affinity), puis les
  // neutres → le complément reste COHÉRENT au lieu d'un sac random. Les cartes
  // hors-Voie ne sont JAMAIS auto-injectées (le joueur peut toujours les FORCER
  // dans son deck via le DeckManager — souveraineté). Cf. VOIE-ARCHETYPES.md.
  const padPool = (Object.keys(CARDS) as CardId[]).filter(
    (c) => !have.has(c) && isDeckable(c) && CARDS[c]?.rarity !== "legendary"
      && (CARDS[c]?.voie === undefined || CARDS[c]?.voie === affinity),
  );
  for (let i = padPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [padPool[i], padPool[j]] = [padPool[j], padPool[i]];
  }
  // Signatures de la Voie EN PREMIER (tri stable → ordre aléatoire conservé par groupe).
  padPool.sort((a, b) =>
    (affinity && CARDS[a]?.voie === affinity ? 0 : 1) - (affinity && CARDS[b]?.voie === affinity ? 0 : 1),
  );
  const nonLegendaryCount = () => out.filter((c) => CARDS[c]?.rarity !== "legendary").length;
  for (const f of padPool) {
    if (nonLegendaryCount() >= 6) break;
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
