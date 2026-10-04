/**
 * Fin de match — décision PURE, partagée par le résolveur pur (resolveTurn) ET
 * le flux live (runResolverFlow) → les deux clients du lockstep online calculent
 * EXACTEMENT le même verdict (Alex 2026-10 « Plafond 20 + départage »).
 *
 * Appelée APRÈS endOfTurnCleanup (créatures survivantes connues) :
 *  - un seul héros ≤0 → KO classique ;
 *  - les DEUX ≤0 ce tour, OU plafond TURN_HARD_CAP atteint à PV égaux →
 *    DÉPARTAGE avant la mort subite :
 *      (a) PV les plus hauts au DÉBUT du tour ;
 *      (b) sinon plus de créatures vivantes sur le board après le tour ;
 *      (c) sinon mort subite RPSLS (vs-CPU) / NUL propre (online, noSuddenDeath) ;
 *  - plafond atteint à PV différents → le plus bas perd.
 * Le verdict est écrit dans le board (perdant à 0 PV, gagnant ≥1 PV) pour que
 * matchResult / ArenaMatchEnd le lisent sans logique dupliquée.
 */
import { TURN_HARD_CAP, type BoardState, type MatchEndReason, type Side } from "../arenaTypes";
import { alog } from "../arenaLog";

/** Créatures vivantes d'un camp (après le tour). */
function livingCount(b: BoardState, side: Side): number {
  return b.lanes.reduce((n, l) => {
    const c = side === "a" ? l.a : l.b;
    return n + (c && c.hp > 0 ? 1 : 0);
  }, 0);
}

/** Écrit la victoire de `winner` : perdant à 0 PV, gagnant au moins 1 PV. */
function award(b: BoardState, winner: Side, reason: MatchEndReason): BoardState {
  const loser: Side = winner === "a" ? "b" : "a";
  return {
    ...b,
    [winner]: { ...b[winner], hp: Math.max(1, b[winner].hp) },
    [loser]: { ...b[loser], hp: 0 },
    phase: "match-end",
    endReason: reason,
  } as BoardState;
}

/** Départage (a) PV de début de tour, (b) créatures vivantes, (c) mort subite
 *  ou nul (online). Utilisé pour le double KO (combat ET fatigue, cf.
 *  lifecycle.advanceToNextTurn) et le plafond à PV égaux. */
export function tieBreak(startHp: { a: number; b: number }, b: BoardState, noSuddenDeath: boolean): BoardState {
  if (startHp.a !== startHp.b) {
    const w: Side = startHp.a > startHp.b ? "a" : "b";
    alog("turn", `DÉPARTAGE — PV en début de tour (${startHp.a} vs ${startHp.b}) → ${w} gagne`);
    return award(b, w, "tiebreak-start-hp");
  }
  const ca = livingCount(b, "a");
  const cb = livingCount(b, "b");
  if (ca !== cb) {
    const w: Side = ca > cb ? "a" : "b";
    alog("turn", `DÉPARTAGE — créatures vivantes (${ca} vs ${cb}) → ${w} gagne`);
    return award(b, w, "tiebreak-board");
  }
  if (!noSuddenDeath) {
    alog("turn", `DÉPARTAGE — égalité totale → 🌟 BUT D'OR / Mort subite RPSLS`);
    return { ...b, phase: "sudden-death", endReason: "sudden-death" };
  }
  // Online : mort subite non déterministe → NUL propre (les deux à 0).
  alog("turn", `DÉPARTAGE — égalité totale (online) → NUL`);
  return { ...b, a: { ...b.a, hp: 0 }, b: { ...b.b, hp: 0 }, phase: "match-end", endReason: "draw" };
}

/** Verdict de fin de tour. `startHp` = PV des deux héros AU DÉBUT du tour
 *  (avant sorts/combat). Renvoie le board inchangé si la partie continue. */
export function decideMatchEnd(
  startHp: { a: number; b: number },
  b: BoardState,
  opts: { noSuddenDeath?: boolean } = {},
): BoardState {
  const noSD = !!opts.noSuddenDeath;
  const aDead = b.a.hp <= 0;
  const bDead = b.b.hp <= 0;
  if (aDead && bDead) {
    alog("turn", `DOUBLE KO (a.hp=${b.a.hp}, b.hp=${b.b.hp}) → départage`);
    return tieBreak(startHp, b, noSD);
  }
  if (aDead || bDead) return { ...b, phase: "match-end", endReason: "ko" };
  if (b.turn >= TURN_HARD_CAP) {
    if (b.a.hp === b.b.hp) {
      alog("turn", `PLAFOND T${b.turn} — PV égaux (${b.a.hp}) → départage`);
      return tieBreak(startHp, b, noSD);
    }
    const w: Side = b.a.hp > b.b.hp ? "a" : "b";
    alog("turn", `PLAFOND T${b.turn} — ${w === "a" ? "b" : "a"} perd (PV ${b.a.hp} vs ${b.b.hp})`);
    return award(b, w, "cap-hp");
  }
  return b;
}
