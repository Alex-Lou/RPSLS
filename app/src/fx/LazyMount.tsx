/**
 * LazyMount — defer rendering children until their slot scrolls near the
 * viewport. Once mounted, stays mounted (we don't want pads re-initialising
 * every time the user scrolls past them).
 *
 * Useful for galleries of expensive thumbnails — pad pickers, card grids —
 * where N items all paint at once even though only a handful are visible.
 * SMIL/SVG pads in particular create their own DOM trees + paint listeners,
 * so deferring 8/13 of them on first open is a noticeable boot win.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

export function LazyMount({
  children,
  fallback = null,
  rootMargin = "200px",
  className,
}: {
  children: ReactNode;
  /** What to render while the slot is off-screen. Defaults to nothing. */
  fallback?: ReactNode;
  /** IntersectionObserver rootMargin — bump to mount a bit before scroll-in. */
  rootMargin?: string;
  /** Forwarded to the placeholder div so the slot keeps its layout size. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    // Older WebViews / SSR-less builds: be defensive.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : fallback}
    </div>
  );
}
