/**
 * BracketPage — full-page tournament bracket view.
 *
 * Flow: pick a bracket size → auto-simulate CPU matches → surface a bold
 * "Combattre X" CTA on the player's turn → champion / spectator states.
 */

import { useCallback, useEffect, useRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";
import {
  type TournamentState,
  type TournamentSize,
  TOURNAMENT_SIZES,
  buildBracket,
  findPlayerMatch,
  isPlayerEliminated,
  hasPendingCpuMatch,
  simulateOneCpuMatch,
} from "./TournamentBracket";
import { BracketTree } from "./BracketUI";
import { FloatingMatchBackButton, hapticTick } from "../sharedMatchUI";
import { LoadingTip } from "../flavor/LoadingTip";

const SIZE_META: Record<TournamentSize, { title: string; sub: string; glyph: string }> = {
  4: { title: "Rapide", sub: "4 joueurs · 2 tours", glyph: "⚡" },
  8: { title: "Classique", sub: "8 joueurs · 3 tours", glyph: "🛡️" },
  16: { title: "Épique", sub: "16 joueurs · 4 tours", glyph: "👑" },
};

export function BracketPage({
  tournament, setTournament, onStartMatch, onBack,
}: {
  tournament: TournamentState;
  setTournament: (fn: (t: TournamentState) => TournamentState) => void;
  onStartMatch: (oppName: string, oppAvatar: string) => void;
  onBack: () => void;
}) {
  const simRef = useRef(false);

  const pickSize = useCallback((size: TournamentSize) => {
    hapticTick();
    setTournament((t) => buildBracket(t.you, size));
  }, [setTournament]);

  // Auto-simulate one CPU match every ~1.6s while it isn't the player's turn.
  useEffect(() => {
    if (tournament.phase !== "running") return;
    if (simRef.current) return;
    if (findPlayerMatch(tournament)) return; // player's turn — wait for them
    if (!hasPendingCpuMatch(tournament) && !hasPlayerPending(tournament)) return;

    simRef.current = true;
    const id = setTimeout(() => {
      simRef.current = false;
      setTournament((t) => simulateOneCpuMatch(t));
    }, 1600);
    return () => { clearTimeout(id); simRef.current = false; };
  }, [tournament, setTournament]);

  const playerMatch = findPlayerMatch(tournament);
  const eliminated = isPlayerEliminated(tournament);
  const selecting = tournament.phase === "select" || tournament.rounds.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 flex-1 py-2 px-1 max-w-2xl mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center mt-8">
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
          <span className="text-2xl">🏆</span> Tournoi
        </h1>
        <p className="text-[11px] text-zinc-500 mt-1">
          {selecting
            ? "Choisis la taille du tableau"
            : tournament.phase === "complete"
            ? "Tournoi terminé !"
            : "En cours…"}
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
          >
            <LayoutGroup>
              <BracketTree tournament={tournament} />
            </LayoutGroup>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player's match CTA */}
      {!selecting && playerMatch && (
        <CombatButton
          oppName={playerMatch.opp.name}
          oppAvatar={playerMatch.opp.avatar}
          onClick={() => onStartMatch(playerMatch.opp.name + " (CPU)", playerMatch.opp.avatar)}
        />
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
      {!selecting && eliminated && tournament.phase === "running" && (
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

      {/* Waiting for CPU matches */}
      {!selecting && !playerMatch && !eliminated && tournament.phase === "running" && (
        <div className="flex flex-col items-center gap-2 py-2 max-w-sm mx-auto px-4">
          <div className="text-center text-[11px] text-zinc-500">
            Les matchs CPU se jouent… Patiente.
          </div>
          <LoadingTip rotateMs={4000} className="justify-center text-center" />
        </div>
      )}
    </motion.div>
  );
}

function hasPlayerPending(t: TournamentState): boolean {
  for (const round of t.rounds) {
    for (const m of round) {
      if (m.status === "pending" && m.p1 && m.p2 && (m.p1.isYou || m.p2.isYou)) return true;
    }
  }
  return false;
}

/* ──────────── Size picker ──────────── */

function SizePicker({ onPick }: { onPick: (s: TournamentSize) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-3 max-w-sm mx-auto w-full px-2"
    >
      {TOURNAMENT_SIZES.map((size, i) => {
        const meta = SIZE_META[size];
        return (
          <motion.button
            key={size}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(size)}
            className="group relative w-full overflow-hidden rounded-2xl text-left transition"
            style={{
              background:
                "linear-gradient(135deg, " +
                "color-mix(in oklab, var(--theme-primary) 16%, rgba(10,12,20,0.88)) 0%, " +
                "color-mix(in oklab, var(--theme-secondary) 16%, rgba(10,12,20,0.88)) 100%)",
              border: "1px solid color-mix(in oklab, var(--theme-primary) 45%, transparent)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="text-3xl drop-shadow">{meta.glyph}</span>
              <div className="flex-1">
                <div
                  className="text-lg font-extrabold text-white"
                  style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
                >
                  {meta.title}
                </div>
                <div className="text-[11px] text-zinc-300/80">{meta.sub}</div>
              </div>
              <span
                className="text-2xl font-black tabular-nums"
                style={{ color: "color-mix(in oklab, var(--theme-primary) 85%, white)" }}
              >
                {size}
              </span>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

/* ──────────── Combat CTA ──────────── */

function CombatButton({ oppName, oppAvatar, onClick }: {
  oppName: string; oppAvatar: string; onClick: () => void;
}) {
  const isPhoto = /^(data:|\/|https?:)/.test(oppAvatar);
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      onClick={onClick}
      aria-label={`Combattre ${oppName}`}
      // Bold, unmistakable primary CTA: a SOLID theme gradient (like the Lock
      // button) so it reads as "the action" while still wearing the active
      // palette. White text + the opponent's avatar give it presence.
      className="group relative w-full max-w-md mx-auto overflow-hidden rounded-2xl transition"
      style={{
        background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
        boxShadow:
          "0 10px 30px -10px color-mix(in oklab, var(--theme-primary) 70%, transparent), " +
          "inset 0 1px 0 rgba(255,255,255,0.20)",
      }}
    >
      {/* Sweeping sheen */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-[-40%] w-[45%] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
          transform: "skewX(-18deg)",
        }}
      />
      <span className="relative flex items-center justify-center gap-3 py-4 px-5">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-black/25 overflow-hidden shrink-0 ring-1 ring-white/30">
          {isPhoto ? (
            <img src={oppAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">{oppAvatar}</span>
          )}
        </span>
        <span
          className="flex flex-col items-start leading-tight text-white"
          style={{ fontFamily: "var(--font-headline)", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
        >
          <span className="text-[10px] uppercase tracking-[0.25em] opacity-80">Combattre</span>
          <span className="text-lg font-extrabold" style={{ letterSpacing: "0.04em" }}>
            {oppName.toUpperCase()}
          </span>
        </span>
        <span aria-hidden className="ml-1 text-xl text-white/90 group-hover:translate-x-0.5 transition-transform">⚔️</span>
      </span>
    </motion.button>
  );
}
