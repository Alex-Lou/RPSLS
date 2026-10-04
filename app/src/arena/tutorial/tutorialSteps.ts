/**
 * tutorialSteps — les bulles du coach, tour par tour.
 *
 * Deux sortes d'étapes :
 *  - « info » : explication, le joueur touche « Continuer » (tout le reste est bloqué) ;
 *  - « action » : un seul élément est touchable (le trou du projecteur), l'étape
 *    est franchie quand `done` devient vrai (état du jeu, pas un clic).
 * L'étape courante est DÉRIVÉE de l'état (cf. ArenaTutorialCoach) : si le joueur
 * annule un ciblage, le coach revient tout seul à l'étape précédente.
 *
 * Cibles = sélecteurs CSS posés sur l'UI existante (data-tut / data-arena-lane).
 */
import type { ArenaTargeting, TurnIntent } from "../arenaTypes";
import type { Move } from "../../engine/game";
import type { CardId } from "../../ranked/rankedTypes";

export interface TutCtx {
  intent: TurnIntent;
  targeting: ArenaTargeting;
}

export interface TutStep {
  id: string;
  /** Clé i18n du texte de la bulle. */
  textKey: string;
  /** Sélecteur de l'élément mis en lumière ; null = bulle centrée, sans trou. */
  target: string | null;
  kind: "info" | "action";
  done?: (c: TutCtx) => boolean;
}

const MOVE = (m: Move) => `[data-tut="move-${m}"]`;
const LANE = (side: "a" | "b", lane: number) => `[data-arena-lane="${lane}"][data-arena-side="${side}"]`;
const CARD = (id: CardId) => `[data-tut="card-${id}"]`;
const HERO_OPP = `[data-tut="hero-opp"]`;
const HERO_YOU = `[data-tut="hero-you"]`;
const LOCK = `[data-tut="lock"]`;

const hasSummon = (c: TutCtx, lane: number, move: Move) =>
  c.intent.summons.some((s) => s.lane === lane && s.move === move);
const targetingMove = (c: TutCtx, move: Move) =>
  c.targeting?.kind === "summon" && c.targeting.move === move;
const hasLaneSpell = (c: TutCtx, id: CardId, lane: number) =>
  c.intent.spells.some((s) => s.id === id && s.kind === "lane" && s.lane === lane);

/** Étapes « choisir un symbole puis une voie » (le cœur du geste d'invocation). */
function summonSteps(prefix: string, move: Move, lane: number, pickKey: string, placeKey: string): TutStep[] {
  return [
    {
      id: `${prefix}-pick`, textKey: pickKey, target: MOVE(move), kind: "action",
      done: (c) => targetingMove(c, move) || hasSummon(c, lane, move),
    },
    {
      id: `${prefix}-place`, textKey: placeKey, target: LANE("a", lane), kind: "action",
      done: (c) => hasSummon(c, lane, move),
    },
  ];
}

const lock = (turn: number): TutStep => ({
  id: `t${turn}-lock`, textKey: `tut.t${turn}.lock`, target: LOCK, kind: "action",
  // Franchie par le verrouillage lui-même (le coach se retire pendant la résolution).
  done: () => false,
});

export const TUTORIAL_STEPS: Record<number, TutStep[]> = {
  1: [
    { id: "t1-welcome", textKey: "tut.t1.welcome", target: null, kind: "info" },
    { id: "t1-opp", textKey: "tut.t1.opp", target: HERO_OPP, kind: "info" },
    { id: "t1-you", textKey: "tut.t1.you", target: HERO_YOU, kind: "info" },
    ...summonSteps("t1", "scissors", 1, "tut.t1.pick", "tut.t1.place"),
    lock(1),
  ],
  2: [
    { id: "t2-hit", textKey: "tut.t2.hit", target: HERO_OPP, kind: "info" },
    { id: "t2-paper", textKey: "tut.t2.paper", target: LANE("b", 2), kind: "info" },
    ...summonSteps("t2", "scissors", 2, "tut.t2.pick", "tut.t2.place"),
    lock(2),
  ],
  3: [
    { id: "t3-rock", textKey: "tut.t3.rock", target: LANE("b", 1), kind: "info" },
    { id: "t3-cut", textKey: "tut.t3.cut", target: LANE("a", 2), kind: "info" },
    { id: "t3-mana", textKey: "tut.t3.mana", target: HERO_YOU, kind: "info" },
    ...summonSteps("t3a", "paper", 1, "tut.t3.pickPaper", "tut.t3.placePaper"),
    ...summonSteps("t3b", "spock", 0, "tut.t3.pickSpock", "tut.t3.placeSpock"),
    lock(3),
  ],
  4: [
    { id: "t4-cards", textKey: "tut.t4.cards", target: CARD("surge"), kind: "info" },
    {
      id: "t4-pick", textKey: "tut.t4.pick", target: CARD("surge"), kind: "action",
      done: (c) => (c.targeting?.kind === "spell" && c.targeting.id === "surge") || hasLaneSpell(c, "surge", 2),
    },
    {
      id: "t4-aim", textKey: "tut.t4.aim", target: LANE("a", 2), kind: "action",
      done: (c) => hasLaneSpell(c, "surge", 2),
    },
    { id: "t4-finish", textKey: "tut.t4.finish", target: HERO_OPP, kind: "info" },
    lock(4),
  ],
};

/** Légende courte affichée PENDANT la résolution (non bloquante). */
export const TUTORIAL_RESOLVE_CAPTION: Record<number, string> = {
  1: "tut.t1.resolve",
  2: "tut.t2.resolve",
  3: "tut.t3.resolve",
  4: "tut.t4.resolve",
};
