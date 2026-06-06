/**
 * playerSync.ts — client-side player state sync with the server.
 *
 * On connect (Hello), the server loads the player's saved progression from
 * Redis and replies with `state_loaded`. This module merges that state with
 * local Zustand state (taking the higher/newer values for each field), then
 * pushes the merged result back so both sides stay in sync.
 *
 * After important state changes (match end, pack open, craft, quest claim),
 * the app calls `pushPlayerState()` to persist the update server-side.
 */

import type { Player } from "../types";
import type { OnlineClient, PlayerProgress } from "./online";
import { useStore } from "../store/store";

/** Build the sync payload from the current Zustand player state. */
export function buildProgressFromPlayer(player: Player): PlayerProgress {
  return {
    xp: player.xp ?? 0,
    rankLp: player.rankLp ?? 0,
    eclats: player.eclats ?? 0,
    dust: player.dust ?? 0,
    wins: player.stats?.wins ?? 0,
    losses: player.stats?.losses ?? 0,
    draws: player.stats?.draws ?? 0,
    cardCollection: player.cardCollection ?? [],
    cardMastery: player.cardMastery ?? {},
    codexClaimed: player.codexClaimed ?? [],
    rankedDeck: player.rankedDeck ?? [],
    seasonNumber: player.season?.number ?? 1,
    seasonStartedAt: player.season?.startedAt ?? Date.now(),
    winStreak: player.winStreak ?? 0,
    updatedAt: Date.now(),
  };
}

/** Merge server state INTO local, taking the higher/newer value for each field.
 *  Returns the merged player patch to apply to the store. */
export function mergeServerState(
  local: Player,
  server: PlayerProgress,
): Partial<Player> {
  const patch: Partial<Player> = {};

  // Currencies + XP — take the max
  if (server.xp > (local.xp ?? 0)) patch.xp = server.xp;
  if (server.rankLp > (local.rankLp ?? 0)) patch.rankLp = server.rankLp;
  if (server.eclats > (local.eclats ?? 0)) patch.eclats = server.eclats;
  if (server.dust > (local.dust ?? 0)) patch.dust = server.dust;

  // Stats — take max per field
  const localStats = local.stats ?? { wins: 0, losses: 0, draws: 0, byMove: {} };
  if (server.wins > localStats.wins || server.losses > localStats.losses || server.draws > localStats.draws) {
    patch.stats = {
      ...localStats,
      wins: Math.max(localStats.wins, server.wins),
      losses: Math.max(localStats.losses, server.losses),
      draws: Math.max(localStats.draws, server.draws),
    };
  }

  // Card collection — union of both sets
  const localCards = new Set(local.cardCollection ?? []);
  const serverCards = server.cardCollection ?? [];
  let hasNewCards = false;
  for (const c of serverCards) {
    if (!localCards.has(c)) {
      localCards.add(c);
      hasNewCards = true;
    }
  }
  if (hasNewCards) patch.cardCollection = Array.from(localCards);

  // Card mastery — take max per card
  const localMastery = { ...(local.cardMastery ?? {}) };
  const serverMastery = server.cardMastery ?? {};
  let masteryChanged = false;
  for (const [card, xp] of Object.entries(serverMastery)) {
    if (xp > (localMastery[card] ?? 0)) {
      localMastery[card] = xp;
      masteryChanged = true;
    }
  }
  if (masteryChanged) patch.cardMastery = localMastery;

  // Codex claimed — union
  const localCodex = new Set(local.codexClaimed ?? []);
  const serverCodex = server.codexClaimed ?? [];
  let codexChanged = false;
  for (const t of serverCodex) {
    if (!localCodex.has(t)) {
      localCodex.add(t);
      codexChanged = true;
    }
  }
  if (codexChanged) patch.codexClaimed = Array.from(localCodex);

  // Ranked deck — take server's if local is default and server has one
  if (server.rankedDeck?.length > 0 && (!local.rankedDeck || local.rankedDeck.length === 0)) {
    patch.rankedDeck = server.rankedDeck;
  }

  // Season — take higher number
  const localSeason = local.season ?? { number: 1, startedAt: Date.now() };
  if (server.seasonNumber > localSeason.number) {
    patch.season = { number: server.seasonNumber, startedAt: server.seasonStartedAt };
  }

  // Win streak — take max
  if (server.winStreak > (local.winStreak ?? 0)) {
    patch.winStreak = server.winStreak;
  }

  return patch;
}

/** Handle a `state_loaded` message from the server: merge into local store
 *  and push the merged result back. */
export function handleStateLoaded(server: PlayerProgress, client: OnlineClient) {
  const store = useStore.getState();
  const local = store.player;
  const patch = mergeServerState(local, server);

  // Apply patch to local store if anything changed
  if (Object.keys(patch).length > 0) {
    store.applyServerSync(patch);
  }

  // Push merged state back to server so it has the union
  const merged = { ...local, ...patch };
  const progress = buildProgressFromPlayer(merged as Player);
  client.send({ type: "sync_state", state: progress });
}

/** Push current player state to the server. Call after important actions
 *  (match end, pack open, craft, quest claim, season rollover). */
export function pushPlayerState(client: OnlineClient | null) {
  if (!client || client.status !== "open") return;
  const player = useStore.getState().player;
  const progress = buildProgressFromPlayer(player);
  client.send({ type: "sync_state", state: progress });
}

/** Global reference to the active online client, set by OnlinePage when
 *  a connection is established. Used by the background sync subscriber. */
let _activeClient: OnlineClient | null = null;

export function setActiveClient(client: OnlineClient | null) {
  _activeClient = client;
}

/** Fingerprint of the fields we care about syncing. When it changes,
 *  we push state to the server. */
function syncFingerprint(p: Player): string {
  return `${p.xp}|${p.rankLp}|${p.eclats}|${p.dust}|${p.stats?.wins}|${p.stats?.losses}|${(p.cardCollection ?? []).length}|${p.winStreak ?? 0}`;
}

let _lastFingerprint = "";
let _debounce: ReturnType<typeof setTimeout> | null = null;

/** Subscribe to the store and auto-push state when progression changes.
 *  Called once at app boot (App.tsx). */
export function startSyncSubscriber() {
  _lastFingerprint = syncFingerprint(useStore.getState().player);

  useStore.subscribe((state) => {
    const fp = syncFingerprint(state.player);
    if (fp === _lastFingerprint) return;
    _lastFingerprint = fp;

    // Debounce: if multiple changes happen rapidly (e.g. recordMatch + eclats),
    // batch into one push after 500ms of quiet.
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      _debounce = null;
      pushPlayerState(_activeClient);
    }, 500);
  });
}
