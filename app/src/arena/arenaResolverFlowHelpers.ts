/**
 * Helpers PURS du résolveur séquencé (arenaResolverFlow) : snapshot de log,
 * analyse visuelle d'une lane AVANT son combat (poursuite, splash, Provoc,
 * chargeurs) et télémétrie Watcher par lane. Aucun timer, aucun RNG, aucun
 * setState : la chaîne de setTimeout reste entièrement dans arenaResolverFlow.
 * Extraits d'arenaResolverFlow.ts (cap <400 lignes/fichier) à l'identique.
 */

import { creatureEffectiveAtk } from "./arenaRules";
import { CREATURE_STATS, moveCountersMove, type BoardState, type LaneIndex } from "./arenaTypes";
import { alog } from "./arenaLog";
import type { LaneOutcome, LaneResult } from "./arenaTelemetry";

/** Snapshot helper — log compact d'une lane avec flags. Réutilise le même
 *  format que advanceToNextTurn pour cohérence à travers le pipeline. */
export function logBoardSnapshot(b: BoardState, tag: string): void {
  alog("state", `--- ${tag} --- a.hp=${b.a.hp} b.hp=${b.b.hp}`);
  const fmt = (c: BoardState["lanes"][number]["a"]): string => {
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
  for (let i = 0; i < 3; i++) {
    alog("state", `${tag} L${i} a:${fmt(b.lanes[i].a)} b:${fmt(b.lanes[i].b)}`);
  }
  // Alex feedback : "ajouter les cartes de chacun dans les logs" → mains
  // visibles côté joueur ET côté CPU pour analyse CCG post-mortem.
  // Format compact : main=[id1,id2,...] deck=N discard=M mana=X/Y.
  alog("hand", `${tag} a hand=[${b.a.hand.join(",")}] deck=${b.a.deck.length} discard=${b.a.discard.length} mana=${b.a.mana}/${b.a.maxMana}`);
  alog("hand", `${tag} b hand=[${b.b.hand.join(",")}] deck=${b.b.deck.length} discard=${b.b.discard.length} mana=${b.b.mana}/${b.b.maxMana}`);
}

// ANTI-TAUNT BYPASS — when an attack reaches the hero AND the
// defender HAS a charged Pierre but the attacker carries Étouffe
// (Paper) / Logique (Spock), the Provocation is cancelled. Surface
// WHICH passive bypassed the rock so the player understands why it
// didn't defend (keep the move check in sync with isAntiTaunt in analyzeLaneCombat).
export const findAntiTauntBypass = (b: BoardState, defenderSide: "a" | "b"): { rockLane: LaneIndex; cause: "paper" | "spock" } | null => {
  const attackerSide: "a" | "b" = defenderSide === "a" ? "b" : "a";
  let cause: "paper" | "spock" | null = null;
  for (let i = 0; i < 3; i++) {
    const c = attackerSide === "a" ? b.lanes[i].a : b.lanes[i].b;
    if (c && (c.move === "paper" || c.move === "spock")) { cause = c.move; break; }
  }
  if (!cause) return null;
  for (let i = 0; i < 3; i++) {
    const c = defenderSide === "a" ? b.lanes[i].a : b.lanes[i].b;
    if (c && c.taunt && c.provocationCharges > 0) return { rockLane: i as LaneIndex, cause };
  }
  return null;
};

/** Analyse visuelle d'une lane au DÉBUT de son beat de combat (avant
 *  resolveLaneCombatAt) — lue par les cues (charge, flash héros, Provoc,
 *  riposte) et la télémétrie. Lecture seule de `b`. */
export function analyzeLaneCombat(b: BoardState, laneIdx: 0 | 1 | 2) {
  const lane = b.lanes[laneIdx];
  const aHitsB = !!lane.a && !lane.b;
  const bHitsA = !!lane.b && !lane.a;
  // RPSLS counter follow-through (2026-06-09): if both creatures
  // are present and one counters the other, the loser dies AND the
  // winner pursues its ATK onto the opp hero (unless dodge or a
  // charged Pierre deflects). Treat that as a hero hit for the
  // anim layer too.
  const bothPresent = !!lane.a && !!lane.b;
  const counterAB = bothPresent && moveCountersMove(lane.a!.move, lane.b!.move);
  const counterBA = bothPresent && moveCountersMove(lane.b!.move, lane.a!.move);
  // Sync avec arenaCombat : la poursuite n'a PAS lieu si le perdant est
  // sauvé par Esquive OU par Aegis (sauf attaquant Tranchant/LAME qui
  // percent le bouclier ; LAME perce aussi l'Esquive). Sans ces termes
  // l'anim flashait le héros alors que l'engine ne frappait pas.
  const aLame = !!lane.a && b.a.lameActive && lane.a.move === "scissors";
  const bLame = !!lane.b && b.b.lameActive && lane.b.move === "scissors";
  const aFollowsThroughOnB = bothPresent && counterAB && !counterBA
    && (lane.b!.dodgeCharges === 0 || aLame)
    && (!lane.b!.divineShield || lane.a!.pierces || aLame);
  const bFollowsThroughOnA = bothPresent && counterBA && !counterAB
    && (lane.a!.dodgeCharges === 0 || bLame)
    && (!lane.a!.divineShield || lane.b!.pierces || bLame);
  // TAUNT DEFLECTION DETECTION — keep in sync with rules.findDeflector:
  //   first ALIVE+CHARGED Pierre on defender's side, EXCEPT if
  //   attacker has Paper/Spock anti-taunt active. Returns the
  //   Pierre's lane so the chip can point a dotted line at it.
  const isAntiTaunt = (c: { move: string } | null | undefined): boolean =>
    !!c && (c.move === "paper" || c.move === "spock");
  const findDeflectorLane = (defenderSide: "a" | "b"): LaneIndex | null => {
    const attackerSide: "a" | "b" = defenderSide === "a" ? "b" : "a";
    // LAME Finisher : l'attaquant Ciseau LAME perce la Provoc — pas de
    // chip "détourné" (sync avec le skip deflect d'arenaCombat).
    const attackerLame = attackerSide === "a" ? aLame : bLame;
    if (attackerLame) return null;
    const attackerHasAntiTaunt = b.lanes.some((l) =>
      isAntiTaunt(attackerSide === "a" ? l.a : l.b),
    );
    if (attackerHasAntiTaunt) return null;
    for (let i = 0; i < 3; i++) {
      const c = defenderSide === "a" ? b.lanes[i].a : b.lanes[i].b;
      if (c && c.taunt && c.provocationCharges > 0) return i as LaneIndex;
    }
    return null;
  };
  // a hits b's hero when either undefended attack or RPSLS follow-through.
  // Splash damage (Alex 2026-06-11) : la poursuite après counter-kill
  // est réduite à max(0, ATK − HP cible). Si splash = 0 → le hero ne
  // prend RIEN, pas d'anim flash sur sa HP bar (sinon induit en erreur).
  const atkA = lane.a ? creatureEffectiveAtk(lane.a) : 0;
  const atkB = lane.b ? creatureEffectiveAtk(lane.b) : 0;
  const splashAtoB = aFollowsThroughOnB && lane.b ? Math.max(0, atkA - lane.b.hp) : 0;
  const splashBtoA = bFollowsThroughOnA && lane.a ? Math.max(0, atkB - lane.a.hp) : 0;
  const aReachesHeroB = aHitsB || aFollowsThroughOnB;
  const bReachesHeroA = bHitsA || bFollowsThroughOnA;
  // damage RÉEL qui va toucher le hero (filtre les follow-through à 0)
  const aHitsHeroBForReal = (aHitsB && atkA > 0) || splashAtoB > 0;
  const bHitsHeroAForReal = (bHitsA && atkB > 0) || splashBtoA > 0;
  const bDeflectorLane = aReachesHeroB ? findDeflectorLane("b") : null;
  const aDeflectorLane = bReachesHeroA ? findDeflectorLane("a") : null;
  // Anti-mush (Alex 2026-06-17) : seul l'ATTAQUANT charge — le défenseur
  // garde sa réaction hitShake au moment du dégât → séquence lisible
  // « fonce → encaisse ». Vainqueur du counter, ou créature seule ; trade
  // sans counter (même symbole / pas de relation) = les 2 (vrai clash).
  const chargers: ("a" | "b")[] = bothPresent
    ? (counterAB && !counterBA ? ["a"] : counterBA && !counterAB ? ["b"] : ["a", "b"])
    : lane.a ? ["a"] : lane.b ? ["b"] : [];
  return {
    lane, aHitsB, bHitsA, bothPresent, counterAB, counterBA, aLame, bLame,
    atkA, atkB, splashAtoB, splashBtoA, aHitsHeroBForReal, bHitsHeroAForReal,
    bDeflectorLane, aDeflectorLane, chargers,
  };
}

/** Télémétrie Watcher (Tier B) — issue de la lane, à partir des valeurs
 *  DÉJÀ calculées (analyzeLaneCombat) + le diff de board (prevB → b). */
export function emitLaneTelemetry(
  onLaneResolved: ((outcome: LaneOutcome) => void) | undefined,
  laneIdx: LaneIndex,
  an: ReturnType<typeof analyzeLaneCombat>,
  prevB: BoardState,
  b: BoardState,
): void {
  const { lane, counterAB, counterBA, bDeflectorLane, aDeflectorLane, splashAtoB, splashBtoA, aHitsB, bHitsA, atkA, atkB } = an;
  if (onLaneResolved) {
    try {
      const selfMove = lane.a?.move ?? null;
      const oppMove = lane.b?.move ?? null;
      const result: LaneResult =
        lane.a && lane.b
          ? counterAB ? "counterWinSelf" : counterBA ? "counterWinOpp" : "mirror"
          : lane.a ? "emptySelf" : lane.b ? "emptyOpp" : "none";
      onLaneResolved({
        lane: laneIdx,
        selfMove,
        oppMove,
        result,
        killSelf: !!prevB.lanes[laneIdx].a && !b.lanes[laneIdx].a,
        killOpp: !!prevB.lanes[laneIdx].b && !b.lanes[laneIdx].b,
        saved:
          (counterAB && !counterBA && !!prevB.lanes[laneIdx].b && !!b.lanes[laneIdx].b) ||
          (counterBA && !counterAB && !!prevB.lanes[laneIdx].a && !!b.lanes[laneIdx].a),
        splashToOpp: bDeflectorLane === null ? splashAtoB : 0,
        splashToSelf: aDeflectorLane === null ? splashBtoA : 0,
        directToOpp: aHitsB && bDeflectorLane === null ? atkA : 0,
        directToSelf: bHitsA && aDeflectorLane === null ? atkB : 0,
      });
    } catch {
      /* télémétrie fail-soft — jamais bloquer la résolution */
    }
  }
}
