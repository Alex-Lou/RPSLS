/**
 * bootSync.ts — one-shot background sync at app launch.
 *
 * Connects to the server, sends Hello, waits for StateLoaded, merges,
 * pushes merged state back, then disconnects. Runs silently in the
 * background — the user never sees this connection. If it fails (server
 * asleep, no network), it's a no-op and the app works fully offline.
 */

import { useStore, DEFAULT_CLOUD_URL } from "../store/store";
import { normalizeServerUrl, type PlayerProgress } from "./online";
import { buildProgressFromPlayer, mergeServerState } from "./playerSync";

const BOOT_SYNC_TIMEOUT = 8_000;

/** Cold-start jitter window. When N players open the app within the same
 *  short window (e.g. after a push notification), their bootSync would all
 *  hit the dormant Render instance at the same instant — the first few get
 *  a 429 from the governor, the rest pile on top. A random 0-8 s delay turns
 *  that synchronised spike into a smooth ramp. The sync is silent + fully
 *  background so the delay has zero user-facing cost. */
const BOOT_SYNC_JITTER_MAX_MS = 8_000;

export function runBootSync() {
  const state = useStore.getState();
  const player = state.player;
  if (!player.id) return;

  const url = state.serverConfig?.cloudUrl || DEFAULT_CLOUD_URL;
  const normalized = normalizeServerUrl(url);
  if (!normalized) return;

  const wsUrl = normalized.replace(/\/+$/, "") + "/ws";
  const jitterMs = Math.floor(Math.random() * BOOT_SYNC_JITTER_MAX_MS);
  // Bail the whole thing into a microtask after the jitter so the WebSocket
  // is only constructed AFTER the random wait — otherwise we'd build the
  // connection at app boot and just delay the message, which still herds.
  setTimeout(() => runBootSyncImmediate(player, wsUrl), jitterMs);
}

function runBootSyncImmediate(player: { id: string; nickname: string; claimToken?: string }, wsUrl: string) {
  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch {
    return;
  }

  const timeout = setTimeout(() => {
    try { ws.close(); } catch { /* */ }
  }, BOOT_SYNC_TIMEOUT);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: "hello",
      nickname: player.nickname || "Anonymous",
      player_id: player.id,
      claim_token: player.claimToken || "",
    }));
  };

  ws.onmessage = (ev) => {
    let msg: { type: string; state?: PlayerProgress; claim_token?: string; code?: string; message?: string };
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
      return;
    }

    // ── Reinstall recovery path ──
    // Server rejects with "claim token mismatch" when the player_id exists
    // server-side but our local claim_token is empty / wrong. This is the
    // exact signature of a reinstall that wiped localStorage (WebView storage
    // does NOT survive `adb install` without -r, nor a real user uninstall).
    // The player's data is on the server but inaccessible without the token.
    // Rather than leave the player stuck forever on a half-broken account,
    // we treat the rejection as a "fresh start" signal: regenerate player.id
    // locally so the next boot sync creates a clean record + fresh claim
    // token. The local progression (currencies, cards, owned premiums)
    // accumulated since the wipe is preserved and gets pushed to the new
    // server record. NB: this loses access to pre-wipe server data, but
    // that data was already unreachable; the alternative is "no sync at all
    // until user uninstalls again". A future fix is to persist player.id +
    // claimToken via a Tauri filesystem plugin so they survive WebView wipes.
    if (msg.type === "error" && msg.code === "auth_failed" &&
        (msg.message || "").includes("claim token") &&
        !(player.claimToken || "").length) {
      const newId = crypto.randomUUID();
      // eslint-disable-next-line no-console
      console.warn("[bootSync] claim-mismatch on empty local token — regenerating player.id (reinstall recovery).", { oldId: player.id, newId });
      const store = useStore.getState();
      store.applyServerSync({ id: newId, claimToken: undefined });
      // Re-send hello with the fresh id so the server creates a clean record.
      try {
        ws.send(JSON.stringify({
          type: "hello",
          nickname: player.nickname || "Anonymous",
          player_id: newId,
          claim_token: "",
        }));
        // Update the bound `player` closure too so a subsequent message uses
        // the new id when it tries to push.
        (player as { id: string }).id = newId;
      } catch { /* */ }
      return;
    }

    if (msg.type === "state_loaded" && msg.state) {
      const store = useStore.getState();
      const currentPlayer = store.player;
      const patch = mergeServerState(currentPlayer, msg.state);

      // Persist TOFU claim token if issued/confirmed by the server.
      if (msg.claim_token) {
        patch.claimToken = msg.claim_token;
      }

      if (Object.keys(patch).length > 0) {
        store.applyServerSync(patch);
      }

      // Push merged state back
      const merged = { ...currentPlayer, ...patch };
      const progress = buildProgressFromPlayer(merged);
      ws.send(JSON.stringify({ type: "sync_state", state: progress }));

      // Give the server a moment to process, then close.
      setTimeout(() => {
        clearTimeout(timeout);
        try { ws.close(); } catch { /* */ }
      }, 300);
    }
  };

  ws.onerror = () => {
    clearTimeout(timeout);
  };

  ws.onclose = () => {
    clearTimeout(timeout);
  };
}
