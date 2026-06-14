/**
 * accountAuth.ts — client auth round-trips (e-mail/password + Google).
 *
 * One transient WebSocket per attempt (same ephemeral lifecycle as bootSync):
 * Hello establishes the GUEST identity, then a credential message is sent and
 * the server's `auth_ok` is applied to the store (switch identity, merge
 * progression, persist the anchor). Mirrors `crates/rpsls-server/src/protocol.rs`
 * (Signup / Login / GoogleLogin → AuthOk / AuthError).
 *
 * Google is built on a PLUGGABLE provider: "obtain a Google ID token on-device"
 * is one function, registered at boot. Generic Sign-in-with-Google now; Play
 * Games later is just a different provider — the server verifies either token
 * and the rest of this flow is unchanged.
 */

import { useStore, DEFAULT_CLOUD_URL } from "../store/store";
import { normalizeServerUrl, type PlayerProgress } from "./online";
import { applyAuthState } from "./playerSync";
import { saveAnchor } from "./playerAnchor";

export type AuthMode = "signup" | "login";
export type AuthResult = { ok: true } | { ok: false; code: string };

/** Generous: a cold Render instance + an Argon2 verify can take a few seconds. */
const AUTH_TIMEOUT = 15_000;

/* ──────────── Google token provider (pluggable) ──────────── */

/** Obtains a Google-issued ID token on-device. Resolves to the token, or `null`
 *  when the user cancels / it's unavailable. Register a real provider at boot
 *  with {@link setGoogleTokenProvider}; until then the Google button stays
 *  hidden. Swapping generic Google for Play Games later = registering a
 *  different provider here — nothing else in the auth flow changes. */
export type GoogleTokenProvider = () => Promise<string | null>;

let _googleProvider: GoogleTokenProvider | null = null;
export function setGoogleTokenProvider(p: GoogleTokenProvider | null): void {
  _googleProvider = p;
}
export function isGoogleAvailable(): boolean {
  return _googleProvider !== null;
}

/* ──────────── Shared WS exchange ──────────── */

interface ExchangeOpts {
  /** Build the credential message sent after Hello (signup / login / google_login). */
  credential: () => Record<string, unknown>;
  /** Wait for `state_loaded` before sending the credential? signup + Google link
   *  the guest's progression, so the server must have the session authenticated
   *  first (the player_id is only set once Hello's task lands); plain login
   *  doesn't need it. */
  waitForState: boolean;
  /** How `applyAuthState` reconciles local vs account state. "adopt" (e-mail
   *  login) replaces local with the account; "merge" (signup, Google) keeps
   *  local — see applyAuthState. */
  strategy: "merge" | "adopt";
  /** Which provider this auth establishes — stamped on the player so "signed in"
   *  doesn't depend on having a displayable e-mail (Play Games / unverified-
   *  e-mail Google return no e-mail but ARE authenticated). */
  provider: "email" | "google";
  /** E-mail already known client-side (typed). `AuthOk.email` overrides it. */
  knownEmail?: string;
}

function runExchange(opts: ExchangeOpts): Promise<AuthResult> {
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
    let credentialSent = false;
    const finish = (r: AuthResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* */ }
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, code: "timeout" }), AUTH_TIMEOUT);

    const sendCredential = () => {
      if (credentialSent) return;
      credentialSent = true;
      try {
        ws.send(JSON.stringify(opts.credential()));
      } catch {
        finish({ ok: false, code: "network" });
      }
    };

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({
          type: "hello",
          nickname: player.nickname || "Anonymous",
          player_id: player.id,
          claim_token: player.claimToken || "",
        }));
        // Plain login is independent of the guest session being authenticated.
        if (!opts.waitForState) sendCredential();
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
        email?: string;
      };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }

      if (msg.type === "state_loaded" && opts.waitForState && !credentialSent) {
        sendCredential();
        return;
      }
      if (msg.type === "auth_ok" && msg.player_id && msg.state) {
        applyAuthOk(opts.strategy, opts.provider, msg.email ?? opts.knownEmail, {
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
      // Hello rejection (e.g. claim-token mismatch on a wiped install).
      if (msg.type === "error" && msg.code === "auth_failed") {
        finish({ ok: false, code: "session" });
        return;
      }
    };

    ws.onerror = () => finish({ ok: false, code: "network" });
    ws.onclose = () => finish({ ok: false, code: "network" });
  });
}

/* ──────────── Public flows ──────────── */

/** Run a signup or login round-trip. */
export function authenticate(mode: AuthMode, email: string, password: string): Promise<AuthResult> {
  return runExchange({
    credential: () => ({ type: mode, email, password }),
    waitForState: mode === "signup",
    // signup = the guest becomes the account (merge); login = switch identity (adopt).
    strategy: mode === "signup" ? "merge" : "adopt",
    provider: "email",
    knownEmail: email,
  });
}

/** Sign in with Google: obtain an ID token via the registered provider (generic
 *  web-OAuth now; Play Games later), then run the same exchange. The server
 *  maps the verified Google identity to a durable player_id. */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!_googleProvider) return { ok: false, code: "google_unavailable" };
  let idToken: string | null;
  try {
    idToken = await _googleProvider();
  } catch {
    return { ok: false, code: "google_failed" };
  }
  if (!idToken) return { ok: false, code: "cancelled" };
  const token = idToken;
  return runExchange({
    // First Google sign-in links the guest's progression → wait for state_loaded.
    credential: () => ({ type: "google_login", id_token: token }),
    waitForState: true,
    // MERGE (not adopt): on a first sign-in the server binds the guest's OWN pid,
    // so merging preserves unsynced local progress; on a returning sign-in the
    // union/max keeps the player from losing anything. (Cross-account laundering
    // here is gated by the server-authoritative economy work, §9-B.)
    strategy: "merge",
    provider: "google",
  });
}

/** Apply the account into the store: identity + reconciled progression + anchor. */
function applyAuthOk(
  strategy: "merge" | "adopt",
  provider: "email" | "google",
  email: string | undefined,
  msg: { player_id: string; claim_token?: string; state: PlayerProgress },
) {
  const store = useStore.getState();
  const local = store.player;

  const patch = applyAuthState(local, msg.state, strategy);
  patch.id = msg.player_id;
  if (msg.claim_token) patch.claimToken = msg.claim_token;
  // E-mail = the server's verified one (Google) when present, else the typed one.
  if (email) patch.accountEmail = email;
  // Durable "signed in" marker, INDEPENDENT of accountEmail — an e-mail-less
  // Google / Play Games identity is still authenticated and must clear the gate.
  patch.accountProvider = provider;
  store.applyServerSync(patch);

  // History: on ADOPT replace with the account's log (don't keep the guest's);
  // on MERGE seed from the server only when the local log is empty.
  if (strategy === "adopt") {
    store.restoreHistory(msg.state.history ?? []);
  } else if (store.history.length === 0 && msg.state.history && msg.state.history.length > 0) {
    store.restoreHistory(msg.state.history);
  }

  const finalToken = patch.claimToken ?? local.claimToken;
  if (msg.player_id && finalToken) {
    void saveAnchor(msg.player_id, finalToken);
  }
}
