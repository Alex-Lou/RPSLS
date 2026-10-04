import { useEffect, useState } from "react";

export interface Rect { x: number; y: number; w: number; h: number }

/** Position écran de l'élément `selector`, suivie à chaque frame tant que le
 *  sélecteur est actif (les cartes de l'éventail se soulèvent, le plateau se
 *  redimensionne…). Le state ne bouge que si la position change vraiment, donc
 *  pas de rendu par frame quand tout est immobile. Boucle coupée dès que
 *  `selector` passe à null (coach masqué) : rien ne tourne pendant le combat. */
export function useTargetRect(selector: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!selector) { setRect(null); return; }
    let raf = 0;
    let last: Rect | null = null;
    const tick = () => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
      const moved = !next || !last
        ? next !== last
        : Math.abs(next.x - last.x) > 0.5 || Math.abs(next.y - last.y) > 0.5
          || Math.abs(next.w - last.w) > 0.5 || Math.abs(next.h - last.h) > 0.5;
      if (moved) { last = next; setRect(next); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}
