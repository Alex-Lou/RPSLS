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
import { loadAnchor, saveAnchor } from "./playerAnchor";

/** Restore player.id + claimToken from the durable Tauri anchor file into
 *  the Zustand store. This MUST run before the first bootSync handshake —
 *  otherwise a freshly-wiped localStorage (post-reinstall) hands the server
 *  a brand-new UUID and orphans every diamond, star, dust, card, owned set,
 *  cosmetic preference the player has earned.
 *
 *  Behaviour:
 *   - If the anchor file is missing (true first launch), no-op.
 *   - If the local store ALREADY has a non-null claimToken, no-op (the local
 *     store is the source of truth — the anchor is just a backup against
 *     wipes).
 *   - If the local store is missing the claimToken but the anchor has one,
 *     restore BOTH id and claimToken so the next Hello presents the right
 *     pair and the server recognises us.
 *
 *  Tauri-only — on browser preview the loader silently returns nulls and we
 *  no-op. */
export async function restoreAnchorIntoStore(): Promise<void> {
  try {
    const anchor = await loadAnchor();
    if (!anchor.id || !anchor.claimToken) return;
    const store = useStore.getState();
    const local = store.player;
    // If local already has a matching pair, nothing to do. If local has a
    // DIFFERENT (older or wiped) id but the anchor has a real claim token,
    // the anchor wins — that's the whole point of the backup.
    if (local.claimToken && local.claimToken === anchor.claimToken &&
        local.id === anchor.id) {
      return;
    }
    // Restore the anchored identity so the next Hello uses it.
    store.applyServerSync({
      id: anchor.id,
      claimToken: anchor.claimToken,
    });
    // eslint-disable-next-line no-console
    console.warn("[bootSync] restored anchor identity from durable store", {
      id: anchor.id.slice(0, 8) + "...",
      hadLocalToken: !!local.claimToken,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[bootSync] anchor restore failed", e);
  }
}

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
      // ANTI-DUPLICATE: minting a fresh player.id here orphans the old server
      // record and creates a SECOND account for the same person — the exact
      // "doublons" we must never produce. So before regenerating, make a LAST
      // attempt to recover the durable anchor (Tauri store): localStorage may
      // have been wiped while the OS-managed anchor still holds our real
      // id + claim token. If so, RE-ASSERT that identity instead of creating a
      // new one. Only when there is genuinely no recoverable identity (true
      // first run after a total wipe with no anchor) do we regenerate.
      void loadAnchor().then((anchor) => {
        const store = useStore.getState();
        if (anchor.id && anchor.claimToken) {
          // eslint-disable-next-line no-console
          console.warn("[bootSync] claim-mismatch but anchor recovered — re-asserting durable identity (no new account).", { id: anchor.id.slice(0, 8) + "…" });
          store.applyServerSync({ id: anchor.id, claimToken: anchor.claimToken });
          (player as { id: string; claimToken?: string }).id = anchor.id;
          (player as { id: string; claimToken?: string }).claimToken = anchor.claimToken;
          try {
            ws.send(JSON.stringify({
              type: "hello",
              nickname: player.nickname || "Anonymous",
              player_id: anchor.id,
              claim_token: anchor.claimToken,
            }));
          } catch { /* */ }
          return;
        }
        // No durable identity anywhere → a genuine fresh start is the only
        // option (the old record is permanently unreachable without its token).
        const newId = crypto.randomUUID();
        // eslint-disable-next-line no-console
        console.warn("[bootSync] claim-mismatch + no anchor — regenerating player.id (true fresh start).", { oldId: player.id, newId });
        store.applyServerSync({ id: newId, claimToken: undefined });
        try {
          ws.send(JSON.stringify({
            type: "hello",
            nickname: player.nickname || "Anonymous",
            player_id: newId,
            claim_token: "",
          }));
          (player as { id: string }).id = newId;
        } catch { /* */ }
      });
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

      // Persist (id, claimToken) to the DURABLE Tauri anchor so a future
      // localStorage wipe (reinstall, OS cleanup) doesn't orphan the account.
      // Fire-and-forget — never blocks the bootSync.
      const finalId = patch.id ?? currentPlayer.id;
      const finalToken = patch.claimToken ?? currentPlayer.claimToken;
      if (finalId && finalToken) {
        void saveAnchor(finalId, finalToken);
      }

      // Restaure l'historique du cloud sur une install FRAÎCHE (local vide) —
      // AVANT le push-back, sinon on réécraserait le cloud avec un historique
      // vide. Restore-only : jamais d'écrasement d'un local NON vide.
      if (useStore.getState().history.length === 0 && msg.state.history && msg.state.history.length > 0) {
        useStore.getState().restoreHistory(msg.state.history);
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
