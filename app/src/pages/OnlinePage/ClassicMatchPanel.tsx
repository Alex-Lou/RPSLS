/**
 * Panneau du match Classique en cours (phases matched / round / reveal) :
 * en-tête de score, scène du round, veille adversaire, forfait + modale.
 * Extrait verbatim d'OnlinePage — présentationnel, l'état reste au parent.
 */
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../../i18n";
import { QuitConfirmModal } from "../../match/QuitConfirmModal";
import type { Move } from "../../engine/game";
import type { AppState } from "../../store/storeTypes";
import { OnlineMatchGuard } from "./OnlineMatchGuard";
import { ScoreHeader } from "./MatchFlowSplash";
import { PickStage, LockedStage, RevealCountdown, RevealStage } from "./MatchFlowRound";
import type { Phase, MatchState } from "./types";

export interface ClassicMatchPanelProps {
  phase: Phase;
  player: AppState["player"];
  m: MatchState;
  youScore: number;
  oppScore: number;
  target: number;
  pickStartedAt: number | null;
  playMove: (mv: Move) => void;
  revealRevealed: boolean;
  youMove: Move | null;
  oppMove: Move | null;
  outcomeForYou: "win" | "loss" | "draw" | null;
  verb: string | null;
  showMatchFoundSplash: boolean;
  oppWaitLevel: number;
  leaveMatch: () => void;
  quitOpen: boolean;
  setQuitOpen: (open: boolean) => void;
  vsBot: boolean;
  recordAbandon: () => number;
}

export function ClassicMatchPanel({
  phase, player, m, youScore, oppScore, target, pickStartedAt, playMove,
  revealRevealed, youMove, oppMove, outcomeForYou, verb, showMatchFoundSplash,
  oppWaitLevel, leaveMatch, quitOpen, setQuitOpen, vsBot, recordAbandon,
}: ClassicMatchPanelProps) {
  const t = useT();
  return (
    <motion.div
      key="play"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-4"
    >
      {/* Score header */}
      <ScoreHeader
        youName={player.nickname}
        opponentName={m.opponent}
        youScore={youScore}
        oppScore={oppScore}
        round={m.roundNo || 1}
        target={target}
        bestOf={m.bestOf}
      />

      {/* Stage — what happens here depends on phase */}
      <div className="relative min-h-[260px] sm:min-h-[320px] flex items-center justify-center">
        {phase === "round" && !m.myMove && (
          <PickStage
            startedAt={pickStartedAt}
            deadlineMs={m.deadlineMs}
            onPick={playMove}
          />
        )}
        {phase === "round" && m.myMove && (
          <LockedStage move={m.myMove} />
        )}
        {phase === "reveal" && !revealRevealed && (
          <RevealCountdown />
        )}
        {phase === "reveal" && revealRevealed && (
          <RevealStage
            youMove={youMove}
            oppMove={oppMove}
            outcomeForYou={outcomeForYou}
            verb={verb}
            opponentName={m.opponent}
          />
        )}
        {phase === "matched" && !showMatchFoundSplash && (
          <div className="text-zinc-400 text-sm">{t("online.preparing")}</div>
        )}
      </div>

      {/* Opponent watchdog — escalating feedback + a fair, penalty-free
          exit when the opponent is slow or has dropped, so the player is
          never stuck on a frozen match wondering what's happening. */}
      <AnimatePresence>
        {oppWaitLevel >= 1 && (
          <motion.div
            key="oppwait"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={
              "self-center flex flex-col items-center gap-2 rounded-2xl px-4 py-3 border text-center " +
              (oppWaitLevel >= 2
                ? "bg-rose-500/10 border-rose-400/40"
                : "bg-white/5 border-white/10")
            }
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
              <span className={oppWaitLevel >= 2 ? "text-rose-200" : "text-zinc-300"}>
                {oppWaitLevel >= 2
                  ? t("online.oppWait.dropped")
                  : t("online.oppWait.slow")}
              </span>
            </div>
            {oppWaitLevel >= 2 && (
              <button
                onClick={leaveMatch}
                className="px-4 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 text-rose-100 text-[11px] font-bold transition"
              >
                {t("online.oppWait.leave")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setQuitOpen(true)}
        className="mt-2 self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-xs transition"
      >
        {t("online.forfeit")}
      </button>
      <OnlineMatchGuard onQuitRequest={() => setQuitOpen(true)} />
      <AnimatePresence>
        {quitOpen && (
          <QuitConfirmModal
            competitive={!vsBot}
            onCancel={() => setQuitOpen(false)}
            onConfirm={() => { setQuitOpen(false); if (!vsBot) recordAbandon(); leaveMatch(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
