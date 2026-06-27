/**
 * runMatch — UNE partie Constellation Pro headless, 100% pure.
 *
 * Pipeline de référence (unit-testable) du résolveur — JAMAIS la live path
 * (arenaResolverFlow), donc aucune anim, aucun rAF, aucun timing. Les deux
 * camps sont pilotés par l'IA réelle (cpuArenaDecision). Déterminisme via le
 * patch Math.random seedé (voir prng.ts) posé AUTOUR de l'appel.
 *
 * Imports volontairement identiques au simulateur headless validé (_voie_sim) :
 * ces chemins sont prouvés purs (le bundle node tournait sans dépendance UI).
 */
import { makeInitialBoard } from "../../arena/arenaRules/boardInit";
import { buildCpuSignatureDeck } from "../../arena/arenaDecks";
import { cpuArenaDecision } from "../../arena/arenaAI";
import { resolveTurn } from "../../arena/arenaRules/resolver";
import { advanceToNextTurn, matchResult } from "../../arena/arenaRules/lifecycle";
import { TURN_HARD_CAP } from "../../arena/arenaTypes/constants";
import type { Move } from "../../engine/game";
import type { CpuPersona } from "../../arena/arenaTypes";
import { patchRandom, restoreRandom } from "./prng";
import type { Diff, MatchTrace } from "./simTypes";

const PERSONAS: CpuPersona[] = ["tactician", "aggressor", "builder", "defender"];

/** Joue 1 partie voieA vs voieB. `seed` rend le shuffle/pioche reproductible. */
export function runMatch(voieA: Move, voieB: Move, diff: Diff, seed: number): MatchTrace {
  patchRandom(seed);
  try {
    // Persona symétrique tiré du PRNG seedé (même persona des 2 côtés → pas de
    // biais de tempérament ; le déséquilibre mesuré vient des Voies, pas de l'IA).
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    let board = makeInitialBoard(
      buildCpuSignatureDeck(voieA),
      buildCpuSignatureDeck(voieB),
      voieA,
      voieB,
      persona,
    );
    // makeInitialBoard ne pose le persona que sur B → symétriser sur A.
    board = { ...board, a: { ...board.a, cpuPersona: persona } };

    const hpA: number[] = [board.a.hp];
    const hpB: number[] = [board.b.hp];
    let guard = 0;

    while (board.phase === "planning" && board.turn <= TURN_HARD_CAP && guard++ < 200) {
      const ia = cpuArenaDecision(board, "a", diff);
      const ib = cpuArenaDecision(board, "b", diff);
      board = resolveTurn(board, ia, ib);
      if (board.phase === "match-end") break;
      board = advanceToNextTurn(board);
      hpA.push(board.a.hp);
      hpB.push(board.b.hp);
      if (board.phase === "match-end") break;
    }

    const r = matchResult(board);
    let winner: "a" | "b" | "draw";
    if (r) winner = r.winner;
    else winner = board.a.hp > board.b.hp ? "a" : board.b.hp > board.a.hp ? "b" : "draw"; // hard-cap → PV

    return {
      winner,
      turns: board.turn,
      voieA,
      voieB,
      hpAByTurn: hpA,
      hpBByTurn: hpB,
      finisherA: !!board.a.finisherUnlocked,
      finisherB: !!board.b.finisherUnlocked,
    };
  } finally {
    restoreRandom();
  }
}
