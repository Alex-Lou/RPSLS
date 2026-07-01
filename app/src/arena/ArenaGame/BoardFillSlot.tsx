import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * BoardFillSlot — règle DÉFINITIVEMENT le dimensionnement du pad sur le WebView.
 *
 * Le WebView Android ne résout PAS de façon fiable une chaîne `flex-1` profonde
 * (le pad restait court → lanes coupées / vide en bas) alors que ça marche en
 * preview desktop. MAIS `clientHeight` (mesure post-layout) EST fiable — c'est
 * ce que fait ScaleToFit. Donc : on MESURE la hauteur dispo du slot et on la
 * passe à l'enfant, qui se la pose en hauteur EXPLICITE (px). Une hauteur px
 * explicite résout les `flex-1` enfants de façon 100 % fiable → le pad remplit
 * la place SANS scaler les cartes (≠ ScaleToFit qui, lui, rétrécissait tout, y
 * compris la main). La main reste DEHORS du slot → jamais rétrécie.
 */
export function BoardFillSlot({ children, onMeasure }: {
  children: (h: number) => ReactNode;
  /** Rapporte la hauteur dispo mesurée (px) — permet à une AUTRE phase (ex. le
   *  reveal Classé) de réutiliser EXACTEMENT la même taille de board → plateau
   *  stable d'une phase à l'autre. */
  onMeasure?: (h: number) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [availH, setAvailH] = useState(0);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () => {
      const ah = slot.clientHeight;
      setAvailH(ah);
      if (ah > 0) onMeasure?.(ah);
      // Le board reçoit minHeight=ah → il REMPLIT quand le contenu rentre
      // (espace en trop → centre du pad). S'il dépasse (écran trop court), on
      // réduit UNIQUEMENT à ce moment (jamais de coupe) — sinon scale 1 et les
      // cartes gardent leur taille exacte (cas du tel d'Alex).
      const nh = innerRef.current ? innerRef.current.scrollHeight : 0;
      setScale(ah > 0 && nh > ah + 1 ? Math.max(0.5, ah / nh) : 1);
    };
    measure();
    // rAF re-measure : le board monte derrière le splash, la 1ʳᵉ passe peut
    // précéder le layout final.
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);
  return (
    <div ref={slotRef} className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-hidden">
      <div
        ref={innerRef}
        className="w-full flex flex-col items-center"
        style={{ transform: scale !== 1 ? `scale(${scale})` : undefined }}
      >
        {children(availH)}
      </div>
    </div>
  );
}
