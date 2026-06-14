/**
 * transientSession.ts — shared plumbing for the one-shot WebSocket round-trips.
 *
 * Three flows open a short-lived connection, send `hello`, do one thing, and
 * close: the auth exchange (accountAuth), the launch sync (bootSync), and the
 * off-page state push (playerSync's pushPlayerStateOneShot). They each repeated
 * verbatim the two pieces factored out here: resolving the "/ws" URL from the
 * active server config, and building the `hello` frame.
 *
 * The full lifecycle (timeout / close / reinstall recovery) deliberately stays
 * per-caller: it differs enough — Promise-settled auth vs fire-and-forget sync
 * vs bootSync's claim-mismatch recovery — that a single primitive would be a
 * leaky abstraction. Only the genuinely identical bits live here.
 */

import { useStore, DEFAULT_CLOUD_URL } from "../store/store";
import { normalizeServerUrl } from "./online";

/** Resolve the server "/ws" endpoint from the current store config. Returns
 *  null when no server is configured or the URL is unparseable — callers treat
 *  that as "stay offline". Same resolution `OnlineClient.openSocket` does for
 *  the persistent connection, against the store-held cloud URL. */
export function resolveWsUrl(): string | null {
  const url = useStore.getState().serverConfig?.cloudUrl || DEFAULT_CLOUD_URL;
  const normalized = normalizeServerUrl(url);
  if (!normalized) return null;
  return normalized.replace(/\/+$/, "") + "/ws";
}

/** The `hello` frame that opens every transient connection: guest identity +
 *  TOFU claim token. `nickname` falls back to "Anonymous" and `claim_token` to
 *  "" — exactly as each caller built it inline. Accepts a partial player so a
 *  recovery re-hello can pass an anchored {id, claimToken} pair. */
export function helloFrame(player: { id: string; nickname?: string; claimToken?: string }) {
  return {
    type: "hello" as const,
    nickname: player.nickname || "Anonymous",
    player_id: player.id,
    claim_token: player.claimToken || "",
  };
}
