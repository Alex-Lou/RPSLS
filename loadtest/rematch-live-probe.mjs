// Fast probe: is the DEPLOYED server the rematch-capable build?
// Sends `request_rematch` while not in a match. The new server silently
// ignores it (no in_match/in_lanes entry); the old server rejects it with an
// "unknown variant" error. → exit 0 = LIVE (new), exit 1 = old / unreachable.
import WebSocket from "ws";

const URL = process.env.WS_URL || "wss://rpsls-server-tptj.onrender.com/ws";
let isOld = false;
const ws = new WebSocket(URL, { handshakeTimeout: 15000 });

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "hello", nickname: "probe" }));
  ws.send(JSON.stringify({ type: "request_rematch" }));
  setTimeout(finish, 2500);
});
ws.on("message", (d) => {
  let m; try { m = JSON.parse(d); } catch { return; }
  if (m.type === "error" && /unknown variant|bad_message/i.test((m.message || "") + (m.code || ""))) {
    isOld = true;
  }
});
ws.on("error", () => { isOld = true; finish(); });

let done = false;
function finish() {
  if (done) return;
  done = true;
  try { ws.close(); } catch {}
  console.log(isOld ? "OLD" : "LIVE");
  process.exit(isOld ? 1 : 0);
}
