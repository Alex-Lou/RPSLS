/**
 * Constellation Pro — CPU brain.
 *
 * MVP-tier "greedy" AI: it plays its mana on what looks immediately useful
 * without long-term planning. The output is a TurnIntent the resolver can
 * consume directly. Good enough to be a sparring partner; replaced by a
 * proper search-based AI in a later phase.
 *
 * Heuristics, in priority order:
 *   1. Defensive emergencies — if a creature of mine is about to die from
 *      an obvious incoming attack, slap Aegis / Anchor on it.
 *   2. Burst lethal — if the opp hero is at ≤ 6 HP and I have Supernova,
 *      Heist, or a strong open-lane combo, send it.
 *   3. Develop board — empty lanes get summons (prefer the highest-stat
 *      RPSLS counter to whatever the opp has on the opposite lane).
 *   4. Spend remaining mana — buffs/draws/utility, biggest mana cost first
 *      so a 4-cost legendary doesn't sit in hand while we leak small spells.
 *
 * Difficulty (player.difficulty) modulates aggression and randomness:
 *   easy   — passive, no combos, sometimes skips lethal
 *   normal — full greedy
 *   hard   — full greedy + threat awareness (always plays Aegis on the
 *            creature that will be killed by the highest opp ATK)
 */

import { CREATURE_STATS, MANA_CAP, moveCountersMove } from "./arenaTypes";
import type {
  BoardState,
  CpuPersona,
  PlayedSpell,
  Side,
  TurnIntent,
  LaneIndex,
  Creature,
} from "./arenaTypes";
import { arenaSupported, spellPriority } from "./arenaCardEffects";
import { truncateIntentByCaps } from "./arenaRules";
import { arenaSpellCost } from "./arenaSpellHelpers";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";
import type { Difficulty } from "../types";

const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

/** Biais d'IA par persona (Alex 2026-06-11). Chaque persona penche pour un
 *  axe gameplay distinct → matches feel différents selon qui te tombe dessus.
 *  - tactician : counter optimal + bloque la Voie joueur intensément
 *  - aggressor : push lethal asap (sorts damage, peu de défense)
 *  - builder   : focus SA Voie pour build 3⭐ rapidement
 *  - defender  : Aegis/Anchor + Pierre Provoc, prudent */
interface PersonaBias {
  /** % de chance de poser SA Voie sur une lane vide. */
  affinityBuildChance: number;
  /** % de chance de prioriser le counter de la Voie joueur (créature qui
   *  match l'affinity joueur) vs le counter de n'importe quelle créature. */
  blockPlayerVoieChance: number;
  /** Skip chance multiplier (1 = normal, >1 plus passif). */
  spellSkipMult: number;
  /** Si true, le CPU pousse lethal damage agressivement (heist/supernova
   *  cast plus tôt même si player a > 6 HP). */
  prioritizeLethal: boolean;
}

// Bias adoucis (Alex 2026-06-11) : pas de "lecteur parfait", l'IA reste une
// stratégie crédible avec des chances honnêtes — jamais 100%, jamais d'info
// privée. Les valeurs sont volontairement basses pour laisser de la place
// au plan du joueur ; un humain qui joue prudent fait des choix similaires.
const PERSONA_BIAS: Record<CpuPersona, PersonaBias> = {
  tactician: { affinityBuildChance: 0.45, blockPlayerVoieChance: 0.50, spellSkipMult: 1.0, prioritizeLethal: true  },
  aggressor: { affinityBuildChance: 0.30, blockPlayerVoieChance: 0.25, spellSkipMult: 0.8, prioritizeLethal: true  },
  builder:   { affinityBuildChance: 0.60, blockPlayerVoieChance: 0.15, spellSkipMult: 1.2, prioritizeLethal: false },
  defender:  { affinityBuildChance: 0.40, blockPlayerVoieChance: 0.40, spellSkipMult: 1.3, prioritizeLethal: false },
};
const DEFAULT_BIAS: PersonaBias = { affinityBuildChance: 0.45, blockPlayerVoieChance: 0.25, spellSkipMult: 1.0, prioritizeLethal: false };

