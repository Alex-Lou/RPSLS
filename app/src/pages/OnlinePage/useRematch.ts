/**
 * Poignée de main « revanche » des matchs en ligne (Classique + Constellation).
 *
 * États côté client :
 *  - `offered`            : l'adversaire propose une revanche (modale Accepter / Refuser) ;
 *  - `waiting = "sent"`   : on a proposé, on attend sa réponse ;
 *  - `waiting = "accepted"` : on a accepté, on attend le nouveau `match_found` ;
 *  - `toast`              : issue négative brève (refusée / expirée), puis retour menu.
 *
 * Le serveur ouvre une fenêtre FIXE de 30 s après la fin du match et ne
 * prévient pas quand elle se ferme : chaque attente a donc son propre minuteur
 * qui bascule sur « expirée ». `toast` est une CLÉ i18n (traduite au rendu).
 *
 * Toutes les fonctions renvoyées sont stables (le gestionnaire de messages du
 * client WebSocket les capture une fois).
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Fenêtre serveur (30 s) + marge — on a proposé, sans réponse. */
const SENT_TIMEOUT_MS = 32_000;
/** Proposition reçue : au plus la fenêtre serveur. */
const OFFER_TIMEOUT_MS = 30_000;
/** Acceptée : le serveur relance aussitôt ; au-delà, la fenêtre était close. */
const ACCEPTED_TIMEOUT_MS = 8_000;
/** Durée d'affichage du toast avant le retour au menu. */
const TOAST_MS = 1_600;

export type RematchToastKey =
  | "online.rematch.declined"
  | "online.rematch.noResponse"
  | "online.rematch.expired";

export interface RematchHandshake {
  offered: boolean;
  waiting: null | "sent" | "accepted";
  toast: RematchToastKey | null;
  /** Remet tout à zéro (nouveau match, retour menu…). */
  clear: () => void;
  /** Message serveur `rematch_offered`. */
  onOffered: () => void;
  /** Message serveur `rematch_declined`. */
  onDeclined: () => void;
  request: () => void;
  accept: () => void;
  decline: () => void;
  cancelWait: () => void;
}

export function useRematch(
  send: (msg: { type: "request_rematch" } | { type: "respond_rematch"; accept: boolean } | { type: "leave_match" }) => void,
  onExit: () => void,
): RematchHandshake {
  const [offered, setOffered] = useState(false);
  const [waiting, setWaiting] = useState<null | "sent" | "accepted">(null);
  const [toast, setToast] = useState<RematchToastKey | null>(null);
  const timer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  // Le dernier `send` / `onExit` rendus (fonctions recréées à chaque rendu).
  const sendRef = useRef(send);
  const exitRef = useRef(onExit);
  sendRef.current = send;
  exitRef.current = onExit;

  const stopTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    stopTimer();
    setOffered(false);
    setWaiting(null);
  }, [stopTimer]);

  /** Issue négative : toast, puis retour menu. */
  const fail = useCallback((key: RematchToastKey) => {
    stopTimer();
    setOffered(false);
    setWaiting(null);
    setToast(key);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
      exitRef.current();
    }, TOAST_MS);
  }, [stopTimer]);

  const arm = useCallback((ms: number, key: RematchToastKey) => {
    stopTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      fail(key);
    }, ms);
  }, [stopTimer, fail]);

  const onOffered = useCallback(() => {
    setOffered(true);
    // Si on attendait déjà notre propre proposition, le serveur relance le
    // match dès notre accord : on garde le minuteur « sent » en place.
    if (timer.current === null) arm(OFFER_TIMEOUT_MS, "online.rematch.expired");
  }, [arm]);

  const onDeclined = useCallback(() => fail("online.rematch.declined"), [fail]);

  const request = useCallback(() => {
    sendRef.current({ type: "request_rematch" });
    setOffered(false);
    setWaiting("sent");
    arm(SENT_TIMEOUT_MS, "online.rematch.noResponse");
  }, [arm]);

  const accept = useCallback(() => {
    sendRef.current({ type: "respond_rematch", accept: true });
    setOffered(false);
    setWaiting("accepted");
    arm(ACCEPTED_TIMEOUT_MS, "online.rematch.expired");
  }, [arm]);

  const decline = useCallback(() => {
    sendRef.current({ type: "respond_rematch", accept: false });
    clear();
    exitRef.current();
  }, [clear]);

  const cancelWait = useCallback(() => {
    sendRef.current({ type: "leave_match" });
    clear();
    exitRef.current();
  }, [clear]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  return { offered, waiting, toast, clear, onOffered, onDeclined, request, accept, decline, cancelWait };
}
