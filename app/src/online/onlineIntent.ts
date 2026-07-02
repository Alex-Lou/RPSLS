/**
 * onlineIntent — passerelle « consume-once » entre un hub (Classé, Casual, Lanes…)
 * et la page En ligne. Un hub POSE une intention (mode + auto-queue + ladder à
 * créditer côté client) puis navigue vers `page="online"` ; OnlinePage la CONSOMME
 * une seule fois au montage (auto-file d'attente + mémorise le ladder pour la fin
 * de match). Pas de store React : un simple module suffit (set → navigate → read).
 *
 * `ladder` = quel classement LOCAL créditer en plus du rankLp serveur : "classe"
 * pour le hub Classé (classeLp), null ailleurs (le vrai match alimente déjà le
 * rang global rankLp côté serveur — cf. « compter dans les deux », Alex 2026-07).
 */

export interface OnlineIntent {
  /** File à rejoindre : RPSLS classique ou Lanes. */
  mode: "classic" | "lanes";
  /** Best-of pour le mode classique (ex. 5 pour le Classé). */
  bestOf?: number;
  /** Win-to pour le mode Lanes. */
  winTo?: number;
  /** true → OnlinePage lance la file automatiquement au montage. */
  autoQueue?: boolean;
  /** Ladder LOCAL à créditer à la fin du match (en plus du rankLp serveur). */
  ladder?: "classe" | null;
}

let pending: OnlineIntent | null = null;

/** Pose l'intention à consommer par le prochain montage d'OnlinePage. */
export function setOnlineIntent(intent: OnlineIntent): void {
  pending = intent;
}

/** Lit ET efface l'intention (consume-once). Retourne null s'il n'y en a pas. */
export function consumeOnlineIntent(): OnlineIntent | null {
  const i = pending;
  pending = null;
  return i;
}
