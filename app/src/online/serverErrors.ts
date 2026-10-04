/**
 * Erreurs serveur génériques (`{ type: "error", code, message }`) → texte
 * traduit. Le `message` anglais du serveur n'est jamais montré tel quel : il
 * sert au debug. Codes émis par crates/rpsls-server (dispatch.rs reply_error,
 * hello.rs, main.rs). Les refus du portefeuille ont leur propre table
 * (wallet.ts walletErrorKey) et ceux de l'authentification aussi (auth.err.*).
 *
 * Code inconnu → texte générique qui rappelle le code (utile au support).
 */
import { tNow } from "../i18n/core";

export const SERVER_ERROR_CODES = [
  "self_match",
  "lobby_not_found",
  "bad_code",
  "lobby_rate_limited",
  "server_full",
  "bad_best_of",
  "bad_win_to",
  "bad_ccg_join",
  "bad_message",
  "hello_limited",
  "auth_needed",
  "auth_failed",
  "auth_transient",
] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

const KNOWN = new Set<string>(SERVER_ERROR_CODES);

/** Clé i18n du message pour un code d'erreur serveur. */
export function serverErrorKey(code: string): string {
  return KNOWN.has(code) ? `online.serverErr.${code}` : "online.serverErr.unknown";
}

/** Texte traduit (langue courante) pour un code d'erreur serveur. */
export function serverErrorText(code: string | undefined | null): string {
  const c = code || "unknown";
  return tNow(serverErrorKey(c), { code: c });
}
