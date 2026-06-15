import { useLayoutEffect, useRef, useState } from "react";

/**
 * ScaleToFit — guarantees its child ALWAYS fits the available height without
 * scrolling. Measures the child's natural (pre-transform) size and applies a
 * uniform `transform: scale()` so it shrinks to fit a short viewport and never
 * needs a scrollbar. At/under capacity the scale is 1 (no change). This is how
 * the match views promise "you never scroll to reach the Lock button".
 *
 * offsetWidth/offsetHeight are read pre-transform, so scaling never feeds back
 * into the measurement (no loops); a ResizeObserver re-fits on viewport changes
 * (rotation, keyboard) and on content changes (combo banner appearing, etc.).
 */
export function ScaleToFit({
  children,
  className = "",
  align = "center",
  fill = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Vertical anchor of the scaled content within the available box. */
  align?: "center" | "top";
  /** When the content FITS (no scale-down needed), stretch the inner to the
   *  full available height and lay its DIRECT children out with space-between,
   *  instead of leaving empty box above/below. On a short viewport it falls
   *  straight back to natural height + scale-down. Used by the Arena pad so
   *  the lanes fill the frame on tall phones (Alex: "espace vide en dessous")
   *  while still never clipping on short ones. Default off → no behaviour
   *  change for the classic 1v1 callers. */
  fill?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [filled, setFilled] = useState(false);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const availH = outer.clientHeight;
      // scrollHeight reports the content's REAL height even when the inner is
      // stretched to h-full in fill mode, so genuine overflow is still caught.
      const needH = inner.scrollHeight;
      if (!availH || !needH) return;
      if (needH > availH + 1) {
        // Doesn't fit → scale down to fit, natural layout (no fill).
        setFilled(false);
        const next = Math.max(0.4, availH / needH);
        setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
      } else {
        // Fits → no scaling; optionally fill the spare height.
        setScale((prev) => (prev !== 1 ? 1 : prev));
        setFilled(fill);
      }
    };
    measure();
    // The fill consumer (Arena board) mounts AFTER the match splash, so the
    // first measure can run before the flex heights are final — re-measure on
    // the next two frames so `filled` reliably latches on a real-device WebView
    // (where the initial layout lagged and the pad ended up un-stretched).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { measure(); raf2 = requestAnimationFrame(measure); });
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); ro.disconnect(); };
  }, [fill]);

  // When filling, STRETCH the inner to the full available height via flexbox
  // (outer `items-stretch`) instead of `height:100%` — percentage heights
  // against a flex-grown ancestor don't resolve reliably in the Android
  // WebView, which left the pad un-stretched on device (Alex: "le pad doit
  // être étiré vers le bas"). The child (ArenaBoard) then fills via its flex-1.
  const fillActive = fill && filled;

  return (
    <div
      ref={outerRef}
      className={
        "flex-1 min-h-0 w-full overflow-hidden flex justify-center " +
        (fillActive ? "items-stretch " : align === "top" ? "items-start " : "items-center ") +
        className
      }
    >
      <div
        ref={innerRef}
        className={"w-full " + (fill ? "flex flex-col " : "")}
        style={{ transform: `scale(${scale})`, transformOrigin: align === "top" ? "center top" : "center center" }}
      >
        {children}
      </div>
    </div>
  );
}
