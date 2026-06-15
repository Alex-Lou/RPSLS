import { alog } from "../arenaLog";
import { CAST_ON_DRAW_IDS, isCastOnDraw, resolveCastOnDraw } from "../arenaCastOnDraw";
import {
  HAND_CAP,
  HERO_MAX_HP,
  STARTING_HAND_SIZE,
  type BoardState,
  type CastOnDrawEvent,
  type HeroState,
  type LaneState,
} from "../arenaTypes";
import { CARDS } from "../../ranked/cards";
import type { CardId } from "../../ranked/rankedTypes";
import type { Move } from "../../engine/game";

/* ───────────────────────── Board init ───────────────────────── */

/** Build a fresh hero from a deck (shuffled at match start). The deck is
 *  the 8 cards equipped in the player's saved deck; passives equipped in
 *  Ranked are IGNORED in Arena — they don't exist as concept here.
 *  `affinity` is the Constellation Pro v2 Voie picked by this player. */
export function makeHero(deckIds: CardId[], affinity?: Move, cpuPersona?: import("../arenaTypes").CpuPersona): HeroState {
  const cleaned = deckIds.filter(
    (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
  );
  const shuffled = shuffle(cleaned);
  // Main de départ ANTI-DOUBLON (Alex 2026-06-13) : on tire en évitant les
  // doublons → fini les « 2 Ancres » à l'ouverture / au mulligan.
  let pool = shuffled.slice();
  const startingHand: CardId[] = [];
  for (let k = 0; k < STARTING_HAND_SIZE; k++) {
    // ⚡ Exclut les cartes « à la pioche » de la MAIN DE DÉPART (elles ne
    // s'activent qu'EN JEU via drawCards, jamais à l'ouverture).
    const res = drawOneAvoidingHand([...startingHand, ...CAST_ON_DRAW_IDS], pool, []);
    if (!res) break;
    pool = res.deck;
    startingHand.push(res.card);
  }
  const remaining = pool;
  return {
    hp: HERO_MAX_HP,
    maxHp: HERO_MAX_HP,
    mana: 1,
    maxMana: 1,
    hand: startingHand,
    deck: remaining,
    discard: [],
    exiled: [],
    divineShield: false,
    affinity,
    constellationCount: 0,
    cpuPersona,
  };
}

/** Mulligan T1 (Alex 2026-06-13 économie expert) : remet les cartes choisies
 *  dans le deck, shuffle, repioche autant. Une seule fois par match (géré
 *  côté UI). Les indices invalides sont ignorés. */
export function mulliganSwap(hero: HeroState, handIndices: number[]): HeroState {
  const idx = [...new Set(handIndices)].filter((i) => i >= 0 && i < hero.hand.length);
  if (idx.length === 0) return hero;
  const kept = hero.hand.filter((_, i) => !idx.includes(i));
  const returned = idx.map((i) => hero.hand[i]);
  // Redraw ANTI-DOUBLON (Alex 2026-06-13) : on évite les doublons de la main
  // gardée, les cartes rejetées (ne pas les re-servir) et les déjà-repiochées.
  let deck = shuffle([...hero.deck, ...returned]);
  let discard = hero.discard.slice();
  const redrawn: CardId[] = [];
  for (let k = 0; k < idx.length; k++) {
    const res = drawOneAvoidingHand([...kept, ...returned, ...redrawn, ...CAST_ON_DRAW_IDS], deck, discard);
    if (!res) break;
    deck = res.deck;
    discard = res.discard;
    redrawn.push(res.card);
  }
  alog("hand", `mulligan : ${returned.join(",")} remplacées par ${redrawn.join(",")}`);
  return { ...hero, hand: [...kept, ...redrawn], deck, discard };
}

/** Mulligan IMMÉDIAT, EN PLACE (Alex 2026-06-13) : rejette la carte à l'index
 *  `i` et tire UNE remplaçante qui prend EXACTEMENT le même emplacement (pas de
 *  décalage → le joueur VOIT clairement la nouvelle carte arriver). La rejetée
 *  est remélangée dans le deck. Taille de main préservée. */
export function mulliganReplaceInPlace(hero: HeroState, i: number): HeroState {
  if (i < 0 || i >= hero.hand.length) return hero;
  const rejected = hero.hand[i];
  const handWithout = [...hero.hand.slice(0, i), ...hero.hand.slice(i + 1)];
  // La rejetée retourne au deck (remélangée). On tire en évitant les doublons
  // du RESTE de la main ET la rejetée elle-même (ne pas re-servir ce qu'on vient
  // de jeter). Anti-doublon Alex 2026-06-13.
  const deck = shuffle([...hero.deck, rejected]);
  const res = drawOneAvoidingHand([...handWithout, rejected, ...CAST_ON_DRAW_IDS], deck, hero.discard);
  if (!res) return hero;
  const newHand = [...hero.hand.slice(0, i), res.card, ...hero.hand.slice(i + 1)];
  alog("hand", `mulligan en place : ${rejected} → ${res.card}`);
  return { ...hero, hand: newHand, deck: res.deck, discard: res.discard };
}

export function makeInitialBoard(
  deckA: CardId[],
  deckB: CardId[],
  affinityA?: Move,
  affinityB?: Move,
  cpuPersonaB?: import("../arenaTypes").CpuPersona,
): BoardState {
  return {
    a: makeHero(deckA, affinityA),
    b: makeHero(deckB, affinityB, cpuPersonaB),
    lanes: [makeEmptyLane(), makeEmptyLane(), makeEmptyLane()],
    turn: 1,
    phase: "planning",
    augurRevealedA: [],
    augurRevealedB: [],
    forgeA: null,
    forgeB: null,
  };
}

function makeEmptyLane(): LaneState { return { a: null, b: null }; }

function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ───────────────────────── Draw / hand ───────────────────────── */

// HAND_RARITY_CAP (cap 3/2/1/1 par rareté) RETIRÉ (Alex 2026-06-13) : remplacé
// par la règle ANTI-DOUBLON stricte (max 1 copie en main) dans drawCards.

/** Pioche UNE carte du deck en ÉVITANT les doublons de `avoid` (typiquement
 *  la main) — RÈGLE ANTI-DOUBLON (Alex 2026-06-13) : « tant qu'une carte est en
 *  main, on ne peut pas la repiocher ; si elle n'y est plus, la pioche aléatoire
 *  PEUT la ramener ». Reshuffle la défausse au besoin. FILET ANTI-TOUR-MORT : si
 *  TOUT le pool (deck+défausse) est en doublon de `avoid`, on pioche quand même
 *  (sinon pioche vide = pire). Retourne null seulement si plus AUCUNE carte.
 *
 *  L'exception « Larcin / pioche au hasard chez l'adversaire » (et Écho) n'est
 *  PAS concernée : ces effets ajoutent à la main SANS passer par ici. */
export function drawOneAvoidingHand(
  avoid: readonly CardId[], deck: readonly CardId[], discard: readonly CardId[],
): { card: CardId; deck: CardId[]; discard: CardId[] } | null {
  let d = deck.slice();
  let disc = discard.slice();
  // ⚖️ Légendaires NE RECYCLENT PAS (Alex 2026-06-13 « 4 légendaires en repioche,
  // wtf ») : à chaque RESHUFFLE de la défausse on les DROPPE → une légendaire VUE
  // ne revient jamais en pioche. En plus de l'exil au CAST, ça sort aussi du
  // cycle une légendaire défaussée SANS être jouée (Juge/Cascade) — fini le flood.
  const noLegend = (pool: CardId[]) => pool.filter((c) => CARDS[c]?.rarity !== "legendary");
  if (d.length === 0) {
    const pool = noLegend(disc);
    if (pool.length === 0) return null;
    d = shuffle(pool); disc = [];
  }
  // Préfère une carte PAS déjà dans `avoid`.
  let idx = d.findIndex((c) => !avoid.includes(c));
  if (idx < 0 && disc.length > 0) {
    // Rien de neuf dans le deck → injecte la défausse mélangée (sans légendaires).
    d = d.concat(shuffle(noLegend(disc))); disc = [];
    idx = d.findIndex((c) => !avoid.includes(c));
  }
  if (idx < 0) idx = 0; // tout le pool est doublon → filet : pioche la tête
  const [card] = d.splice(idx, 1);
  return { card, deck: d, discard: disc };
}

/** Pull `n` cards from the deck → hand (reshuffles discard into deck if the
 *  deck runs dry mid-draw). Returns the new HeroState. Cap at HAND_CAP — extra
 *  cards sont "burned" (lost to the void — classic overdraw rule).
 *
 *  RÈGLE ANTI-DOUBLON (Alex 2026-06-13) : on ne pioche jamais une carte DÉJÀ en
 *  main tant qu'elle y est (remplace l'ancien cap par rareté 3/2/1/1, plus
 *  permissif). Évite le flood de doublons / passifs. Cf. drawOneAvoidingHand. */
export function drawCards(hero: HeroState, n: number): HeroState {
  let hand = hero.hand.slice();
  let deck = hero.deck.slice();
  let discard = hero.discard.slice();
  let h = hero; // porte les mutations PV/mana des cartes « à la pioche »
  const castEvents: CastOnDrawEvent[] = [];
  let toDraw = n;
  let guard = 0; // filet anti-boucle (deck 100% à-la-pioche / pioches en chaîne)
  while (toDraw > 0 && guard < 64) {
    guard++;
    toDraw--;
    const res = drawOneAvoidingHand(hand, deck, discard);
    if (!res) break; // plus aucune carte (deck + défausse vides)
    deck = res.deck;
    discard = res.discard;
    // ⚡ Carte « À LA PIOCHE » (Cast When Drawn, Alex 2026-06-13) : ne va PAS en
    // main — elle résout son effet IMMÉDIATEMENT au tirage. Peut piocher plus
    // (extraDraws) → la boucle enchaîne naturellement (toDraw +=).
    if (isCastOnDraw(res.card)) {
      const fired = resolveCastOnDraw({ ...h, hand, deck, discard }, res.card);
      if (fired) {
        h = fired.hero;
        hand = fired.hero.hand;       // un effet « défausse » peut modifier la main
        deck = fired.hero.deck;
        discard = fired.hero.discard;
        castEvents.push(fired.event);
        toDraw += fired.extraDraws;
      }
      continue;
    }
    // Cap de main = HAND_CAP (7). Au-delà → burn (overdraw assumé).
    if (hand.length < HAND_CAP) hand.push(res.card);
  }
  return { ...h, hand, deck, discard, castOnDrawEvents: castEvents };
}
