/**
 * arena-online-check — preuve END-TO-END du modèle Pro online (hors React).
 *
 * Simule DEUX clients complets reliés par un faux relais (miroir du ccg_engine),
 * en passant par TOUTE la pile online réelle : ArenaOnlineSession → driver
 * (makeArenaOnlineDriver, avec serialize/parse) → moteur (makeInitialBoard +
 * resolveTurn + advanceToNextTurn), depuis un shared_seed commun.
 *
 * On rejoue une partie : échange des decks (round 0), puis chaque tour chaque
 * client génère l'intent de SON camp, l'échange via son driver, et résout
 * CANONIQUEMENT. On prouve que les deux boards restent byte-identiques à chaque
 * tour — c'est-à-dire que la couche réseau (session+driver+relais) ne casse pas
 * le déterminisme prouvé par arena-lockstep-check. C'est la vérif la plus proche
 * du vrai jeu à deux qu'on puisse faire sans device (il ne manque que l'UI React).
 *
 * Usage : npx tsx app/scripts/arena-online-check.ts
 */
import { makeInitialBoard } from "../src/arena/arenaRules/boardInit";
import { resolveTurn } from "../src/arena/arenaRules/resolver";
import { advanceToNextTurn } from "../src/arena/arenaRules/lifecycle";
import { buildCpuSignatureDeck } from "../src/arena/arenaDecks";
import { cpuArenaDecision } from "../src/arena/arenaAI";
import { makeRngPair, type RngPair } from "../src/engine/rng";
import { ArenaOnlineSession } from "../src/arena/arenaOnlineSession";
import { makeArenaOnlineDriver } from "../src/arena/arenaOnlineDriver";
import { hashBoard } from "../src/arena/arenaNet";
import { TURN_HARD_CAP } from "../src/arena/arenaTypes/constants";
import type { ClientMessage, ServerMessage } from "../src/online/online";
import type { Move } from "../src/engine/game";
import type { BoardState, TurnIntent } from "../src/arena/arenaTypes";

/* ── Faux relais (miroir ccg_engine) : apparie les ccg_turn par round ── */
class FakeRelay {
  private turns: Record<number, { a?: unknown; b?: unknown }> = {};
  private dA!: (m: ServerMessage) => void;
  private dB!: (m: ServerMessage) => void;
  wire(dA: (m: ServerMessage) => void, dB: (m: ServerMessage) => void) { this.dA = dA; this.dB = dB; }
  from(who: "a" | "b", msg: ClientMessage) {
    if (msg.type !== "ccg_turn") return;
    const slot = this.turns[msg.round_no] ?? (this.turns[msg.round_no] = {});
    slot[who] = msg.intent;
    if (slot.a !== undefined && slot.b !== undefined) {
      this.dA({ type: "ccg_turn_relay", from: "b", round_no: msg.round_no, intent: slot.b as never });
      this.dB({ type: "ccg_turn_relay", from: "a", round_no: msg.round_no, intent: slot.a as never });
      delete this.turns[msg.round_no];
    }
  }
}

/** Intent d'IA REPRODUCTIBLE (Math.random patché) — l'IA est un input joueur. */
function scriptedIntent(board: BoardState, side: "a" | "b", salt: number): TurnIntent {
  const orig = Math.random;
  let s = (0x85ebca6b ^ salt ^ (side === "a" ? 1 : 2)) >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { return cpuArenaDecision(board, side, "hard"); } finally { Math.random = orig; }
}

const trap = <T>(fn: () => T): T => {
  const orig = Math.random;
  Math.random = (() => { throw new Error("FUITE Math.random pendant résolution online seedée"); }) as typeof Math.random;
  try { return fn(); } finally { Math.random = orig; }
};

/** Construit le board CANONIQUE côté d'un client (mon deck sur mySide, celui de
 *  l'adversaire sur oppSide) — exactement la logique de ArenaGame. */
