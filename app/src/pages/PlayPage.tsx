import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { GameMode } from "../types";
import { type DailyChallenge } from "../engine/daily";
import type { Page } from "../Sidebar";
import { UserHeader } from "../UserHeader";
import { LocalLanesGame } from "../match/LocalLanesGame";
import { RankedGame } from "../ranked/RankedGame";
import { RankedLobby } from "../ranked/RankedLobby";
import { initialTournament, resolvePlayerMatch, isPlayerEliminated, type TournamentState } from "../ranked/TournamentBracket";
import { BracketPage } from "../ranked/BracketPage";
import { DeckManager } from "../ranked/DeckManager";
import { levelFromXp } from "../engine/leveling";
import { Game } from "./play/PlayGame";
import { ModeSelect, SandboxView, ConstellationLobby, ClasseLobby } from "./play/PlayMenu";

type View =
  | { kind: "select" }
  | { kind: "sandbox" }
  | { kind: "game"; mode: GameMode; bestOf: number; daily?: DailyChallenge; questCtx?: { title: string; reward: number }; atouts?: boolean }
  | { kind: "constellation_prep" }
  | { kind: "lanes_cpu"; winTo: number }
  | { kind: "ranked_lobby" }
  | { kind: "ranked_deck" }
  | { kind: "ranked_bracket" }
  | { kind: "ranked_match"; oppName: string; oppAvatar: string }
  // Classé (classic 1v1) hub — its own lobby + tournament + match.
  | { kind: "classe_lobby" }
  | { kind: "classe_bracket" }
  | { kind: "classe_match"; oppName: string; oppAvatar: string };

