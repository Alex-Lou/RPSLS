import { alog, alogSetTurn } from "../arenaLog";
import {
  CREATURE_STATS,
  MANA_CAP,
  type ArenaMatchResult,
  type BoardState,
  type HeroState,
  type LaneState,
  type Side,
} from "../arenaTypes";
import { creatureEffectiveAtk } from "./heroCreature";
import { drawCards } from "./boardInit";

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
