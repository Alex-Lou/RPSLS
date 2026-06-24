/**
 * OwnedBadgeLongPress — hold the "✓ OWNED" badge for 3 s to revoke a premium
 * set so the purchase flow can be re-tested.
 *
 * Why 3 s + a visible ring: the previous 800 ms version "ne marchait pas du
 * tout" because (a) the click on the parent picker button kept firing
 * regardless of the long-press timer, and (b) 800 ms left no time for the
 * tester to feel a confirmation beat. This rewrite:
 *
 *   - stops EVERY pointer/click event on the wrapper so the surrounding
 *     <button> in ProfilePage can't re-apply the bg mid-press
 *   - draws an SVG progress ring around the badge that fills 0 → 100 % over
 *     the 3 000 ms hold, giving the user a clear "yes, keep holding" signal
 *   - fires a soft haptic tick at 1 500 ms (halfway) so the player feels the
 *     gesture is registered before commitment
 *   - fires a strong haptic + revoke at 3 000 ms
 *   - cancels cleanly on release / drift / leave (no orphan timers)
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { PremiumBadge } from "./PremiumBadge";
import { useStore } from "../store/store";
import { hapticAlert, hapticMatchWin, hapticTap } from "../haptic";

const HOLD_MS = 3000;
const HALFWAY_MS = 1500;
const DRIFT_CANCEL_PX = 10;

export function OwnedBadgeLongPress({
  setId,
  className = "",
}: {
  setId: string;
  className?: string;
}) {
  const revoke = useStore((s) => s.revokePremiumSet);
  const [progress, setProgress] = useState(0);
  const [pressing, setPressing] = useState(false);

  const startAt = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);
  const halfwayFired = useRef(false);
  const progressRef = useRef(0);

  const cleanup = () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    startAt.current = null;
    startPos.current = null;
    halfwayFired.current = false;
    progressRef.current = 0;
    setPressing(false);
    setProgress(0);
  };

  useEffect(() => () => cleanup(), []);

  const tick = () => {
    if (startAt.current === null) return;
    const elapsed = performance.now() - startAt.current;
    const p = Math.min(1, elapsed / HOLD_MS);
    progressRef.current = p;
    setProgress(p);
    if (!halfwayFired.current && elapsed >= HALFWAY_MS) {
      halfwayFired.current = true;
      hapticTap();
    }
    if (p >= 1) {
      hapticMatchWin();
      revoke(setId);
      cleanup();
      return;
    }
    rafId.current = requestAnimationFrame(tick);
  };

  // Stops every variant of "the parent picker will think this was a tap to
  // re-apply the bg" — pointer events, the synthesized click, and the
  // long-press-triggered context menu on mobile.
  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div
      onPointerDown={(e) => {
        // La RÉVOCATION par appui long (re-test du flux d'achat) n'est désactivée
        // que dans une vraie RELEASE PUBLIQUE (VITE_PUBLIC_RELEASE=1) ; elle reste
        // dispo en dev ET dans les builds debug device. En public, le badge
        // « ✓ OWNED » reste et le tap passe au parent (sélection normale du
        // cosmétique possédé). Alex 2026-06-20 « virer le test dev en public ».
        if (import.meta.env.VITE_PUBLIC_RELEASE === "1") return;
        stopAll(e);
        startAt.current = performance.now();
        startPos.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        halfwayFired.current = false;
        hapticTap();
        rafId.current = requestAnimationFrame(tick);
      }}
      onPointerMove={(e) => {
        if (!startPos.current) return;
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        if (Math.hypot(dx, dy) > DRIFT_CANCEL_PX) {
          // Slid out → user is scrolling / panning, not committing.
          if (progressRef.current > 0.3) hapticAlert();
          cleanup();
        }
      }}
      onPointerUp={(e) => {
        stopAll(e);
        cleanup();
      }}
      onPointerCancel={() => cleanup()}
      onPointerLeave={() => cleanup()}
      // Block click + ctx menu too so the surrounding <button> never fires.
      onClick={(e) => stopAll(e)}
      onContextMenu={(e) => { stopAll(e); e.preventDefault(); }}
      className={"absolute z-20 " + className}
      style={{ touchAction: "none" }}
    >
      <PremiumBadge variant="ribbon" label="✓ OWNED" />

      {/* Progress ring: circular SVG that fills as the hold accumulates.
          strokeDashoffset drives the 0 → 100 % sweep with a 50 ms linear
          tween so each rAF frame interpolates smoothly without jitter. */}
      {pressing && (
        <motion.svg
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          viewBox="0 0 120 120"
          className="absolute pointer-events-none"
          style={{ inset: -12, width: "calc(100% + 24px)", height: "calc(100% + 24px)" }}
        >
          {/* Track */}
          <circle cx={60} cy={60} r={52} stroke="rgba(0,0,0,0.4)" strokeWidth={6} fill="none" />
          {/* Fill — gold sweep, starts at 12 o'\''clock. */}
          <circle
            cx={60}
            cy={60}
            r={52}
            stroke="#fbbf24"
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            transform="rotate(-90 60 60)"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={(1 - progress) * 2 * Math.PI * 52}
            style={{
              transition: "stroke-dashoffset 0.05s linear",
              filter: "drop-shadow(0 0 8px rgba(251,191,36,0.9))",
            }}
          />
        </motion.svg>
      )}
    </div>
  );
}
