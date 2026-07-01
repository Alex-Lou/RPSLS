import { alog, csnap } from "../arenaLog";
import { AFFINITY_TO_FINISHER } from "../arenaFinishers";
import { applyEnginesEndOfTurn, engineMaxed, trancheAtkBonus, mirageDodgeBonus, mirageAtkBonus, riseEngineOnHeld } from "../arenaEngines";
import { BALANCE } from "../arenaBalance";
// resolveCombat vit dans ./arenaCombat (déplacé 2026-06-09 : arenaRules > 700 l).
// Le cycle arenaRules<->arenaCombat tient car arenaCombat n'importe que les
// primitives feuilles (creatureEffectiveAtk/damageCreature/damageHero), sans
// back-dépendance sur ce resolver. resolveCombat + resolveLaneCombatAt sont
// re-exportés par le barrel (index.ts) pour préserver le contract des callsites.
import { resolveCombat } from "../arenaCombat";
import {
  applyArenaSpell,
  spellPriority,
  type ArenaSpellContext,
} from "../arenaCardEffects";
import { arenaSpellCost } from "../arenaSpellHelpers";
import {
  MAX_SPELLS_PER_TURN,
  UTILITY_SPELLS_PER_TURN,
  type BoardState,
  type Creature,
  type HeroState,
  type LaneIndex,
  type LaneState,
  type PlayedSpell,
  type Side,
  type TurnIntent,
} from "../arenaTypes";
import { makeCreature, endOfTurnReset, gainStrateIfHeld } from "./heroCreature";
import { drawCards } from "./boardInit";
import type { CardId } from "../../ranked/rankedTypes";
import type { Move } from "../../engine/game";

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

  // ─── 1. Summon phase ─── (Alex 2026-06-29 : invocations AVANT les sorts → un
  //     sort de zone comme Éboulement touche les voisines TOUT JUSTE invoquées,
  //     au lieu de frapper une lane encore vide. Ordre miroité dans runResolverFlow.)
  b = applySummons(b, intentA, "a");
  b = applySummons(b, intentB, "b");

  // ─── 2. Spell phase ─── (intercale les deux camps par priorité)
  b = applyAllSpells(b, intentA, intentB);

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
    // ENGINE de Voie — la jauge ne monte PLUS au summon : elle monte quand ton
    // symbole REMPORTE un counter en lane (« Le Tracé », Alex 2026-06-24 ; cf.
    // arenaCombat.riseEngineOnCounterWin). Le Lézard posé profite ici de la jauge
    // Mirage déjà accumulée par tes victoires passées.
    const created = makeCreature(summon.move, side, hero.affinity);
    // MIRAGE : un Lézard de la Voie arrive avec +mirageStack charges d'Esquive
    // (borné dodgeCapOnSummon) ET +mirageStack ATK perm (mirageAtkBonus, payoff
    // offensif 2026-06-30) — insaisissable ET tranchant : la jauge convertit
    // enfin en pression (frappes imblocables) au lieu de turtle pur.
    lane[side] = created.move === "lizard"
      ? {
          ...created,
          dodgeCharges: Math.min(BALANCE.mirage.dodgeCapOnSummon, created.dodgeCharges + mirageDodgeBonus(hero)),
          voieAtkBonus: created.voieAtkBonus + mirageAtkBonus(hero),
        }
      : created;
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

