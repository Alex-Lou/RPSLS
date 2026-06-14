/**
 * accountAuth.ts — client-side e-mail/password auth (§9-A).
 *
 * Opens a transient WebSocket (same ephemeral lifecycle as bootSync), gives the
 * server the GUEST identity via Hello, then runs signup/login and applies the
 * server's `auth_ok` to the store: switches identity (player_id + claim_token),
 * merges progression, persists the durable anchor. Returns a typed result the
 * AuthModal renders. The auto-sync subscriber (playerSync) pushes the merged
 * state to the (now account-bound) player_id shortly after — we don't push here.
 *
 * Mirrors `crates/rpsls-server/src/protocol.rs` Signup/Login/AuthOk/AuthError.
 */

import { useStore, DEFAULT_CLOUD_URL } from "../store/store";
import { normalizeServerUrl, type PlayerProgress } from "./online";
import { applyAuthState } from "./playerSync";
import { saveAnchor } from "./playerAnchor";

export type AuthMode = "signup" | "login";
export type AuthResult = { ok: true } | { ok: false; code: string };

/** Generous: a cold Render instance + an Argon2 verify can take a few seconds. */
const AUTH_TIMEOUT = 15_000;

/**
 * Run a signup or login round-trip. Resolves with `{ ok: true }` after the
 * store has adopted the account, or `{ ok: false, code }` with a generic error
 * code the modal maps to a localized message.
 */
export function authenticate(mode: AuthMode, email: string, password: string): Promise<AuthResult> {
  return new Promise<AuthResult>((resolve) => {
    const state = useStore.getState();
    const player = state.player;
    const url = state.serverConfig?.cloudUrl || DEFAULT_CLOUD_URL;
    const normalized = normalizeServerUrl(url);
    if (!normalized) {
      resolve({ ok: false, code: "no_server" });
      return;
    }
    const wsUrl = normalized.replace(/\/+$/, "") + "/ws";

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      resolve({ ok: false, code: "network" });
      return;
    }

    let settled = false;
    let signupSent = false;
    const finish = (r: AuthResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* */ }
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, code: "timeout" }), AUTH_TIMEOUT);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({
          type: "hello",
          nickname: player.nickname || "Anonymous",
          player_id: player.id,
          claim_token: player.claimToken || "",
        }));
        // Login is independent of the guest session being authenticated, so it
        // can fire right after Hello. Signup MUST wait for `state_loaded` — the
        // server links the new account to the now-authenticated guest player_id,
        // and that id is only set once the Hello handler's async task lands.
        if (mode === "login") {
          ws.send(JSON.stringify({ type: "login", email, password }));
        }
      } catch {
        finish({ ok: false, code: "network" });
      }
    };

    ws.onmessage = (ev) => {
      let msg: {
        type?: string;
        player_id?: string;
        claim_token?: string;
        state?: PlayerProgress;
        code?: string;
      };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }

      if (msg.type === "state_loaded" && mode === "signup" && !signupSent) {
        signupSent = true;
        try {
          ws.send(JSON.stringify({ type: "signup", email, password }));
        } catch {
          finish({ ok: false, code: "network" });
        }
        return;
      }
      if (msg.type === "auth_ok" && msg.player_id && msg.state) {
        applyAuthOk(mode, email, {
          player_id: msg.player_id,
          claim_token: msg.claim_token,
          state: msg.state,
        });
        finish({ ok: true });
        return;
      }
      if (msg.type === "auth_error") {
        finish({ ok: false, code: msg.code || "unknown" });
        return;
      }
      // Hello rejection (e.g. claim-token mismatch on a wiped install) — auth
      // can't proceed on this session. Surface as a generic session error.
      if (msg.type === "error" && msg.code === "auth_failed") {
        finish({ ok: false, code: "session" });
        return;
      }
    };

    ws.onerror = () => finish({ ok: false, code: "network" });
    ws.onclose = () => finish({ ok: false, code: "network" });
  });
}

/** Adopt the account into the store: identity + merged progression + anchor. */
function applyAuthOk(
  mode: AuthMode,
  email: string,
  msg: { player_id: string; claim_token?: string; state: PlayerProgress },
) {
  const store = useStore.getState();
  const local = store.player;

  const patch = applyAuthState(local, msg.state, mode);
  patch.id = msg.player_id;
  if (msg.claim_token) patch.claimToken = msg.claim_token;
  patch.accountEmail = email;
  store.applyServerSync(patch);

  // Restore cloud history on a FRESH local (empty) — e.g. login on a new device.
  if (store.history.length === 0 && msg.state.history && msg.state.history.length > 0) {
    store.restoreHistory(msg.state.history);
  }

  // Persist the durable anchor (id + claim token) so a future localStorage wipe
  // keeps the account link. The auto-sync subscriber pushes the merged state to
  // the account-bound player_id momentarily — no manual push needed here.
  const finalToken = patch.claimToken ?? local.claimToken;
  if (msg.player_id && finalToken) {
    void saveAnchor(msg.player_id, finalToken);
  }
}
