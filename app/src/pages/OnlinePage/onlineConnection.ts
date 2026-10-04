/**
 * Connexion paresseuse du client WebSocket de la page En ligne + ack du Hello.
 *
 * Extrait verbatim d'OnlinePage (`ensureClient` / `settleHelloAck`) : le
 * composant garde ses refs et appelle ces fonctions avec les valeurs du rendu.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useStore } from "../../store/store";
import { OnlineClient, type ServerMessage } from "../../online/online";
import { setActiveClient } from "../../online/playerSync";
import type { ServerConfig } from "../../store/storeTypes";
import { hapticAlert } from "../../haptic";

/* ── Lazy create client ── */
// Ack du Hello (bug "Anonymous", Alex 2026-07) : le serveur applique le pseudo
// du Hello de façon ASYNC (vérif claim-token Redis) — un join_queue envoyé
// aussitôt crée le match avec le pseudo par défaut "Anonymous" côté serveur.
// On attend donc que le hello soit TRAITÉ (state_loaded, ou error) avant de
// rendre le client aux join*. Timeout de garde : serveur froid/legacy sans
// state_loaded → on ne bloque pas la file plus de HELLO_ACK_TIMEOUT_MS.
export const HELLO_ACK_TIMEOUT_MS = 4_000;

export function settleHelloAck(helloAckRef: MutableRefObject<(() => void) | null>) {
  helloAckRef.current?.();
  helloAckRef.current = null;
}

export interface EnsureClientCtx {
  clientRef: MutableRefObject<OnlineClient | null>;
  helloAckRef: MutableRefObject<(() => void) | null>;
  serverConfig: ServerConfig;
  t: (key: string, params?: Record<string, string | number>) => string;
  onMessage: (msg: ServerMessage) => void;
  setConnDropped: Dispatch<SetStateAction<boolean>>;
}

export function ensureOnlineClient(ctx: EnsureClientCtx): Promise<OnlineClient> {
  const { clientRef, helloAckRef, serverConfig, t, onMessage, setConnDropped } = ctx;
  if (clientRef.current && clientRef.current.status === "open") {
    return Promise.resolve(clientRef.current);
  }
  // Disconnect any previous closed client.
  clientRef.current?.disconnect();
  const url = serverConfig.cloudUrl;
  if (!url.trim()) {
    return Promise.reject(
      new Error(
        serverConfig.mode === "cloud"
          ? t("online.err.noCloudUrl")
          : t("online.err.noLanUrl")
      )
    );
  }
  const c = new OnlineClient();
  clientRef.current = c;
  c.on(onMessage);
  c.onStatus = (s) => {
    // Surface only the "reconnecting" → "open" cycle in the UI banner.
    if (s === "reconnecting") {
      setConnDropped(true);
      hapticAlert();
    } else if (s === "open") {
      setConnDropped(false);
    } else if (s === "error" || s === "closed") {
      // After all retries exhausted, OnlineClient flips to "error".
      // Leave the banner up — the user can cancel/retry manually.
    }
  };
  // Envoie le Hello avec le pseudo COURANT (getState), pas la closure du
  // render : sur un tél fraîchement installé, le pseudo peut se charger APRÈS
  // la création du client → sinon le serveur nous enregistre en "Anonymous"
  // et l'adversaire voit ça au "Match trouvé" (bug Alex 2026-07). getState lit
  // toujours l'état à jour (post-hydratation / post-onboarding).
  const sendHello = () => {
    const p = useStore.getState().player;
    // JAMAIS le placeholder "Anonymous" (Alex 2026-07) : si le pseudo est vide
    // (invité pas encore nommé), on envoie le défaut lisible "Player 1" —
    // l'adversaire voit un vrai nom, pas "Anonymous". `getState` = valeur
    // COURANTE (pas la closure du render). Le joueur peut régler un pseudo
    // custom dans son profil ; il sera alors transmis tel quel.
    const nick = (p.nickname && p.nickname.trim()) || "Player 1";
    c.send({ type: "hello", nickname: nick, player_id: p.id, claim_token: p.claimToken });
  };
  c.onReconnect = () => {
    // Server session reset on reconnect — re-introduce ourselves so the
    // server has our nickname for the next match.
    sendHello();
  };
  return c.connect(url).then(async () => {
    // Send Hello once on connection — puis ATTENDRE son traitement serveur
    // (state_loaded/error règle l'ack ; timeout de garde sinon). Garantit que
    // le join_queue qui suit trouve le pseudo déjà posé côté serveur → fini
    // le « Anonymous » vu par l'adversaire au match_found.
    const helloAck = new Promise<void>((res) => { helloAckRef.current = res; });
    sendHello();
    setActiveClient(c);
    await Promise.race([
      helloAck,
      new Promise<void>((res) => window.setTimeout(res, HELLO_ACK_TIMEOUT_MS)),
    ]);
    return c;
  });
}
