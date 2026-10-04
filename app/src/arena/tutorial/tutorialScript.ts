/**
 * tutorialScript — la partie SCRIPTÉE du tutoriel Arena Pro (logique pure).
 *
 * Partie 100 % déterministe : graine fixe, decks fixes, Voies neutres, CPU qui
 * joue des coups écrits d'avance, et le joueur guidé vers UN coup attendu par
 * tour (le coach bloque le reste). Dérouler ce script dans le moteur réel donne
 * TOUJOURS la même partie : KO au tour 4 grâce à la Surcharge (sans elle, pas
 * de KO). Vérifié en CI par scripts/arena-tutorial-check.ts — si une règle du
 * moteur change et casse le scénario, la CI le dit avant le joueur.
 *
 * Déroulé (voies 0 = gauche, 1 = milieu, 2 = droite) :
 *   T1  toi : Ciseaux au milieu (voie vide → frappe le héros)   CPU : Feuille à droite
 *   T2  toi : Ciseaux face à la Feuille (Ciseaux coupe Feuille)  CPU : Pierre au milieu
 *   T3  toi : Feuille face à la Pierre + Spock à gauche          CPU : rien
 *   T4  toi : Surcharge (+3 ATK) sur le Ciseaux de droite → KO
 */
import { makeInitialBoard } from "../arenaRules/boardInit";
import type { BoardState, PlannedSummon, PlayedSpell, TurnIntent } from "../arenaTypes";
import type { CardId } from "../../ranked/rankedTypes";
import type { Move } from "../../engine/game";
import { makeRngPair, type RngPair } from "../../engine/rng";

export const TUTORIAL_SEED = 424242;
/** PV du héros CPU : réglé pour que le KO tombe PILE au tour 4, avec Surcharge. */
export const TUTORIAL_CPU_HP = 18;
export const TUTORIAL_LAST_TURN = 4;
/** XP offerte UNE fois, à la première réussite. */
export const TUTORIAL_XP = 100;
/** Portrait du « Mentor » (adversaire du tuto). */
export const TUTORIAL_CPU_AVATAR = "/Profile miniatures/hero_sage.png";

/** 5 cartes distinctes (+ un doublon qui reste au deck) : la chute de deck du
 *  tour 4 les pose TOUTES en main (anti-doublon), quelle que soit la graine, et
 *  le deck n'est jamais vide (pas de fatigue). */
const PLAYER_DECK: CardId[] = ["surge", "precision", "aegis", "second-wind", "seve", "seve"];
const CPU_DECK: CardId[] = ["aegis", "precision", "anchor", "prescience", "mascarade", "seve", "echappee"];

const summon = (lane: 0 | 1 | 2, move: Move): PlannedSummon => ({ lane, move });
const none: TurnIntent = { spells: [], summons: [] };

const CPU_INTENTS: Record<number, TurnIntent> = {
  1: { spells: [], summons: [summon(2, "paper")] },
  2: { spells: [], summons: [summon(1, "rock")] },
};

/** Le coup ATTENDU du joueur, tour par tour (seul coup autorisé par le coach). */
export const TUTORIAL_PLAYER_INTENTS: Record<number, TurnIntent> = {
  1: { spells: [], summons: [summon(1, "scissors")] },
  2: { spells: [], summons: [summon(2, "scissors")] },
  3: { spells: [], summons: [summon(1, "paper"), summon(0, "spock")] },
  4: { spells: [{ id: "surge", kind: "lane", lane: 2 }], summons: [] },
};

export function tutorialRngPair(): RngPair {
  return makeRngPair(TUTORIAL_SEED);
}

/** Board de départ du tuto (camp a = joueur, b = Mentor). */
export function makeTutorialBoard(rng: RngPair): BoardState {
  const b = makeInitialBoard(PLAYER_DECK, CPU_DECK, undefined, undefined, undefined, rng);
  return { ...b, b: { ...b.b, hp: TUTORIAL_CPU_HP, maxHp: TUTORIAL_CPU_HP } };
}

export function tutorialCpuIntent(turn: number): TurnIntent {
  return CPU_INTENTS[turn] ?? none;
}

function sameSpell(a: PlayedSpell, b: PlayedSpell): boolean {
  return a.id === b.id && a.kind === b.kind && (a.kind !== "lane" || (b.kind === "lane" && a.lane === b.lane));
}

/** Retire de l'intent tout ce qui n'est pas dans le coup attendu (glisser un
 *  symbole sur la mauvaise voie, etc.). Renvoie null si l'intent est déjà
 *  propre — l'appelant ne réécrit l'état QUE s'il y a quelque chose à corriger. */
export function sanitizeTutorialIntent(turn: number, intent: TurnIntent): TurnIntent | null {
  const expected = TUTORIAL_PLAYER_INTENTS[turn] ?? none;
  const summons = intent.summons.filter((s) =>
    expected.summons.some((e) => e.lane === s.lane && e.move === s.move));
  const spells = intent.spells.filter((s) => expected.spells.some((e) => sameSpell(e, s)));
  if (summons.length === intent.summons.length && spells.length === intent.spells.length) return null;
  return { spells, summons };
}
