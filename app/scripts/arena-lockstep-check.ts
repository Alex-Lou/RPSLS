/**
 * arena-lockstep-check — preuve du CŒUR lockstep du Constellation Pro online (Phase 3).
 *
 * Modélise deux clients qui, depuis un `shared_seed` commun, rejouent la MÊME
 * partie canonique (board a=A, b=B) sans jamais se voir : chacun résout
 * localement à partir des intents ÉCHANGÉS via le fil. On prouve la propriété
 * qui rend le mode jouable :
 *
 *   Même setup (2 decks + 2 Voies + shared_seed) + même mulligan relayé + même
 *   suite d'intents (sérialisés → parsés, comme sur le réseau)
 *      ⇒ board CANONIQUE byte-identique à CHAQUE étape, sur les 2 clients,
 *         et ZÉRO Math.random consommé pendant la résolution seedée.
 *
 * Un seul site oublié = desync silencieux 1-2 tours plus tard → ce test est le
 * garde-fou n°1 AVANT tout câblage UI. Réutilise le pattern de determinism-check.
 *
 * L'IA (cpuArenaDecision) sert UNIQUEMENT à générer des intents réalistes côté
 * « arbitre » (comme un vrai joueur produirait ses coups) — elle est un INPUT,
 * jamais rejouée par les clients (ils résolvent les intents déjà échangés).
 *
 * Usage : npx tsx app/scripts/arena-lockstep-check.ts
 */
import { makeInitialBoard, mulliganSwap } from "../src/arena/arenaRules/boardInit";
import { resolveTurn } from "../src/arena/arenaRules/resolver";
import { advanceToNextTurn } from "../src/arena/arenaRules/lifecycle";
import { buildCpuSignatureDeck } from "../src/arena/arenaDecks";
import { cpuArenaDecision } from "../src/arena/arenaAI";
import { serializeIntent, parseTurnIntent } from "../src/arena/arenaNet";
import { makeRngPair } from "../src/engine/rng";
import { TURN_HARD_CAP } from "../src/arena/arenaTypes/constants";
import type { Move } from "../src/engine/game";
import type { BoardState, TurnIntent } from "../src/arena/arenaTypes";

/* ── Piège anti-fuite (Math.random interdit pendant la résolution seedée) ── */
function withTrap<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = (() => { throw new Error("FUITE: Math.random pendant résolution seedée → desync lockstep"); }) as typeof Math.random;
  try { return fn(); } finally { Math.random = orig; }
}
/** Génère un intent d'IA de façon REPRODUCTIBLE (Math.random patché par un seed
 *  dérivé) — l'IA est un input du joueur, hors du déterminisme lockstep. */
function scriptedIntent(board: BoardState, side: "a" | "b", salt: number): TurnIntent {
  const orig = Math.random;
  let s = (0x9e3779b9 ^ salt ^ (side === "a" ? 1 : 2)) >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { return cpuArenaDecision(board, side, "hard"); } finally { Math.random = orig; }
}

const deepCopy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

interface MatchSetup {
  seed: number; voieA: Move; voieB: Move;
  mulliganA: number[]; mulliganB: number[];
}
interface RefereeTape { setup: MatchSetup; snaps: string[]; wire: { a: unknown; b: unknown }[]; winner: string }

/** Board initial + mulligan relayé, IDENTIQUE sur les 2 clients (a←rng.a, b←rng.b).
 *  C'est l'état de départ canonique que les deux camps partagent. */
function boot(setup: MatchSetup): { board: BoardState; pair: ReturnType<typeof makeRngPair> } {
  const pair = makeRngPair(setup.seed);
  let board = makeInitialBoard(
    buildCpuSignatureDeck(setup.voieA), buildCpuSignatureDeck(setup.voieB),
    setup.voieA, setup.voieB, undefined, pair,
  );
  // Mulligan relayé : chaque camp échange SES indices ; les 2 clients appliquent
  // les DEUX, chacun sur le flux de SON camp (canonical mulligan = mulliganSwap).
  board = { ...board, a: mulliganSwap(board.a, setup.mulliganA, pair.a) };
  board = { ...board, b: mulliganSwap(board.b, setup.mulliganB, pair.b) };
  return { board, pair };
}

/** ARBITRE : joue la partie, génère les intents (IA=input), les fait passer par
 *  le FIL (serialize→parse) et enregistre board+wire à chaque étape. */
