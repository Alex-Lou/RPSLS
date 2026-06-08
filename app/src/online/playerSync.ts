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

import type { BackgroundId, Difficulty, PadId, Player, ThemeId } from "../types";
import { PAD_META } from "../types";
import { type OnlineClient, type PlayerProgress, normalizeServerUrl } from "./online";
import { useStore, DEFAULT_CLOUD_URL } from "../store/store";
import { THEMES } from "../theme/theme";
import { BACKGROUNDS_BY_ID } from "../theme/themes";
import { isAvatarImage } from "../theme/avatar";

/** Build the sync payload from the current Zustand player state. */
export function buildProgressFromPlayer(player: Player): PlayerProgress {
  return {
    xp: player.xp ?? 0,
    rankLp: player.rankLp ?? 0,
    eclats: player.eclats ?? 0,
    dust: player.dust ?? 0,
    stars: player.stars ?? 0,
    wins: player.stats?.wins ?? 0,
    losses: player.stats?.losses ?? 0,
    draws: player.stats?.draws ?? 0,
    cardCollection: player.cardCollection ?? [],
    cardMastery: player.cardMastery ?? {},
    codexClaimed: player.codexClaimed ?? [],
    claimedQuests: player.claimedQuests ?? [],
    rankedDeck: player.rankedDeck ?? [],
    ownedPremiumSets: player.ownedPremiumSets ?? [],
    seasonNumber: player.season?.number ?? 1,
    seasonStartedAt: player.season?.startedAt ?? Date.now(),
    winStreak: player.winStreak ?? 0,
    // Classé own ladder + record — cloud-saved like rankLp/stats.
    classeLp: player.classeLp ?? 1000,
    classeWins: player.classeStats?.wins ?? 0,
    classeLosses: player.classeStats?.losses ?? 0,
    classeDraws: player.classeStats?.draws ?? 0,
    updatedAt: Date.now(),
    // Cosmetics — small prefs so a reinstall restores the look. The avatar is
    // synced only when it's a preset path / emoji; custom uploaded data: URLs
    // are too bulky and stay device-local.
    themeId: player.themeId,
    backgroundId: player.backgroundId,
    padId: player.padId,
    avatar: player.avatar && !player.avatar.startsWith("data:") ? player.avatar : undefined,
    nickname: player.nickname,
    difficulty: player.difficulty,
    fontScale: player.fontScale,
    padChosen: player.padChosen,
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
  // Premium currency — take max (never lose paid ✦; same model as eclats/dust).
  if (server.stars != null && server.stars > (local.stars ?? 0)) patch.stars = server.stars;

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

  // Claimed quests — union (a one-time reward stays claimed across devices, and
  // can't be re-collected after a reinstall).
  const localQuests = new Set(local.claimedQuests ?? []);
  const serverQuests = server.claimedQuests ?? [];
  let questsChanged = false;
  for (const q of serverQuests) {
    if (!localQuests.has(q)) { localQuests.add(q); questsChanged = true; }
  }
  if (questsChanged) patch.claimedQuests = Array.from(localQuests);

  // Ranked deck — take server's if local is default and server has one
  if (server.rankedDeck?.length > 0 && (!local.rankedDeck || local.rankedDeck.length === 0)) {
    patch.rankedDeck = server.rankedDeck;
  }

  // Owned premium sets — UNION (paid content only ever grows; never lost on a
  // reinstall or a device with a stale copy). Same durability model as cards.
  const localSets = new Set(local.ownedPremiumSets ?? []);
  const serverSets = server.ownedPremiumSets ?? [];
  let setsChanged = false;
  for (const s of serverSets) {
    if (!localSets.has(s)) { localSets.add(s); setsChanged = true; }
  }
  if (setsChanged) patch.ownedPremiumSets = Array.from(localSets);

  // Season — take higher number
  const localSeason = local.season ?? { number: 1, startedAt: Date.now() };
  if (server.seasonNumber > localSeason.number) {
    patch.season = { number: server.seasonNumber, startedAt: server.seasonStartedAt };
  }

  // Win streak — take max
  if (server.winStreak > (local.winStreak ?? 0)) {
    patch.winStreak = server.winStreak;
  }

  // Classé own ladder — take max (same model as rankLp: the saved cloud value
  // seeds a fresh/wiped install and never silently loses rank). Optional on the
  // wire, so guard against an older server build that omits it.
  if (server.classeLp != null && server.classeLp > (local.classeLp ?? 1000)) {
    patch.classeLp = server.classeLp;
  }
  // Classé record — W/L/D are monotonic, so max-per-field is correct (same as
  // the global stats merge above).
  const localCs = local.classeStats ?? { wins: 0, losses: 0, draws: 0 };
  const sW = server.classeWins ?? 0, sL = server.classeLosses ?? 0, sD = server.classeDraws ?? 0;
  if (sW > localCs.wins || sL > localCs.losses || sD > localCs.draws) {
    patch.classeStats = {
      wins: Math.max(localCs.wins, sW),
      losses: Math.max(localCs.losses, sL),
      draws: Math.max(localCs.draws, sD),
    };
  }

  // Cosmetics — the LOCAL choice is the stable source of truth on every boot.
  // The server copy is a BACKUP that only seeds a fresh/wiped install — it must
  // NEVER override a look the player already has locally, otherwise the theme
  // visibly flickers at launch (local hydrate → server overwrite a few seconds
  // later when bootSync lands). Previously this adopted the server look whenever
  // server.updatedAt > local.syncedAt, which fired on essentially every boot.
  //
  // Rule: adopt the server look ONLY when the local profile is "vierge" — i.e.
  // the player has no explicit background chosen (default / unset). That's the
  // reinstall-recovery case. Once a background is chosen locally, the entire
  // local look wins and is pushed up; the player keeps that choice every launch
  // until THEY change it. (Avatar/nickname follow the same vierge gate.)
  const localHasChosen =
    !!local.backgroundId && local.backgroundId !== "default";
  if (!localHasChosen && (server.updatedAt ?? 0) > 0) {
    if (server.themeId && server.themeId in THEMES) patch.themeId = server.themeId as ThemeId;
    if (server.backgroundId && server.backgroundId in BACKGROUNDS_BY_ID) patch.backgroundId = server.backgroundId as BackgroundId;
    if (server.padId && server.padId in PAD_META) patch.padId = server.padId as PadId;
    if (server.avatar && isAvatarImage(server.avatar)) patch.avatar = server.avatar;
    if (server.nickname && server.nickname.trim().length > 0) patch.nickname = server.nickname.slice(0, 24);
    // Gameplay / accessibility prefs — same reinstall-recovery gate. Only adopt
    // values that are actually set & valid (server sends "" / 0 when unset).
    if (server.difficulty && ["easy", "normal", "hard"].includes(server.difficulty)) {
      patch.difficulty = server.difficulty as Difficulty;
    }
    if (server.fontScale && server.fontScale >= 1) patch.fontScale = server.fontScale;
    if (server.padChosen) patch.padChosen = true;
  }

  return patch;
}

/** Handle a `state_loaded` message from the server: merge into local store
 *  and push the merged result back. */
export function handleStateLoaded(server: PlayerProgress, client: OnlineClient, claimToken?: string) {
  const store = useStore.getState();
  const local = store.player;
  const patch = mergeServerState(local, server);

  // Persist the TOFU claim token if the server issued/confirmed one.
  if (claimToken) {
    patch.claimToken = claimToken;
  }

  // Apply patch to local store if anything changed
  if (Object.keys(patch).length > 0) {
    store.applyServerSync(patch);
  }

  // Push merged state back to server so it has the union, and anchor our
  // last-synced timestamp to that push (LWW reference for cosmetics).
  const merged = { ...local, ...patch };
  const progress = buildProgressFromPlayer(merged as Player);
  client.send({ type: "sync_state", state: progress });
  store.applyServerSync({ syncedAt: progress.updatedAt });
}

/** Push current player state to the server. Call after important actions
 *  (match end, pack open, craft, quest claim, season rollover, cosmetic change). */
export function pushPlayerState(client: OnlineClient | null) {
  if (!client || client.status !== "open") return;
  const store = useStore.getState();
  const progress = buildProgressFromPlayer(store.player);
  client.send({ type: "sync_state", state: progress });
  store.applyServerSync({ syncedAt: progress.updatedAt });
}

const ONE_SHOT_TIMEOUT = 8_000;

/** Transient one-shot push for when there is NO active OnlinePage WebSocket.
 *  Without this, any state change while the player is on the Shop / DeckManager /
 *  any non-online surface dies in localStorage and is LOST on reinstall — the
 *  exact "j'ai plus les cartes que j'ai achetées" symptom. Mirrors bootSync's
 *  ephemeral connect → hello → state_loaded → sync_state → close lifecycle. */
function pushPlayerStateOneShot(): void {
  const state = useStore.getState();
  const player = state.player;
  if (!player.id) return;
  const url = state.serverConfig?.cloudUrl || DEFAULT_CLOUD_URL;
  const normalized = normalizeServerUrl(url);
  if (!normalized) return;
  const wsUrl = normalized.replace(/\/+$/, "") + "/ws";

  let ws: WebSocket;
  try { ws = new WebSocket(wsUrl); } catch { return; }
  const timeout = setTimeout(() => { try { ws.close(); } catch { /* */ } }, ONE_SHOT_TIMEOUT);

  ws.onopen = () => {
    try {
      ws.send(JSON.stringify({
        type: "hello",
        nickname: player.nickname || "Anonymous",
        player_id: player.id,
        claim_token: player.claimToken || "",
      }));
    } catch { /* */ }
  };

  ws.onmessage = (ev) => {
    let msg: { type?: string };
    try { msg = JSON.parse(ev.data as string); } catch { return; }
    // Once the server has accepted us (state_loaded), push CURRENT local state.
    // We deliberately don't merge here — the live local state (with the new pack
    // contents) is the source of truth; bootSync at next launch handles the
    // proper union-merge. The goal here is just to persist the change.
    if (msg.type === "state_loaded") {
      try {
        const progress = buildProgressFromPlayer(useStore.getState().player);
        ws.send(JSON.stringify({ type: "sync_state", state: progress }));
        useStore.getState().applyServerSync({ syncedAt: progress.updatedAt });
      } catch { /* */ }
      // Give the server a moment to ack, then close.
      setTimeout(() => { clearTimeout(timeout); try { ws.close(); } catch { /* */ } }, 300);
    }
  };

  ws.onerror = () => clearTimeout(timeout);
  ws.onclose = () => clearTimeout(timeout);
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
  return [
    p.xp, p.rankLp, p.eclats, p.dust, p.stars ?? 0, p.stats?.wins, p.stats?.losses,
    (p.cardCollection ?? []).length, (p.claimedQuests ?? []).length, p.winStreak ?? 0,
    // Classé own ladder + record — so a Classé match pushes to the cloud too.
    p.classeLp ?? 1000, p.classeStats?.wins ?? 0, p.classeStats?.losses ?? 0,
    // Cosmetics + prefs — so picking a theme/background/pad/avatar/difficulty pushes too.
    p.themeId, p.backgroundId, p.padId, p.avatar, p.nickname,
    p.difficulty, p.fontScale ?? 1, p.padChosen ?? false,
  ].join("|");
}

let _lastFingerprint = "";
let _lastPlayerRef: Player | null = null;
let _debounce: ReturnType<typeof setTimeout> | null = null;

/** Subscribe to the store and auto-push state when progression changes.
 *  Called once at app boot (App.tsx). */
export function startSyncSubscriber() {
  const initial = useStore.getState().player;
  _lastFingerprint = syncFingerprint(initial);
  _lastPlayerRef = initial;

  useStore.subscribe((state) => {
    // Ref-check first: every store action that touches the player spreads a
    // new object (`{ player: { ...s.player, ...patch } }`), so a referentially
    // equal player means a non-player change (locale, serverConfig, …). Bail
    // before paying the 13-field fingerprint join — this fires for the vast
    // majority of store updates.
    if (state.player === _lastPlayerRef) return;
    _lastPlayerRef = state.player;

    const fp = syncFingerprint(state.player);
    if (fp === _lastFingerprint) return;
    _lastFingerprint = fp;

    // Debounce: if multiple changes happen rapidly (e.g. recordMatch + eclats),
    // batch into one push after 500ms of quiet.
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      _debounce = null;
      // Prefer the live OnlinePage socket when it's open (no extra connection
      // cost), otherwise fire a one-shot transient WS so the state actually
      // lands on the server. Without this fallback, every pack/craft/codex
      // claim made off the OnlinePage was lost on reinstall.
      if (_activeClient && _activeClient.status === "open") {
        pushPlayerState(_activeClient);
      } else {
        pushPlayerStateOneShot();
      }
    }, 500);
  });
}
