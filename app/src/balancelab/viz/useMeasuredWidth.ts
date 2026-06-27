/** Mesure la largeur d'un élément (synchrone au montage + ResizeObserver) →
 *  canvas responsive. La mesure synchrone via getBoundingClientRect garantit une
 *  largeur non-nulle dès le 1er rendu, même si l'observer tarde (double-montage
 *  StrictMode). L'observer prend ensuite le relais pour les redimensionnements. */
import { useLayoutEffect, useRef, useState } from "react";

export function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cw = Math.round(el.getBoundingClientRect().width);
      setW((prev) => (prev === cw ? prev : cw));
    };
    measure(); // synchrone, non-nul dès le montage
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