function buildCanonicalBoard(mySide: "a" | "b", myDeck: string[], myAff: Move, oppDeck: string[], oppAff: Move, pair: RngPair): BoardState {
  const deckA = mySide === "a" ? myDeck : oppDeck;
  const deckB = mySide === "a" ? oppDeck : myDeck;
  const affA = mySide === "a" ? myAff : oppAff;
  const affB = mySide === "a" ? oppAff : myAff;
  return makeInitialBoard(deckA, deckB, affA, affB, undefined, pair);
}

async function playOnline(seed: number, voieA: Move, voieB: Move): Promise<{ diff: string | null; turns: number }> {
  // Deux sessions reliées par le faux relais.
  const relay = new FakeRelay();
  const sA = new ArenaOnlineSession((m) => relay.from("a", m), { winTo: 1, rulesetHash: "h" });
  const sB = new ArenaOnlineSession((m) => relay.from("b", m), { winTo: 1, rulesetHash: "h" });
  relay.wire((m) => sA.handle(m), (m) => sB.handle(m));

  // Handshake : chaque client reçoit son camp + la MÊME graine.
  const mfA = sA.waitMatchFound(); const mfB = sB.waitMatchFound();
  sA.handle({ type: "ccg_match_found", match_id: "m", opponent: { nickname: "B" }, you_are: "a", win_to: 1, shared_seed: seed });
  sB.handle({ type: "ccg_match_found", match_id: "m", opponent: { nickname: "A" }, you_are: "b", win_to: 1, shared_seed: seed });
  await Promise.all([mfA, mfB]);

  // Decks : chacun connaît le sien ; échange (round 0) pour obtenir celui d'en face.
  const deckAOwn = buildCpuSignatureDeck(voieA);
  const deckBOwn = buildCpuSignatureDeck(voieB);
  const [oppForA, oppForB] = await Promise.all([
    sA.exchange(0, { deck: deckAOwn, affinity: voieA }),
    sB.exchange(0, { deck: deckBOwn, affinity: voieB }),
  ]);
  const setupA = oppForA as { deck: string[]; affinity: Move };
  const setupB = oppForB as { deck: string[]; affinity: Move };

  // Drivers + boards canoniques (graine partagée → paires identiques).
  const drvA = makeArenaOnlineDriver(sA, { mySide: "a", rngPair: makeRngPair(seed), oppName: "B", oppDeck: setupA.deck, oppAffinity: setupA.affinity });
  const drvB = makeArenaOnlineDriver(sB, { mySide: "b", rngPair: makeRngPair(seed), oppName: "A", oppDeck: setupB.deck, oppAffinity: setupB.affinity });
  let boardA = trap(() => buildCanonicalBoard("a", deckAOwn, voieA, drvA.oppDeck, drvA.oppAffinity, drvA.rngPair));
  let boardB = trap(() => buildCanonicalBoard("b", deckBOwn, voieB, drvB.oppDeck, drvB.oppAffinity, drvB.rngPair));

  const snapsA = [JSON.stringify(boardA)];
  const snapsB = [JSON.stringify(boardB)];
  let guard = 0;
  while (boardA.phase === "planning" && boardA.turn <= TURN_HARD_CAP && guard++ < 200) {
    const turn = boardA.turn;
    // Chaque client génère l'intent de SON camp (sur le board canonique commun).
    const aIntent = scriptedIntent(boardA, "a", turn);
    const bIntent = scriptedIntent(boardB, "b", turn);
    // Échange via les drivers (serialize→relais→parse) + hash d'état (anti-triche
    // Phase 4). En lockstep honnête, hashBoard(boardA) == hashBoard(boardB).
    const [aGotOpp, bGotOpp] = await Promise.all([
      drvA.exchangeIntent(turn, aIntent, hashBoard(boardA)),
      drvB.exchangeIntent(turn, bIntent, hashBoard(boardB)),
    ]);
    // Résolution CANONIQUE de chaque côté : A(mySide=a)→(aIntent,aGotOpp) ;
    // B(mySide=b)→(bGotOpp,bIntent). aGotOpp==bIntent, bGotOpp==aIntent ⇒ mêmes inputs.
    // noSuddenDeath = true comme en vrai online (ArenaGame : !!online) → double KO
    // (combat OU fatigue) tranché à l'identique des deux côtés, jamais de mort subite.
    boardA = trap(() => resolveTurn(boardA, aIntent, aGotOpp, drvA.rngPair, { noSuddenDeath: true }));
    boardB = trap(() => resolveTurn(boardB, bGotOpp, bIntent, drvB.rngPair, { noSuddenDeath: true }));
    snapsA.push(JSON.stringify(boardA)); snapsB.push(JSON.stringify(boardB));
    if (boardA.phase === "match-end" || boardB.phase === "match-end") break;
    boardA = trap(() => advanceToNextTurn(boardA, drvA.rngPair, { noSuddenDeath: true }));
    boardB = trap(() => advanceToNextTurn(boardB, drvB.rngPair, { noSuddenDeath: true }));
    snapsA.push(JSON.stringify(boardA)); snapsB.push(JSON.stringify(boardB));
    if (boardA.phase === "match-end" || boardB.phase === "match-end") break;
  }

  // Comparaison étape par étape.
  const n = Math.max(snapsA.length, snapsB.length);
  for (let i = 0; i < n; i++) {
    if (snapsA[i] === snapsB[i]) continue;
    if (snapsA[i] === undefined || snapsB[i] === undefined) return { diff: `étape ${i}: longueurs ≠`, turns: boardA.turn };
    let j = 0; while (j < snapsA[i].length && snapsA[i][j] === snapsB[i][j]) j++;
    return { diff: `étape ${i}, char ${j}:\n    A …${snapsA[i].slice(Math.max(0, j - 30), j + 50)}…\n    B …${snapsB[i].slice(Math.max(0, j - 30), j + 50)}…`, turns: boardA.turn };
  }
  return { diff: null, turns: boardA.turn };
}

