/**
 * arena-tutorial-check — le scénario du tutoriel Arena Pro tient-il toujours ?
 *
 * Le tuto est une partie SCRIPTÉE (graine + decks + coups fixes). Ses textes
 * promettent un déroulé précis (« ta créature frappe le héros », « Surcharge =
 * coup de grâce »). Si une règle du moteur change, le scénario peut dérailler
 * en silence (KO trop tôt, pas de KO, carte absente de la main…). Ce contrôle
 * rejoue le script dans le VRAI moteur et vérifie chaque promesse.
 *
 * Usage : npx tsx app/scripts/arena-tutorial-check.ts
 */
import { resolveTurn } from "../src/arena/arenaRules/resolver";
import { advanceToNextTurn } from "../src/arena/arenaRules/lifecycle";
import { prepareResolveStart } from "../src/arena/ArenaGame/arenaResolvePrep";
import {
  TUTORIAL_CPU_HP, TUTORIAL_LAST_TURN, TUTORIAL_PLAYER_INTENTS,
  makeTutorialBoard, sanitizeTutorialIntent, tutorialCpuIntent, tutorialRngPair,
} from "../src/arena/tutorial/tutorialScript";
import type { BoardState, TurnIntent } from "../src/arena/arenaTypes";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) console.log(`  ok  ${msg}`);
  else { failures++; console.error(`  ÉCHEC  ${msg}`); }
}

function withTrap<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = (() => { throw new Error("Math.random pendant le tuto → partie non déterministe"); }) as typeof Math.random;
  try { return fn(); } finally { Math.random = orig; }
}

/** Joue le tuto ; `override` remplace le coup du joueur à un tour donné. */
function play(override?: { turn: number; intent: TurnIntent }): { board: BoardState; hpAtTurnStart: number[] } {
  const rng = tutorialRngPair();
  let board = withTrap(() => makeTutorialBoard(rng));
  const hpAtTurnStart: number[] = [];
  while (board.phase === "planning" && board.turn <= TUTORIAL_LAST_TURN + 1) {
    hpAtTurnStart[board.turn] = board.b.hp;
    const mine = override?.turn === board.turn ? override.intent : (TUTORIAL_PLAYER_INTENTS[board.turn] ?? { spells: [], summons: [] });
    const cur = board;
    const { startBoard, safeIntent, safeCpuIntent } = prepareResolveStart(cur, mine, tutorialCpuIntent(cur.turn), "a");
    board = withTrap(() => resolveTurn(startBoard, safeIntent, safeCpuIntent, rng));
    if (board.phase === "match-end") break;
    const next = board;
    board = withTrap(() => advanceToNextTurn(next, rng));
  }
  return { board, hpAtTurnStart };
}

console.log("== Scénario du tuto");
const start = makeTutorialBoard(tutorialRngPair());
check(start.b.hp === TUTORIAL_CPU_HP && start.a.hp === 20, `départ : toi 20 ❤, Mentor ${TUTORIAL_CPU_HP} ❤`);

const main = play();
check(main.board.phase === "match-end", "la partie se termine");
check(main.board.turn === TUTORIAL_LAST_TURN, `KO au tour ${TUTORIAL_LAST_TURN} (obtenu : tour ${main.board.turn})`);
check(main.board.b.hp <= 0 && main.board.a.hp > 0, "le joueur gagne");
check(main.hpAtTurnStart[2] === TUTORIAL_CPU_HP - 4, "T1 : le Ciseaux sur voie vide frappe le héros (−4)");

// Main du tour 4 : la Surcharge doit y être (sinon l'étape « joue Surcharge » bloque).
{
  const rng = tutorialRngPair();
  let b = makeTutorialBoard(rng);
  for (let t = 1; t < TUTORIAL_LAST_TURN; t++) {
    const cur = b;
    const p = prepareResolveStart(cur, TUTORIAL_PLAYER_INTENTS[t], tutorialCpuIntent(t), "a");
    b = advanceToNextTurn(resolveTurn(p.startBoard, p.safeIntent, p.safeCpuIntent, rng), rng);
  }
  check(b.a.hand.includes("surge"), `T4 : Surcharge en main (${b.a.hand.join(", ")})`);
  check(b.a.mana >= 2, "T4 : assez de mana pour Surcharge");
  check(b.lanes[2].a?.move === "scissors", "T4 : le Ciseaux de droite est vivant (cible de Surcharge)");
  check(b.lanes[1].b === null && b.lanes[2].b === null, "T4 : voies adverses vides (la Pierre est tombée)");
}

const noSurge = play({ turn: TUTORIAL_LAST_TURN, intent: { spells: [], summons: [] } });
check(!(noSurge.board.phase === "match-end" && noSurge.board.turn === TUTORIAL_LAST_TURN),
  "sans Surcharge, pas de KO au tour 4 (la carte est bien le coup de grâce)");

console.log("== Garde-fou des coups");
check(sanitizeTutorialIntent(1, TUTORIAL_PLAYER_INTENTS[1]) === null, "le coup attendu passe tel quel");
const stray = sanitizeTutorialIntent(1, { spells: [], summons: [{ lane: 0, move: "scissors" }, { lane: 1, move: "scissors" }] });
check(!!stray && stray.summons.length === 1 && stray.summons[0].lane === 1, "un symbole posé sur la mauvaise voie est retiré");

if (failures > 0) {
  console.error(`\n${failures} échec(s) : le scénario du tuto ne tient plus — ajuster tutorialScript.ts.`);
  process.exit(1);
}
console.log("\nScénario du tuto OK.");
