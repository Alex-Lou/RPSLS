/**
 * levelUpGate — qui célèbre une montée de niveau ?
 *
 * Règle : un niveau gagné EN MATCH est célébré une seule fois, par l'écran de
 * fin (ProgressReveal → LevelBar, badge « NIVEAU N ! »). L'overlay global
 * (LevelUpWatcher) ne s'affiche que pour les niveaux gagnés hors écran de fin
 * (quêtes, podium de tournoi…), ou APRÈS l'écran de fin si celui-ci ne l'a
 * finalement pas montré (fermé avant l'animation, barre absente…).
 *
 * Mécanique (état module, pas de store : purement visuel) :
 *  - `claimLevelUps()` : posé par MatchEndScreen tant qu'il affiche la barre
 *    de niveau. Tout level-up survenu pendant ce temps lui revient.
 *  - `deferLevelUpToMatchEnd()` : appelé par le store quand le level-up vient
 *    d'un enregistrement de match (recordMatch / recordArenaMatch). Ces modes
 *    créditent parfois l'XP plusieurs secondes AVANT de monter l'écran de fin
 *    (pause post-manche) : on réserve le level-up pendant MATCH_GRACE_MS.
 *  - `markLevelCelebrated(n)` : la LevelBar a réellement montré « NIVEAU n ».
 */

/** Délai max entre l'enregistrement du match et le montage de l'écran de fin
 *  (pause post-manche Classé 5,5 s + suspense de révélation, avec marge). */
export const MATCH_GRACE_MS = 12_000;

let claims = 0;
let matchDeferUntil = 0;
let celebrated = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** L'écran de fin prend en charge les level-ups jusqu'au retour de la fonction. */
export function claimLevelUps(): () => void {
  claims++;
  // L'écran de fin est là : la réservation « en attente d'écran » est soldée.
  matchDeferUntil = 0;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims--;
    emit();
  };
}

/** Le level-up qui vient d'avoir lieu provient d'un match : l'écran de fin
 *  qui va suivre le célébrera. */
export function deferLevelUpToMatchEnd(): void {
  // Écran déjà monté (Classique, Arena : crédit post-rendu) → il a la main.
  if (claims > 0) return;
  matchDeferUntil = Date.now() + MATCH_GRACE_MS;
}

/** La barre de niveau de l'écran de fin a montré le badge du niveau `level`. */
export function markLevelCelebrated(level: number): void {
  if (level > celebrated) celebrated = level;
}

/** Vrai si un level-up survenant MAINTENANT doit être laissé à l'écran de fin. */
export function levelUpOwnedByMatchEnd(): boolean {
  return claims > 0 || Date.now() < matchDeferUntil;
}

/** Un écran de fin est-il actuellement à l'écran avec sa barre de niveau ? */
export function matchEndClaimActive(): boolean {
  return claims > 0;
}

export function celebratedLevel(): number {
  return celebrated;
}

export function subscribeLevelUpGate(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
