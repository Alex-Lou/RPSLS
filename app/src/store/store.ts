import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppState } from "./storeTypes";
import { createSlice } from "./storeSlice";
import { persistOptions } from "./persistConfig";
import { initHistorySideChannel } from "./historySideChannel";

export const useStore = create<AppState>()(persist(createSlice, persistOptions));

// Wire the debounced history side-channel AFTER useStore exists (subscribe +
// pagehide). MUST be a call, not a for-effect import: ES module imports are
// hoisted, so an import would run before create() and bind a missing store.
initHistorySideChannel();

// Barrel re-exports — keep every existing `…/store/store` import path resolving
// byte-for-byte identically (50 consumers import the literal segment store/store).
export { emptyByMove, defaultPlayer, defaultServerConfig, DEFAULT_CLOUD_URL, randomNickname } from "./storeDefaults";
export type { ServerMode, ServerConfig, AppState } from "./storeTypes";
