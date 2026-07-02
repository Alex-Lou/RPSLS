/**
 * arena-session-check — preuve de la machine à états de session Pro online.
 *
 * Deux ArenaOnlineSession reliées par un FAUX relais (miroir du ccg_engine :
 * apparie les deux ccg_turn d'un round et renvoie à chacun l'intent de l'AUTRE).
 * On prouve :
 *   1. le handshake (matchFound + coin) résout des deux côtés,
 *   2. l'échange lockstep corréle par round_no et fonctionne quel que soit
 *      l'ordre d'arrivée (adverse AVANT ou APRÈS notre envoi) — le buffer inbox,
 *   3. le mulligan (round 0) et les intents (rounds ≥1) passent par le même canal.
 *
 * Usage : npx tsx app/scripts/arena-session-check.ts
 */
import { ArenaOnlineSession } from "../src/arena/arenaOnlineSession";
import type { ClientMessage, ServerMessage } from "../src/online/online";

let fail = 0;
const ok = (c: boolean, label: string) => { console.log(`${c ? "✓" : "✗"} ${label}`); if (!c) fail++; };

/* ── Faux relais : deux sessions, appariement des ccg_turn par round ── */
class FakeRelay {
  private turns: Record<number, { a?: unknown; b?: unknown }> = {};
  a!: ArenaOnlineSession;
  b!: ArenaOnlineSession;
  private deliverA!: (m: ServerMessage) => void;
  private deliverB!: (m: ServerMessage) => void;

  wire(a: ArenaOnlineSession, b: ArenaOnlineSession, dA: (m: ServerMessage) => void, dB: (m: ServerMessage) => void) {
    this.a = a; this.b = b; this.deliverA = dA; this.deliverB = dB;
  }
  fromA(msg: ClientMessage) { this.route("a", msg); }
  fromB(msg: ClientMessage) { this.route("b", msg); }

  private route(who: "a" | "b", msg: ClientMessage) {
    if (msg.type !== "ccg_turn") return; // le test ne pilote que l'échange de tours
    const slot = this.turns[msg.round_no] ?? (this.turns[msg.round_no] = {});
    slot[who] = msg.intent;
    if (slot.a !== undefined && slot.b !== undefined) {
      // Chacun reçoit l'intent de l'AUTRE (verbatim), comme le vrai relais.
      this.deliverA({ type: "ccg_turn_relay", from: "b", round_no: msg.round_no, intent: slot.b as never });
      this.deliverB({ type: "ccg_turn_relay", from: "a", round_no: msg.round_no, intent: slot.a as never });
      delete this.turns[msg.round_no];
    }
  }
}

const relay = new FakeRelay();
const sessA = new ArenaOnlineSession((m) => relay.fromA(m), { winTo: 3, rulesetHash: "h" });
const sessB = new ArenaOnlineSession((m) => relay.fromB(m), { winTo: 3, rulesetHash: "h" });
relay.wire(sessA, sessB, (m) => sessA.handle(m), (m) => sessB.handle(m));

async function main() {
  // 1. Handshake : matchFound des deux côtés (le serveur assigne A/B + seed).
  const mfA = sessA.waitMatchFound();
  const mfB = sessB.waitMatchFound();
  sessA.handle({ type: "ccg_match_found", match_id: "m1", opponent: { nickname: "Bob" }, you_are: "a", win_to: 3, shared_seed: 123456 });
  sessB.handle({ type: "ccg_match_found", match_id: "m1", opponent: { nickname: "Alice" }, you_are: "b", win_to: 3, shared_seed: 123456 });
  const [ia, ib] = await Promise.all([mfA, mfB]);
  ok(ia.sharedSeed === 123456 && ib.sharedSeed === 123456, "matchFound: même shared_seed des 2 côtés");
  ok(ia.youAre === "a" && ib.youAre === "b", "matchFound: camps assignés (a/b)");

  // 2. Coin serveur.
  const cA = sessA.waitCoinFlip();
  sessA.handle({ type: "start_coin_flip", winner: "a" });
  ok((await cA) === "a", "coin flip résolu");

  // 3. MULLIGAN (round 0) — envoi quasi simultané, appariés par le relais.
  const [mulA, mulB] = await Promise.all([
    sessA.exchange(0, { mulligan: [0, 2] }),
    sessB.exchange(0, { mulligan: [1] }),
  ]);
  ok(JSON.stringify(mulA) === JSON.stringify({ mulligan: [1] }), "mulligan: A reçoit les indices de B");
  ok(JSON.stringify(mulB) === JSON.stringify({ mulligan: [0, 2] }), "mulligan: B reçoit les indices de A");

  // 4. Round 1 — A envoie EN PREMIER (B pas encore) → A doit attendre (pending),
  //    puis B envoie → les deux résolvent. Teste l'arrivée APRÈS l'envoi.
  const pA = sessA.exchange(1, { tag: "intentA1" });
  const pB = sessB.exchange(1, { tag: "intentB1" });
  const [r1a, r1b] = await Promise.all([pA, pB]);
  ok(JSON.stringify(r1a) === JSON.stringify({ tag: "intentB1" }), "round1: A reçoit l'intent de B (arrivée après envoi)");
  ok(JSON.stringify(r1b) === JSON.stringify({ tag: "intentA1" }), "round1: B reçoit l'intent de A");

  // 5. Round 2 — B envoie EN PREMIER, son relais arrive chez A AVANT que A appelle
  //    exchange(2) → doit être bufferisé (inbox) puis servi. Teste l'arrivée AVANT.
  sessB.exchange(2, { tag: "intentB2" }); // B envoie ; A n'a pas encore appelé exchange(2)
  // À ce stade le relais a chez A un ccg_turn_relay round=2 en attente ? Non : le
  // relais n'apparie qu'à réception des DEUX. On force donc A à envoyer ensuite.
  const r2a = await sessA.exchange(2, { tag: "intentA2" });
  ok(JSON.stringify(r2a) === JSON.stringify({ tag: "intentB2" }), "round2: échange OK quel que soit l'ordre d'envoi");

  // 6. Buffer explicite : un relais qui arrive AVANT l'exchange doit être servi.
  const sess = new ArenaOnlineSession(() => {}, { winTo: 3, rulesetHash: "h" });
  sess.handle({ type: "ccg_turn_relay", from: "b", round_no: 5, intent: { early: true } as never });
  const got = await sess.exchange(5, { mine: true });
  ok(JSON.stringify(got) === JSON.stringify({ early: true }), "buffer: relais reçu AVANT exchange est servi");

  // 7. Fin de match via callback.
  let ended: { w: string | null; f: boolean } | null = null;
  const sEnd = new ArenaOnlineSession(() => {}, { winTo: 3, rulesetHash: "h" }, { onMatchEnd: (w, f) => { ended = { w, f }; } });
  sEnd.handle({ type: "ccg_match_end", winner: "a", forfeit: false });
  ok(ended !== null && ended!.w === "a" && ended!.f === false && sEnd.isEnded, "match_end: callback + flag ended");

  console.log(`\n── Session Pro online : ${fail === 0 ? "OK ✅" : `${fail} ÉCHEC(S) ❌`} ──`);
  if (fail > 0) process.exitCode = 1;
}
main();
