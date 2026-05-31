/**
 * DiceRoll — animated 3D-CSS dice that gets thrown, tumbles, and lands.
 *
 * Stages (driven by requestAnimationFrame so we can chain them cleanly):
 *  1. Throw    — die enters from the right offscreen with a wild spin
 *  2. Tumble   — flies toward centre while rotating along both axes
 *  3. Settle   — eases into the target face, lands with a small bounce
 *
 * The cube is built from the six PNGs in /public/Dice Faces/ stacked as
 * 3D faces. A soft elliptical shadow underneath grows/shrinks with the
 * die's vertical position so the throw reads as a real toss.
 */

import { useEffect, useRef, useState } from "react";

export type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

/** Rotation (deg) that brings each face to the front of the cube.
 *  Layout assumes: 1=front, 2=right, 3=top, 4=bottom, 5=left, 6=back. */
const FACE_ROTATION: Record<DiceFace, { x: number; y: number }> = {
  1: { x:   0, y:   0 },
  2: { x:   0, y: -90 },
  3: { x: -90, y:   0 },
  4: { x:  90, y:   0 },
  5: { x:   0, y:  90 },
  6: { x:   0, y: 180 },
};

const DURATION_MS = 1700;
const FULL_SPINS = 5;

export function DiceRoll({
  targetFace,
  size = 84,
  onSettle,
}: {
  /** The face the die must land on. Roll re-animates whenever this changes. */
  targetFace: DiceFace;
  /** Edge length in px. Defaults to 84 — sized for a sidebar/inline trigger. */
  size?: number;
  /** Fires once the animation has settled. */
  onSettle?: (face: DiceFace) => void;
}) {
  const [s, setS] = useState({ rx: -20, ry: 25, tx: 0, ty: 0, scale: 1 });
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
    const start = performance.now();
    const target = FACE_ROTATION[targetFace];
    // Slight resting tilt at the end so the cube reads as 3D not as a flat
    // sticker. Keep small so adjacent faces barely peek out.
    const restingTiltX = -10;
    const restingTiltY = 14;
    const finalRX = -360 * FULL_SPINS + target.x + restingTiltX;
    const finalRY = -360 * FULL_SPINS + target.y + restingTiltY;
    // Throw arc: enters from the right (positive tx) with a small upward
    // hop (negative ty at the peak) and finishes at 0,0.
    const startTX = size * 1.4;
    const startTY = -size * 0.2;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / DURATION_MS);
      // easeOutCubic for the body of the roll
      const eRoll = 1 - Math.pow(1 - t, 3);
      // Position is a separate ease — quick approach, then a tiny settle
      // bounce on touch-down (over-shoot with a damped sine wave).
      const ePos = 1 - Math.pow(1 - t, 4);
      // Vertical bounce: arc up then down, plus a final micro-bounce
      const arcY = Math.sin(Math.PI * t) * -size * 0.55;
      const settleBounce =
        t > 0.85 ? Math.sin((t - 0.85) / 0.15 * Math.PI * 2) * size * 0.04 * (1 - t) : 0;
      setS({
        rx: finalRX * eRoll,
        ry: finalRY * eRoll,
        tx: startTX + (0 - startTX) * ePos,
        ty: startTY + (0 - startTY) * ePos + arcY + settleBounce,
        scale: 1 - 0.05 * (1 - t), // very subtly scales up as it falls
      });
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!settledRef.current) {
        settledRef.current = true;
        onSettle?.(targetFace);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFace]);

  const half = size / 2;
  // Shadow shrinks as the die rises (further from "ground"), grows as it falls.
  const shadowScale = 1 - Math.min(0.6, Math.abs(s.ty) / (size * 0.7));
  const shadowOpacity = 0.35 * shadowScale;
  return (
    <div
      style={{
        perspective: size * 5,
        width: size,
        height: size,
        display: "inline-block",
        position: "relative",
      }}
      className="select-none"
    >
      {/* Soft ground shadow — sells the throw arc by tracking the die's y. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "100%",
          width: size * 0.85,
          height: size * 0.22,
          marginLeft: -(size * 0.425),
          marginTop: -size * 0.1,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(0,0,0,0.45), rgba(0,0,0,0))",
          transform: `scale(${shadowScale})`,
          opacity: shadowOpacity,
          pointerEvents: "none",
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `translate3d(${s.tx}px, ${s.ty}px, 0) scale(${s.scale}) rotateX(${s.rx}deg) rotateY(${s.ry}deg)`,
          willChange: "transform",
        }}
      >
        <Face face={1} style={{ transform: `translateZ(${half}px)` }} size={size} />
        <Face face={6} style={{ transform: `rotateY(180deg) translateZ(${half}px)` }} size={size} />
        <Face face={2} style={{ transform: `rotateY( 90deg) translateZ(${half}px)` }} size={size} />
        <Face face={5} style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }} size={size} />
        <Face face={3} style={{ transform: `rotateX( 90deg) translateZ(${half}px)` }} size={size} />
        <Face face={4} style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }} size={size} />
      </div>
    </div>
  );
}

function Face({ face, style, size }: { face: DiceFace; style: React.CSSProperties; size: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: size,
        height: size,
        backgroundImage: `url("/Dice Faces/${face}.png")`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backfaceVisibility: "hidden",
        ...style,
      }}
    />
  );
}
