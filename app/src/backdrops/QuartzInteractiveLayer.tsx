/**
 * QuartzInteractiveLayer — touch-reactive crystals + bubbles for the Quartz
 * premium backdrop.
 *
 * Interaction grammar (only active when `enabled` is true — typically during
 * the full-screen backdrop peek; off everywhere else so the regular UI taps
 * keep working unchanged):
 *
 *   tap         → spawn a crystal at the touch point that grows in + spins
 *   slide       → leave a trail of small drifting bubbles (one every ~70ms)
 *   hold (~350ms, no drift)
 *               → the most-recent crystal "blooms" (scales 1.0 → 1.45 +
 *                 brighter aura) until released
 *   tap on an existing crystal
 *               → it shatters (gold sparkle burst + remove)
 *
 * Performance hardening:
 *   - All state lives in React state; no per-frame setState, no rAF loop.
 *     Each motion.div animates its own keyframes on the GPU compositor.
 *   - Hard cap: 20 crystals, 40 bubbles. Past that, oldest is evicted FIFO.
 *   - Every item self-cleans via a setTimeout matched to its animation.
 *     Cleanup ids tracked in a ref so unmount + tab-switch never leak.
 *   - SVG via inline elements (single layer, no nested SVG roots).
 *   - pointerEvents: auto only on the capture div, so when `enabled=false`
 *     the layer reverts to invisible-passthrough — no UI interference.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { menuFxSuppressed } from "../fx/menuFx";
import {
  MAX_CRYSTALS, MAX_BUBBLES, CRYSTAL_TTL_MS, BUBBLE_TTL_MS, HOLD_BLOOM_MS,
  BUBBLE_THROTTLE_MS, SHATTER_HIT_RADIUS_PCT, type Crystal, type Bubble,
} from "./quartzLayerConfig";
import { BubbleMark, CrystalMark } from "./QuartzLayerMarks";

/**
 * Three operating modes:
 *  - mode="off"     — layer is invisible-passthrough, no event listening.
 *  - mode="passive" — layer listens at WINDOW level, NEVER intercepts clicks
 *                     (pointerEvents stay 'none'). Crystals/bubbles render
 *                     behind the UI so taps on buttons still register. Used
 *                     during normal gameplay — the player can play with the
 *                     backdrop without losing UI tappability.
 *  - mode="active"  — layer captures pointer events on itself (pointerEvents:
 *                     auto). Used during the full-screen peek so the
 *                     interaction is the focus, no UI to compete for taps.
 */
export type QuartzLayerMode = "off" | "passive" | "active";

export function QuartzInteractiveLayer({
  enabled,
  mode,
}: {
  enabled?: boolean;
  mode?: QuartzLayerMode;
}) {
  // Backwards compat: callers passing `enabled` get the binary on/off behaviour;
  // new callers can pass `mode` for tri-state control.
  const resolvedMode: QuartzLayerMode = mode ?? (enabled ? "active" : "off");
  const layerEnabled = resolvedMode !== "off";
  return (
    <QuartzInteractiveLayerInner enabled={layerEnabled} mode={resolvedMode} />
  );
}