export function endOfTurnCleanup(board: BoardState): BoardState {
  // STRATES (Voie Montagne) appliquées APRÈS le reset, en passant le
  // summonedThisTurn ORIGINAL (avant reset) → une Pierre ne gagne pas de Strate
  // le tour de son arrivée, seulement après avoir TENU un tour. Cf. gainStrateIfHeld.
  const lanes = board.lanes.map((lane) => ({
    a: lane.a ? gainStrateIfHeld(endOfTurnReset(lane.a, board.a.vergerActive, trancheAtkBonus(board.a)), board.a.affinity, lane.a.summonedThisTurn) : null,
    b: lane.b ? gainStrateIfHeld(endOfTurnReset(lane.b, board.b.vergerActive, trancheAtkBonus(board.b)), board.b.affinity, lane.b.summonedThisTurn) : null,
  })) as [LaneState, LaneState, LaneState];
  // 🔥 PHÉNIX (2026-06-12) : ressuscite à 1 PV les créatures snapshotées au
  // cast (applyPhenix) qui sont mortes ce tour — lane désormais vide. Si la
  // lane a été reprise par une autre créature (survivante / nouveau summon),
  // pas de résurrection (on n'écrase rien).
  const revive = (snap: { lane: LaneIndex; move: Move }[] | undefined, side: Side): void => {
    if (!snap || snap.length === 0) return;
    const aff = side === "a" ? board.a.affinity : board.b.affinity;
    // NERF Forêt (Alex 2026-06-30) : Phénix ne ressuscite plus qu'UNE créature (la
    // 1re tombée) au lieu de TOUT le board → casse la « forteresse inkillable » (le
    // board ne se vidait jamais, coupant la win-condition lane-vide→héros). Reste un
    // sauvetage légendaire fort. Voie-agnostique (ne casse pas les decks non-Forêt).
    let revived = 0;
    for (const { lane, move } of snap) {
      if (revived >= 1) break;
      const cur = side === "a" ? lanes[lane].a : lanes[lane].b;
      if (!cur) {
        const reborn: Creature = { ...makeCreature(move, side, aff), hp: 1, summonedThisTurn: false, justRevived: true };
        lanes[lane] = side === "a" ? { ...lanes[lane], a: reborn } : { ...lanes[lane], b: reborn };
        alog("turn", `${side} 🔥 PHÉNIX → ${move} renaît à 1 PV (L${lane})`);
        revived++;
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
    // Refonte clarté (Alex 2026-06-23) : le Finisher se débloque quand la jauge
    // d'ENGINE de la Voie est PLEINE (engineMaxed) — une seule progression visible,
    // finie la « constellation » séparée qui embrouillait. 1×/match (finisherUnlocked).
    const unlocked = engineMaxed(hero) && !hero.finisherUnlocked;
    if (!unlocked) return hero;
    let hand = hero.hand;
    if (hero.affinity) {
      const finisherId = AFFINITY_TO_FINISHER[hero.affinity];
      hand = [...hero.hand, finisherId];
      alog("turn", `${side} TRACÉ FERMÉ ⭐⭐⭐ → FINISHER [${finisherId}] injecté en main`);
    }
    return { ...hero, finisherUnlocked: true, hand };
  };
  // 🪨 MONTAGNE — la jauge Strates monte AUSSI si une Pierre de la Voie a TENU ce
  // tour (rock survivant, pas fraîchement posé) : on lie la jauge au « tenir » (=
  // la win-condition snowball), pas au seul counter-win qui gèle Montagne (cf.
  // riseEngineOnHeld, parallèle au fix Mirage). Posé AVANT refreshConstellation pour
  // que Forteresse se débloque sur la jauge montée. Affinité rock-gated dans la fn.
  const aHeldRock = board.lanes.some((l) => !!l.a && l.a.move === "rock" && !l.a.summonedThisTurn);
  const bHeldRock = board.lanes.some((l) => !!l.b && l.b.move === "rock" && !l.b.summonedThisTurn);
  const heroA0 = aHeldRock ? riseEngineOnHeld(board.a) : board.a;
  const heroB0 = bHeldRock ? riseEngineOnHeld(board.b) : board.b;
  // ENGINES de Voie (Sève régén + Cosmos chip) appliqués APRÈS la constellation,
  // sur les héros rafraîchis. Pur/capé/additif (cf. arenaEngines).
  const engines = applyEnginesEndOfTurn(
    board,
    refreshConstellation(heroA0, "a"),
    refreshConstellation(heroB0, "b"),
  );
  // SILLAGE SPECTRAL (Mirage 2026-06-28) — aura active : si un de mes Lézards a
  // esquivé ce tour (flag posé en combat, cf. arenaCombat), je pioche 1 (cap
  // 1/tour). Lu sur board.X (post-combat), pioche appliquée sur engines.X.
  let aHero = engines.a;
  let bHero = engines.b;
  if (aHero.sillageActive && board.a.sillageDodgedThisTurn) {
    aHero = drawCards(aHero, 1);
    alog("turn", `a 🌀 SILLAGE SPECTRAL → esquive ce tour = pioche 1`);
  }
  if (bHero.sillageActive && board.b.sillageDodgedThisTurn) {
    bHero = drawCards(bHero, 1);
    alog("turn", `b 🌀 SILLAGE SPECTRAL → esquive ce tour = pioche 1`);
  }
  // Reset des flags PER-TOUR : Mirage (Sillage esquive + Nuée imblocable) + Montagne
  // (Écrasement soin coupé — lu par seveHealAmount juste au-dessus, puis remis à 0).
  aHero = { ...aHero, sillageDodgedThisTurn: false, nueeActive: false, healLockedThisTurn: false };
  bHero = { ...bHero, sillageDodgedThisTurn: false, nueeActive: false, healLockedThisTurn: false };
  return {
    ...board,
    lanes,
    a: aHero,
    b: bHero,
    phenixReviveA: undefined, // snapshot Phénix consommé
    phenixReviveB: undefined,
  };
}