function biasFor(persona: CpuPersona | undefined): PersonaBias {
  return persona ? PERSONA_BIAS[persona] : DEFAULT_BIAS;
}

/** Cartes que le cerveau CPU sait réellement jouer (cases de buildSpellTarget).
 *  Le deck CPU (buildCpuDeckMirroring) ne pioche QUE dedans : avant, le pool
 *  incluait toutes les cartes Arena-supportées et le CPU piochait des cartes
 *  qu'il ne castait JAMAIS (oracle-inverse, échappée, juge, genèse…) → cartes
 *  mortes en main et tours passifs (asymétrie vs joueur). Ces cartes restent
 *  jouables par le JOUEUR — simplement hors deck CPU tant que l'IA n'a pas
 *  d'heuristique sensée pour elles. */
const CPU_PLAYABLE = new Set<CardId>([
  "aegis", "anchor", "riposte", "precision", "surge", "curse", "supernova",
  "heist", "tide", "prescience", "oracle", "augur", "second-wind", "mirror",
  "vortex",
  "gaia", "sablier", "offre", "rempart", "benediction", "cascade",
  "marchand-ames", "mascarade", "sangsue", "trou-noir", "paradoxe",
  // ── Nouvelles cartes Pro (2026-06-12) — permutation + reverberation
  //    laissées au JOUEUR (ciblage trop spécifique pour l'IA). ──
  "jet-caillou", "seve", "coup-oeil", "toile-gluante", "gravite",
  "doppelganger", "purge", "roue-destin", "phenix", "singularite",
]);
export function cpuCanPlay(id: CardId): boolean {
  return CPU_PLAYABLE.has(id);
}

