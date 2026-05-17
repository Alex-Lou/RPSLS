#!/usr/bin/env node
// End-to-end smoke test: 2 WS clients, full random-queue match flow.
// Usage:
//   node smoke-test-ws.mjs wss://rpsls-server-tptj.onrender.com
//   node smoke-test-ws.mjs ws://localhost:8080

import { WebSocket } from "ws";

const url = (process.argv[2] || "ws://localhost:8080").replace(/\/+$/, "") + "/ws";
console.log("Connecting to", url);

function makeClient(name, nickname) {
  const ws = new WebSocket(url);
  const pending = [];
  const waiters = [];
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    process.stdout.write(`[${name}] ← ${msg.type}\n`);
    const idx = waiters.findIndex((w) => w.type === msg.type);
    if (idx >= 0) {
      const w = waiters.splice(idx, 1)[0];
      clearTimeout(w.timer);
      w.resolve(msg);
    } else {
      pending.push(msg);
    }
  });
  return {
    name,
    ws,
    nickname,
    send(msg) {
      process.stdout.write(`[${name}] → ${msg.type}\n`);
      ws.send(JSON.stringify(msg));
    },
    waitFor(type, timeoutMs = 70000) {
      const idx = pending.findIndex((m) => m.type === type);
      if (idx >= 0) return Promise.resolve(pending.splice(idx, 1)[0]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`[${name}] timed out waiting for ${type}`)),
          timeoutMs
        );
        waiters.push({ type, resolve, timer });
      });
    },
    open() {
      return new Promise((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
      });
    },
  };
}

async function main() {
  const a = makeClient("A", "Alice");
  await a.open();
  await a.waitFor("welcome");
  a.send({ type: "hello", nickname: a.nickname });
  a.send({ type: "join_queue", best_of: 1 });
  await a.waitFor("queued");

  const b = makeClient("B", "Bob");
  await b.open();
  await b.waitFor("welcome");
  b.send({ type: "hello", nickname: b.nickname });
  b.send({ type: "join_queue", best_of: 1 });

  const [aFound, bFound] = await Promise.all([
    a.waitFor("match_found"),
    b.waitFor("match_found"),
  ]);
  console.log("MATCH_FOUND:", { a: aFound.you_are, b: bFound.you_are });

  await Promise.all([a.waitFor("round_start"), b.waitFor("round_start")]);
  a.send({ type: "play_move", mv: "rock" });
  b.send({ type: "play_move", mv: "scissors" });

  await Promise.all([a.waitFor("round_result"), b.waitFor("round_result")]);
  const [aEnd, bEnd] = await Promise.all([
    a.waitFor("match_end"),
    b.waitFor("match_end"),
  ]);
  console.log("MATCH_END A:", aEnd);
  console.log("MATCH_END B:", bEnd);

  if (aEnd.winner !== "a" || bEnd.winner !== "a") {
    throw new Error("expected A to win (rock beats scissors)");
  }

  a.ws.close();
  b.ws.close();
  console.log("\n✓ end-to-end smoke test passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✗ FAIL:", e.message);
  process.exit(1);
});