function QuartzInteractiveLayerInner({
  enabled,
  mode,
}: {
  enabled: boolean;
  mode: QuartzLayerMode;
}) {
  const [crystals, setCrystals] = useState<Crystal[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const lastBubbleAt = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const heldId = useRef<number | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const idCtr = useRef(1);
  // Tracks every pending setTimeout so we can clear them all on unmount /
  // when `enabled` flips off mid-stream — no stale callbacks firing later.
  const timers = useRef<Set<number>>(new Set());

  // Convert a pointer event to a percentage position relative to the layer.
  const pctFromEvent = useCallback((e: { clientX: number; clientY: number }) => {
    const el = layerRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  }, []);

  // Single source of truth for setTimeout — keeps the timers set in sync.
  const scheduleCleanup = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    // NEVER spawn crystals during a match — match surfaces suppress menu FX.
    if (menuFxSuppressed()) return;
    const p = pctFromEvent(e);
    downAt.current = p;
    // Was this tap inside an existing crystal? If so, shatter it instead of
    // spawning a new one — gives the user a clean "delete" affordance.
    const hit = crystals.find(
      (c) =>
        Math.hypot(c.x - p.x, c.y - p.y) < SHATTER_HIT_RADIUS_PCT && !c.shattering,
    );
    if (hit) {
      setCrystals((cs) => cs.map((c) => (c.id === hit.id ? { ...c, shattering: true } : c)));
      scheduleCleanup(600, () =>
        setCrystals((cs) => cs.filter((c) => c.id !== hit.id)),
      );
      return;
    }
    // Otherwise spawn a new crystal + start the hold-to-bloom timer.
    const id = idCtr.current++;
    const fresh: Crystal = {
      id, x: p.x, y: p.y,
      rot: (Math.floor(id * 53) % 60) - 30,
      size: "small",
      born: performance.now(),
    };
    setCrystals((cs) => {
      const next = [...cs, fresh];
      // FIFO evict if past the cap.
      return next.length > MAX_CRYSTALS ? next.slice(next.length - MAX_CRYSTALS) : next;
    });
    heldId.current = id;
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      // Still down + still our crystal → bloom.
      if (heldId.current === id) {
        setCrystals((cs) => cs.map((c) => (c.id === id ? { ...c, size: "big" } : c)));
      }
    }, HOLD_BLOOM_MS);
    scheduleCleanup(CRYSTAL_TTL_MS, () =>
      setCrystals((cs) => cs.filter((c) => c.id !== id)),
    );
  }, [enabled, crystals, pctFromEvent, scheduleCleanup]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!enabled || downAt.current === null) return;
    if (menuFxSuppressed()) return;
    const p = pctFromEvent(e);
    const dx = p.x - downAt.current.x;
    const dy = p.y - downAt.current.y;
    // Any meaningful drift cancels the hold-bloom — the user is sliding.
    if (Math.hypot(dx, dy) > 1 && holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      heldId.current = null;
    }
    const now = performance.now();
    if (now - lastBubbleAt.current < BUBBLE_THROTTLE_MS) return;
    lastBubbleAt.current = now;
    const id = idCtr.current++;
    const fresh: Bubble = { id, x: p.x, y: p.y };
    setBubbles((bs) => {
      const next = [...bs, fresh];
      return next.length > MAX_BUBBLES ? next.slice(next.length - MAX_BUBBLES) : next;
    });
    scheduleCleanup(BUBBLE_TTL_MS, () =>
      setBubbles((bs) => bs.filter((b) => b.id !== id)),
    );
  }, [enabled, pctFromEvent, scheduleCleanup]);

  const onUp = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    heldId.current = null;
    downAt.current = null;
  }, []);

  // Hard cleanup: when `enabled` flips off (peek closes), or when the parent
  // unmounts, wipe everything in flight so the bubble/crystal arrays don't
  // re-render alone in the background and the timer set is empty.
  useEffect(() => {
    if (enabled) return;
    setCrystals([]);
    setBubbles([]);
    for (const id of timers.current) window.clearTimeout(id);
    timers.current.clear();
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, [enabled]);

  useEffect(() => () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current.clear();
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
  }, []);

  // In ACTIVE mode the layer itself receives pointer events (peek view).
  // In PASSIVE mode we attach to WINDOW so UI elements still receive their
  // own clicks — the backdrop simply ALSO listens, never intercepts.
  useEffect(() => {
    if (mode !== "passive") return;
    const toEvt = (ev: PointerEvent) => ({
      clientX: ev.clientX,
      clientY: ev.clientY,
    });
    const handleDown = (e: PointerEvent) =>
      onDown({ ...toEvt(e), nativeEvent: e } as unknown as React.PointerEvent);
    const handleMove = (e: PointerEvent) =>
      onMove({ ...toEvt(e), nativeEvent: e } as unknown as React.PointerEvent);
    window.addEventListener("pointerdown", handleDown, { passive: true });
    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [mode, onDown, onMove, onUp]);

  const content = (
    <div
      ref={layerRef}
      // Active mode: capture pointer events on the layer itself.
      onPointerDown={mode === "active" ? onDown : undefined}
      onPointerMove={mode === "active" ? onMove : undefined}
      onPointerUp={mode === "active" ? onUp : undefined}
      onPointerCancel={mode === "active" ? onUp : undefined}
      onPointerLeave={mode === "active" ? onUp : undefined}
      // PASSIVE: fixed full-screen at z-[60] (ABOVE the opaque menu cards,
      // BELOW modals at z-[120]) so the crystals/bubbles are VISIBLE in-game
      // — previously the layer rendered at z-0 behind the menu, so the touch
      // FX existed but were hidden. pointer-events stay none so taps reach
      // the UI; the window-level listeners (effect above) drive the FX.
      // ACTIVE: absolute fill inside the peek wrapper, capturing events.
      className={mode === "passive" ? "fixed inset-0 z-[60]" : "absolute inset-0"}
      style={{
        pointerEvents: mode === "active" ? "auto" : "none",
        touchAction: "none",
      }}
    >
      <AnimatePresence>
        {bubbles.map((b) => <BubbleMark key={b.id} x={b.x} y={b.y} />)}
        {crystals.map((c) => (
          <CrystalMark key={c.id} c={c} />
        ))}
      </AnimatePresence>
    </div>
  );
  // Passive layer portals to <body> so its z-[60] isn't trapped in the
  // backdrop's z-0 stacking context (where it'd stay behind the menu).
  return mode === "passive" ? createPortal(content, document.body) : content;
}
