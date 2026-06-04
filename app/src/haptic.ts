/**
 * Tiny haptic feedback helper.
 *
 * PRIMARY path: the native Tauri haptics plugin (@tauri-apps/plugin-haptics),
 * which drives the Android Vibrator service directly — reliable inside the
 * Tauri WebView where `navigator.vibrate` is often a silent no-op.
 *
 * FALLBACK: navigator.vibrate for plain-web / dev-in-browser runs.
 *
 * The plugin API is async; our callers fire-and-forget, so we ignore the
 * returned promise. Total ms of a pattern drives the native vibration
 * duration (the plugin's `vibrate(ms)`).
 */

import { vibrate as nativeVibrate } from "@tauri-apps/plugin-haptics";

type Pattern = number | number[];
export type HapticIntensity = "low" | "med" | "high";

/** True when running inside the Tauri runtime (native plugin available). */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function canWebVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/* ── Module-level settings, synced from the Zustand store by App.tsx ─────── */
let _enabled = true;
let _intensity: HapticIntensity = "med";

/** Called by App.tsx in a useEffect whenever the player toggles haptics. */
export function setHapticSettings(s: { enabled: boolean; intensity: HapticIntensity }) {
  _enabled = s.enabled;
  _intensity = s.intensity;
}

/** Multiplier applied to every ms value of a pattern based on intensity. */
function scale(pattern: Pattern): Pattern {
  const mult = _intensity === "low" ? 0.5 : _intensity === "high" ? 1.4 : 1.0;
  if (typeof pattern === "number") return Math.max(1, Math.round(pattern * mult));
  return pattern.map((v) => Math.max(1, Math.round(v * mult)));
}

/** Total active-buzz ms of a pattern (drives the native single-shot duration).
 *  For an array we sum the "on" segments (even indices) so a triple-buzz still
 *  feels meatier than a single tap. */
function totalMs(pattern: Pattern): number {
  const p = scale(pattern);
  if (typeof p === "number") return p;
  return p.reduce((sum, v, i) => (i % 2 === 0 ? sum + v : sum), 0);
}

/** Fire a vibration pattern. No-ops when disabled. Prefers the native Tauri
 *  plugin, falls back to navigator.vibrate on the web. */
export function vibrate(pattern: Pattern): void {
  if (!_enabled) return;
  if (inTauri()) {
    // Native plugin — async, fire-and-forget. Clamp to a sane min so a
    // sub-perceptible 1ms buzz still registers on the motor.
    void nativeVibrate(Math.max(10, totalMs(pattern))).catch(() => {});
    return;
  }
  if (canWebVibrate()) {
    try { navigator.vibrate(scale(pattern)); } catch { /* background tab */ }
  }
}

/* ── Named events used by the match flow ─────────────────────────────── */

/** Soft tap: move picked / button confirmed.
 *  Bumped from 10 ms to 22 ms so it's actually felt through a phone case. */
export const hapticTap = () => vibrate(22);

/** Lock / important confirmation. */
export const hapticLock = () => vibrate(20);

/** Match found — short attention double-tap. */
export const hapticMatchStart = () => vibrate([30, 40, 30]);

/** Round revealed in your favor. */
export const hapticWin = () => vibrate([20, 30, 20]);

/** Round revealed against you. */
export const hapticLoss = () => vibrate([60, 40, 60]);

/** Match won — celebratory triple buzz. */
export const hapticMatchWin = () => vibrate([40, 50, 40, 50, 80]);

/** Match lost — heavy thud. */
export const hapticMatchLoss = () => vibrate([100, 60, 100]);

/** Connection lost / dropped. */
export const hapticAlert = () => vibrate([30, 20, 30, 20, 30]);
