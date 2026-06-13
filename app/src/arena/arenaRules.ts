/**
 * Constellation Pro — pure rules engine.
 *
 * Everything here is a pure function on BoardState: no React, no refs, no
 * I/O. The resolver below takes a snapshot of the board + both sides'
 * TurnIntent, applies spells → summons → combat → HP check, and returns
 * the new board. UI animates from the diff.
 *
 * Resolver order (per turn, AFTER both sides locked):
 *   1. Spells fire — defensive (Aegis, Anchor, Riposte) before offensive
 *      (Curse, Heist, Supernova). Same-priority both-side spells fire in
 *      parallel (state taken AT THE START of the spell phase).
 *   2. Summons land — new creatures arrive on their lanes; if the lane is
 *      already occupied by an ALLIED creature, the new one REPLACES (old
 *      dies silently, no damage taken).
 *   3. Combat — each lane resolves 1v1 (or attacker→hero if undefended)
 *      simultaneously. Both creatures take damage at the same step; one
 *      can die "to" a corpse and still trigger Riposte.
 *   4. HP check — if either hero ≤ 0, phase becomes "match-end".
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked combat formulas.
 */

import { alog, alogSetTurn, csnap } from "./arenaLog";
import { AFFINITY_TO_FINISHER } from "./arenaFinishers";
import { resolveLaneCombatAt as _rlCombatAt, resolveCombat as _rCombat } from "./arenaCombat";
import {
  CREATURE_STATS,
  HAND_CAP,
  HERO_MAX_HP,
  MANA_CAP,
  MAX_SPELLS_PER_TURN,
  UTILITY_SPELLS_PER_TURN,
  STARTING_HAND_SIZE,
  type ArenaMatchResult,
  type BoardState,
  type CastOnDrawEvent,
  type Creature,
  type HeroState,
  type LaneIndex,
  type LaneState,
  type PlayedSpell,
  type Side,
  type TurnIntent,
} from "./arenaTypes";
import {
  applyArenaSpell,
  spellPriority,
  type ArenaSpellContext,
} from "./arenaCardEffects";
import { CAST_ON_DRAW_IDS, isCastOnDraw, resolveCastOnDraw } from "./arenaCastOnDraw";
import { arenaSpellCost } from "./arenaSpellHelpers";
import { CARDS } from "../ranked/cards";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";

/* ───────────────────────── Board init ───────────────────────── */

/** Build a fresh hero from a deck (shuffled at match start). The deck is
 *  the 8 cards equipped in the player's saved deck; passives equipped in
 *  Ranked are IGNORED in Arena — they don't exist as concept here.
 *  `affinity` is the Constellation Pro v2 Voie picked by this player. */
