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
  Side,
  TurnIntent,
  LaneIndex,
} from "./arenaTypes";
import { arenaSupported, spellPriority } from "./arenaCardEffects";
import { truncateIntentByCaps, creatureEffectiveAtk } from "./arenaRules";
import { arenaSpellCost } from "./arenaSpellHelpers";
import { engineGauge } from "./arenaEngines";
import type { CardId } from "../ranked/rankedTypes";
import type { Difficulty } from "../types";
import { sideCreature, consume } from "./arenaAIHelpers";
import { biasFor, pickBestMove, bestCounter } from "./arenaAIMoves";
import { buildSpellTarget } from "./arenaAISpellTarget";

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
  // ── Voie Montagne (2026-06-22) ──
  "eboulement", "strate-vive", "contrefort", "gardien-pierre", "veine-gaia", "barricade",
  "ecrasement", "veine-minerale", "grondement",
  // ── Voie Mirage (2026-06-22) ──
  "reflet-echo", "mascarade-enchainee", "fuite-masquee",
  // ── Voie Tranchant (2026-06-22) ──
  "coup-de-taille", "acuite", "frenesie", "estafilade", "saignee", "fureur-emoussee",
  // ── Voie Forêt (2026-06-23) ──
  "ramure", "photosynthese", "ronces", "greffe",
  // ── Voie Cosmos (2026-06-23) ──
  "dilatation-temporelle", "loi-de-causalite", "convergence-cosmique",
  // ── Dégâts signature par Voie (2026-06-23) ──
  "eboulis-final", "drain-vital", "coup-dans-lombre",
  "intrication-quantique", "taillade-mortelle",
  // ── Audit IA 2026-10 : cartes signature dont le case existait mais absentes
  //    d'ici → filtrées du deck CPU (Mirage amputé de 6 cartes, Cosmos de
  //    Chronomancien, Tranchant de Surcharge/Double Mot). ──
  "derobade", "frappe-spectrale", "eclipse", "sillage-spectral", "faux-semblant", "nuee-spectrale",
  "chronomancien", "surcharge", "double-mot",
  // ── Finishers (injectés à 3⭐) — avant, le CPU ne les castait JAMAIS. ──
  "finisher-forteresse", "finisher-verger", "finisher-lame", "finisher-metamorphose", "finisher-calcul",
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
  // Courbe de difficulté (audit 2026-10) : normal ≈ hard avant (0.1) → 0.25.
  const baseSkip = difficulty === "easy" ? 0.4 : difficulty === "hard" ? 0 : 0.25;
  const skipChance = Math.min(0.6, baseSkip * bias.spellSkipMult);

  /* ─── 1. Defensive emergencies — save a creature about to die ─── */
  const savedLanes = new Set<LaneIndex>();
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
      if (mana >= costOf("aegis") && playableHand.includes("aegis") && mine.move !== "spock") {
        intent.spells.push({ id: "aegis", kind: "lane", lane });
        savedLanes.add(lane);
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
      // ATK EFFECTIVE (Lente, Fanaison, Émoussé, Strates, Toile…) — même source
      // que le combat, sinon l'IA croyait au létal sur une Pierre fraîche.
      lethalDmg += creatureEffectiveAtk(myC);
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
  // Easy keeps a bit of randomness (15%), normal/hard always summon if
  // there's an open lane and mana for it.
  // Audit 2026-10 : easy 0.3 → 0.15 (falaise : ~11% vs hard).
  const summonSkip = difficulty === "easy" ? 0.15 : 0;
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
  // HARD — counter-replace (audit 2026-10) : si une créature adverse VISIBLE
  // counter la mienne sur une lane (et que rien ne la sauve : bouclier, esquive,
  // Aegis posé ci-dessus), on ré-invoque le counter par-dessus (remplacement).
  if (difficulty === "hard") {
    for (const lane of laneOrder) {
      if (mana < 1 || summonsThisTurn >= lanesAvailableForSummon) break;
      const mine = sideCreature(board, side, lane);
      const opp = sideCreature(board, oppSide, lane);
      if (!mine || !opp || savedLanes.has(lane)) continue;
      if (!moveCountersMove(opp.move, mine.move) || moveCountersMove(mine.move, opp.move)) continue;
      if (mine.divineShield || mine.dodgeCharges > 0) continue;
      intent.summons.push({ lane, move: bestCounter(opp.move, hero.affinity) });
      mana -= 1;
      summonsThisTurn += 1;
    }
  }
  for (const lane of laneOrder) {
    if (mana < 1) break;
    if (summonsThisTurn >= lanesAvailableForSummon) break;
    if (sideCreature(board, side, lane)) continue;
    if (Math.random() < summonSkip) continue;
    const opp = sideCreature(board, oppSide, lane);
    const choice = pickBestMove(opp, hero.affinity, oppHeroState.affinity, bias, engineGauge(oppHeroState)?.value ?? 0);
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
      intent.summons.push({ lane, move: pickBestMove(opp, hero.affinity, oppHeroState.affinity, bias, engineGauge(oppHeroState)?.value ?? 0) });
      mana -= 1;
      break;
    }
  }

  /* ─── 4. Spend remaining mana — biggest spells first ─── */
  // Sort remaining hand by cost desc; play whatever fits.
  // Chronomancien d'abord : son +3 mana (priorité 165, résolu avant les autres
  // sorts) finance la suite du plan, comme Sablier.
  const queue = playableHand.slice().sort((a, b) =>
    (a === "chronomancien" ? -1 : 0) - (b === "chronomancien" ? -1 : 0) || costOf(b) - costOf(a));
  // Gain Chronomancien en borne BASSE (mana réel au moment où il résout ≤ mana
  // du héros − son coût) → jamais de sort planifié non payable à la résolution.
  const chronoGain = Math.max(0, Math.min(3, MANA_CAP - (hero.mana - costOf("chronomancien"))));
  for (const id of queue) {
    const cost = costOf(id);
    if (cost > mana) continue;
    if (Math.random() < skipChance) continue;
    // Chronomancien seulement s'il débloque un sort de la main sinon inabordable.
    if (id === "chronomancien" && !queue.some((o) => o !== id && costOf(o) > mana - cost && costOf(o) <= mana - cost + chronoGain)) continue;
    const spell = buildSpellTarget(id, board, side);
    if (!spell) continue;
    intent.spells.push(spell);
    mana -= cost;
    // Sablier rend +2 mana à la résolution (priorité 160 : il fire AVANT les
    // sorts plus chers) — le budget de plan peut donc compter le gain.
    if (id === "sablier") mana += 2;
    // Chronomancien : +3 mana à la résolution (clampé MANA_CAP).
    if (id === "chronomancien") mana += chronoGain;
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
