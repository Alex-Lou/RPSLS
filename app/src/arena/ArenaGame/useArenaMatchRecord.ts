/**
 * Télémétrie / enregistrement de fin de match d'ArenaGame (extraits, cap <400
 * lignes/fichier). Hooks/effets à l'IDENTIQUE, appelés aux mêmes positions.
 * - useArenaTelemetryRefs : trajectoire PV, raison de fin, enregistreur de tour,
 *   profil FPS de la partie.
 * - useArenaMatchRecord   : capture PV par tour + haptique/stats/Watcher à la fin.
 */

import { type MutableRefObject, useEffect, useRef } from "react";
import { hapticMatchWin, hapticMatchLoss } from "../../haptic";
import { engineGauge } from "../arenaEngines";
import type { BoardState, Side } from "../arenaTypes";
import type { ArenaOnlineDriver } from "../arenaOnlineDriver";
import { hashBoard } from "../arenaNet";
import { recordWatcherMatch, watcherUuid, watcherAppVersion, watcherEnabled, createTurnRecorder, type WatcherMatchRecord, type TurnRecorder } from "../arenaTelemetry";
import { startMatchFps, stopMatchFps } from "../../graphics/fpsSampler";
import type { useArenaMatchSetup } from "./useArenaMatchSetup";

export function useArenaTelemetryRefs() {
  // Télémétrie Watcher : trajectoire des PV par tour (capturée à chaque tour) +
  // raison de fin (par défaut KO ; mise à « suddendeath » par la mort subite).
  const trajRef = useRef<{ self: number[]; opp: number[] }>({ self: [], opp: [] });
  const endReasonRef = useRef<WatcherMatchRecord["endReason"]>("ko");
  // Enregistreur de déroulé v:2 (Tier A+B) — observationnel, inerte si le Watcher
  // n'est pas configuré. begin() au lock, lane() en combat, end() au settle.
  const turnRecRef = useRef<TurnRecorder | null>(null);
  if (!turnRecRef.current) turnRecRef.current = createTurnRecorder(watcherEnabled());
  const turnRec = turnRecRef.current;

  // Profil FPS de la partie (rAF continu, zéro overhead) — démarré à l'entrée de
  // l'écran de combat, arrêté + joint au MatchRecord à l'enregistrement (fin de
  // partie). Observationnel, fail-soft. Ne mesure que si le Watcher est configuré.
  useEffect(() => {
    if (watcherEnabled()) startMatchFps();
    return () => { stopMatchFps(); };
  }, []);
  return { trajRef, endReasonRef, turnRec };
}

export function useArenaMatchRecord({
  board, mySide, oppSide, trajRef, endReasonRef, turnRec, matchEndedRef, tutorial, online, recordArenaMatch,
}: {
  board: BoardState;
  mySide: Side;
  oppSide: Side;
  trajRef: MutableRefObject<{ self: number[]; opp: number[] }>;
  endReasonRef: MutableRefObject<WatcherMatchRecord["endReason"]>;
  turnRec: TurnRecorder;
  matchEndedRef: MutableRefObject<boolean>;
  tutorial: unknown;
  online: ArenaOnlineDriver | undefined;
  recordArenaMatch: ReturnType<typeof useArenaMatchSetup>["recordArenaMatch"];
}) {
  // Télémétrie Watcher : capture les PV des 2 héros une fois par tour (au
  // changement de board.turn = après la résolution du tour précédent). Volontaire
  // que la dép soit [board.turn] seul (1 point/tour, pas à chaque frame de combat).
  useEffect(() => {
    if (board.phase === "match-end" || board.phase === "sudden-death") return;
    trajRef.current.self.push(Math.max(0, board[mySide].hp));
    trajRef.current.opp.push(Math.max(0, board[oppSide].hp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.turn]);

  // Match-end haptic + stat record. Fired once when the phase flips.
  // recordArenaMatch lives in the store and is sync'd to the cloud via the
  // existing playerSync subscriber (fingerprint covers arenaStats now).
  // matchEndedRef is declared above (alongside handleForfeit) so a forfeit
  // can flip the same guard.
  useEffect(() => {
    if (board.phase !== "match-end") return;
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    // Perspective du joueur LOCAL (camp mySide). En vs-CPU, mySide="a" → me=a,
    // opp=b (inchangé) ; en online camp B, me=b → victoire/défaite correctes.
    const me = board[mySide];
    const opp = board[oppSide];
    const meDead = me.hp <= 0;
    const oppDead = opp.hp <= 0;
    const outcome: "win" | "loss" | "draw" =
      meDead && oppDead ? "draw" : oppDead ? "win" : "loss";
    if (outcome === "win") hapticMatchWin();
    else if (outcome === "loss") hapticMatchLoss();
    if (tutorial) return; // tuto : ni stats, ni historique, ni télémétrie
    // Online : déclare l'issue AU SERVEUR + le hash du board final (anti-triche
    // Phase 4) — le serveur compare les DEUX déclarations (vainqueur + hash) ;
    // désaccord = drop, aucun crédit. En lockstep honnête, les deux coïncident.
    online?.reportResult(outcome, hashBoard(board));
    // VOIE jouée (joueur + adversaire) journalisée dans l'historique (Alex
    // 2026-06-13). me/opp.affinity = la Voie choisie par chaque camp.
    recordArenaMatch(outcome, { playerVoie: me.affinity, oppVoie: opp.affinity, online: !!online });
    // Télémétrie Watcher (Arena Pro vs CPU) — fail-soft, inerte si non configuré.
    if (me.affinity) {
      // Filet : fige le dernier tour si le settle ne l'a pas déjà fait (no-op
      // sinon — pending est purgé après chaque end). Puis lit le déroulé v:2.
      try {
        turnRec.end({
          hpSelf: Math.max(0, me.hp),
          hpOpp: Math.max(0, opp.hp),
          engine: engineGauge(me)?.value ?? 0,
          engineOpp: engineGauge(opp)?.value ?? 0,
          finisherUnlocked: !!me.finisherUnlocked,
        });
      } catch { /* télémétrie fail-soft */ }
      const turnLog = turnRec.log();
      recordWatcherMatch({
        v: turnLog.length ? 2 : 1,
        id: watcherUuid(),
        ts: Date.now(),
        mode: "pro",
        playerVoie: me.affinity,
        oppVoie: opp.affinity ?? null,
        oppKind: "cpu",
        result: outcome,
        turns: board.turn,
        finalHpSelf: Math.max(0, me.hp),
        finalHpOpp: Math.max(0, opp.hp),
        finisherFired: !!me.finisherUnlocked,
        oppFinisherFired: !!opp.finisherUnlocked,
        hpTrajectorySelf: [...trajRef.current.self, Math.max(0, me.hp)],
        hpTrajectoryOpp: [...trajRef.current.opp, Math.max(0, opp.hp)],
        endReason: endReasonRef.current,
        appVersion: watcherAppVersion,
        turnLog: turnLog.length ? turnLog : undefined,
        fps: stopMatchFps() ?? undefined, // profil FPS de la partie (rAF) — null si trop court
      });
    }
  }, [board.phase, board[mySide].hp, board[oppSide].hp, recordArenaMatch]);
}
