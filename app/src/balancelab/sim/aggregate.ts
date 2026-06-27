/**
 * aggregate — la stat-math du Lab, séparée du runner (pure, testable).
 *
 * Accumule les traces de partie en stats par Voie + matrice de matchup
 * SYMÉTRISÉE (chaque paire jouée dans les 2 sens → on neutralise le biais de
 * côté « a » du tie-break documenté de l'IA). Win-rate cible d'équilibre : 50%.
 */
import { HERO_MAX_HP } from "../../arena/arenaTypes/constants";
import type { Move } from "../../engine/game";
import { MOVES, type MatchTrace, type VoieStats } from "./simTypes";

const N = MOVES.length;
const idx = (m: Move) => MOVES.indexOf(m);

type Bucket = "early" | "mid" | "late";
function bucketOf(turns: number): Bucket {
  if (turns <= 6) return "early";
  if (turns <= 11) return "mid";
  return "late";
}

export interface Accumulator {
  winsA: number[][]; // [i][j] victoires du camp A quand A=Voie i, B=Voie j
  games: number[][]; // [i][j] parties jouées dans ce sens
  vGames: number[];
  vWins: number[];
  vDraws: number[];
  vSumTurns: number[];
  vSumFinalHp: number[];
  vSumOppHp: number[];
  vFin: number[];
  hpSum: number[][]; // [voie][turn] somme des PV
  hpCnt: number[][]; // [voie][turn] nombre d'échantillons
  bGames: Record<Bucket, number>[]; // [voie][bucket]
  bWins: Record<Bucket, number>[];
}

export function newAccumulator(): Accumulator {
  const mat = () => Array.from({ length: N }, () => Array(N).fill(0));
  const vec = () => Array(N).fill(0);
  const bkt = () => Array.from({ length: N }, () => ({ early: 0, mid: 0, late: 0 }));
  return {
    winsA: mat(),
    games: mat(),
    vGames: vec(),
    vWins: vec(),
    vDraws: vec(),
    vSumTurns: vec(),
    vSumFinalHp: vec(),
    vSumOppHp: vec(),
    vFin: vec(),
    hpSum: Array.from({ length: N }, () => [] as number[]),
    hpCnt: Array.from({ length: N }, () => [] as number[]),
    bGames: bkt(),
    bWins: bkt(),
  };
}

function foldHp(sum: number[], cnt: number[], series: number[]): void {
  for (let t = 0; t < series.length; t++) {
    sum[t] = (sum[t] ?? 0) + series[t];
    cnt[t] = (cnt[t] ?? 0) + 1;
  }
}

export function foldResult(acc: Accumulator, tr: MatchTrace): void {
  const i = idx(tr.voieA);
  const j = idx(tr.voieB);
  const bk = bucketOf(tr.turns);

  acc.games[i][j]++;
  if (tr.winner === "a") acc.winsA[i][j]++;

  acc.vGames[i]++;
  acc.vGames[j]++;
  if (tr.winner === "a") acc.vWins[i]++;
  else if (tr.winner === "b") acc.vWins[j]++;
  else {
    acc.vDraws[i]++;
    acc.vDraws[j]++;
  }

  acc.vSumTurns[i] += tr.turns;
  acc.vSumTurns[j] += tr.turns;
  const finalA = tr.hpAByTurn[tr.hpAByTurn.length - 1] ?? 0;
  const finalB = tr.hpBByTurn[tr.hpBByTurn.length - 1] ?? 0;
  acc.vSumFinalHp[i] += finalA;
  acc.vSumFinalHp[j] += finalB;
  acc.vSumOppHp[i] += finalB;
  acc.vSumOppHp[j] += finalA;
  acc.vFin[i] += tr.finisherA ? 1 : 0;
  acc.vFin[j] += tr.finisherB ? 1 : 0;

  foldHp(acc.hpSum[i], acc.hpCnt[i], tr.hpAByTurn);
  foldHp(acc.hpSum[j], acc.hpCnt[j], tr.hpBByTurn);

  acc.bGames[i][bk]++;
  acc.bGames[j][bk]++;
  if (tr.winner === "a") acc.bWins[i][bk]++;
  else if (tr.winner === "b") acc.bWins[j][bk]++;
}

/** Win-rate symétrisé de la Voie i contre la Voie j (moyenne des 2 sens, 0..1). */
function sym(acc: Accumulator, i: number, j: number): number {
  const ga = acc.games[i][j];
  const gb = acc.games[j][i];
  const a = ga > 0 ? acc.winsA[i][j] / ga : 0.5;
  const b = gb > 0 ? 1 - acc.winsA[j][i] / gb : 0.5;
  return (a + b) / 2;
}

export function finalize(acc: Accumulator): VoieStats[] {
  return MOVES.map((move, i) => {
    const g = acc.vGames[i] || 1;
    const hpByTurn = acc.hpSum[i].map((s, t) => (acc.hpCnt[i][t] ? s / acc.hpCnt[i][t] : 0));
    const vsWinRate: Partial<Record<Move, number>> = {};
    for (let j = 0; j < N; j++) if (j !== i) vsWinRate[MOVES[j]] = sym(acc, i, j);
    const br = (b: Bucket) => (acc.bGames[i][b] ? acc.bWins[i][b] / acc.bGames[i][b] : 0);
    return {
      move,
      games: acc.vGames[i],
      wins: acc.vWins[i],
      draws: acc.vDraws[i],
      winRate: acc.vWins[i] / g,
      avgTurns: acc.vSumTurns[i] / g,
      avgFinalHp: acc.vSumFinalHp[i] / g,
      avgDmgDealt: HERO_MAX_HP - acc.vSumOppHp[i] / g,
      finisherFireRate: acc.vFin[i] / g,
      hpByTurn,
      vsWinRate,
      byBucket: { early: br("early"), mid: br("mid"), late: br("late") },
    };
  });
}

/** Matrice [i][j] = win-rate % de la Voie i (attaquant) vs j (défenseur), symétrisée. */
export function buildMatrix(acc: Accumulator): number[][] {
  return Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => (i === j ? NaN : sym(acc, i, j) * 100)),
  );
}
