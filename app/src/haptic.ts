/**
 * Tiny haptic feedback helper.
 *
 * Uses navigator.vibrate (Android, and a handful of desktop browsers when
 * `dom.vibrator.enabled=true`). iOS Safari ignores it — that's fine, the
 * call becomes a no-op. Everything is gated on the API existing, so we never
 * throw or warn.
 */

type Pattern = number | number[];

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Fire a vibration pattern. Silently no-ops if the device doesn't support it. */
export function vibrate(pattern: Pattern): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore — some browsers throw if the page is in the background. */
  }
}

/* ── Named events used by the match flow ─────────────────────────────── */

/** Soft tap: move picked / button confirmed. */
export const hapticTap = () => vibrate(10);

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
