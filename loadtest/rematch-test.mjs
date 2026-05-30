// Verifies the server rematch handshake end-to-end:
// 2 bots play a 1-round match; on match_end the "asker" requests a rematch,
// the "accepter" accepts → both must receive a SECOND match_found.
import WebSocket from "ws";

const URL = process.env.WS_URL || "ws://127.0.0.1:8080/ws";
const MOVES = ["rock", "paper", "scissors", "lizard", "spock"];
const rnd = () => MOVES[(Math.random() * 5) | 0];
const log = (...a) => console.log(...a);

let matchEnds = 0;
let secondMatchFound = 0;

function bot(name, role) {
  const ws = new WebSocket(URL);
  let matches = 0;
  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "hello", nickname: name }));
    ws.send(JSON.stringify({ type: "join_queue", best_of: 1 }));
  });
  ws.on("message", (d) => {
    const m = JSON.parse(d);
    switch (m.type) {
      case "match_found":
        matches++;
        log(`${name}: match_found #${matches}`);
        if (matches === 2) secondMatchFound++;
        break;
      case "round_start":
        setTimeout(() => ws.send(JSON.stringify({ type: "play_move", mv: rnd() })), 60);
        break;
      case "match_end":
        matchEnds++;
        log(`${name}: match_end`);
        if (role === "asker" && matches === 1) {
          setTimeout(() => { log(`${name}: -> request_rematch`); ws.send(JSON.stringify({ type: "request_rematch" })); }, 250);
        }
        break;
      case "rematch_offered":
        log(`${name}: rematch_offered -> accept`);
        ws.send(JSON.stringify({ type: "respond_rematch", accept: true }));
        break;
      case "rematch_declined":
        log(`${name}: rematch_declined`);
        break;
      case "error":
        log(`${name}: ERROR ${m.code}: ${m.message}`);
        break;
    }
  });
  return ws;
}

bot("asker", "asker");
bot("accepter", "accepter");

setTimeout(() => {
  log(`\nRESULT: matchEnds=${matchEnds}  secondMatchFound=${secondMatchFound}  (expect 2 → rematch OK)`);
  process.exit(secondMatchFound === 2 ? 0 : 1);
}, 12000);
