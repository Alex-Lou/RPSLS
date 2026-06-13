/**
 * matchExitStore — mini global slot pour LE callback de sortie d'un match
 * en cours (forfait Arena/Ranked/Lanes). MobileShell le rend en TOP du
 * drawer pour intégrer la sortie au burger menu sans avoir 2 boutons HUD
 * concurrents (Alex 2026-06-11).
 *
 * Pattern : useSyncExternalStore. Pas de React Context — le store vit en
 * dehors du React tree pour éviter les re-renders parasites de tout le
 * shell quand le callback change.
 */

export interface MatchExit {
  label: string;
  onExit: () => void;
}

let current: MatchExit | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of Array.from(listeners)) l();
}

export function setMatchExit(exit: MatchExit | null): void {
  current = exit;
  notify();
}

export function getMatchExit(): MatchExit | null {
  return current;
}

export function subscribeMatchExit(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