export function cpuArenaDecision(
  board: BoardState,
  side: Side,
  difficulty: Difficulty,
): TurnIntent {
  const intent: TurnIntent = { spells: [], summons: [] };
  let mana = side === "a" ? board.a.mana : board.b.mana;
  const hero = side === "a" ? board.a : board.b;
  const oppSide: Side = side === "a" ? "b" : "a";
  const oppHeroState = side === "a" ? board.b : board.a;
  const bias = biasFor(hero.cpuPersona);
  // oppHero (the hero we're attacking) is now computed inside the lethal
  // block as `playerHero` — keep this local out so we don't shadow it.

  // Hand of playable spells (filter out cards we haven't adapted to Arena yet).
  const playableHand = hero.hand.filter(arenaSupported);

  // Coût effectif (Finisher CALCUL QUANTIQUE −1m) — même source que l'engine
  // et l'UI, sinon le CPU budgète faux dès que son Finisher Spock est actif.
  const costOf = (id: CardId): number => arenaSpellCost(hero, id);

  // Easy CPU: skip ~40% of optional plays so the player has breathing room.
  // Persona module via spellSkipMult.
  const baseSkip = difficulty === "easy" ? 0.4 : difficulty === "hard" ? 0 : 0.1;
  const skipChance = Math.min(0.6, baseSkip * bias.spellSkipMult);

  /* ─── 1. Defensive emergencies — save a creature about to die ─── */
  if (difficulty !== "easy") {
    for (let i = 0; i < 3; i++) {
      const lane = i as LaneIndex;
      const mine = sideCreature(board, side, lane);
      const opp = sideCreature(board, oppSide, lane);
      if (!mine || !opp) continue;
      // Updated for RPSLS one-shot combat: if opp counters mine in RPSLS,
      // mine dies instantly regardless of HP (unless saved by a shield/dodge).
      // Mirror match → fall back to ATK/HP arithmetic.
      const counterOM = moveCountersMove(opp.move, mine.move);
      const counterMO = moveCountersMove(mine.move, opp.move);
      let wouldDie: boolean;
      if (counterOM && !counterMO) {
        wouldDie = !mine.divineShield && mine.dodgeCharges === 0;
      } else if (counterMO && !counterOM) {
        wouldDie = false;
      } else {
        const incoming = CREATURE_STATS[opp.move].atk + opp.atkBuff;
        wouldDie = mine.hp <= incoming && !mine.divineShield && mine.dodgeCharges === 0;
      }
      if (!wouldDie) continue;
      // Try Aegis first — divine shield absorbs ALL the incoming dmg.
      // Lock 1×/match levé : "1 copie en main = 1 cast" via consume gère seul.
      if (mana >= costOf("aegis") && playableHand.includes("aegis")) {
        intent.spells.push({ id: "aegis", kind: "lane", lane });
        consume(playableHand, "aegis");
        mana -= costOf("aegis");
        continue;
      }
      // Else Anchor (1m) — doesn't help vs combat but at least blocks Curse/etc.
      // Only useful if the opp is likely to debuff. Skip for greedy.
    }
  }

  /* ─── 2. Lethal check — compute the damage WE can dump on the opp hero
   *      this turn and prioritize it if it kills. Includes:
   *      - Existing creatures' undefended ATK (lanes where player has none)
   *      - Supernova on hero (6 dmg, 4 mana)
   *      - Heist (3 dmg, 3 mana)
   *      - Paradoxe (5 dmg both, 3 mana — risky if we're also low)
   *      Adversaire AI is "side", so "us" attacks the hero on `oppSide`. */
  const playerHero = side === "a" ? board.b : board.a; // the hero we're trying to kill
  // Undefended attacks bypass to hero EXCEPT when blocked by Provocation —
  // a live opp Rock anywhere on the board, unless WE have a live Paper
  // (Étouffe) that suppresses that taunt.
  const oppHasTaunt = ([0, 1, 2] as LaneIndex[]).some((i) => {
    const c = sideCreature(board, oppSide, i);
    return !!c && c.taunt;
  });
  const meHasStifle = ([0, 1, 2] as LaneIndex[]).some((i) => {
    const c = sideCreature(board, side, i);
    // Both RPSLS counters of Rock suppress its Provocation board-wide.
    return !!c && (c.move === "paper" || c.move === "spock");
  });
  const tauntBlocksMe = oppHasTaunt && !meHasStifle;
  let lethalDmg = 0;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const myC = sideCreature(board, side, lane);
    const oppC = sideCreature(board, oppSide, lane);
    if (myC && !oppC) {
      if (tauntBlocksMe) continue; // attack deflected, contributes nothing
      lethalDmg += CREATURE_STATS[myC.move].atk + myC.atkBuff;
    }
  }
  const couldLethal = lethalDmg + (playableHand.includes("supernova") && mana >= costOf("supernova") ? 6 : 0)
                                + (playableHand.includes("heist") && mana >= costOf("heist") ? 3 : 0)
                                >= playerHero.hp;

  /* ─── 2b. Burst lethal vs an exposed hero — push spells if lethal is on.
   *      Persona "aggressor"/"tactician" qui prioritizeLethal pousse à 8 HP. */
  const lethalThreshold = bias.prioritizeLethal ? 8 : 6;
  if ((playerHero.hp <= lethalThreshold || couldLethal) && Math.random() >= skipChance) {
    if (mana >= costOf("supernova") && playableHand.includes("supernova")) {
      intent.spells.push({ id: "supernova", kind: "hero" });
      consume(playableHand, "supernova");
      mana -= costOf("supernova");
    }
    if (mana >= costOf("heist") && playableHand.includes("heist")) {
      intent.spells.push({ id: "heist", kind: "self" }); // self because it draws + hits hero
      consume(playableHand, "heist");
      mana -= costOf("heist");
    }
  }

  /* ─── 3. Develop board — summon on empty lanes ─── */
  // Sort lanes by "openness" (empty mine + empty opp first, so we don't trade
  // immediately if we don't have to). On TIES, the lane order is RANDOMIZED
  // so the CPU doesn't always fill 1 → 2 → 3 (Alex's "previsible pattern"
  // complaint): we add a Math.random() jitter before sorting by score.
  const laneOrder: LaneIndex[] = ([0, 1, 2] as LaneIndex[])
    .map((l) => ({ l, jitter: Math.random() }))
    .sort((a, b) => a.jitter - b.jitter)
    .map((x) => x.l);
  laneOrder.sort((l1, l2) => {
    const score = (l: LaneIndex) => {
      const mine = sideCreature(board, side, l);
      const opp = sideCreature(board, oppSide, l);
      if (mine) return 0;
      if (!opp) return 2;
      return 1;
    };
    return score(l2) - score(l1);
  });

  // Summon skip chance — much lower than the spell skip so the CPU
  // RELIABLY develops board, instead of standing still on its mana.
  // Easy keeps a bit of randomness (30%), normal/hard always summon if
  // there's an open lane and mana for it.
  const summonSkip = difficulty === "easy" ? 0.3 : 0;
  // HARD CAP: max 2 summons per turn. Without this, the CPU stacks all 3
  // lanes every turn → player has zero undefended path to reach opp hero
  // (Alex's "opp ne perd jamais de vie" symptom). Leaving one lane open
  // also makes for real tactical games instead of "wall of creatures".
  // Alex feedback (d) 2026-06-09 : "le cpu n'invoque pas le troisième
  // symbole sur la lane qui lui reste, c'est pas vraiment cool pour les
  // test". Cap MAX_SUMMONS_PER_TURN passe de 2 à 3 pour autoriser opp à
  // remplir toutes les lanes vides s'il a la mana. Le "leaving one lane
  // open" tactique n'est plus prioritaire vs visibilité de test (et de
  // toute façon les anti-taunts du joueur cassent souvent les lignes).
  const MAX_SUMMONS_PER_TURN = 3;
  const lanesAvailableForSummon = MAX_SUMMONS_PER_TURN;
  let summonsThisTurn = 0;
  for (const lane of laneOrder) {
    if (mana < 1) break;
    if (summonsThisTurn >= lanesAvailableForSummon) break;
    if (sideCreature(board, side, lane)) continue;
    if (Math.random() < summonSkip) continue;
    const opp = sideCreature(board, oppSide, lane);
    const choice = pickBestMove(opp, hero.affinity, oppHeroState.affinity, bias);
    intent.summons.push({ lane, move: choice });
    mana -= 1;
    summonsThisTurn += 1;
  }
  // Fallback: if for any reason no summon happened and we still have ≥ 1
  // mana + at least one empty lane (under the cap), FORCE one — a boring
  // "CPU did nothing" turn is worse than a suboptimal summon.
  if (summonsThisTurn === 0 && mana >= 1 && difficulty !== "easy" && lanesAvailableForSummon > 0) {
    for (const lane of laneOrder) {
      if (sideCreature(board, side, lane)) continue;
      const opp = sideCreature(board, oppSide, lane);
      intent.summons.push({ lane, move: pickBestMove(opp, hero.affinity, oppHeroState.affinity, bias) });
      mana -= 1;
      break;
    }
  }

  /* ─── 4. Spend remaining mana — biggest spells first ─── */
  // Sort remaining hand by cost desc; play whatever fits.
  const queue = playableHand.slice().sort((a, b) => costOf(b) - costOf(a));
  for (const id of queue) {
    const cost = costOf(id);
    if (cost > mana) continue;
    if (Math.random() < skipChance) continue;
    const spell = buildSpellTarget(id, board, side);
    if (!spell) continue;
    intent.spells.push(spell);
    mana -= cost;
    // Sablier rend +2 mana à la résolution (priorité 160 : il fire AVANT les
    // sorts plus chers) — le budget de plan peut donc compter le gain.
    if (id === "sablier") mana += 2;
  }

  // Final priority sort — caller (resolver) will re-sort, but doing it here
  // keeps the intent legible if anyone inspects it for tests.
  intent.spells.sort((s1, s2) => spellPriority(s1.id) - spellPriority(s2.id));
  // Symétrie joueur : MÊMES caps que l'UI/engine (MAX_SPELLS lane + 1 utility)
  // via truncateIntentByCaps. L'ancien cap "2 sorts TOTAL" privait le CPU de
  // son sort utility alors que le joueur y a droit (2 lane + 1 utility = 3).
  // Le tri par priorité ci-dessus garantit qu'on garde les plus importants.
  return truncateIntentByCaps(intent);
}

