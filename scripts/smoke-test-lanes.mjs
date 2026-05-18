#!/usr/bin/env node
// End-to-end smoke test for Constellation Lanes (Phase 1).
//
// Two clients join the lanes queue with win_to=2 (bo3 in round-wins),
// play 2 rounds where A always plays [Rock, Paper, Spock] (beats anything
// from B that includes Scissors/Lizard/Rock), and asserts the match ends.
//
// Usage:
//   node smoke-test-lanes.mjs ws://localhost:8080
//   node smoke-test-lanes.mjs wss://rpsls-server-tptj.onrender.com

import { WebSocket } from "ws";

const url = (process.argv[2] || "ws://localhost:8080").replace(/\/+$/, "") + "/ws";
console.log("Connecting to", url);

function makeClient(name, nickname) {
  const ws = new WebSocket(url);
  const pending = [], waiters = [];
  ws.on("message", (data) => {
    const m = JSON.parse(data.toString());
    process.stdout.write(`[${name}] ← ${m.type}\n`);
    const i = waiters.findIndex((w) => w.type === m.type);
    if (i >= 0) { const w = waiters.splice(i, 1)[0]; clearTimeout(w.t); w.ok(m); }
    else pending.push(m);
  });
  return {
    name, ws, nickname,
    send(m) { process.stdout.write(`[${name}] → ${m.type}\n`); ws.send(JSON.stringify(m)); },
    open() { return new Promise((r, e) => { ws.once("open", r); ws.once("error", e); }); },
    waitFor(type, ms = 70000) {
      const i = pending.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(pending.splice(i, 1)[0]);
      return new Promise((ok, ko) => {
        const t = setTimeout(() => ko(new Error(`[${name}] ${type} timeout`)), ms);
        waiters.push({ type, ok, t });
      });
    },
  };
}

function play(mv) { return { mv, mana: 0 }; }

async function main() {
  const a = makeClient("A", "Alice");
  const b = makeClient("B", "Bob");

  await Promise.all([a.open(), b.open()]);
  await Promise.all([a.waitFor("welcome"), b.waitFor("welcome")]);
  a.send({ type: "hello", nickname: a.nickname });
  b.send({ type: "hello", nickname: b.nickname });

  // Queue both — win_to: 2 → first to 2 round-wins (so 2 rounds win = match).
  a.send({ type: "join_lanes_queue", win_to: 2 });
  await a.waitFor("queued");
  b.send({ type: "join_lanes_queue", win_to: 2 });

  const [aFound, bFound] = await Promise.all([
    a.waitFor("lanes_match_found"),
    b.waitFor("lanes_match_found"),
  ]);
  console.log("MATCH:", { a_slot: aFound.you_are, b_slot: bFound.you_are, lanes: aFound.lanes, win_to: aFound.win_to });
  if (aFound.lanes !== 3) throw new Error(`expected 3 lanes, got ${aFound.lanes}`);

  // Two rounds, A plays a guaranteed sweep:
  // A: [Rock, Paper, Spock]
  // B: [Scissors, Rock, Scissors]
  // → Rock>Scissors, Paper>Rock, Spock>Scissors. A sweeps both rounds.
  for (let round = 1; round <= 2; round++) {
    await Promise.all([a.waitFor("lanes_round_start"), b.waitFor("lanes_round_start")]);
    a.send({ type: "play_lanes", plays: [play("rock"), play("paper"), play("spock")] });
    b.send({ type: "play_lanes", plays: [play("scissors"), play("rock"), play("scissors")] });
    const [aR, _bR] = await Promise.all([
      a.waitFor("lanes_round_result"),
      b.waitFor("lanes_round_result"),
    ]);
    console.log(`Round ${round}:`, {
      a_points: aR.a_points, b_points: aR.b_points,
      wins: `${aR.round_wins_a}-${aR.round_wins_b}`,
    });
    if (aR.a_points !== 3 || aR.b_points !== 0) {
      throw new Error(`round ${round}: expected A=3 B=0, got A=${aR.a_points} B=${aR.b_points}`);
    }
  }

  const [aEnd, bEnd] = await Promise.all([
    a.waitFor("lanes_match_end"),
    b.waitFor("lanes_match_end"),
  ]);
  console.log("END:", { winner: aEnd.winner, wins: `${aEnd.round_wins_a}-${aEnd.round_wins_b}` });
  if (aEnd.winner !== "a" || bEnd.winner !== "a") {
    throw new Error(`expected A winner, got a=${aEnd.winner} b=${bEnd.winner}`);
  }
  if (aEnd.round_wins_a !== 2 || aEnd.round_wins_b !== 0) {
    throw new Error("expected 2-0 round wins");
  }

  a.ws.close(); b.ws.close();
  console.log("\n✓ Lanes smoke test passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✗ FAIL:", e.message);
  process.exit(1);
});
