/**
 * BracketPage — full-page tournament bracket view.
 *
 * Flow: pick a bracket size → auto-simulate CPU matches → surface a bold
 * "Combattre X" CTA on the player's turn → champion / spectator states.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";
import {
  type TournamentState, type TournamentSize, buildBracket, findPlayerMatch, isPlayerEliminated, hasPendingCpuMatch, hasPlayingCpuMatch, simulateOneCpuMatch,
} from "./TournamentBracket";
import { BracketTree } from "./BracketUI";
import { TournamentPodium } from "./TournamentPodium";
import { hapticTick } from "../match/sharedMatchUI";
import { useImmersive, useTopBar } from "../nav/topBarStore";
import { useT } from "../i18n";
import { LoadingTip } from "../flavor/LoadingTip";
import { TournamentPreparingOverlay, hasPlayerPending, SizePicker, CombatButton } from "./BracketPageParts";

export function BracketPage({
  tournament, setTournament, onStartMatch, onBack,
}: {
  tournament: TournamentState;
  setTournament: (fn: (t: TournamentState) => TournamentState) => void;
  /** `oppName` = graine STABLE de la persona adverse (oppPersona : thème/pad),
   *  jamais traduite ; `oppLabel` = nom affiché (suffixe IA/CPU traduit). */
  onStartMatch: (oppName: string, oppAvatar: string, oppLabel: string) => void;
  onBack: () => void;
}) {
  const simRef = useRef(false);
  // Preview-then-join: a freshly built bracket is shown as a still preview; the
  // player taps "Intégrer" to actually enter + start the CPU matches running.
  // A resumed in-progress bracket counts as already joined.
  const [joined, setJoined] = useState(() =>
    tournament.rounds.some((r) => r.some((m) => m.status === "done")),
  );
  /** Brief "le tournoi se prépare…" countdown that fires once between
   *  "Intégrer" and the bracket actually running. Gives the moment a sense
   *  of weight — Alex insisted that without the ramp-up the tournament
   *  feels like a UI flick instead of an event. */
  const [preparing, setPreparing] = useState(false);
  const handleJoin = useCallback(() => {
    hapticTick();
    setPreparing(true);
  }, []);

  const pickSize = useCallback((size: TournamentSize) => {
    hapticTick();
    setTournament((t) => buildBracket(t.you, size));
  }, [setTournament]);

  // Drive the bracket one tick at a time. Each CPU duel now takes two ticks
  // (start → resolve) so the round visibly plays out; we keep ticking while
  // a match is pending OR a CPU duel is mid-play. Slower cadence than before
  // (was 1.6s and resolved instantly) so the tournament reads as a sequence
  // of duels rather than collapsing in a blink.
  useEffect(() => {
    if (!joined) return; // hold the bracket as a preview until the player joins
    if (tournament.phase !== "running") return;
    if (simRef.current) return;
    if (findPlayerMatch(tournament)) return; // player's turn — wait for them
    if (!hasPendingCpuMatch(tournament) && !hasPlayingCpuMatch(tournament) && !hasPlayerPending(tournament)) return;

    // A duel "in progress" lingers a touch longer than the gap between duels,
    // so the eye catches the amber "en cours" pulse before the result lands.
    const inProgress = hasPlayingCpuMatch(tournament);
    simRef.current = true;
    const id = setTimeout(() => {
      simRef.current = false;
      setTournament((t) => simulateOneCpuMatch(t));
    }, inProgress ? 1500 : 900);
    return () => { clearTimeout(id); simRef.current = false; };
  }, [tournament, setTournament, joined]);

  const playerMatch = findPlayerMatch(tournament);
  const eliminated = isPlayerEliminated(tournament);
  const selecting = tournament.phase === "select" || tournament.rounds.length === 0;
  // Barre du haut (retour à gauche) ; le podium final est une célébration
  // plein écran → surface immersive avec ses propres boutons flottants.
  const t = useT();
  const complete = tournament.phase === "complete";
  useTopBar(complete ? null : { title: t("lobby.tournament"), onBack });
  useImmersive(complete);

  // Tournament over → celebratory podium takeover.
  if (tournament.phase === "complete") {
    return (
      <TournamentPodium
        tournament={tournament}
        onContinue={onBack}
        onReplay={() => {
          setTournament((t) => ({
            ...t,
            rounds: [],
            champion: null,
            phase: "select" as const,
          }));
          setJoined(false);
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 flex-1 min-h-0 py-2 px-1 max-w-2xl mx-auto w-full"
    >
      <div className="shrink-0 text-center">
        <h1
          className="text-2xl sm:text-3xl font-extrabold flex items-center justify-center gap-2"
          style={{
            fontFamily: "var(--font-headline)",
            background: "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          <span className="text-2xl">🏆</span> {t("lobby.tournament")}
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">
          {selecting
            ? t("bracket.sub.select")
            : !joined
            ? t("bracket.sub.preview")
            : t("bracket.sub.running")}
        </p>
      </div>

      {/* Size selection */}
      <AnimatePresence mode="wait">
        {selecting ? (
          <SizePicker key="picker" onPick={pickSize} />
        ) : (
          <motion.div
            key="tree"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <LayoutGroup>
              <BracketTree tournament={tournament} />
            </LayoutGroup>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intégrer — join the previewed bracket to start playing. */}
      {!selecting && !joined && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleJoin}
          className="mx-auto px-8 py-3.5 rounded-2xl font-bold text-white shadow-lg transition hover:scale-[1.02]"
          style={{
            background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
            boxShadow: "0 8px 24px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.04em",
          }}
        >
          {t("bracket.join")}
        </motion.button>
      )}

      {/* Player's match CTA */}
      {!selecting && joined && playerMatch && (
        <CombatButton
          oppName={playerMatch.opp.name}
          oppAvatar={playerMatch.opp.avatar}
          // Graine historique « Nom (CPU) » conservée telle quelle (même persona
          // qu'avant) ; seul le libellé affiché est traduit.
          onClick={() => onStartMatch(
            playerMatch.opp.name + " (CPU)",
            playerMatch.opp.avatar,
            t("bracket.cpuName", { name: playerMatch.opp.name }),
          )}
        />
      )}

      {/* (Tournament-complete state is handled by the TournamentPodium takeover above.) */}

      {/* Spectator mode after elimination */}
      {!selecting && joined && eliminated && tournament.phase === "running" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3 py-3"
        >
          <div className="text-center text-sm font-semibold text-ink-muted">
            {t("bracket.eliminated")}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTournament((t) => ({
                  ...t,
                  rounds: [],
                  champion: null,
                  phase: "select" as const,
                }));
                setJoined(false);
              }}
              className="px-5 py-2.5 rounded-2xl text-sm font-bold text-white bg-themed shadow-themed transition"
            >
              {t("bracket.newTournament")}
            </button>
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold transition"
              style={{
                background: "color-mix(in oklab, var(--theme-primary) 18%, rgba(10,12,20,0.85))",
                border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)",
              }}
            >
              {t("bracket.quit")}
            </button>
          </div>
        </motion.div>
      )}

      {/* Waiting for CPU matches */}
      {!selecting && joined && !playerMatch && !eliminated && tournament.phase === "running" && (
        <div className="flex flex-col items-center gap-2 py-2 max-w-sm mx-auto px-4">
          <div className="text-center text-[11px] text-ink-faint">
            {t("bracket.waitingOthers")}
          </div>
          <LoadingTip rotateMs={4000} className="justify-center text-center" />
        </div>
      )}

      <AnimatePresence>
        {preparing && (
          <TournamentPreparingOverlay
            size={tournament.size}
            onDone={() => {
              setPreparing(false);
              setJoined(true);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
