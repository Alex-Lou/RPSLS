/**
 * BracketPage — full-page tournament bracket view.
 *
 * Auto-simulates CPU matches, shows "Combattre X (CPU)" when it's player's
 * turn, handles champion state.
 */

import { useCallback, useEffect, useRef } from "react";
import { motion, LayoutGroup } from "motion/react";
import {
  type TournamentState,
  type MatchSlot,
  findPlayerMatch,
  feedWinner,
} from "./TournamentBracket";
import { BracketTree } from "./BracketUI";
import { FloatingMatchBackButton } from "../sharedMatchUI";

function isPlayerEliminated(t: TournamentState): boolean {
  const rounds: MatchSlot[][] = [t.quarters as MatchSlot[], t.semis as MatchSlot[], [t.final]];
  for (const round of rounds) {
    for (const m of round) {
      if (m.status === "done" && m.winner) {
        const youIn = m.p1?.isYou || m.p2?.isYou;
        if (youIn && !m.winner.isYou) return true;
      }
    }
  }
  return false;
}

export function BracketPage({
  tournament, setTournament, onStartMatch, onBack,
}: {
  tournament: TournamentState;
  setTournament: (fn: (t: TournamentState) => TournamentState) => void;
  onStartMatch: (oppName: string, oppAvatar: string) => void;
  onBack: () => void;
}) {
  const simRef = useRef(false);

  const simulateNext = useCallback(() => {
    setTournament((t) => {
      const next = { ...t, phase: "running" as const };
      const rounds: MatchSlot[][] = [
        next.quarters as MatchSlot[],
        next.semis as MatchSlot[],
        [next.final],
      ];
      for (let ri = 0; ri < rounds.length; ri++) {
        for (let mi = 0; mi < rounds[ri].length; mi++) {
          const m = rounds[ri][mi];
          if (m.status === "pending" && m.p1 && m.p2) {
            if (m.p1.isYou || m.p2.isYou) {
              rounds[ri][mi] = { ...m, status: "playing" };
              return next;
            }
            const winner = Math.random() < 0.5 ? m.p1 : m.p2;
            rounds[ri][mi] = { ...m, winner, status: "done" };
            feedWinner(next, ri, mi, winner);
            return next;
          }
        }
      }
      if (next.final.status === "done" && next.final.winner) {
        return { ...next, champion: next.final.winner, phase: "complete" as const };
      }
      return next;
    });
  }, [setTournament]);

  // Auto-start on mount if lobby phase
  useEffect(() => {
    if (tournament.phase === "lobby") {
      setTournament((t) => ({ ...t, phase: "running" }));
    }
  }, []);

  // Auto-simulate CPU matches every 2s
  useEffect(() => {
    if (tournament.phase !== "running") return;
    if (simRef.current) return;
    const playerMatch = findPlayerMatch(tournament);
    if (playerMatch) return; // Player's turn — don't auto-sim
    // Check if there's any pending match with both players
    const rounds: MatchSlot[][] = [
      tournament.quarters as MatchSlot[],
      tournament.semis as MatchSlot[],
      [tournament.final],
    ];
    let hasPending = false;
    for (const round of rounds) {
      for (const m of round) {
        if (m.status === "pending" && m.p1 && m.p2) { hasPending = true; break; }
      }
    }
    if (!hasPending) return;

    simRef.current = true;
    const id = setTimeout(() => {
      simRef.current = false;
      simulateNext();
    }, 2000);
    return () => { clearTimeout(id); simRef.current = false; };
  }, [tournament, simulateNext]);

  const playerMatch = findPlayerMatch(tournament);
  const eliminated = isPlayerEliminated(tournament);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 flex-1 py-2 px-1 max-w-xl mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center mt-8">
        <h1 className="text-xl sm:text-3xl font-extrabold flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">
          <span className="text-2xl">🏆</span> Tournoi
        </h1>
        <p className="text-[11px] text-zinc-500 mt-1">
          {tournament.phase === "complete"
            ? "Tournoi terminé !"
            : tournament.phase === "running"
            ? "En cours..."
            : "Prêt à démarrer"}
        </p>
      </div>

      <LayoutGroup>
        <BracketTree tournament={tournament} />
      </LayoutGroup>

      {/* Player's match CTA */}
      {playerMatch && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onStartMatch(playerMatch.opp.name + " (CPU)", playerMatch.opp.avatar)}
          className="w-full py-4 rounded-2xl font-extrabold text-lg text-white
                     bg-gradient-to-r from-emerald-500 to-teal-500
                     shadow-xl shadow-emerald-500/30 transition animate-pulse"
        >
          ⚔️ Combattre {playerMatch.opp.name} (CPU)
        </motion.button>
      )}

      {/* Champion */}
      {tournament.phase === "complete" && tournament.champion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4"
        >
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-xl font-extrabold">
            {tournament.champion.isYou
              ? "Tu es CHAMPION !"
              : `${tournament.champion.name} remporte le tournoi`}
          </div>
          <button
            onClick={onBack}
            className="mt-4 px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold transition"
          >
            Retour au classement
          </button>
        </motion.div>
      )}

      {/* Spectator mode after elimination */}
      {eliminated && tournament.phase === "running" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3 py-3"
        >
          <div className="text-center text-sm font-semibold text-zinc-300">
            Tu as été éliminé. Regarde la suite !
          </div>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold transition"
          >
            Quitter
          </button>
        </motion.div>
      )}

      {/* No match right now — waiting for CPU (only if still in the tournament) */}
      {!playerMatch && !eliminated && tournament.phase === "running" && (
        <div className="text-center text-[11px] text-zinc-500 py-2">
          Les matchs CPU se jouent... Patiente.
        </div>
      )}
    </motion.div>
  );
}
