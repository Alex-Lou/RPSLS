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
import { type OnlineClient, type PlayerProgress } from "./online";
import { resolveWsUrl, helloFrame } from "./transientSession";
import { saveAnchor } from "./playerAnchor";
import { useStore } from "../store/store";
import { mergeServerState } from "./playerStateMerge";

// Fusion / adoption de l'état serveur : déplacées dans playerStateMerge.ts,
// réexportées ici pour ne rien changer aux importeurs existants.
export { mergeServerState, applyAuthState } from "./playerStateMerge";

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
    arenaDeck: player.arenaDeck ?? [],
    ownedPremiumSets: player.ownedPremiumSets ?? [],
    seasonNumber: player.season?.number ?? 1,
    seasonStartedAt: player.season?.startedAt ?? Date.now(),
    winStreak: player.winStreak ?? 0,
    // Classé own ladder + record — cloud-saved like rankLp/stats.
    classeLp: player.classeLp ?? 1000,
    classeWins: player.classeStats?.wins ?? 0,
    classeLosses: player.classeStats?.losses ?? 0,
    classeDraws: player.classeStats?.draws ?? 0,
    arenaWins: player.arenaStats?.wins ?? 0,
    arenaLosses: player.arenaStats?.losses ?? 0,
    arenaDraws: player.arenaStats?.draws ?? 0,
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
    // Historique récent (capé 50) — synchronisé pour survivre au réinstall
    // (Alex 2026-06-13). Lu du STORE (global, pas sur `player`). Restauré
    // uniquement sur install fraîche côté merge → jamais d'écrasement d'un
    // historique local non vide.
    // SANS le détail des manches : 60 matchs Bo9 avec `rounds` dépassaient la
    // limite de 64 KiB par message du serveur → socket coupée, sync perdue en
    // silence. Le détail reste sur l'appareil ; le cloud garde le résumé.
    history: (useStore.getState().history?.slice(0, 60) ?? []).map((h) => ({ ...h, rounds: [] })),
    // ── Progression réparée 2026-06-14 : ces champs étaient ABSENTS du payload
    // → jamais persistés → perdus à chaque install propre (défis du jour
    // re-réclamables, quête pentagramme + Voie réinitialisées). ──
    dailyClaims: player.dailyClaims ?? { date: "", ids: [] },
    completedDailies: player.completedDailies ?? [],
    byMove: player.stats?.byMove ?? {},
    arenaAffinity: player.arenaAffinity,
    abandons: player.abandons,
  };
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

  // Restaure l'historique du cloud sur une install FRAÎCHE (local vide) — AVANT
  // le push-back, sinon on réécraserait le cloud avec un historique vide.
  // Restore-only : jamais d'écrasement d'un historique local NON vide.
  if (useStore.getState().history.length === 0 && server.history && server.history.length > 0) {
    useStore.getState().restoreHistory(server.history);
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
  const player = useStore.getState().player;
  if (!player.id) return;
  const wsUrl = resolveWsUrl();
  if (!wsUrl) return;

  let ws: WebSocket;
  try { ws = new WebSocket(wsUrl); } catch { return; }
  const timeout = setTimeout(() => { try { ws.close(); } catch { /* */ } }, ONE_SHOT_TIMEOUT);

  ws.onopen = () => {
    try {
      ws.send(JSON.stringify(helloFrame(player)));
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
      // Joueur neuf : le serveur vient de créer son jeton (TOFU). Le garder,
      // sinon tous les Hello suivants seraient refusés (auth_failed).
      const token = (msg as { claim_token?: string | null }).claim_token;
      if (token && !useStore.getState().player.claimToken) {
        useStore.getState().applyServerSync({ claimToken: token });
        void saveAnchor(player.id, token).catch(() => undefined);
      }
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

/** Fingerprint of the player progression. When it changes, we push to the
 *  server. DÉRIVÉ du payload `buildProgressFromPlayer` (au lieu de relister les
 *  champs à la main) : ainsi le fingerprint ne peut JAMAIS diverger de ce qui est
 *  réellement poussé — tout champ ajouté au payload est automatiquement couvert
 *  (fini les « j'ai oublié de l'ajouter aux DEUX endroits »).
 *
 *  Trois champs sont NEUTRALISÉS (figés) car ils ne doivent pas déclencher de push :
 *   - `updatedAt` : `Date.now()` à chaque build → sinon le fingerprint changerait
 *     à chaque appel = push infini.
 *   - `seasonStartedAt` : idem `Date.now()` quand aucune saison n'est posée.
 *   - `history` : volumineux, et il co-varie déjà avec les champs de progression à
 *     chaque match (ses deltas sont donc déjà captés) — garde le fingerprint léger. */
function syncFingerprint(p: Player): string {
  return JSON.stringify({
    ...buildProgressFromPlayer(p),
    updatedAt: 0,
    seasonStartedAt: 0,
    history: [],
  });
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
