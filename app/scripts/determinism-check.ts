/**
 * determinism-check — preuve d'acceptation Phase 0 (lockstep Constellation Pro online).
 *
 * Vérifie les 3 invariants du threading RNG (cf. CONSTELLATION-PRO-ONLINE-SCOPING.md §7
 * Phase 0 + engine/rng.ts) SANS toucher au chemin live :
 *
 *  1. REPLAY BYTE-IDENTIQUE — même seed + mêmes intents ⇒ même suite de BoardState
 *     (JSON strictement égal à chaque étape). C'est LA garantie lockstep : deux
 *     clients qui partagent le shared_seed rejouent la même partie.
 *  2. ZÉRO FUITE Math.random — pendant makeInitialBoard/resolveTurn/advanceToNextTurn
 *     avec une RngPair fournie, Math.random est PIÉGÉ (throw). Un seul site de
 *     résolution non threadé = crash immédiat ici, au lieu d'un desync silencieux
 *     1-2 tours plus tard en prod.
 *  3. LA GRAINE MORD — seed S et S+1 produisent des boards initiaux différents
 *     (le seeding n'est pas un no-op).
 *
 *  + smoke SANS pair : le défaut Math.random reste opérationnel (chemin vs-CPU/sim
 *    inchangé — le threading est additif).
 *
 * L'IA (cpuArenaDecision) reste HORS piège : c'est un INPUT (comme un joueur
 * humain), jamais seedée — en online l'intent adverse vient du réseau. On
 * enregistre ses intents au run 1 et on les REJOUE au run 2.
 *
 * Usage :  npx tsx app/scripts/determinism-check.ts
 * (hors tsconfig include:["src"] → n'entre pas dans le build ; imports = les mêmes
 *  chemins purs/headless que balancelab/sim/runMatch.ts, prouvés sans dépendance UI.)
 */
import { makeInitialBoard } from "../src/arena/arenaRules/boardInit";
import { resolveTurn } from "../src/arena/arenaRules/resolver";
import { advanceToNextTurn } from "../src/arena/arenaRules/lifecycle";
import { buildCpuSignatureDeck } from "../src/arena/arenaDecks";
import { cpuArenaDecision } from "../src/arena/arenaAI";
import { TURN_HARD_CAP } from "../src/arena/arenaTypes/constants";
import { makeRngPair } from "../src/engine/rng";
import type { Move } from "../src/engine/game";
import type { CpuPersona, TurnIntent } from "../src/arena/arenaTypes";

/* ── Piège anti-fuite ─────────────────────────────────────────────────────── */

const trap = (): number => {
  throw new Error(
    "FUITE DÉTERMINISME : Math.random() appelé pendant une résolution SEEDÉE " +
    "(site non threadé → desync lockstep). Stack ↓",
  );
};

/** Exécute `fn` avec Math.random piégé — toute consommation non-seedée throw. */
function withTrap<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = trap as typeof Math.random;
  try { return fn(); } finally { Math.random = orig; }
}

/* ── Une partie seedée, enregistrable et rejouable ────────────────────────── */

interface TurnRec { intentA: TurnIntent; intentB: TurnIntent; }
interface GameRun { snaps: string[]; recorded: TurnRec[] }