/* ───────────────────────── Helpers ───────────────────────── */

function sideCreature(board: BoardState, side: Side, lane: LaneIndex): Creature | null {
  return side === "a" ? board.lanes[lane].a : board.lanes[lane].b;
}

function consume(hand: CardId[], id: CardId): void {
  const i = hand.indexOf(id);
  if (i >= 0) hand.splice(i, 1);
}

/** Pick the best RPSLS move to summon against `opp`. Voie-aware (Alex
 *  2026-06-11) : si l'IA peut construire SA Constellation (affinityBuildChance)
 *  elle pose son symbole sur lane vide. Face à une créature opp qui MATCH la
 *  Voie joueur, elle priorise la counter (blockPlayerVoieChance) — c'est la
 *  vraie raison d'avoir choisi une Voie : ton plan se voit et se contre.
 *  Pierre is favored slightly (defensive opener, cheap and tanks attacks);
 *  Ciseaux and Lézard are the offensive flavors. */
function pickBestMove(
  opp: Creature | null,
  myAffinity: Move | undefined,
  oppAffinity: Move | undefined,
  bias: PersonaBias,
): Move {
  // Cas lane VIDE : opportunité de poser SA Voie pour build sa Constellation.
  if (!opp) {
    if (myAffinity && Math.random() < bias.affinityBuildChance) {
      return myAffinity;
    }
    // Sinon bag défensif (mêmes proportions qu'avant) — varié.
    const bag: Move[] = ["rock", "rock", "rock", "spock", "spock", "scissors", "scissors", "lizard", "paper"];
    return bag[Math.floor(Math.random() * bag.length)];
  }
  // Face à une créature opp qui MATCH la Voie joueur → priorité blocage
  // (le CPU "lit" ton plan et le contre).
  if (oppAffinity && opp.move === oppAffinity && Math.random() < bias.blockPlayerVoieChance) {
    let best: Move | null = null;
    for (const mv of MOVES) {
      if (!moveCountersMove(mv, opp.move)) continue;
      if (best === null) { best = mv; continue; }
      const s = CREATURE_STATS[mv];
      const bs = CREATURE_STATS[best];
      if (s.atk * 10 + s.hp > bs.atk * 10 + bs.hp) best = mv;
    }
    if (best) return best;
  }
  // Variance vs counter parfait (Round 9) — 30% bag random pour pas que le
  // joueur sente "CPU triche". Builder persona varie plus (1.3× skip implique
  // moins d'agression brute) — déjà calibré par bias.
  if (Math.random() < 0.30) {
    const bag: Move[] = ["rock", "rock", "rock", "spock", "spock", "scissors", "scissors", "lizard", "paper"];
    return bag[Math.floor(Math.random() * bag.length)];
  }
  for (const mv of MOVES) {
    if (moveCountersMove(mv, opp.move)) {
      // Among counters, pick the one with the best ATK/HP for this trade.
      let best: Move = mv;
      for (const candidate of MOVES) {
        if (!moveCountersMove(candidate, opp.move)) continue;
        const s = CREATURE_STATS[candidate];
        const bs = CREATURE_STATS[best];
        if (s.atk * 10 + s.hp > bs.atk * 10 + bs.hp) best = candidate;
      }
      return best;
    }
  }
  // Fallback when the move can't be RPSLS-countered (impossible in practice
  // for the 5-symbol table, but guards against future extensions). Random
  // from the bag instead of hardcoded Scissors.
  const fallbackBag: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
  return fallbackBag[Math.floor(Math.random() * fallbackBag.length)];
}

