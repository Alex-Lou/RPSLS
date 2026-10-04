import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useStore } from "../store/store";
import { GameMode } from "../types";
import { type DailyChallenge } from "../engine/daily";
import type { Page } from "../Sidebar";
import { UserHeader } from "../UserHeader";
import { LocalLanesGame } from "../match/LocalLanesGame";
import { RankedGame } from "../ranked/RankedGame";
import { RankedLobby } from "../ranked/RankedLobby";
import { initialTournament, resolvePlayerMatch, isPlayerEliminated, pickCpuOpponent, type TournamentState } from "../ranked/TournamentBracket";
import { BracketPage } from "../ranked/BracketPage";
import { DeckManager } from "../ranked/DeckManager";
import { MatchPrepScreen, type Arena } from "../ranked/MatchPrepScreen";
import { ArenaPadProvider } from "../ranked/arena";
import { ArenaPage } from "../arena/ArenaPage";
import { ArenaLobby } from "../arena/ArenaLobby";
import { ArenaTutorialPage } from "../arena/tutorial/ArenaTutorialPage";
import { skipArenaTutorial } from "../arena/tutorial/tutorialProgress";
import { ArenaOnlineGame } from "../arena/ArenaOnlineGame";
import { useArenaOverride } from "../ranked/arenaOverride";
import { oppPersona } from "../ranked/personaSeed";
import { applyTheme } from "../theme/theme";
import { levelFromXp } from "../engine/leveling";
import { Game } from "./play/PlayGame";
import { ModeSelect, SandboxView, ConstellationLobby, ClasseLobby } from "./play/PlayMenu";
import { setOnlineIntent } from "../online/onlineIntent";
import { consumePlayReturnView } from "../online/playReturnView";
import { backPromptActive } from "../match/sharedMatchUI/androidBack";
import { MatchStage } from "../nav/MatchStage";

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
  // `direct` = duel rapide hors tournoi (retour lobby, pas de bracket) — Alex 2026-07.
  // oppName = graine de persona (oppPersona) ; oppLabel = nom affiché (défaut : oppName).
  | { kind: "ranked_prep"; oppName: string; oppAvatar: string; oppLabel?: string; direct?: boolean }
  | { kind: "ranked_match"; oppName: string; oppAvatar: string; oppLabel?: string; arena?: Arena; direct?: boolean }
  // Classé (classic 1v1) hub — its own lobby + tournament + match.
  | { kind: "classe_lobby" }
  | { kind: "classe_bracket" }
  | { kind: "classe_match"; oppName: string; oppAvatar: string }
  // Constellation Pro — solo lobby (deck + rules + entry points) then match.
  | { kind: "arena_lobby" }
  | { kind: "arena_pro" }
  | { kind: "arena_tutorial" }
  | { kind: "arena_online" };

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
  // Clé de montage d'un match : change à chaque NOUVELLE vue (setView), mais
  // reste stable entre deux rendus. Avant, `Date.now()` dans la clé remontait
  // (et effaçait sans l'enregistrer) le match en cours à chaque re-rendu de la
  // page (saison posée par le portefeuille, autodétection graphique…).
  const viewNonce = useMemo(() => Date.now(), [view]);
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

  // Reset to mode-select on explicit Home clicks (not on first mount) — SAUF si
  // OnlinePage a posé une vue de retour (match Classé en ligne fini → revenir au
  // hub Classé, pas à l'accueil). PlayPage remonte à neuf en revenant de la page
  // En ligne : on lit la vue de retour ici (consume-once) avant tout reset.
  useEffect(() => {
    const rv = consumePlayReturnView();
    if (rv === "classe_lobby") { setView({ kind: "classe_lobby" }); return; }
    if (homeNonce && homeNonce > 0) setView({ kind: "select" });
  }, [homeNonce]);

  // Android system back button: when we're in a sub-view (Game or
  // LanesMatch) push a history entry on entry and pop back to select
  // when the user hits the back button — instead of letting Android
  // minimize the app.
  useEffect(() => {
    if (view.kind === "select") return;
    history.pushState({ rpslsView: view.kind }, "");
    const onPop = () => {
      // Un match / lobby gère le retour lui-même (modale de confirmation).
      if (backPromptActive()) return;
      setView({ kind: "select" });
    };
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
        <UserHeader onNavigate={onNavigate ?? (() => {})} className="px-0 -mt-8" />
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
            onGoOnline={() => setView({ kind: "arena_online" })}
            onManageDeck={() => setView({ kind: "ranked_deck", from: "arena" })}
            onBack={() => setView({ kind: "select" })}
            onTutorial={() => setView({ kind: "arena_tutorial" })}
          />
        )}
        {view.kind === "arena_tutorial" && (
          <MatchStage key="arena_tutorial">
            <ArenaTutorialPage
              // Quitter en cours de route = tuto « passé » (plus proposé d'office) ;
              // sans effet s'il est déjà réussi.
              onBack={() => { skipArenaTutorial(); setView({ kind: "arena_lobby" }); }}
              onPlayReal={() => setView({ kind: "arena_pro" })}
            />
          </MatchStage>
        )}
        {view.kind === "arena_online" && (
          <MatchStage key="arena_online">
            <ArenaOnlineGame onBack={() => setView({ kind: "arena_lobby" })} />
          </MatchStage>
        )}
        {view.kind === "arena_pro" && (
          <MatchStage key="arena_pro">
            <ArenaPage onBack={() => setView({ kind: "arena_lobby" })} />
          </MatchStage>
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
          <MatchStage key={`${view.mode}-${view.bestOf}-${view.daily?.date ?? ""}-${viewNonce}`}>
            <Game
              mode={view.mode}
              bestOf={view.bestOf}
              daily={view.daily}
              questCtx={view.questCtx}
              withAtouts={view.atouts}
              onQuit={() => setView({ kind: "select" })}
            />
          </MatchStage>
        )}
        {view.kind === "lanes_cpu" && (
          <MatchStage key={`lanes-cpu-${view.winTo}-${viewNonce}`}>
            <LocalLanesGame
              winTo={view.winTo}
              onQuit={() => setView({ kind: "select" })}
            />
          </MatchStage>
        )}
        {view.kind === "ranked_lobby" && (
          <RankedLobby
            key="ranked-lobby"
            onBack={() => setView({ kind: "select" })}
            onQuickMatch={() => {
              // Duel direct vs CPU (hors tournoi) : adversaire aléatoire du roster,
              // pré-match (pièce) puis match ; retour au lobby (flag `direct`).
              const opp = pickCpuOpponent();
              setView({ kind: "ranked_prep", oppName: opp.name, oppAvatar: opp.avatar, direct: true });
            }}
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
            onStartMatch={(name, avatar, label) => setView({ kind: "ranked_prep", oppName: name, oppAvatar: avatar, oppLabel: label })}
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
              oppName={view.oppLabel ?? view.oppName}
              oppAvatar={view.oppAvatar}
              oppThemeId={persona.themeId}
              oppPadId={persona.padId}
              oppBackgroundId={persona.backgroundId}
              onBack={() => setView(view.direct ? { kind: "ranked_lobby" } : { kind: "ranked_bracket" })}
              onReady={(arena) =>
                setView({ kind: "ranked_match", oppName: view.oppName, oppAvatar: view.oppAvatar, oppLabel: view.oppLabel, arena, direct: view.direct })
              }
            />
          );
        })()}
        {view.kind === "ranked_match" && (
          <MatchStage key={`ranked-match-${view.oppName}`}>
            {/* The arena pad override (if the coin gave the duel to the
                opponent's pad) is supplied via context; null = player's pad. */}
            <ArenaPadProvider value={view.arena?.side === "opp" ? view.arena.padId : null}>
              <RankedGame
                winTo={3}
                opponentName={view.oppLabel ?? view.oppName}
                onQuit={() => setView(view.direct ? { kind: "ranked_lobby" } : { kind: "ranked_bracket" })}
                onMatchResult={(won) => {
                  // Duel direct : retour au lobby (le match est déjà enregistré par
                  // RankedGame — XP/historique). Tournoi : on route dans le bracket.
                  if (view.direct) { setView({ kind: "ranked_lobby" }); return; }
                  setTournament((t) => resolvePlayerMatch(t, won));
                  setView({ kind: "ranked_bracket" });
                }}
              />
            </ArenaPadProvider>
          </MatchStage>
        )}

        {/* ─── Classé (classic 1v1) hub ─── */}
        {view.kind === "classe_lobby" && (
          <ClasseLobby
            key="classe-lobby"
            onBack={() => setView({ kind: "select" })}
            onQuickMatch={() => setView({ kind: "game", mode: "ranked", bestOf: 5, atouts: true })}
            onQuickMatchOnline={() => {
              // vs joueur réel : file RPSLS classique best-of-5, auto-queue, et
              // crédit du ladder Classé (classeLp) en fin de match (+ rankLp serveur).
              setOnlineIntent({ mode: "classic", bestOf: 5, autoQueue: true, ladder: "classe" });
              onNavigate?.("online");
            }}
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
          <MatchStage key={`classe-match-${view.oppName}-${viewNonce}`}>
            <Game
              mode="ranked"
              bestOf={5}
              withAtouts
              onQuit={() => setView({ kind: "classe_bracket" })}
              onMatchResult={(won) => {
                setClasseTournament((t) => resolvePlayerMatch(t, won));
                setView({ kind: "classe_bracket" });
              }}
            />
          </MatchStage>
        )}
      </AnimatePresence>
    </div>
  );
}

