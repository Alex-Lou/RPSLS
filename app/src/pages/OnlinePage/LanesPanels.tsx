/**
 * Panneaux Constellation Lanes en ligne : préparation (pièce + double « prêt »)
 * et match. Extraits verbatim d'OnlinePage — l'état reste au parent, les
 * callbacks inline (envoi WS + remises à zéro) sont conservés tels quels.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { motion } from "motion/react";
import { useT } from "../../i18n";
import type { OnlineClient } from "../../online/online";
import {
  LanesMatchView,
  type LanesMatchInfo,
  type LanesRoundData,
  type LanesRoundResultData,
  type LanesEndData,
} from "../../match/LanesMatchView";
import { MatchPrepScreen } from "../../ranked/MatchPrepScreen";
import type { OppPersona } from "../../ranked/personaSeed";
import { ArenaPadProvider } from "../../ranked/arena";
import type { AppState } from "../../store/storeTypes";
import { hapticLock } from "../../haptic";

type SetState<T> = Dispatch<SetStateAction<T>>;

export interface LanesPrepPanelProps {
  player: AppState["player"];
  lanesMatch: LanesMatchInfo;
  lanesOppPersona: OppPersona;
  clientRef: MutableRefObject<OnlineClient | null>;
  prepReadyState: { you: boolean; opp: boolean };
  prepCoinWinner: "you" | "opp" | null;
  connDropped: boolean;
  setLanesMatch: SetState<LanesMatchInfo | null>;
  setPrepReadyState: SetState<{ you: boolean; opp: boolean }>;
  setPrepCoinWinner: SetState<"you" | "opp" | null>;
  backToMenu: () => void;
}

export function LanesPrepPanel({
  player, lanesMatch, lanesOppPersona, clientRef, prepReadyState, prepCoinWinner,
  connDropped, setLanesMatch, setPrepReadyState, setPrepCoinWinner, backToMenu,
}: LanesPrepPanelProps) {
  const t = useT();
  return (
    <motion.div
      key="lanes-prep"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col min-h-0"
    >
      <MatchPrepScreen
        key={`lanes-prep-${lanesMatch.matchId}`}
        youName={player.nickname || t("online.you")}
        youAvatar={player.avatar}
        youThemeId={player.themeId}
        youBackgroundId={player.backgroundId ?? "default"}
        oppName={lanesMatch.opponent || t("online.opponent")}
        // No avatar exchange in the protocol yet — use a placeholder
        // glyph; the persona theme + bg already gives a distinct look.
        oppAvatar="🛡️"
        oppThemeId={lanesOppPersona.themeId}
        oppPadId={lanesOppPersona.padId}
        oppBackgroundId={lanesOppPersona.backgroundId}
        onBack={() => {
          clientRef.current?.send({ type: "leave_match" });
          setLanesMatch(null);
          setPrepReadyState({ you: false, opp: false });
          setPrepCoinWinner(null);
          backToMenu();
        }}
        // `onReady` is never called in online mode (the transition out
        // of the prep screen is driven by `lanes_round_start`), but
        // the prop is required by the component.
        onReady={() => {}}
        online={{
          youReady: prepReadyState.you,
          oppReady: prepReadyState.opp,
          coinWinner: prepCoinWinner,
          // `connDropped` flips true on "reconnecting" and false on
          // "open" — mirrors the underlying OnlineClient status, so
          // the prep button reflects the actual wire state.
          connectionAlive: !connDropped,
          onReady: () => {
            if (prepReadyState.you || connDropped) return;
            // Optimistic local flip — server will echo back the same
            // `prep_ready_state` shortly, but the button feels
            // unresponsive otherwise on a 100ms RTT. OnlineClient now
            // queues the send if the socket happens to be mid-flap,
            // so the message replays on reconnect (TTL guards against
            // landing in a dead match).
            setPrepReadyState((s) => ({ ...s, you: true }));
            clientRef.current?.send({ type: "prep_ready" });
          },
        }}
      />
    </motion.div>
  );
}

export interface LanesMatchPanelProps {
  player: AppState["player"];
  lanesMatch: LanesMatchInfo;
  lanesOppPersona: OppPersona | null;
  clientRef: MutableRefObject<OnlineClient | null>;
  prepCoinWinner: "you" | "opp" | null;
  lanesRound: LanesRoundData | null;
  lanesLastResult: LanesRoundResultData | null;
  lanesEnd: LanesEndData | null;
  lanesSubmitted: boolean;
  setLanesMatch: SetState<LanesMatchInfo | null>;
  setLanesRound: SetState<LanesRoundData | null>;
  setLanesLastResult: SetState<LanesRoundResultData | null>;
  setLanesEnd: SetState<LanesEndData | null>;
  setLanesSubmitted: SetState<boolean>;
  setPrepCoinWinner: SetState<"you" | "opp" | null>;
  backToMenu: () => void;
  requestRematch: () => void;
}

export function LanesMatchPanel({
  player, lanesMatch, lanesOppPersona, clientRef, prepCoinWinner, lanesRound,
  lanesLastResult, lanesEnd, lanesSubmitted, setLanesMatch, setLanesRound,
  setLanesLastResult, setLanesEnd, setLanesSubmitted, setPrepCoinWinner,
  backToMenu, requestRematch,
}: LanesMatchPanelProps) {
  return (
    <motion.div
      key="lanes"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-0"
    >
      {/* When the coin gave the duel to the opponent's pad, the arena
          override pad replaces the player's own. null = no override. */}
      <ArenaPadProvider value={prepCoinWinner === "opp" ? lanesOppPersona?.padId ?? null : null}>
        <LanesMatchView
          nickname={player.nickname}
          match={lanesMatch}
          round={lanesRound}
          lastResult={lanesLastResult}
          end={lanesEnd}
          submitted={lanesSubmitted}
          onSubmitPicks={(picks) => {
            hapticLock();
            clientRef.current?.send({
              type: "play_lanes",
              plays: picks.map((mv) => ({ mv, mana: 0 })),
            });
            setLanesSubmitted(true);
          }}
          onLeave={() => {
            clientRef.current?.send({ type: "leave_match" });
            setLanesMatch(null);
            setLanesRound(null);
            setLanesLastResult(null);
            setLanesEnd(null);
            setLanesSubmitted(false);
            setPrepCoinWinner(null);
            backToMenu();
          }}
          onRematch={requestRematch}
        />
      </ArenaPadProvider>
    </motion.div>
  );
}