const deepCopy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * Joue une partie complète avec une RngPair(seed). `script` absent = run 1
 * (l'IA décide, intents enregistrés) ; présent = run 2 (replay des intents).
 * Toute la résolution tourne SOUS PIÈGE. Retourne un snapshot JSON du board
 * après CHAQUE étape (init / resolveTurn / advanceToNextTurn).
 */
function playGame(seed: number, voieA: Move, voieB: Move, persona: CpuPersona, script?: TurnRec[]): GameRun {
  const pair = makeRngPair(seed);
  const deckA = buildCpuSignatureDeck(voieA);
  const deckB = buildCpuSignatureDeck(voieB);
  let board = withTrap(() => makeInitialBoard(deckA, deckB, voieA, voieB, persona, pair));
  // Symétrise le persona sur A (makeInitialBoard ne le pose que sur B) — même
  // convention que balancelab/sim/runMatch.ts.
  board = { ...board, a: { ...board.a, cpuPersona: persona } };

  const snaps: string[] = [JSON.stringify(board)];
  const recorded: TurnRec[] = [];
  let guard = 0;

  while (board.phase === "planning" && board.turn <= TURN_HARD_CAP && guard++ < 200) {
    let ia: TurnIntent;
    let ib: TurnIntent;
    if (script) {
      const rec = script[recorded.length];
      if (!rec) break; // script épuisé (ne doit arriver que si le replay diverge — détecté par snaps)
      ia = deepCopy(rec.intentA);
      ib = deepCopy(rec.intentB);
    } else {
      // IA HORS piège : input libre (Math.random autorisé), comme un joueur.
      ia = cpuArenaDecision(board, "a", "hard");
      ib = cpuArenaDecision(board, "b", "hard");
    }
    recorded.push({ intentA: deepCopy(ia), intentB: deepCopy(ib) });

    board = withTrap(() => resolveTurn(board, ia, ib, pair));
    snaps.push(JSON.stringify(board));
    if (board.phase === "match-end") break;

    board = withTrap(() => advanceToNextTurn(board, pair));
    snaps.push(JSON.stringify(board));
    if (board.phase === "match-end") break;
  }
  return { snaps, recorded };
}

/* ── Comparaison + rapport ────────────────────────────────────────────────── */

/** Première divergence entre deux runs ; null si byte-identiques. */
function firstDivergence(r1: GameRun, r2: GameRun): string | null {
  const n = Math.max(r1.snaps.length, r2.snaps.length);
  for (let i = 0; i < n; i++) {
    const a = r1.snaps[i];
    const b = r2.snaps[i];
    if (a === b) continue;
    if (a === undefined || b === undefined) {
      return `étape ${i} : longueurs différentes (run1=${r1.snaps.length} étapes, run2=${r2.snaps.length})`;
    }
    let j = 0;
    while (j < a.length && j < b.length && a[j] === b[j]) j++;
    const ctx = (s: string): string => s.slice(Math.max(0, j - 40), j + 60);
    return `étape ${i}, char ${j} :\n    run1 …${ctx(a)}…\n    run2 …${ctx(b)}…`;
  }
  return null;
}

/* ── Campagne ─────────────────────────────────────────────────────────────── */

const VOIES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
const PERSONAS: CpuPersona[] = ["tactician", "aggressor", "builder", "defender"];
const SEEDS = [7, 42, 1337, 99991, 2147483647];

let failures = 0;
let games = 0;

console.log("── determinism-check : Phase 0 lockstep Constellation Pro ──\n");

for (let s = 0; s < SEEDS.length; s++) {
  const seed = SEEDS[s];
  // Ring des 5 Voies : chaque seed teste un matchup différent → couverture
  // large des kits de cartes (draws, cast-on-draw, vols, globaux…).
  const voieA = VOIES[s % VOIES.length];
  const voieB = VOIES[(s + 1) % VOIES.length];
  const persona = PERSONAS[s % PERSONAS.length];
  games++;

  // 1+2. REPLAY BYTE-IDENTIQUE sous piège anti-fuite.
  const run1 = playGame(seed, voieA, voieB, persona);
  const run2 = playGame(seed, voieA, voieB, persona, run1.recorded);
  const div = firstDivergence(run1, run2);
  const turns = run1.recorded.length;
  if (div) {
    failures++;
    console.log(`✗ seed=${seed} ${voieA} vs ${voieB} (${persona}) — DIVERGENCE au replay :\n  ${div}`);
  } else {
    console.log(`✓ seed=${seed} ${voieA} vs ${voieB} (${persona}) — ${turns} tours, ${run1.snaps.length} snapshots byte-identiques, 0 fuite Math.random`);
  }

  // 3. LA GRAINE MORD : board initial S vs S+1 différent.
  const initS = withTrap(() => JSON.stringify(makeInitialBoard(
    buildCpuSignatureDeck(voieA), buildCpuSignatureDeck(voieB), voieA, voieB, persona, makeRngPair(seed))));
  const initS1 = withTrap(() => JSON.stringify(makeInitialBoard(
    buildCpuSignatureDeck(voieA), buildCpuSignatureDeck(voieB), voieA, voieB, persona, makeRngPair(seed + 1))));
  if (initS === initS1) {
    failures++;
    console.log(`✗ seed=${seed} : seed et seed+1 donnent le MÊME board initial (le seeding ne mord pas)`);
  }
}

// Smoke SANS pair : le défaut Math.random reste opérationnel (chemin vs-CPU/sim).
try {
  let board = makeInitialBoard(buildCpuSignatureDeck("rock"), buildCpuSignatureDeck("paper"), "rock", "paper", "tactician");
  board = { ...board, a: { ...board.a, cpuPersona: "tactician" } };
  let guard = 0;
  while (board.phase === "planning" && board.turn <= TURN_HARD_CAP && guard++ < 200) {
    const ia = cpuArenaDecision(board, "a", "hard");
    const ib = cpuArenaDecision(board, "b", "hard");
    board = resolveTurn(board, ia, ib); // AUCUNE pair → défauts Math.random
    if (board.phase === "match-end") break;
    board = advanceToNextTurn(board);
    if (board.phase === "match-end") break;
  }
  console.log(`✓ smoke sans pair — partie complète en ${board.turn} tours sur le défaut Math.random (chemin vs-CPU intact)`);
} catch (e) {
  failures++;
  console.log(`✗ smoke sans pair : le chemin par défaut a crashé — ${(e as Error).message}`);
}

console.log(`\n── Résultat : ${games} parties seedées ×2 runs — ${failures === 0 ? "TOUT EST DÉTERMINISTE ✅" : `${failures} ÉCHEC(S) ❌`} ──`);
if (failures > 0) process.exitCode = 1;
