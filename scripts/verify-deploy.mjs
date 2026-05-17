#!/usr/bin/env node
// Quick post-deploy check: measures the inter-round sleep on the server.
// Expect ≥ 3000ms after the polish PR (was 1200ms before).

import { WebSocket } from "ws";

const url =
  (process.argv[2] || "wss://rpsls-server-tptj.onrender.com").replace(/\/+$/, "") +
  "/ws";

function makeClient(name) {
  const ws = new WebSocket(url);
  const pending = [], waiters = [];
  ws.on("message", (data) => {
    const m = JSON.parse(data.toString());
    const w = waiters.findIndex((x) => x.type === m.type);
    if (w >= 0) { const x = waiters.splice(w, 1)[0]; clearTimeout(x.t); x.ok(m); }
    else pending.push(m);
  });
  return {
    name, ws,
    send(m) { ws.send(JSON.stringify(m)); },
    open() { return new Promise((r, e) => { ws.once("open", r); ws.once("error", e); }); },
    waitFor(type, ms = 30000) {
      const i = pending.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(pending.splice(i, 1)[0]);
      return new Promise((ok, ko) => {
        const t = setTimeout(() => ko(new Error(`[${name}] ${type} timeout`)), ms);
        waiters.push({ type, ok, t });
      });
    },
  };
}

const a = makeClient("A"), b = makeClient("B");
await Promise.all([a.open(), b.open()]);
await Promise.all([a.waitFor("welcome"), b.waitFor("welcome")]);
a.send({ type: "hello", nickname: "A" }); b.send({ type: "hello", nickname: "B" });
a.send({ type: "join_queue", best_of: 3 });
await a.waitFor("queued");
b.send({ type: "join_queue", best_of: 3 });
await Promise.all([a.waitFor("match_found"), b.waitFor("match_found")]);
await Promise.all([a.waitFor("round_start"), b.waitFor("round_start")]);
a.send({ type: "play_move", mv: "rock" });
b.send({ type: "play_move", mv: "scissors" });
await Promise.all([a.waitFor("round_result"), b.waitFor("round_result")]);
const t0 = Date.now();
await a.waitFor("round_start"); // round 2
const dt = Date.now() - t0;
console.log(`Inter-round sleep observed: ${dt} ms`);
if (dt >= 3000) console.log("✓ new 3.5s pacing is LIVE on this server");
else console.log("✗ old 1.2s pacing still active — redeploy not yet picked up");
a.ws.close(); b.ws.close();
process.exit(0);
