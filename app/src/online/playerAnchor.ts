/**
 * playerAnchor.ts — durable persistence of player.id + claimToken via the
 * Tauri Store plugin.
 *
 * THE PROBLEM
 *  Android Tauri WebView storage (localStorage, IndexedDB, SessionStorage) is
 *  WIPED on every `adb install` without -r, on every real user uninstall, and
 *  when the OS reclaims storage. When that happens:
 *   - player.id is regenerated locally (fresh UUID)
 *   - claimToken disappears
 *   - on next bootSync the server sees a brand-new player_id with no token,
 *     creates a fresh account
 *   - all currencies / cards / cosmetics on the server are orphaned on the
 *     old player_id, completely unreachable
 *  Result: every "reinstall" was a silent account loss. Critical for both
 *  development AND production (since real users uninstall apps).
 *
 * THE FIX
 *  tauri-plugin-store writes JSON files to the OS's app data directory:
 *    Android: /data/data/<package>/files/
 *    iOS    : <App>/Library/Application Support/
 *    Desktop: %APPDATA% / ~/.local/share / Library
 *  These paths are MANAGED BY THE OS, not the WebView — they survive both
 *  the localStorage wipe AND, on Android, can be restored from auto-backup.
 *
 *  The anchor file player_anchor.json holds just two strings:
 *    { "id": "<uuid>", "claimToken": "<uuid>" }
 *  We read it ONCE at app boot, BEFORE the rest of the app touches the
 *  player store, and seed the Zustand store with those values if the local
 *  (zustand-persist) is empty / stale. We write it after every bootSync
 *  that issues a fresh claim token.
 *
 * GRACEFUL DEGRADATION
 *  Web preview / non-Tauri targets don't have the plugin → the load/save
 *  helpers silently no-op. Existing localStorage-based persistence keeps
 *  working unchanged.
 */

import type { Store } from "@tauri-apps/plugin-store";

const ANCHOR_FILE = "player_anchor.json";
const KEY_ID = "id";
const KEY_TOKEN = "claimToken";

/** Cached store handle. We open lazily on first access — the plugin imports
 *  Tauri APIs that aren't available in dev / browser preview. */
let _store: Store | null = null;
let _opened = false;

async function openStore(): Promise<Store | null> {
  if (_opened) return _store;
  _opened = true;
  // Tauri detection — outside Tauri this throws on import. We catch and
  // disable the anchor; the existing localStorage flow keeps working.
  try {
    const mod = await import("@tauri-apps/plugin-store");
    _store = await mod.load(ANCHOR_FILE, { autoSave: true, defaults: {} });
    return _store;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[playerAnchor] store unavailable (non-Tauri target)", e);
    _store = null;
    return null;
  }
}

/** Load the persisted anchor. Returns null fields if not present (first
 *  boot) or if the plugin isn't available (browser preview). */
export async function loadAnchor(): Promise<{ id: string | null; claimToken: string | null }> {
  const s = await openStore();
  if (!s) return { id: null, claimToken: null };
  try {
    const id = (await s.get<string>(KEY_ID)) ?? null;
    const claimToken = (await s.get<string>(KEY_TOKEN)) ?? null;
    return { id, claimToken };
  } catch {
    return { id: null, claimToken: null };
  }
}

/** Save a fresh anchor (typically right after the server has issued / confirmed
 *  the claim token). Idempotent — safe to call on every sync. */
export async function saveAnchor(id: string, claimToken: string): Promise<void> {
  if (!id || !claimToken) return;
  const s = await openStore();
  if (!s) return;
  try {
    await s.set(KEY_ID, id);
    await s.set(KEY_TOKEN, claimToken);
    await s.save();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[playerAnchor] save failed", e);
  }
}

/** Clear the anchor — used only by manual "delete my account" flows. Normal
 *  operation never deletes. */
export async function clearAnchor(): Promise<void> {
  const s = await openStore();
  if (!s) return;
  try {
    await s.delete(KEY_ID);
    await s.delete(KEY_TOKEN);
    await s.save();
  } catch {
    /* */
  }
}
