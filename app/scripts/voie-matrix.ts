/**
 * voie-matrix — matrice des DUELS de Voies (IA vs IA, headless, déterministe).
 *
 * Pour chaque paire ordonnée (Voie i en camp A, Voie j en camp B, i≠j) on joue
 * N parties via le runner pur du Balance Lab (balancelab/sim/runMatch : IA réelle
 * des 2 côtés, decks signature, même pré-calcul que le flux live). Chaque duel
 * {i,j} est donc joué 2N fois, CÔTÉS ALTERNÉS (N en A, N en B) → le biais de camp
 * est neutralisé. Graine de chaque partie = seed + index stable → reproductible.
 * Score d'une partie = 1 victoire, 0,5 nul (mort subite comptée nul), 0 défaite.
 *
 * Sorties : matrice [i][j] = % de score de i contre j, winrate global par Voie
 * (moyenne de ses 4 duels), écart global (meilleure − pire), pire duel.
 *
 * Usage (depuis app/) :
 *   npx tsx scripts/voie-matrix.ts [--games 200] [--seed 1337] [--diff hard]
 *                                  [--patch '{"cosmos":{"intricationCap":5}}'] [--json]
 * --games = parties PAR SENS (200 → 400 par duel). --patch = réglage BALANCE
 * partiel appliqué après resetBalance (même chemin que le Lab).
 */
import { runMatch } from "../src/balancelab/sim/runMatch";
import { MOVES, VOIE_META, type Diff } from "../src/balancelab/sim/simTypes";
import { applyBalance, resetBalance } from "../src/arena/arenaBalance";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const GAMES = Number(arg("games", "200"));
const SEED = Number(arg("seed", "1337"));
const DIFF = arg("diff", "hard") as Diff;
const PATCH = arg("patch", "");
const JSON_OUT = process.argv.includes("--json");

resetBalance();
if (PATCH) applyBalance(JSON.parse(PATCH));

const N = MOVES.length;
// score[i][j] = points de i quand i est en A face à j en B ; games[i][j] idem.
const score = Array.from({ length: N }, () => Array(N).fill(0) as number[]);
const games = Array.from({ length: N }, () => Array(N).fill(0) as number[]);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    if (i === j) continue;
    for (let k = 0; k < GAMES; k++) {
      // Graine stable par (paire ordonnée, k) : indépendante de l'ordre de boucle.
      const tr = runMatch(MOVES[i], MOVES[j], DIFF, SEED + (i * N + j) * 100003 + k);
      score[i][j] += tr.winner === "a" ? 1 : tr.winner === "draw" ? 0.5 : 0;
      games[i][j]++;
    }
  }
}
// Duel symétrisé : moyenne des 2 sens (i en A vs j en B, et i en B vs j en A).
const duel = (i: number, j: number): number =>
  ((score[i][j] / games[i][j]) + (1 - score[j][i] / games[j][i])) / 2 * 100;
const matrix = MOVES.map((_, i) => MOVES.map((_, j) => (i === j ? NaN : duel(i, j))));
const global = MOVES.map((_, i) => matrix[i].filter((x) => !Number.isNaN(x)).reduce((a, b) => a + b, 0) / (N - 1));
const spread = Math.max(...global) - Math.min(...global);
let worst = { v: 0, i: 0, j: 0 };
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j && matrix[i][j] > worst.v) worst = { v: matrix[i][j], i, j };

if (JSON_OUT) {
  console.log(JSON.stringify({ matrix, global, spread, worst, games: GAMES, seed: SEED, patch: PATCH || null }));
} else {
  const name = (m: (typeof MOVES)[number]) => VOIE_META[m].name.padEnd(10);
  console.log(`voie-matrix — ${GAMES}×2 parties/duel, seed ${SEED}, IA ${DIFF}${PATCH ? `, patch ${PATCH}` : ""} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
  console.log(`${"".padEnd(10)} ${MOVES.map(name).join(" ")}  global`);
  for (let i = 0; i < N; i++) {
    const row = matrix[i].map((x) => (Number.isNaN(x) ? "—" : x.toFixed(1)).padEnd(10)).join(" ");
    console.log(`${name(MOVES[i])} ${row}  ${global[i].toFixed(1)}`);
  }
  console.log(`\nÉcart global (meilleure − pire) : ${spread.toFixed(1)} pts`);
  console.log(`Pire duel : ${VOIE_META[MOVES[worst.i]].name} bat ${VOIE_META[MOVES[worst.j]].name} ${worst.v.toFixed(1)} %`);
}
