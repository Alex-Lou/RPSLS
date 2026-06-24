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
import { MatchPrepScreen, type Arena } from "../ranked/MatchPrepScreen";
import { ArenaPadProvider } from "../ranked/arena";
import { ArenaPage } from "../arena/ArenaPage";
import { ArenaLobby } from "../arena/ArenaLobby";
import { useArenaOverride } from "../ranked/arenaOverride";
import { oppPersona } from "../ranked/personaSeed";
import { applyTheme } from "../theme/theme";
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
  | { kind: "ranked_deck"; from?: "ranked" | "arena" }
  | { kind: "ranked_bracket" }
  // Pre-match staging: deck check + pad swap + coin flip for the arena.
  | { kind: "ranked_prep"; oppName: string; oppAvatar: string }
  | { kind: "ranked_match"; oppName: string; oppAvatar: string; arena?: Arena }
  // Classé (classic 1v1) hub — its own lobby + tournament + match.
  | { kind: "classe_lobby" }
  | { kind: "classe_bracket" }
  | { kind: "classe_match"; oppName: string; oppAvatar: string }
  // Constellation Pro — solo lobby (deck + rules + entry points) then match.
  | { kind: "arena_lobby" }
  | { kind: "arena_pro" };

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

  // Arena swap — when the coin flip handed the duel to the opponent, the
  // WHOLE arena (backdrop scene + HUD theme + pad) is replaced for the
  // duration of the match. Previously only the pad swapped — Alex flagged
  // that as half-baked: "after the coin flip the WHOLE theme of whoever
  // won should apply to the duel, not just the pad". Here we now:
  //   1. flip the global `arenaOverride.bg` store so App.tsx renders the
  //      opponent's backdrop scene (instead of the player's),
  //   2. apply their HUD theme via direct CSS-var mutation,
  //   3. snapshot + restore everything on unmount so leaving the match
  //      drops the player back into their own universe.
  // The pad side is handled below by <ArenaPadProvider> as before.
  const setArenaBg = useArenaOverride((s) => s.setBg);
  useEffect(() => {
    if (view.kind !== "ranked_match" || view.arena?.side !== "opp") return;
    const root = document.documentElement;
    const snap = {
      p: root.style.getPropertyValue("--theme-primary"),
      s: root.style.getPropertyValue("--theme-secondary"),
      b: root.style.getPropertyValue("--theme-bg"),
    };
    applyTheme(view.arena.themeId);
    setArenaBg(view.arena.backgroundId);
    return () => {
      if (snap.p) root.style.setProperty("--theme-primary", snap.p);
      if (snap.s) root.style.setProperty("--theme-secondary", snap.s);
      if (snap.b) root.style.setProperty("--theme-bg", snap.b);
      setArenaBg(null);
    };
  }, [view, setArenaBg]);

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-8 pt-0 pb-2 sm:py-4 flex-1 flex flex-col min-h-0">
      {/* Player header on the home / mode-select too (Alex likes it there) —
          but never once a match is running (view !== "select"). */}
      {view.kind === "select" && (
        // Carte joueur PLEINE LARGEUR + remontée (Alex 2026-06-12 v2) : le
        // burger flottant est MASQUÉ sur cet écran (ModeSelect setBurgerHidden,
        // remplacé par le burger themed inline à gauche du Défi du jour) →
        // plus rien à esquiver, la carte monte (-mt-10 sur le pt-12 global).
        // px-0 : aligne la carte sur la largeur des tuiles du menu (qui n'ont
        // pas de padding interne). -mt-11→-mt-4 (Alex 2026-06-23) : -mt-11 plaçait
        // la carte à ~4px sous la safe-area → DANS la barre de statut Android. -mt-4
        // garde ~32px de marge au-dessus de --sai-top (≥24px) → dégage le notch.
        <UserHeader onNavigate={onNavigate ?? (() => {})} className="px-0 -mt-4" />
      )}
      <AnimatePresence mode="wait">
        {view.kind === "select" && (
          <ModeSelect
            key="select"
            onStart={(mode, bestOf, questCtx) => setView({ kind: "game", mode, bestOf, questCtx })}
            onGoOnline={onNavigate ? () => onNavigate("online") : undefined}
            onGoConstellation={(winTo) => setView({ kind: "lanes_cpu", winTo })}
            onGoConstellationMenu={() => setView({ kind: "constellation_prep" })}
            onGoRanked={() => setView({ kind: "ranked_lobby" })}
            onGoArenaPro={() => setView({ kind: "arena_lobby" })}
            onGoSandbox={() => setView({ kind: "sandbox" })}
            onGoClasse={() => setView({ kind: "classe_lobby" })}
          />
        )}
        {view.kind === "arena_lobby" && (
          <ArenaLobby
            key="arena-lobby"
            onTraining={() => setView({ kind: "arena_pro" })}
            onManageDeck={() => setView({ kind: "ranked_deck", from: "arena" })}
            onGoShop={() => setView({ kind: "ranked_lobby" })}
            onBack={() => setView({ kind: "select" })}
          />
        )}
        {view.kind === "arena_pro" && (
          <motion.div
            key="arena_pro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col flex-1 min-h-0"
          >
            <ArenaPage onBack={() => setView({ kind: "arena_lobby" })} />
          </motion.div>
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
            onManageDeck={() => setView({ kind: "ranked_deck", from: "ranked" })}
            onGoShop={onNavigate ? () => onNavigate("shop") : undefined}
          />
        )}
        {view.kind === "ranked_deck" && (
          <DeckManager
            key="ranked-deck"
            mode={view.from === "arena" ? "arena" : "ranked"}
            onClose={() => setView({
              kind: view.from === "arena" ? "arena_lobby" : "ranked_lobby",
            })}
          />
        )}
        {view.kind === "ranked_bracket" && (
          <BracketPage
            key="ranked-bracket"
            tournament={tournament}
            setTournament={setTournament}
            onStartMatch={(name, avatar) => setView({ kind: "ranked_prep", oppName: name, oppAvatar: avatar })}
            onBack={() => setView({ kind: "ranked_lobby" })}
          />
        )}
        {view.kind === "ranked_prep" && (() => {
          const persona = oppPersona(view.oppName);
          const me = useStore.getState().player;
          return (
            <MatchPrepScreen
              key={`ranked-prep-${view.oppName}`}
              youName={me.nickname}
              youAvatar={me.avatar}
              youThemeId={me.themeId}
              youBackgroundId={me.backgroundId ?? "default"}
              oppName={view.oppName}
              oppAvatar={view.oppAvatar}
              oppThemeId={persona.themeId}
              oppPadId={persona.padId}
              oppBackgroundId={persona.backgroundId}
              onBack={() => setView({ kind: "ranked_bracket" })}
              onReady={(arena) =>
                setView({ kind: "ranked_match", oppName: view.oppName, oppAvatar: view.oppAvatar, arena })
              }
            />
          );
        })()}
        {view.kind === "ranked_match" && (
          <motion.div
            key={`ranked-match-${view.oppName}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* The arena pad override (if the coin gave the duel to the
                opponent's pad) is supplied via context; null = player's pad. */}
            <ArenaPadProvider value={view.arena?.side === "opp" ? view.arena.padId : null}>
              <RankedGame
                winTo={3}
                opponentName={view.oppName}
                onQuit={() => setView({ kind: "ranked_bracket" })}
                onMatchResult={(won) => {
                  setTournament((t) => resolvePlayerMatch(t, won));
                  setView({ kind: "ranked_bracket" });
                }}
              />
            </ArenaPadProvider>
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

