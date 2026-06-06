/**
 * useLongPress — fire `onLongPress` after `delayMs` of continuous press.
 *
 * Returns a set of event handlers to spread on the target element. A single
 * tap that releases before delayMs runs `onTap` instead (if provided). Cancels
 * on pointer move past the threshold so a scroll doesn't trigger the long
 * press — important on touch.
 */

import { useCallback, useRef } from "react";

export interface LongPressOpts {
  /** ms before the long press fires. Default 700 — tested feel. */
  delayMs?: number;
  /** Px of finger drift that cancels the long press. Default 8. */
  cancelOnDriftPx?: number;
  /** Called the moment the long press timer elapses (finger still down). */
  onLongPress: () => void;
  /** Called on a normal tap (released before delay). Optional. */
  onTap?: () => void;
}

export function useLongPress({
  delayMs = 700, cancelOnDriftPx = 8, onLongPress, onTap,
}: LongPressOpts) {
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    triggeredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      onLongPress();
    }, delayMs);
  }, [delayMs, onLongPress]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (dx * dx + dy * dy > cancelOnDriftPx * cancelOnDriftPx) cancel();
  }, [cancel, cancelOnDriftPx]);

  const onPointerUp = useCallback(() => {
    const wasTimerActive = timerRef.current !== null;
    cancel();
    if (wasTimerActive && !triggeredRef.current && onTap) onTap();
  }, [cancel, onTap]);

  const onPointerCancel = useCallback(() => cancel(), [cancel]);
  const onPointerLeave = useCallback(() => cancel(), [cancel]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave };
}