const VOIES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
const SEEDS = [11, 505, 90909, 12345678, 2100000001];
let fail = 0;
console.log("── arena-online-check : modèle Pro online end-to-end (2 clients) ──\n");
(async () => {
  for (let i = 0; i < SEEDS.length; i++) {
    const voieA = VOIES[i % 5], voieB = VOIES[(i + 3) % 5];
    const { diff, turns } = await playOnline(SEEDS[i], voieA, voieB);
    if (diff) { fail++; console.log(`✗ seed=${SEEDS[i]} ${voieA} vs ${voieB} — DESYNC:\n  ${diff}`); }
    else console.log(`✓ seed=${SEEDS[i]} ${voieA} vs ${voieB} — ${turns} tours, clientA=clientB byte-identiques (via session+driver+relais), 0 fuite`);
  }
  // Preuve de DÉTECTION anti-triche (Phase 4) : un board FALSIFIÉ produit un hash
  // DIFFÉRENT → côté serveur, a_hash != b_hash déclenche le drop du match.
  {
    const pair = makeRngPair(424242);
    const board = makeInitialBoard(buildCpuSignatureDeck("rock"), buildCpuSignatureDeck("paper"), "rock", "paper", undefined, pair);
    const honest = hashBoard(board);
    const cheated = hashBoard({ ...board, a: { ...board.a, hp: board.a.hp + 10 } }); // triche : +10 PV
    const ok = honest !== cheated;
    console.log(`${ok ? "✓" : "✗"} détection triche : board falsifié (+10 PV) → hash DIFFÉRENT → le serveur droppe le match`);
    if (!ok) fail++;
  }

  console.log(`\n── Pro online end-to-end : ${fail === 0 ? "IDENTIQUE DES 2 CÔTÉS ✅" : `${fail} DESYNC ❌`} ──`);
  if (fail > 0) process.exitCode = 1;
})();
