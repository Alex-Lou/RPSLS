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
import { AnimatePresence, motion } from "motion/react";

interface Crystal {
  id: number;
  /** Position in viewport %. We use % so the backdrop scales with the device. */
  x: number;
  y: number;
  rot: number;
  /** "small" = tap default, "big" = held. Mutates while held. */
  size: "small" | "big";
  /** Performance timestamp (ms) — used for tap-vs-existing crystal detection. */
  born: number;
  /** Set when the user re-taps this crystal — triggers the shatter exit. */
  shattering?: boolean;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
}

const MAX_CRYSTALS = 20;
const MAX_BUBBLES = 40;
const CRYSTAL_TTL_MS = 6000;
const BUBBLE_TTL_MS = 1700;
const HOLD_BLOOM_MS = 350;
const BUBBLE_THROTTLE_MS = 70;
const SHATTER_HIT_RADIUS_PCT = 6;

export function QuartzInteractiveLayer({ enabled }: { enabled: boolean }) {
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

  return (
    <div
      ref={layerRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      className="absolute inset-0"
      style={{ pointerEvents: enabled ? "auto" : "none", touchAction: "none" }}
    >
      <AnimatePresence>
        {bubbles.map((b) => <BubbleMark key={b.id} x={b.x} y={b.y} />)}
        {crystals.map((c) => (
          <CrystalMark key={c.id} c={c} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Small drifting bubble — gold rim, hollow centre, drifts up + fades. */
function BubbleMark({ x, y }: { x: number; y: number }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1, 0.9], y: [0, -22, -38] }}
      transition={{ duration: BUBBLE_TTL_MS / 1000, ease: "easeOut" }}
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: 9,
        height: 9,
        translate: "-50% -50%",
        border: "1.2px solid #fde9ff",
        background:
          "radial-gradient(circle, rgba(255,233,225,0.55) 30%, rgba(251,191,36,0.18) 70%, transparent 100%)",
        boxShadow: "0 0 10px rgba(251,191,36,0.55)",
      }}
    />
  );
}

/** A summoned crystal — same shape as the backdrop shards (hex sliver),
 *  but spawn-grown with an aura + sparkle. Mutates to "big" on hold,
 *  shatters with a gold burst when re-tapped. */
function CrystalMark({ c }: { c: Crystal }) {
  const big = c.size === "big";
  const W = big ? 56 : 36;
  const H = W * 1.55;
  // Shatter: tilt + scale-out with a small burst overlay.
  const variants = c.shattering
    ? { opacity: [1, 0], scale: [big ? 1.45 : 1, 0.4], rotate: [c.rot, c.rot + 25] }
    : {
        opacity: [0, 1, big ? 0.95 : 0.9],
        scale: [0.2, big ? 1.45 : 1, big ? 1.4 : 0.96],
        rotate: [c.rot - 30, c.rot, c.rot],
      };
  const dur = c.shattering ? 0.55 : 0.85;
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.2 }}
      animate={variants}
      exit={{ opacity: 0 }}
      transition={{ duration: dur, ease: c.shattering ? "easeIn" : [0.16, 1, 0.3, 1] }}
      className="absolute pointer-events-none"
      style={{
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: W,
        height: H,
        translate: "-50% -50%",
        willChange: "transform, opacity",
      }}
    >
      {/* Aura — soft warm halo so the spawn reads as "lit from within". */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(circle, rgba(251,207,128,0.65), rgba(253,233,255,0.25) 50%, transparent 75%)",
        }}
      />
      {/* The shard. */}
      <svg viewBox="-10 -16 20 32" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`uqz-${c.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde9ff" stopOpacity="0.98" />
            <stop offset="40%" stopColor="#dbe7ff" stopOpacity="0.85" />
            <stop offset="80%" stopColor="#c8aef0" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3b2c5a" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M 0 -16 L 7 -6 L 6 12 L -6 12 L -7 -6 Z" fill={`url(#uqz-${c.id})`} />
        <path d="M 0 -14 L 3 -6 L 2 10 L -2 10 L -3 -6 Z" fill="#ffffff" fillOpacity="0.5" />
      </svg>
      {/* Shatter burst — 8 little gold motes radiating out. */}
      {c.shattering && (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * 36, y: Math.sin(a) * 36, opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: 3, height: 3,
                  background: i % 2 ? "#fde68a" : "#fbcf80",
                  boxShadow: "0 0 8px rgba(251,191,36,0.95)",
                  translate: "-50% -50%",
                }}
              />
            );
          })}
        </>
      )}
    </motion.span>
  );
}
