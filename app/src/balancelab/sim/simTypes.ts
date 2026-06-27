/**
 * simTypes — contrat entre le moteur de sim (runMatch/aggregate) et l'UI du Lab.
 * Pur TS, sérialisable (prêt à passer dans un Web Worker plus tard si besoin).
 */
import type { Move } from "../../engine/game";

export type Diff = "easy" | "normal" | "hard";

export const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

/** Étiquette FR + couleur (var CSS) par Voie — source unique pour toute la viz. */
export const VOIE_META: Record<Move, { name: string; cssVar: string }> = {
  rock: { name: "Montagne", cssVar: "--voie-rock" },
  paper: { name: "Forêt", cssVar: "--voie-paper" },
  scissors: { name: "Tranchant", cssVar: "--voie-scissors" },
  lizard: { name: "Mirage", cssVar: "--voie-lizard" },
  spock: { name: "Cosmos", cssVar: "--voie-spock" },
};

/** Résultat d'UNE partie headless (trace minimale pour l'agrégation). */
export interface MatchTrace {
  winner: "a" | "b" | "draw";
  turns: number;
  voieA: Move;
  voieB: Move;
  hpAByTurn: number[]; // PV du héros A indexé par tour (0 = départ)
  hpBByTurn: number[];
  finisherA: boolean;
  finisherB: boolean;
}

/** Stats agrégées d'UNE Voie sur tout un batch (toutes positions/adversaires). */
export interface VoieStats {
  move: Move;
  games: number;
  wins: number;
  draws: number;
  winRate: number; // 0..1
  avgTurns: number;
  avgFinalHp: number;
  avgDmgDealt: number; // 20 - PV final adverse moyen
  finisherFireRate: number; // 0..1 — % parties où l'engine a maxé (finisher débloqué)
  hpByTurn: number[]; // PV moyen de cette Voie, indexé par tour
  vsWinRate: Partial<Record<Move, number>>; // win-rate symétrisé vs chaque autre Voie (0..1)
  byBucket: { early: number; mid: number; late: number }; // win-rate selon la durée de partie
}

/** Sortie complète d'un run de sim. */
export interface SimResult {
  stats: VoieStats[];
  matchupMatrix: number[][]; // [attaquant i][défenseur j] = win-rate % de i vs j (0..100)
  meta: { ms: number; seed: number; games: number };
}

/** Réglages d'un run (le futur point d'ancrage des sliders). */
export interface SimOptions {
  games: number;
  seed: number;
  diff: Diff;
  fixedSeed: boolean; // true = reproductible (delta lisible), false = variance Monte-Carlo
}

export const DEFAULT_SIM_OPTIONS: SimOptions = {
  games: 4000,
  seed: 1337,
  diff: "hard",
  fixedSeed: true,
};