/** Build a PlayedSpell with a sensible target chosen for the CPU. Returns null
 *  if no valid target exists (e.g. Mirror with no opp creature). */
function buildSpellTarget(
  id: CardId,
  board: BoardState,
  side: Side,
): PlayedSpell | null {
  const oppSide: Side = side === "a" ? "b" : "a";
  switch (id) {
    case "aegis":     return targetMyBestCreature(board, side, "lane", id) ?? { id, kind: "self" };
    case "anchor":    return targetMyBestCreature(board, side, "lane", id);
    case "riposte":   return targetMyBestCreature(board, side, "lane", id);
    case "precision": return targetMyBestCreature(board, side, "lane", id);
    case "surge":     return targetMyBestCreature(board, side, "lane", id);
    case "curse":     return targetOppBestCreature(board, oppSide, id);
    case "supernova":
      // TOUJOURS le héros (Alex 2026-06-11) : la carte dit "6 dégâts au héros
      // adverse", et le joueur ne peut la cast que sur le héros. L'IA visait
      // une créature si hero > 6 HP → incohérent + "la supernova ne m'a pas
      // touché". Parité player/CPU = hero only.
      return { id, kind: "hero" };
    case "heist":     return { id, kind: "self" };
    case "tide":      return { id, kind: "global" };
    case "prescience": return { id, kind: "self" };
    case "oracle":    return { id, kind: "self" };
    case "augur":     return { id, kind: "global" };
    case "second-wind": return { id, kind: "self" };
    case "mirror":    return targetEmptyMyLaneOppOccupied(board, side, id);
    case "vortex":    return { id, kind: "global" };
    // ── Phase-2 — sans ces cases le CPU piochait ces cartes (deck mirroring)
    //    mais ne les castait JAMAIS : cartes mortes en main, tours passifs. ──
    case "gaia": {
      // Heal 6 — ne pas gaspiller à pleine vie.
      const me = side === "a" ? board.a : board.b;
      return me.hp <= me.maxHp - 4 ? { id, kind: "self" } : null;
    }
    case "sablier":   return { id, kind: "self" };
    case "offre": {
      // +2 mana max permanent — inutile une fois le plafond atteint.
      const me = side === "a" ? board.a : board.b;
      return me.maxMana < MANA_CAP ? { id, kind: "self" } : null;
    }
    case "rempart":
    case "benediction": {
      // Buffs board-wide : utile seulement avec ≥1 créature buffable
      // (Spock Détaché est ignoré par l'effet).
      const hasBuffable = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.move !== "spock";
      });
      return hasBuffable ? { id, kind: "self" } : null;
    }
    case "cascade":   return { id, kind: "self" };
    case "marchand-ames": {
      // Paye 2 HP → pioche 3 : interdit en zone létale.
      const me = side === "a" ? board.a : board.b;
      return me.hp > 5 ? { id, kind: "self" } : null;
    }
    case "mascarade":
      // Refonte déguisement (Alex 2026-06-11) : cible une de mes créatures
      // (elle se transforme pour counter l'adversaire en face).
      return targetMyBestCreature(board, side, "lane", id);
    case "sangsue": {
      // Heal = ATK de ma créature — gaspillé à pleine vie ou board vide.
      const me = side === "a" ? board.a : board.b;
      return me.hp < me.maxHp ? targetMyBestCreature(board, side, "lane", id) : null;
    }
    case "trou-noir": return targetOppBestCreature(board, oppSide, id);
    case "paradoxe": {
      // 5 dmg aux DEUX héros — uniquement en finisher létal sans suicide.
      const me = side === "a" ? board.a : board.b;
      const opp = oppSide === "a" ? board.a : board.b;
      return opp.hp <= 5 && me.hp > 5 ? { id, kind: "global" } : null;
    }
    // ── Nouvelles cartes Pro (2026-06-12) ──
    case "jet-caillou":   return targetOppBestCreature(board, oppSide, id);
    case "toile-gluante": return targetOppBestCreature(board, oppSide, id);
    case "seve": {
      // Soin créature : utile seulement si une de mes créatures est blessée.
      const hurt = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.hp < CREATURE_STATS[c.move].hp;
      });
      return hurt ? targetMyBestCreature(board, side, "lane", id) : null;
    }
    case "coup-oeil": return { id, kind: "self" };
    case "gravite": {
      // Dégât de zone : utile seulement s'il y a ≥1 créature adverse.
      const hasOpp = ([0, 1, 2] as LaneIndex[]).some((l) => !!sideCreature(board, oppSide, l));
      return hasOpp ? { id, kind: "global" } : null;
    }
    case "purge": {
      // Dissipe : utile s'il y a ≥1 créature adverse buffée/protégée.
      const worth = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, oppSide, l);
        return !!c && (c.atkBuff > 0 || c.divineShield || c.anchored || c.ripostePrimed);
      });
      return worth ? { id, kind: "global" } : null;
    }
    case "doppelganger": {
      // Copie : besoin d'≥1 créature ET d'une lane vide à moi.
      const hasCreature = ([0, 1, 2] as LaneIndex[]).some((l) => !!sideCreature(board, side, l));
      const hasEmpty = ([0, 1, 2] as LaneIndex[]).some((l) => !sideCreature(board, side, l));
      return hasCreature && hasEmpty ? { id, kind: "self" } : null;
    }
    case "phenix": {
      // Phénix : utile seulement si j'ai des créatures à protéger.
      const hasCreature = ([0, 1, 2] as LaneIndex[]).some((l) => !!sideCreature(board, side, l));
      return hasCreature ? { id, kind: "self" } : null;
    }
    case "roue-destin": return { id, kind: "self" };
    case "singularite": {
      // Burst héros qui scale avec le board : ne tente que s'il reste ≥1 créature.
      const anyCreature = ([0, 1, 2] as LaneIndex[]).some(
        (l) => !!sideCreature(board, side, l) || !!sideCreature(board, oppSide, l),
      );
      return anyCreature ? { id, kind: "hero" } : null;
    }
    default:          return null;
  }
}

