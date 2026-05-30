// RPSLS server load test.
//
// Spawns N WebSocket clients that each: hello -> join_queue -> play a full
// match (responding to every round_start with a random move) -> re-queue, in a
// loop, to keep the server under sustained matchmaking + match load. Measures
// connection success, matchmaking, match throughput, errors, and a pure
// server round-trip via ping/pong.
//
//   node loadtest/loadtest.mjs <clients> <seconds>
//   WS_URL=ws://host:8080/ws node loadtest/loadtest.mjs 300 30
//
import WebSocket from "ws";

const URL = process.env.WS_URL || "ws://127.0.0.1:8080/ws";
const N = parseInt(process.argv[2] || "200", 10);
const DURATION_S = parseInt(process.argv[3] || "30", 10);
const MOVES = ["rock", "paper", "scissors", "lizard", "spock"];
const rnd = () => MOVES[(Math.random() * MOVES.length) | 0];

const stat = {
  open: 0, connClosed: 0, connError: 0,
  welcomed: 0, queued: 0, matched: 0,
  rounds: 0, matchEnds: 0, srvErrors: 0,
  msgs: 0,
};
const pingRtt = [];
const clients = [];

function pct(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

function spawn(i) {
  let ws;
  try { ws = new WebSocket(URL, { handshakeTimeout: 15000 }); }
  catch { stat.connError++; return; }
  clients.push(ws);
  const pend = new Map(); // ping id -> sent time

  ws.on("open", () => {
    stat.open++;
    ws.send(JSON.stringify({ type: "hello", nickname: "bot" + i }));
    ws.send(JSON.stringify({ type: "join_queue", best_of: 3 }));
    // Pure server-latency probe every ~4s (jittered).
    ws._ping = setInterval(() => {
      if (ws.readyState !== 1) return;
      const id = Date.now() + ":" + Math.random();
      pend.set(id, performance.now());
      ws._lastPingId = id;
      ws.send(JSON.stringify({ type: "ping" }));
    }, 3500 + Math.random() * 1500);
  });

  ws.on("message", (data) => {
    stat.msgs++;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    switch (m.type) {
      case "welcome": stat.welcomed++; break;
      case "queued": stat.queued++; break;
      case "match_found": stat.matched++; break;
      case "round_start":
        // Respond fast but with a little human-ish jitter.
        setTimeout(() => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "play_move", mv: rnd() }));
        }, 40 + Math.random() * 160);
        break;
      case "round_result": stat.rounds++; break;
      case "match_end":
        stat.matchEnds++;
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "join_queue", best_of: 3 }));
        break;
      case "pong": {
        const id = ws._lastPingId;
        if (id && pend.has(id)) { pingRtt.push(performance.now() - pend.get(id)); pend.delete(id); }
        break;
      }
      case "error": stat.srvErrors++; break;
    }
  });

  ws.on("error", () => { stat.connError++; });
  ws.on("close", () => { stat.connClosed++; if (ws._ping) clearInterval(ws._ping); });
}

console.log(`→ ${N} clients vs ${URL} for ${DURATION_S}s`);
const t0 = performance.now();
// Ramp up over ~ N*8ms so we don't thundering-herd the accept loop.
for (let i = 0; i < N; i++) setTimeout(() => spawn(i), i * 8);

const report = setInterval(() => {
  console.log(JSON.stringify({
    t: Math.round((performance.now() - t0) / 1000),
    open: stat.open, closed: stat.connClosed, connErr: stat.connError,
    matched: stat.matched, rounds: stat.rounds, matchEnds: stat.matchEnds,
    srvErr: stat.srvErrors,
    pingMs: { p50: Math.round(pct(pingRtt, 0.5)), p95: Math.round(pct(pingRtt, 0.95)), max: Math.round(pct(pingRtt, 1)) },
  }));
}, 2000);

setTimeout(() => {
  clearInterval(report);
  const live = clients.filter((w) => w.readyState === 1).length;
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify({
    clients: N,
    peakOpen: stat.open, stillLive: live, connErrors: stat.connError, closed: stat.connClosed,
    matchesFound: stat.matched, roundsPlayed: stat.rounds, matchesEnded: stat.matchEnds,
    serverErrors: stat.srvErrors, totalMsgs: stat.msgs,
    pingMs: { p50: Math.round(pct(pingRtt, 0.5)), p95: Math.round(pct(pingRtt, 0.95)), p99: Math.round(pct(pingRtt, 0.99)), max: Math.round(pct(pingRtt, 1)), samples: pingRtt.length },
  }, null, 2));
  process.exit(0);
}, DURATION_S * 1000 + 1000);
