/**
 * playReturnView — passerelle « consume-once » OnlinePage → PlayPage (sens
 * inverse de `onlineIntent`).
 *
 * Un match lancé depuis un hub (ex. Classé via `onQuickMatchOnline`) tourne
 * DANS OnlinePage. Quand il se termine, l'utilisateur doit revenir au HUB
 * D'ORIGINE (le menu Classé), pas au menu « En ligne » d'OnlinePage (bug Alex
 * 2026-07 « un match classé fini doit me renvoyer vers le menu du match classé »).
 *
 * OnlinePage POSE la vue de retour puis demande la navigation vers `page="play"`
 * (event `rpsls:navigate`) ; PlayPage la LIT une seule fois à son (re)montage et
 * ouvre la bonne vue au lieu de retomber sur l'accueil. Pas de store : un simple
 * module suffit (set → navigate → read), exactement comme `onlineIntent`.
 */

/** Vue de PlayPage à rouvrir au retour. Étendre si d'autres hubs délèguent à
 *  OnlinePage (casual, lanes…). */
export type PlayReturnView = "classe_lobby";

let pending: PlayReturnView | null = null;

/** Pose la vue à rouvrir au prochain (re)montage de PlayPage. */
export function setPlayReturnView(v: PlayReturnView): void {
  pending = v;
}

/** Lit ET efface la vue de retour (consume-once). null s'il n'y en a pas. */
export function consumePlayReturnView(): PlayReturnView | null {
  const v = pending;
  pending = null;
  return v;
}
