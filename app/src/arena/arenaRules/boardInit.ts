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

/** Pioche UNE carte du deck en ÉVITANT les doublons de `avoid` (typiquement la
 *  main) — ANTI-DOUBLON STRICT (Alex 2026-06-17 « jamais 2 fois la même carte en
 *  main ») : on ne pioche QUE si une carte non encore en main existe dans le
 *  deck ; sinon on retourne null (on ne ramène JAMAIS un doublon). Le deck NE
 *  recycle PLUS la défausse (deck fini). Retourne null si le deck est vide OU si
 *  tout le deck restant est en doublon de `avoid`.
 *
 *  L'exception « Larcin / pioche au hasard chez l'adversaire » (et Écho) n'est
 *  PAS concernée : ces effets ajoutent à la main SANS passer par ici. */
export function drawOneAvoidingHand(
  avoid: readonly CardId[], deck: readonly CardId[], discard: readonly CardId[],
  softAvoid: readonly CardId[] = [],
): { card: CardId; deck: CardId[]; discard: CardId[] } | null {
  const d = deck.slice();
  const disc = discard.slice();
  // 🔒 DECK FINI (Alex 2026-06-17) : la défausse NE RECYCLE PLUS dans le deck.
  // Une carte jouée ne REVIENT jamais (fini le « retour des mêmes cartes
  // triches ») et le deck s'ÉPUISE → vraie gestion de ressources + les parties
  // finissent (on manque de cartes → il faut conclure). Le deck est mélangé UNE
  // fois à l'init (makeHero → shuffle) donc l'ordre de pioche reste aléatoire et
  // équitable sur tout le deck. Deck vide → null : main+deck vides = tu joues
  // quand même en RPSLS/invocations (les moves ne coûtent pas de carte). Les
  // effets qui RAJOUTENT en main (Écho, Larcin) passent hors d'ici, intacts.
  if (d.length === 0) return null;
  // Anti-récurrence à 2 niveaux (Alex 2026-06-17) :
  //  • DUR (`avoid` = la main) : JAMAIS 2 fois la même carte en main. Inviolable.
  //  • DOUX (`softAvoid` = cartes jouées récemment) : on évite de repiocher une
  //    carte (ou une autre de ses copies) jouée il y a peu (« aegis revient juste
  //    après le tour où je l'ai utilisé ») — MAIS seulement SI une autre carte
  //    existe. Sinon on autorise une carte récente plutôt que de ne rien piocher
  //    (pas de famine de pioche). Le doublon EN MAIN reste, lui, impossible.
  let idx = d.findIndex((c) => !avoid.includes(c) && !softAvoid.includes(c));
  if (idx < 0) idx = d.findIndex((c) => !avoid.includes(c)); // fallback : récent toléré
  if (idx < 0) return null; // tout le deck est en main → rien (jamais de doublon main)
  const [card] = d.splice(idx, 1);
  return { card, deck: d, discard: disc };
}

/** Pull `n` cards from the deck → hand. Returns the new HeroState. Cap at
 *  HAND_CAP — extra cards sont "burned" (lost to the void — classic overdraw).
 *  DECK FINI (Alex 2026-06-17) : la défausse ne recycle PLUS (cf.
 *  drawOneAvoidingHand) — si le deck s'épuise en cours de pioche, on s'arrête
 *  (break sur null) ; une carte jouée ne revient jamais.
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
  // ANTI-RÉCURRENCE (Alex 2026-06-17 « aegis revient juste après le tour où je
  // l'ai utilisé ») : les cartes JOUÉES récemment sont en queue de défausse
  // (cf. arenaResolvePrep). On évite de repiocher une de leurs copies pendant ce
  // tour (softAvoid) → une carte ne réapparaît pas juste après son usage. Fenêtre
  // courte = ~les 4 derniers jeux. C'est DOUX : si rien d'autre n'est piochable,
  // on autorise quand même (pas de famine), mais jamais un doublon en main.
  const RECENT_PLAY_WINDOW = 4;
  const recentlyPlayed = hero.discard.slice(-RECENT_PLAY_WINDOW);
  while (toDraw > 0 && guard < 64) {
    guard++;
    toDraw--;
    const res = drawOneAvoidingHand(hand, deck, discard, recentlyPlayed);
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