export function makeHero(deckIds: CardId[], affinity?: Move, cpuPersona?: import("./arenaTypes").CpuPersona): HeroState {
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
  cpuPersonaB?: import("./arenaTypes").CpuPersona,
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

/* ───────────────────────── Hero helpers ───────────────────────── */

/** Apply damage to a hero, honoring Divine Shield (Aegis on hero). Returns
 *  the new HeroState. If shielded, the shield is consumed and HP unchanged. */
export function damageHero(hero: HeroState, dmg: number): HeroState {
  if (dmg <= 0) return hero;
  if (hero.divineShield) return { ...hero, divineShield: false };
  return { ...hero, hp: Math.max(0, hero.hp - dmg) };
}

export function healHero(hero: HeroState, amount: number): HeroState {
  if (amount <= 0) return hero;
  return { ...hero, hp: Math.min(hero.maxHp, hero.hp + amount) };
}

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

/* ───────────────────────── Creature helpers ───────────────────────── */

export function makeCreature(move: Move, side: Side, affinity?: Move): Creature {
  const stats = CREATURE_STATS[move];
  const matchesAffinity = affinity !== undefined && affinity === move;
  // Voie bonuses (Constellation Pro v2 Couche 1) — applied at summon if the
  // creature's move matches the hero's affinity. See ArenaLobby's VOIE_BONUS
  // for the user-facing description.
  //   Pierre  : provocationCharges 2 (au lieu de 1)
  //   Ciseaux : hp +1 (HP 2 au lieu de 1 — survit à un échange)
  //   Spock   : voieAtkBonus +1 (ATK perm 3 au lieu de 2)
  //   Feuille : wiltSkipNext true → Fanaison ralentie (wilt tous les 2 tours)
  //   Lézard  : dodgeCharges 2 (au lieu de 1 — survit à 2 saves Esquive)
  const voieRockCharges = matchesAffinity && move === "rock" ? 2 : (move === "rock" ? 1 : 0);
  const voieScissorsHpBonus = matchesAffinity && move === "scissors" ? 1 : 0;
  const voieAtkBonus = matchesAffinity && move === "spock" ? 1 : 0;
  // Lot B Round 8 : Lézard base 1 charge dodge, Voie Lézard 2 charges.
  const dodgeCharges = move === "lizard" ? (matchesAffinity ? 2 : 1) : 0;
  // Voie Feuille : flag persistent + toggle wiltSkipNext démarre à true.
  // 1er endOfTurnReset SKIP (Feuille reste ATK 3 ce tour), 2e wilt à 1, 3e
  // SKIP, 4e wilt à 2, 5e SKIP, etc. → Fanaison divisée par 2.
  const voieFeuille = matchesAffinity && move === "paper";
  const wiltSkipNext = voieFeuille;
  return {
    move,
    side,
    hp: stats.hp + voieScissorsHpBonus,
    atkBuff: 0,
    divineShield: false,
    anchored: false,
    ripostePrimed: false,
    // Innate RPSLS passives — one per symbol, tied to RPSLS identity.
    taunt:       move === "rock",     // 🛡 Provocation
    stifles:     move === "paper",    // 🌿 Étouffe (UI badge only — actual
                                       //   check uses move === "paper" || "spock")
    pierces:     move === "scissors", // ⚔ Tranchant
    pierceUsed:  false,                // Tranchant : 1 charge (consume au 1er bypass Aegis)
    dodgeCharges,                      // ✨ Esquive (Lézard 1 ou 2 charges)
    spellImmune: move === "spock",    // 🧬 Logique
    summonedThisTurn: true,           // Lente (Pierre 0 ATK) / Lent (Lézard 1)
    wiltedSteps: 0,                    // Fanaison (Feuille: -1/turn ou -1/2 turns Voie)
    voieFeuille,                       // Lot B Round 8 — flag Voie Feuille
    wiltSkipNext,                      // Voie Feuille slow wilt toggle
    combatBlunted: false,              // Émoussé (Ciseaux: -1 after 1st combat)
    provocationCharges: voieRockCharges,
    voieAtkBonus,
  };
}

export function creatureEffectiveAtk(c: Creature): number {
  // Toile Gluante (2026-06-12) : la créature englutée ne peut pas attaquer ce
  // tour → ATK effectif 0 (badge ⚔0). En combat son counter est aussi annulé
  // (cf. arenaCombat) pour qu'elle ne gagne aucune lane.
  if (c.cannotAttack) return 0;
  const base = CREATURE_STATS[c.move].atk + c.atkBuff + c.voieAtkBonus;
  // ── Lente / Lent : the turn a Pierre or Lézard is summoned, its ATK is
  //    suppressed (Pierre → 0, Lézard → 1). All other moves attack normally
  //    the turn they land. Buff stacking still applies (a Surge on Pierre
  //    the turn it's summoned still goes through).
  if (c.summonedThisTurn) {
    if (c.move === "rock")   return Math.max(0, 0 + c.atkBuff + c.voieAtkBonus);
    if (c.move === "lizard") return Math.max(0, 1 + c.atkBuff + c.voieAtkBonus);
  }
  // ── Fanaison : Feuille loses 1 ATK per turn elapsed since summon, floor 1.
  //    So a freshly summoned Paper is 3, next turn 2, then 1, then stays 1.
  if (c.move === "paper" && c.wiltedSteps > 0) {
    return Math.max(1, CREATURE_STATS.paper.atk - c.wiltedSteps + c.atkBuff + c.voieAtkBonus);
  }
  // ── Émoussé : Ciseaux loses 1 ATK permanently after its first combat.
  if (c.combatBlunted) {
    return Math.max(0, base - 1);
  }
  return Math.max(0, base);
}

/** Apply damage to a creature, honoring its defenses in order:
 *   1. Esquive (Lézard dodgeCharges) — intrinsèque, prioritaire sur divineShield.
 *      Consume 1 charge. Voie Lézard = 2 charges initiales.
 *   2. Divine Shield (Aegis spell) — consommé au 1er dégât.
 *  Returns the new creature, or null if it died. */
export function damageCreature(c: Creature, dmg: number): Creature | null {
  if (dmg <= 0) return c;
  if (c.dodgeCharges > 0) return { ...c, dodgeCharges: c.dodgeCharges - 1 };
  if (c.divineShield) return { ...c, divineShield: false };
  const hp = c.hp - dmg;
  if (hp <= 0) return null;
  return { ...c, hp };
}

/** Soigne une créature (Sève). Plafonne à ses PV de base (CREATURE_STATS) MAIS
 *  ne RÉDUIT jamais une créature déjà au-dessus (ex. boostée par Rempart). */
export function healCreature(c: Creature, amount: number): Creature {
  if (amount <= 0) return c;
  const cap = Math.max(c.hp, CREATURE_STATS[c.move].hp);
  return { ...c, hp: Math.min(cap, c.hp + amount) };
}

// bluntOnCombat / damageCreaturePierce → déplacés dans ./arenaCombat.ts
// (refactor 2026-06-09 : arenaRules.ts dépassait 700 lignes).

/** A creature's "per-turn" buffs (atkBuff, anchored, riposte) reset at the
 *  END of the turn so they don't snowball forever. Persistent damage stays.
 *  Innate passives (taunt, stifles, pierces, spellImmune) and consumed
 *  resources (dodgeCharges, combatBlunted) persist across turns.
 *  - divineShield: persists across turns until consumed by damage.
 *  - summonedThisTurn: cleared (the "Lente/Lent" malus only bites turn 1).
 *  - wiltedSteps: incremented for Paper (drives Fanaison).
 *  - wiltSkipNext: Voie Feuille toggle — skip wilt this turn et flip false.
 *  - vergerActive (param) : Finisher VERGER ÉTERNEL du hero propriétaire —
 *    Fanaison OFF en continu (le wilt ne s'incrémente plus du tout). Avant,
 *    le finisher ne faisait qu'un reset one-shot et les Feuilles re-fanaient
 *    dès le tour suivant, contrairement au texte de la carte. */
export function endOfTurnReset(c: Creature, vergerActive = false): Creature {
  // Lot B Round 8 — Voie Feuille slow wilt (Fanaison ÷ 2) :
  //   voieFeuille=true + wiltSkipNext=true  → SKIP wilt ce tour, flip à false
  //   voieFeuille=true + wiltSkipNext=false → wilt + flip à true (skip prochain)
  //   voieFeuille=false (Feuille normale)   → wilt chaque tour, no toggle
  let wilted = c.wiltedSteps;
  let nextSkip = c.wiltSkipNext;
  if (c.move === "paper" && !vergerActive) {
    if (c.voieFeuille) {
      if (c.wiltSkipNext) {
        // Skip ce tour, prochain tour wilt.
        nextSkip = false;
      } else {
        // Wilt ce tour, prochain tour skip.
        wilted = c.wiltedSteps + 1;
        nextSkip = true;
      }
    } else {
      // Feuille normale (hors Voie) : wilt chaque tour.
      wilted = c.wiltedSteps + 1;
    }
  }
  return {
    ...c,
    atkBuff: 0,
    anchored: false,
    ripostePrimed: false,
    cannotAttack: false, // Toile Gluante expire en fin de tour
    summonedThisTurn: false,
    wiltedSteps: wilted,
    wiltSkipNext: nextSkip,
  };
}

/* ───────────────────────── Resolver ───────────────────────── */

/** Top-level turn resolver. Called when both sides have locked their intents.
 *  Returns the post-resolution board. The caller renders the diff with
 *  animations (combat hits, deaths, hero damage).
 *
 *  NOTE : le chemin LIVE de l'app est runResolverFlow (arenaResolverFlow.ts)
 *  qui séquence ces mêmes étapes avec les timings d'anim + l'égalité parfaite
 *  (sudden-death) + le TURN_HARD_CAP. Cette composition pure reste la
 *  référence unit-testable du pipeline. */
export function resolveTurn(
  board: BoardState,
  intentA: TurnIntent,
  intentB: TurnIntent,
): BoardState {
  let b = board;

  // ─── 1. Spell phase ─── (fairness fix: intercalate sides by priority)
  b = applyAllSpells(b, intentA, intentB);

  // ─── 2. Summon phase ───
  b = applySummons(b, intentA, "a");
  b = applySummons(b, intentB, "b");

  // ─── 3. Combat phase ───
  b = resolveCombat(b);

  // ─── 4. End-of-turn reset (buffs drop, but persistent dmg stays) ───
  b = endOfTurnCleanup(b);

  // ─── 5. HP check ───
  if (b.a.hp <= 0 || b.b.hp <= 0) {
    return { ...b, phase: "match-end" };
  }

  return b;
}

/** Caps de sorts partagés engine/UI/IA : max MAX_SPELLS_PER_TURN sorts
 *  lane-target + 1 sort utility (self/hero/global) par tour. Exporté pour
 *  que l'IA applique EXACTEMENT le même droit de jeu que le joueur (avant
 *  elle se tronquait à 2 sorts TOTAL — désavantage CPU). */
export function truncateIntentByCaps(intent: TurnIntent): TurnIntent {
  let laneCount = 0;
  let utilityCount = 0;
  const kept: PlayedSpell[] = [];
  for (const s of intent.spells) {
    if (s.kind === "lane") {
      if (laneCount >= MAX_SPELLS_PER_TURN) continue;
      laneCount++;
    } else {
      if (utilityCount >= UTILITY_SPELLS_PER_TURN) continue;
      utilityCount++;
    }
    kept.push(s);
  }
  return kept.length === intent.spells.length ? intent : { ...intent, spells: kept };
}

/** Apply BOTH sides' spells, INTERCALATED by priority — fixes the audit
 *  bug #1 where A's offensive spells fired before B's defensive spells
 *  could react. Same priority across sides : tie-break by side a first
 *  (documented bias — alternative is random which breaks reproducibility).
 *  Same priority WITHIN a side : original tap order (intent.spells order). */
export function applyAllSpells(board: BoardState, intentA: TurnIntent, intentB: TurnIntent): BoardState {
  // Alex feedback 2026-06-09 v2 : aligné sur les caps UI (ArenaGame.addSpell)
  // — le filet engine truncate selon les mêmes règles que l'UI (cf.
  // truncateIntentByCaps ci-dessus).
  const safeIntentA = truncateIntentByCaps(intentA);
  const safeIntentB = truncateIntentByCaps(intentB);
  if (safeIntentA !== intentA) {
    alog("spell", `BYPASS BLOCKED a — intent had ${intentA.spells.length} spells (cap lane=${MAX_SPELLS_PER_TURN} + utility=${UTILITY_SPELLS_PER_TURN}), truncated to ${safeIntentA.spells.length}`);
  }
  if (safeIntentB !== intentB) {
    alog("spell", `BYPASS BLOCKED b — intent had ${intentB.spells.length} spells (cap lane=${MAX_SPELLS_PER_TURN} + utility=${UTILITY_SPELLS_PER_TURN}), truncated to ${safeIntentB.spells.length}`);
  }
  const combined: Array<{ spell: PlayedSpell; side: Side; idx: number }> = [
    ...safeIntentA.spells.map((spell, idx) => ({ spell, side: "a" as Side, idx })),
    ...safeIntentB.spells.map((spell, idx) => ({ spell, side: "b" as Side, idx })),
  ];
  combined.sort((x, y) => {
    const pdiff = spellPriority(x.spell.id) - spellPriority(y.spell.id);
    if (pdiff !== 0) return pdiff;
    // Same priority — break by side (a before b), then by original order
    // within the side. Keeps the resolution reproducible and predictable.
    if (x.side !== y.side) return x.side === "a" ? -1 : 1;
    return x.idx - y.idx;
  });
  let b = board;
  for (const { spell, side } of combined) {
    const hero = side === "a" ? b.a : b.b;
    // Finisher : 1×/match en dur côté engine. La carte peut revenir en main
    // via Juge (reshuffle) ou Genèse alors qu'elle a déjà été utilisée
    // (hero.finisherUsed=true). On fizzle silencieusement le cast pour ne
    // pas brûler la carte en mana sans effet (le removeSpentCards en amont
    // l'a déjà retirée de la main, on l'a juste perdue — c'est le prix du
    // contrat "1×/match").
    if (spell.id.startsWith("finisher-") && hero.finisherUsed) {
      alog("spell", `${side} ${spell.id} FIZZLE (déjà utilisé ce match)`);
      continue;
    }
    // Lot D — CALCUL QUANTIQUE : source unique arenaSpellCost (partagée avec
    // l'UI plan/intent et l'IA, sinon le discount n'était dépensable nulle part).
    const effectiveCost = arenaSpellCost(hero, spell.id as CardId);
    if (hero.mana < effectiveCost) continue;
    b = {
      ...b,
      [side]: { ...hero, mana: hero.mana - effectiveCost },
    } as BoardState;
    const ctx: ArenaSpellContext = { board: b, side, spell };
    b = applyArenaSpell(ctx);
    // Réverbération (2026-06-12) : on mémorise le dernier sort NON-réverbération
    // appliqué par CE côté ce tour, pour que Réverbération (priorité plus tardive)
    // puisse le rejouer sur sa cible d'origine.
    if (spell.id !== "reverberation") {
      b = side === "a" ? { ...b, lastSpellAppliedA: spell } : { ...b, lastSpellAppliedB: spell };
    }
  }
  return b;
}

/** Drop new creatures from the side's summons onto their chosen lanes. If
 *  the side already has a creature on a lane, the new one REPLACES (the old
 *  dies silently — design choice so summons can't be wasted but also can't
 *  stack). Costs 1 mana per summon; skipped if mana runs out. Uses the
 *  hero's `affinity` to apply the Voie bonus at makeCreature time. */
export function applySummons(board: BoardState, intent: TurnIntent, side: Side): BoardState {
  let b = board;
  for (const summon of intent.summons) {
    const hero = side === "a" ? b.a : b.b;
    if (hero.mana < 1) {
      alog("summon", `SKIP ${side} ${summon.move} L${summon.lane} (no mana)`);
      break;
    }
    const lanes = b.lanes.slice() as [LaneState, LaneState, LaneState];
    const lane = { ...lanes[summon.lane] };
    const replaced = lane[side];
    lane[side] = makeCreature(summon.move, side, hero.affinity);
    lanes[summon.lane] = lane;
    if (replaced) {
      alog("summon", `${side} pose ${summon.move} L${summon.lane} (REMPLACE ${csnap(replaced)}) affinity=${hero.affinity ?? "∅"}`);
    } else {
      alog("summon", `${side} pose ${summon.move} L${summon.lane} affinity=${hero.affinity ?? "∅"}`);
    }
    // Constellation 3⭐ : on ne PROMET PAS au summon (Alex 2026-06-11 "faux
     // espoir"). L'unlock + l'injection du Finisher se font au settle-time
     // dans endOfTurnCleanup, une fois la créature confirmée vivante après
     // combat. Ici on touche au mana/board seulement.
    b = {
      ...b,
      lanes,
      [side]: { ...hero, mana: hero.mana - 1 },
    } as BoardState;
  }
  return b;
}

/** Lot C v2 — Count les créatures de `side` qui correspondent à son Affinité
 *  ET sont vivantes. Utilisé pour la Constellation 3⭐ SIMULTANÉE (Alex
 *  feedback 2026-06-09) : il faut maintenir 3 Voies en vie en même temps
 *  pour débloquer le Finisher, pas juste poser 3× cumulés. */
export function countAliveAffinity(
  lanes: readonly LaneState[],
  side: Side,
  affinity: Move | undefined,
): number {
  if (!affinity) return 0;
  let count = 0;
  for (const lane of lanes) {
    const c = lane[side];
    if (c && c.move === affinity) count++;
  }
  return count;
}

// resolveLaneCombat / resolveLaneCombatAt / resolveCombat → re-exportés
// depuis ./arenaCombat (refactor 2026-06-09 : arenaRules.ts dépassait 700
// lignes). Imports en haut du fichier, re-exports ici pour préserver le
// contract des callsites qui importent depuis "./arenaRules".
const resolveCombat = _rCombat;
export const resolveLaneCombatAt = _rlCombatAt;
export { resolveCombat };

export function endOfTurnCleanup(board: BoardState): BoardState {
  const lanes = board.lanes.map((lane) => ({
    a: lane.a ? endOfTurnReset(lane.a, board.a.vergerActive) : null,
    b: lane.b ? endOfTurnReset(lane.b, board.b.vergerActive) : null,
  })) as [LaneState, LaneState, LaneState];
  // 🔥 PHÉNIX (2026-06-12) : ressuscite à 1 PV les créatures snapshotées au
  // cast (applyPhenix) qui sont mortes ce tour — lane désormais vide. Si la
  // lane a été reprise par une autre créature (survivante / nouveau summon),
  // pas de résurrection (on n'écrase rien).
  const revive = (snap: { lane: LaneIndex; move: Move }[] | undefined, side: Side): void => {
    if (!snap || snap.length === 0) return;
    const aff = side === "a" ? board.a.affinity : board.b.affinity;
    for (const { lane, move } of snap) {
      const cur = side === "a" ? lanes[lane].a : lanes[lane].b;
      if (!cur) {
        const reborn: Creature = { ...makeCreature(move, side, aff), hp: 1, summonedThisTurn: false };
        lanes[lane] = side === "a" ? { ...lanes[lane], a: reborn } : { ...lanes[lane], b: reborn };
        alog("turn", `${side} 🔥 PHÉNIX → ${move} renaît à 1 PV (L${lane})`);
      }
    }
  };
  revive(board.phenixReviveA, "a");
  revive(board.phenixReviveB, "b");
  // Constellation 3⭐ SIMULTANÉE — resynchronise le compteur sur les Voies
  // VIVANTES post-combat (une mort décompte, cf. design "simultané" Alex) et
  // couvre les arrivées hors-summon (Mirror copie une créature d'Affinité :
  // avant, la 3e étoile via Mirror ne débloquait le Finisher qu'au summon
  // suivant). L'unlock + l'injection restent 1×/match (guard finisherUnlocked).
  const refreshConstellation = (hero: HeroState, side: Side): HeroState => {
    const alive = countAliveAffinity(lanes, side, hero.affinity);
    const unlocked = alive >= 3 && !hero.finisherUnlocked;
    if (alive === hero.constellationCount && !unlocked) return hero;
    let hand = hero.hand;
    if (unlocked && hero.affinity) {
      const finisherId = AFFINITY_TO_FINISHER[hero.affinity];
      hand = [...hero.hand, finisherId];
      alog("turn", `${side} constellation ⭐ ${alive}/3 (post-combat) → FINISHER UNLOCKED — [${finisherId}] injecté en main`);
    }
    return {
      ...hero,
      constellationCount: alive,
      finisherUnlocked: hero.finisherUnlocked || unlocked,
      hand,
    };
  };
  return {
    ...board,
    lanes,
    a: refreshConstellation(board.a, "a"),
    b: refreshConstellation(board.b, "b"),
    phenixReviveA: undefined, // snapshot Phénix consommé
    phenixReviveB: undefined,
  };
}

/* ───────────────────────── Turn lifecycle ───────────────────────── */

/** Advance the board to the next planning turn: mana ↑ by 1 (cap MANA_CAP),
 *  mana refreshes to maxMana, each hero draws 1 card. Clears any per-turn
 *  reveal state (Augur, etc.). */
export function advanceToNextTurn(board: BoardState): BoardState {
  const nextTurn = board.turn + 1;
  alogSetTurn(nextTurn);
  alog("turn", `=== Tour ${nextTurn} === a.hp=${board.a.hp} b.hp=${board.b.hp}`);
  // Snapshot du board pour suivi externe (Alex flag : "tu dois avoir des
  // logs qui disent ce que je vois au front"). Format compact :
  // L0 a:rock(1/3,⚔1,🛡1) b:rock(3/3,⚔0L,🛡1)
  // L1 a:∅ b:scissors(1/1,⚔4)
  // L2 a:paper(1/3,⚔3F) b:∅
  for (let i = 0; i < 3; i++) {
    const la = board.lanes[i].a;
    const lb = board.lanes[i].b;
    const fmt = (c: typeof la): string => {
      if (!c) return "∅";
      const stats = CREATURE_STATS[c.move];
      const atk = creatureEffectiveAtk(c);
      const flags: string[] = [];
      if (c.divineShield) flags.push("🛡");
      if (c.dodgeCharges > 0) flags.push(c.dodgeCharges > 1 ? `✨${c.dodgeCharges}` : "✨");
      if (c.taunt && c.provocationCharges > 0) flags.push(`P${c.provocationCharges}`);
      if (c.summonedThisTurn && (c.move === "rock" || c.move === "lizard")) flags.push("L");
      if (c.move === "paper" && c.wiltedSteps > 0) flags.push(`F${c.wiltedSteps}`);
      if (c.combatBlunted) flags.push("É");
      return `${c.move}(${c.hp}/${stats.hp},⚔${atk}${flags.length ? "," + flags.join("") : ""})`;
    };
    alog("state", `L${i} a:${fmt(la)} b:${fmt(lb)}`);
  }
  // Cartes dispos (Alex feedback : "ajouter les cartes de chacun dans les
  // logs pour voir ce que chacun aurait pu/du jouer"). Mains complètes
  // listées avec mana + flags (kill bonus pending, aegis lock).
  alog("hand", `a hand=[${board.a.hand.join(",")}] deck=${board.a.deck.length} discard=${board.a.discard.length} mana=${board.a.mana}/${board.a.maxMana}${board.a.killBonusPending ? " +K" : ""}`);
  alog("hand", `b hand=[${board.b.hand.join(",")}] deck=${board.b.deck.length} discard=${board.b.discard.length} mana=${board.b.mana}/${board.b.maxMana}${board.b.killBonusPending ? " +K" : ""}`);
  // Alex feedback 2026-06-09 D : "récompenser l'agression" → si tu as
  // tué une créature opp ce tour, tu pioches +1 carte bonus au tour
  // suivant. killBonusPending reset après la pioche bonus.
  const drawA = 2 + (board.a.killBonusPending ? 1 : 0);
  const drawB = 2 + (board.b.killBonusPending ? 1 : 0);
  // Lot D-bis Round 10 — hooks runtime Finishers persistants :
  // VERGER : si vergerActive, hero heal +1/tour (cumulé tant que actif)
  // MÉTAMORPHOSE : si metamorphoseActive, tous mes Lézard refill dodgeCharges
  // Note : LAME est traité in-combat (cf arenaCombat), pas ici.
  let lanesAfterFinishers = board.lanes;
  if (board.a.metamorphoseActive) {
    lanesAfterFinishers = lanesAfterFinishers.map((l) => ({
      ...l,
      a: l.a && l.a.move === "lizard" ? { ...l.a, dodgeCharges: Math.max(l.a.dodgeCharges, 1) } : l.a,
    })) as [LaneState, LaneState, LaneState];
    alog("turn", `a MÉTAMORPHOSE → Lézard dodge refresh`);
  }
  if (board.b.metamorphoseActive) {
    lanesAfterFinishers = lanesAfterFinishers.map((l) => ({
      ...l,
      b: l.b && l.b.move === "lizard" ? { ...l.b, dodgeCharges: Math.max(l.b.dodgeCharges, 1) } : l.b,
    })) as [LaneState, LaneState, LaneState];
    alog("turn", `b MÉTAMORPHOSE → Lézard dodge refresh`);
  }
  const heroAVerger = board.a.vergerActive ? { ...board.a, hp: Math.min(board.a.maxHp, board.a.hp + 1) } : board.a;
  const heroBVerger = board.b.vergerActive ? { ...board.b, hp: Math.min(board.b.maxHp, board.b.hp + 1) } : board.b;
  if (board.a.vergerActive) alog("turn", `a VERGER → +1 HP (${board.a.hp} → ${heroAVerger.hp})`);
  if (board.b.vergerActive) alog("turn", `b VERGER → +1 HP (${board.b.hp} → ${heroBVerger.hp})`);
  // Filet de sécurité (Alex 2026-06-11) : si après la pioche normale la main
  // est VIDE, on pioche 1 carte de plus (la pioche reshuffle la défausse,
  // alimentée par les cartes jouées → il y a presque toujours de quoi).
  const drawnA = drawCards(heroAVerger, drawA);
  const safeA = drawnA.hand.length === 0 ? drawCards(drawnA, 1) : drawnA;
  const drawnB = drawCards(heroBVerger, drawB);
  const safeB = drawnB.hand.length === 0 ? drawCards(drawnB, 1) : drawnB;
  const a = refreshHero({ ...safeA, killBonusPending: false });
  const b = refreshHero({ ...safeB, killBonusPending: false });
  // Augur / Oracle Inverse : durée 2 tours (Alex 2026-06-11). Decrement à
  // chaque advance, clear cards quand reach 0.
  const nextATurns = Math.max(0, (board.augurTurnsLeftA ?? 0) - 1);
  const nextBTurns = Math.max(0, (board.augurTurnsLeftB ?? 0) - 1);
  return {
    ...board,
    lanes: lanesAfterFinishers,
    turn: nextTurn,
    phase: "planning",
    a, b,
    augurRevealedA: nextATurns > 0 ? board.augurRevealedA : [],
    augurRevealedB: nextBTurns > 0 ? board.augurRevealedB : [],
    augurTurnsLeftA: nextATurns,
    augurTurnsLeftB: nextBTurns,
    // RESET du side-channel Larcin (Alex 2026-06-12 "Larcin n'a plus d'anim") :
    // l'anim se déclenche sur le CHANGEMENT de lastHeistStolenA/B. Si on ne
    // remet pas à undefined entre les tours, voler 2× la même carte ne change
    // pas la valeur → l'effet React ne re-fire pas → pas d'anim. On nettoie
    // chaque tour pour garantir une transition undefined→carte à chaque vol.
    lastHeistStolenA: undefined,
    lastHeistStolenB: undefined,
    // Réverbération : le "dernier sort" est par-tour → reset à chaque tour.
    lastSpellAppliedA: undefined,
    lastSpellAppliedB: undefined,
  };
}

function refreshHero(hero: HeroState): HeroState {
  const newMaxMana = Math.min(MANA_CAP, hero.maxMana + 1);
  return { ...hero, maxMana: newMaxMana, mana: newMaxMana };
}

/* ───────────────────────── Match result ───────────────────────── */

export function matchResult(board: BoardState): ArenaMatchResult | null {
  if (board.phase !== "match-end") return null;
  const aLost = board.a.hp <= 0;
  const bLost = board.b.hp <= 0;
  const winner: Side | "draw" =
    aLost && bLost ? "draw" :
    aLost ? "b" :
    bLost ? "a" : "draw";
  return {
    winner,
    finalA: board.a,
    finalB: board.b,
    turns: board.turn,
  };
}