function targetMyBestCreature(
  board: BoardState, side: Side, kind: "lane", id: CardId,
): PlayedSpell | null {
  let bestLane: LaneIndex | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const c = sideCreature(board, side, lane);
    if (!c) continue;
    const score = CREATURE_STATS[c.move].atk + c.hp;
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (bestLane === null) return null;
  return { id, kind, lane: bestLane };
}

function targetOppBestCreature(
  board: BoardState, oppSide: Side, id: CardId,
): PlayedSpell | null {
  let bestLane: LaneIndex | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const c = sideCreature(board, oppSide, lane);
    // Anchor (spell) AND Logique (Spock innate) both fizzle hostile spells —
    // skip them or the CPU wastes mana on a no-op.
    if (!c || c.anchored || c.spellImmune) continue;
    const score = CREATURE_STATS[c.move].atk * 2 + c.hp;
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (bestLane === null) return null;
  return { id, kind: "lane", lane: bestLane };
}

function targetEmptyMyLaneOppOccupied(
  board: BoardState, side: Side, id: CardId,
): PlayedSpell | null {
  const oppSide: Side = side === "a" ? "b" : "a";
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    if (sideCreature(board, side, lane)) continue;
    if (!sideCreature(board, oppSide, lane)) continue;
    return { id, kind: "lane", lane };
  }
  return null;
}
