/**
 * BracketPage — full-page tournament bracket view.
 *
 * Flow: pick a bracket size → auto-simulate CPU matches → surface a bold
 * "Combattre X" CTA on the player's turn → champion / spectator states.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";
import {
  type TournamentState,
  type TournamentSize,
  TOURNAMENT_SIZES,
  buildBracket,
  findPlayerMatch,
  isPlayerEliminated,
  hasPendingCpuMatch,
  hasPlayingCpuMatch,
  simulateOneCpuMatch,
} from "./TournamentBracket";
import { BracketTree } from "./BracketUI";
import { TournamentPodium } from "./TournamentPodium";
import { FloatingMatchBackButton, hapticTick } from "../match/sharedMatchUI";
import { LoadingTip } from "../flavor/LoadingTip";

const SIZE_META: Record<TournamentSize, { title: string; sub: string; glyph: string; art: string }> = {
  4:  { title: "Rapide",    sub: "4 adversaires CPU · 2 tours",  glyph: "⚡",  art: "/Icones Tournoi/ConstRankedRapide.png" },
  8:  { title: "Classique", sub: "8 adversaires CPU · 3 tours",  glyph: "🛡️", art: "/Icones Tournoi/ConstRankedClassique.png" },
  16: { title: "Épique",    sub: "16 adversaires CPU · 4 tours", glyph: "👑", art: "/Icones Tournoi/ConstRankedEpique.png" },
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

  // Tournament over → celebratory podium takeover.
  if (tournament.phase === "complete") {
    return <TournamentPodium tournament={tournament} onContinue={onBack} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 flex-1 min-h-0 py-2 px-1 max-w-2xl mx-auto w-full"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="shrink-0 text-center mt-6">
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
        <p className="text-[11px] text-ink-faint mt-1">
          {selecting
            ? "Choisis la taille du tableau · adversaires CPU (entraînement)"
            : !joined
            ? "Aperçu du tableau · intègre-toi pour lancer le tournoi"
            : "En cours… · adversaires CPU"}
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
          className="mx-auto px-8 py-3.5 rounded-2xl font-bold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
          style={{
            background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.04em",
          }}
        >
          🙋 Intégrer le tournoi
        </motion.button>
      )}

      {/* Player's match CTA */}
      {!selecting && joined && playerMatch && (
        <CombatButton
          oppName={playerMatch.opp.name}
          oppAvatar={playerMatch.opp.avatar}
          onClick={() => onStartMatch(playerMatch.opp.name + " (CPU)", playerMatch.opp.avatar)}
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
            Tu as été éliminé. Regarde la suite !
          </div>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-2xl bg-hairline hover:bg-hairline border border-hairline text-sm font-semibold transition"
          >
            Quitter
          </button>
        </motion.div>
      )}

      {/* Waiting for CPU matches */}
      {!selecting && joined && !playerMatch && !eliminated && tournament.phase === "running" && (
        <div className="flex flex-col items-center gap-2 py-2 max-w-sm mx-auto px-4">
          <div className="text-center text-[11px] text-ink-faint">
            Les matchs CPU se jouent… Patiente.
          </div>
          <LoadingTip rotateMs={4000} className="justify-center text-center" />
        </div>
      )}

      <AnimatePresence>
        {preparing && (
          <TournamentPreparingOverlay
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

/* ─────────── Tournament preparing overlay ─────────── */

/**
 * TournamentPreparingOverlay — drumroll between "Intégrer" and the bracket
 * actually starting. A 3-2-1 countdown over a darkened backdrop with a
 * pulsing trophy gives the tournament its own start beat.
 */
function TournamentPreparingOverlay({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(3);
  useEffect(() => {
    if (beat === 0) {
      const id = window.setTimeout(onDone, 480);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setBeat((b) => b - 1), 850);
    return () => window.clearTimeout(id);
  }, [beat, onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 1.7, repeat: Infinity }}
          className="text-7xl drop-shadow-[0_4px_20px_rgba(251,191,36,0.45)]"
        >
          🏆
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent"
          style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.05em" }}
        >
          Le tournoi se prépare…
        </motion.h2>
        <p className="text-[12px] text-zinc-400 max-w-xs leading-snug px-6">
          Les 8 challengers prennent place sur leur estrade. Premier coup d'envoi imminent.
        </p>
        <motion.div
          key={beat}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className="text-6xl font-black tabular-nums text-amber-200 drop-shadow-[0_2px_12px_rgba(251,191,36,0.65)]"
        >
          {beat > 0 ? beat : "GO !"}
        </motion.div>
      </div>
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
              {meta.art ? (
                <img
                  src={meta.art}
                  alt=""
                  className="w-14 h-14 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                  draggable={false}
                />
              ) : (
                <span className="text-3xl drop-shadow">{meta.glyph}</span>
              )}
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
