import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

/**
 * topBarStore — état de la BARRE DU HAUT unifiée (AppTopBar) des écrans hors
 * match. Même pattern mini-store que matchExitStore / setBurgerHidden (module
 * scope + useSyncExternalStore) : pas de Context, zéro re-render du shell.
 *
 *  - `useTopBar(spec)` : un écran (lobby, deck, tournoi…) impose son titre, son
 *    retour et ses actions de droite. Pile : le DERNIER monté gagne (pendant
 *    une transition AnimatePresence, l'ancien écran garde la main jusqu'à son
 *    démontage). `null` = ne rien déclarer (ex. podium plein écran).
 *  - `useImmersive(actif)` : une surface de match est montée → PAS de barre
 *    (le match garde son HUD immersif : burger flottant + retour flottant).
 */

export interface TopBarSpec {
  /** Titre centré de la barre. */
  title?: string;
  /** Retour (toujours à GAUCHE, à côté du burger). Absent = pas de bouton. */
  onBack?: () => void;
  /** Libellé accessible du retour. */
  backLabel?: string;
  /** Actions compactes à droite (ex. 🎲 Aléatoire). */
  right?: ReactNode;
}

interface Entry { id: number; spec: TopBarSpec }

let stack: Entry[] = [];
let nextId = 1;
let version = 0;
let immersiveCount = 0;
const subs = new Set<() => void>();

function notify(): void {
  version++;
  subs.forEach((f) => f());
}
function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
const getVersion = () => version;
const getImmersive = () => immersiveCount > 0;

/** Déclare la barre du haut de l'écran courant (mise à jour à chaque rendu). */
export function useTopBar(spec: TopBarSpec | null): void {
  const idRef = useRef(0);
  const active = spec !== null;
  // Enregistrement / retrait (layout effect → la barre est à jour avant le paint).
  useLayoutEffect(() => {
    if (!active) return;
    const id = nextId++;
    idRef.current = id;
    stack = [...stack, { id, spec: {} }];
    return () => {
      stack = stack.filter((e) => e.id !== id);
      idRef.current = 0;
      notify();
    };
  }, [active]);
  // Contenu rafraîchi à chaque rendu de l'écran (titre traduit, slot droit…).
  useLayoutEffect(() => {
    if (!spec) return;
    const e = stack.find((x) => x.id === idRef.current);
    if (!e) return;
    e.spec = spec;
    notify();
  });
}

/** Spec du dessus de la pile (null si aucun écran n'en déclare). */
export function useTopBarSpec(): TopBarSpec | null {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return stack.length ? stack[stack.length - 1].spec : null;
}

/** Marque une surface de match immersive tant que `active` est vrai. */
export function useImmersive(active = true): void {
  useLayoutEffect(() => {
    if (!active) return;
    immersiveCount++;
    notify();
    return () => {
      immersiveCount = Math.max(0, immersiveCount - 1);
      notify();
    };
  }, [active]);
}

/** Une surface immersive (match) est-elle montée ? (lu par App.tsx) */
export function useImmersiveActive(): boolean {
  return useSyncExternalStore(subscribe, getImmersive, getImmersive);
}
