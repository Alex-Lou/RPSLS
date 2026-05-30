/**
 * Tiny haptic feedback helper.
 *
 * Uses navigator.vibrate (Android, and a handful of desktop browsers when
 * `dom.vibrator.enabled=true`). iOS Safari ignores it — that's fine, the
 * call becomes a no-op. Everything is gated on the API existing, so we never
 * throw or warn.
 */

type Pattern = number | number[];
export type HapticIntensity = "low" | "med" | "high";

function canVibrate(): boolean {
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

/** Fire a vibration pattern. Silently no-ops if the device doesn't support it
 *  or if the player has haptics disabled in settings. */
export function vibrate(pattern: Pattern): void {
  if (!_enabled || !canVibrate()) return;
  try {
    navigator.vibrate(scale(pattern));
  } catch {
    /* ignore — some browsers throw if the page is in the background. */
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
