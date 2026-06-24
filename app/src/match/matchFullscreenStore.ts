import { useSyncExternalStore } from "react";

/**
 * matchFullscreenStore — signal « un match est en cours, passe le shell en PLEIN
 * ÉCRAN » (Alex 2026-06-20, layout combat tablette).
 *
 * Pourquoi : en paysage tablette (≥900px), la Sidebar restait affichée PENDANT
 * le match et `<main>` capait le contenu à `max-w-md` (448px) → le plateau était
 * écrasé dans une bande étroite, le strip adverse ne s'alignait plus, les cartes
 * du bas étaient coupées. Quand un match est actif, App.tsx masque la Sidebar et
 * retire le cap de largeur → le plateau respire (sa propre `max-w-3xl`).
 *
 * Même pattern mini-store que [setBurgerHidden] (module scope + useSyncExternalStore).
 * Posé par ArenaPage au mount (et nettoyé à l'unmount). Réutilisable par d'autres
 * modes match (Classé…) plus tard.
 */
let fullscreen = false;
const subs = new Set<() => void>();

export function setMatchFullscreen(v: boolean): void {
  if (v === fullscreen) return;
  fullscreen = v;
  subs.forEach((f) => f());
}

function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
function getSnapshot(): boolean {
  return fullscreen;
}

/** Hook réactif : un match est-il en plein écran ? (lu par App.tsx) */
export function useMatchFullscreen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