function referee(setup: MatchSetup): RefereeTape {
  const { board: b0, pair } = boot(setup);
  let board = b0;
  const snaps: string[] = [JSON.stringify(board)];
  const wire: { a: unknown; b: unknown }[] = [];
  let guard = 0;
  while (board.phase === "planning" && board.turn <= TURN_HARD_CAP && guard++ < 200) {
    const iaRaw = scriptedIntent(board, "a", board.turn);
    const ibRaw = scriptedIntent(board, "b", board.turn);
    // Passage sur le FIL : sérialisation puis JSON round-trip (comme le relais).
    const aWire = JSON.parse(JSON.stringify(serializeIntent(iaRaw)));
    const bWire = JSON.parse(JSON.stringify(serializeIntent(ibRaw)));
    wire.push({ a: aWire, b: bWire });
    const iA = parseTurnIntent(aWire)!;
    const iB = parseTurnIntent(bWire)!;
    board = withTrap(() => resolveTurn(board, iA, iB, pair));
    snaps.push(JSON.stringify(board));
    if (board.phase === "match-end") break;
    board = withTrap(() => advanceToNextTurn(board, pair));
    snaps.push(JSON.stringify(board));
    if (board.phase === "match-end") break;
  }
  const winner = board.a.hp <= 0 && board.b.hp <= 0 ? "draw" : board.a.hp <= 0 ? "b" : board.b.hp <= 0 ? "a" : board.a.hp > board.b.hp ? "a" : board.b.hp > board.a.hp ? "b" : "draw";
  return { setup, snaps, wire, winner };
}

/** CLIENT : rejoue la MÊME partie à partir du seul setup + des intents reçus du
 *  fil (parseTurnIntent). Ne génère AUCUN intent, ne touche AUCUN Math.random
 *  pendant la résolution. Doit matcher l'arbitre étape par étape. */
function client(tape: RefereeTape): string[] {
  const { board: b0, pair } = boot(tape.setup);
  let board = b0;
  const snaps: string[] = [JSON.stringify(board)];
  for (const { a: aWire, b: bWire } of tape.wire) {
    const iA = parseTurnIntent(deepCopy(aWire));
    const iB = parseTurnIntent(deepCopy(bWire));
    if (!iA || !iB) { snaps.push("PARSE_FAIL"); break; }
    board = withTrap(() => resolveTurn(board, iA, iB, pair));
    snaps.push(JSON.stringify(board));
    if (board.phase === "match-end") break;
    board = withTrap(() => advanceToNextTurn(board, pair));
    snaps.push(JSON.stringify(board));
    if (board.phase === "match-end") break;
  }
  return snaps;
}

function firstDiff(x: string[], y: string[]): string | null {
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (x[i] === y[i]) continue;
    if (x[i] === undefined || y[i] === undefined) return `étape ${i}: longueurs ≠ (${x.length} vs ${y.length})`;
    let j = 0; while (j < x[i].length && x[i][j] === y[i][j]) j++;
    return `étape ${i}, char ${j}:\n    ref …${x[i].slice(Math.max(0, j - 30), j + 50)}…\n    cli …${y[i].slice(Math.max(0, j - 30), j + 50)}…`;
  }
  return null;
}

/* ── Campagne : 5 seeds × matchups variés × mulligans variés ── */
const VOIES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
const SEEDS = [3, 77, 4242, 88888, 2000000001];
let fail = 0;
console.log("── arena-lockstep-check : cœur lockstep Constellation Pro ──\n");
for (let i = 0; i < SEEDS.length; i++) {
  const setup: MatchSetup = {
    seed: SEEDS[i],
    voieA: VOIES[i % 5], voieB: VOIES[(i + 2) % 5],
    mulliganA: i % 2 === 0 ? [0, 2] : [1],   // indices de mulligan variés par camp
    mulliganB: i % 3 === 0 ? [3] : [0, 1],
  };
  const tape = referee(setup);
  // Deux clients INDÉPENDANTS rejouent depuis le fil → doivent être identiques
  // à l'arbitre ET entre eux (le camp B « voit » exactement ce que voit A).
  const c1 = client(tape);
  const c2 = client(tape);
  const d1 = firstDiff(tape.snaps, c1);
  const d2 = firstDiff(c1, c2);
  const turns = tape.wire.length;
  if (d1 || d2) {
    fail++;
    console.log(`✗ seed=${setup.seed} ${setup.voieA} vs ${setup.voieB} — DESYNC:\n  ${d1 ?? d2}`);
  } else {
    console.log(`✓ seed=${setup.seed} ${setup.voieA} vs ${setup.voieB} (mull A=[${setup.mulliganA}] B=[${setup.mulliganB}]) — ${turns} tours, ${tape.snaps.length} snaps identiques (arbitre=client1=client2), gagnant=${tape.winner}, 0 fuite`);
  }
}
console.log(`\n── Cœur lockstep : ${fail === 0 ? "IDENTIQUE DES 2 CÔTÉS ✅" : `${fail} DESYNC ❌`} ──`);
if (fail > 0) process.exitCode = 1;
