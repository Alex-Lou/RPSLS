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

export function runBootSync() {
  const state = useStore.getState();
  const player = state.player;
  if (!player.id) return;

  const url = state.serverConfig?.cloudUrl || DEFAULT_CLOUD_URL;
  const normalized = normalizeServerUrl(url);
  if (!normalized) return;

  const wsUrl = normalized.replace(/\/+$/, "") + "/ws";

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
    let msg: { type: string; state?: PlayerProgress; claim_token?: string };
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
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
