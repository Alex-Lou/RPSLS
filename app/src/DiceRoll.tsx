/**
 * DiceRoll — animated 3D-CSS dice that tumbles for ~1.8s and lands on a
 * pre-determined face. Used at the start of online matches to pick whose
 * cosmetic theme will paint the table.
 *
 * Architecture: a CSS-only cube built from six absolute-positioned faces,
 * each backed by the matching PNG in /public/Dice Faces/. We drive the
 * cube's rotateX + rotateY via requestAnimationFrame with an ease-out
 * curve so it visibly slows into the final pose. The final rotation is
 * picked from FACE_ROTATION so the requested face ends up facing the camera.
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

const ROLL_DURATION_MS = 1800;
const FULL_SPINS = 4;

export function DiceRoll({
  targetFace,
  size = 140,
  onSettle,
}: {
  /** The face the die must land on. Roll re-animates whenever this changes. */
  targetFace: DiceFace;
  /** Edge length in px. */
  size?: number;
  /** Fires once the animation has settled. */
  onSettle?: (face: DiceFace) => void;
}) {
  const [rotation, setRotation] = useState({ x: -20, y: 25 });
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
    const start = performance.now();
    const target = FACE_ROTATION[targetFace];
    // Tilt slightly off-axis at rest so the cube reads as 3D not 2D.
    const restingTiltX = -18;
    const restingTiltY = 22;
    const finalX = -360 * FULL_SPINS + target.x + restingTiltX;
    const finalY = -360 * FULL_SPINS + target.y + restingTiltY;
    const fromX = rotation.x;
    const fromY = rotation.y;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / ROLL_DURATION_MS);
      // easeOutCubic — fast spin that decelerates into the final pose
      const ease = 1 - Math.pow(1 - t, 3);
      setRotation({
        x: fromX + (finalX - fromX) * ease,
        y: fromY + (finalY - fromY) * ease,
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
    // intentionally exclude rotation from deps — restarting on every frame
    // would cancel the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFace]);

  const half = size / 2;
  return (
    <div
      style={{ perspective: size * 4, width: size, height: size, display: "inline-block" }}
      className="select-none"
    >
      <div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
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