export function PlayPage({
  onNavigate, homeNonce,
}: {
  onNavigate?: (p: Page) => void;
  /** Bumps every time the user explicitly clicks "Home" — resets the
   *  internal view back to mode-select even if a Game or Lanes match
   *  was running. Skipped on initial mount. */
  homeNonce?: number;
}) {
  const [view, setView] = useState<View>({ kind: "select" });
  const [tournament, setTournament] = useState<TournamentState>(() => {
    const p = useStore.getState().player;
    const l = levelFromXp(p.xp);
    return initialTournament(p.nickname, p.avatar, l.level);
  });
  // Separate tournament state for the Classé (classic 1v1) bracket.
  const [classeTournament, setClasseTournament] = useState<TournamentState>(() => {
    const p = useStore.getState().player;
    const l = levelFromXp(p.xp);
    return initialTournament(p.nickname, p.avatar, l.level);
  });

  // Reset to mode-select on explicit Home clicks (not on first mount).
  useEffect(() => {
    if (homeNonce && homeNonce > 0) setView({ kind: "select" });
  }, [homeNonce]);

  // Android system back button: when we're in a sub-view (Game or
  // LanesMatch) push a history entry on entry and pop back to select
  // when the user hits the back button — instead of letting Android
  // minimize the app.
  useEffect(() => {
    if (view.kind === "select") return;
    history.pushState({ rpslsView: view.kind }, "");
    const onPop = () => setView({ kind: "select" });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [view.kind]);

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-8 pt-0 pb-2 sm:py-4 flex-1 flex flex-col min-h-0">
      {/* Player header on the home / mode-select too (Alex likes it there) —
          but never once a match is running (view !== "select"). */}
      {view.kind === "select" && <UserHeader onNavigate={onNavigate ?? (() => {})} />}
      <AnimatePresence mode="wait">
        {view.kind === "select" && (
          <ModeSelect
            key="select"
            onStart={(mode, bestOf, questCtx) => setView({ kind: "game", mode, bestOf, questCtx })}
            onGoOnline={onNavigate ? () => onNavigate("online") : undefined}
            onGoConstellation={(winTo) => setView({ kind: "lanes_cpu", winTo })}
            onGoConstellationMenu={() => setView({ kind: "constellation_prep" })}
            onGoRanked={() => setView({ kind: "ranked_lobby" })}
            onGoSandbox={() => setView({ kind: "sandbox" })}
            onGoClasse={() => setView({ kind: "classe_lobby" })}
          />
        )}
        {view.kind === "constellation_prep" && (
          <ConstellationLobby
            key="constellation-prep"
            onBack={() => setView({ kind: "select" })}
            onPlay={(winTo) => setView({ kind: "lanes_cpu", winTo })}
          />
        )}
        {view.kind === "sandbox" && (
          <SandboxView
            key="sandbox"
            onStart={(mode, bestOf) => setView({ kind: "game", mode, bestOf })}
            onGoConstellation={(winTo) => setView({ kind: "lanes_cpu", winTo })}
            onGoRanked={() => setView({ kind: "ranked_lobby" })}
            onBack={() => setView({ kind: "select" })}
          />
        )}
        {view.kind === "game" && (
          <Game
            key={`${view.mode}-${view.bestOf}-${view.daily?.date ?? ""}-${Date.now()}`}
            mode={view.mode}
            bestOf={view.bestOf}
            daily={view.daily}
            questCtx={view.questCtx}
            withAtouts={view.atouts}
            onQuit={() => setView({ kind: "select" })}
          />
        )}
        {view.kind === "lanes_cpu" && (
          <motion.div
            key={`lanes-cpu-${view.winTo}-${Date.now()}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <LocalLanesGame
              winTo={view.winTo}
              onQuit={() => setView({ kind: "select" })}
            />
          </motion.div>
        )}
        {view.kind === "ranked_lobby" && (
          <RankedLobby
            key="ranked-lobby"
            onBack={() => setView({ kind: "select" })}
            onViewBracket={() => {
              // Fresh start after a finished or lost run, otherwise resume.
              setTournament((t) =>
                t.phase === "complete" || isPlayerEliminated(t)
                  ? initialTournament(t.you.name, t.you.avatar, t.you.level)
                  : t,
              );
              setView({ kind: "ranked_bracket" });
            }}
            onManageDeck={() => setView({ kind: "ranked_deck" })}
          />
        )}
        {view.kind === "ranked_deck" && (
          <DeckManager
            key="ranked-deck"
            onClose={() => setView({ kind: "ranked_lobby" })}
          />
        )}
        {view.kind === "ranked_bracket" && (
          <BracketPage
            key="ranked-bracket"
            tournament={tournament}
            setTournament={setTournament}
            onStartMatch={(name, avatar) => setView({ kind: "ranked_match", oppName: name, oppAvatar: avatar })}
            onBack={() => setView({ kind: "ranked_lobby" })}
          />
        )}
        {view.kind === "ranked_match" && (
          <motion.div
            key={`ranked-match-${view.oppName}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <RankedGame
              winTo={3}
              opponentName={view.oppName}
              onQuit={() => setView({ kind: "ranked_bracket" })}
              onMatchResult={(won) => {
                setTournament((t) => resolvePlayerMatch(t, won));
                setView({ kind: "ranked_bracket" });
              }}
            />
          </motion.div>
        )}

        {/* ─── Classé (classic 1v1) hub ─── */}
        {view.kind === "classe_lobby" && (
          <ClasseLobby
            key="classe-lobby"
            onBack={() => setView({ kind: "select" })}
            onQuickMatch={() => setView({ kind: "game", mode: "ranked", bestOf: 5, atouts: true })}
            onViewBracket={() => {
              setClasseTournament((t) =>
                t.phase === "complete" || isPlayerEliminated(t)
                  ? initialTournament(t.you.name, t.you.avatar, t.you.level)
                  : t,
              );
              setView({ kind: "classe_bracket" });
            }}
          />
        )}
        {view.kind === "classe_bracket" && (
          <BracketPage
            key="classe-bracket"
            tournament={classeTournament}
            setTournament={setClasseTournament}
            onStartMatch={(name, avatar) => setView({ kind: "classe_match", oppName: name, oppAvatar: avatar })}
            onBack={() => setView({ kind: "classe_lobby" })}
          />
        )}
        {view.kind === "classe_match" && (
          <Game
            key={`classe-match-${view.oppName}-${Date.now()}`}
            mode="ranked"
            bestOf={5}
            withAtouts
            onQuit={() => setView({ kind: "classe_bracket" })}
            onMatchResult={(won) => {
              setClasseTournament((t) => resolvePlayerMatch(t, won));
              setView({ kind: "classe_bracket" });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

