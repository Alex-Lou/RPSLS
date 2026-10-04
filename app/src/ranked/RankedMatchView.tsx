/**
 * RankedMatchView — top-level match UI orchestrator.
 *
 * Picks/cards/mana state lives in `RankedGame`; this view receives it as
 * props and decides which phase to render (splash → picking → reveal-intro
 * → reveal → match-end). Thin assembler — pick/reveal heavy lifting is in
 * `RankedPickPhase` and `RankedRevealPhase`.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useT } from "../i18n";
import { MatchScoreBar, type MatchBackHandle } from "../match/sharedMatchUI";
import { InlineBurger } from "../ui/ModeLobbyShell";
import { setBurgerHidden } from "../Sidebar";
import { LoadingTip } from "../flavor/LoadingTip";
import { RankedPickPhase } from "./RankedPickPhase";
import { RankedRevealPhase } from "./RankedRevealPhase";
import { RankedMatchEnd } from "./RankedMatchEnd";
import { useMatchSurface } from "../fx/menuFx";
import type { RankedMatchViewProps } from "./rankedMatchTypes";
import { RankedBackGuard, InlineBackButton } from "./RankedMatchControls";
import { MatchFoundSplash, RevealCountdown } from "./RankedMatchSplash";

export type {
  RankedMatchInfo, RankedRoundData, RankedRoundResultData, RankedEndData, RankedMatchViewProps,
} from "./rankedMatchTypes";

type Phase = "matched" | "picking" | "reveal-intro" | "reveal" | "match-end";

/** Délai avant que l'en-tête ne bumpe le score, en phase reveal. La phase reveal
 *  commence par le décompte « PIERRE-FEUILLE-… TIREZ » (RevealCountdown, 1400ms),
 *  PUIS RankedRevealPhase monte et fait sa cascade de lanes (+200/800/1400ms) +
 *  verdict (+1500ms) → les résultats finissent de s'afficher vers ~2900ms. On
 *  bumpe le score JUSTE APRÈS, à 3000ms, pour ne pas spoiler (Alex 2026-07). */
const REVEAL_SCORE_DELAY_MS = 3000;

export function RankedMatchView({
  nickname, match,
  round, lastResult, end,
  picks, cardPlayed, augurRevealed, mana, manaMax, passives, braiseStacks, activeEffects, compassRevealed, oracleRevealed, oppHandRevealed, hand, oppHandSize,
  roundWinsYou, roundWinsOpp, augurCooldown,
  onPickMove, onClearLane, onPlayCard, onCancelCard, onLock,
  revealAugurFor, onLeave, onRematch, onNext, showTimer = true,
}: RankedMatchViewProps) {
  useMatchSurface();
  const t = useT();
  const phase: Phase = (() => {
    if (end) return "match-end";
    if (lastResult && !round) return "reveal";
    if (round) return "picking";
    return "matched";
  })();

  // Hauteur de board mesurée en phase PICK (BoardFillSlot) — RÉUTILISÉE telle
  // quelle par la phase reveal → le plateau garde EXACTEMENT la même taille d'une
  // phase à l'autre (fini le pad qui rétrécit/grandit). MAJ seulement si ça bouge.
  const [pickBoardH, setPickBoardH] = useState(0);

  // Burger flottant global OFF pendant le match (Alex 2026-07) : on le remplace
  // par le burger INLINE de la rangée de score → plus aucun chevauchement du nom.
  useEffect(() => {
    setBurgerHidden(true);
    return () => setBurgerHidden(false);
  }, []);

  // Handle du back-guard : le bouton retour INLINE (droite de la rangée) déclenche
  // le MÊME modal de confirmation forfait que le back Android (cf. RankedBackGuard).
  const backHandleRef = useRef<MatchBackHandle | null>(null);

  // Splash visible 2.5s after mount.
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setShowSplash(false), 2500);
    return () => window.clearTimeout(id);
  }, [match.matchId]);

  // Reveal-intro suspense countdown.
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (!lastResult) {
      setRevealReady(false);
      return;
    }
    setRevealReady(false);
    const id = window.setTimeout(() => setRevealReady(true), 1400);
    return () => window.clearTimeout(id);
  }, [lastResult]);

  // Score AFFICHÉ dans l'en-tête — DÉCALÉ pendant le reveal (Alex 2026-07). Si on
  // bumpe le score dès que la manche résout, le joueur SAIT qui a gagné AVANT même
  // que l'animation ne le montre (spoiler + temps perdu). On garde donc l'ancien
  // score pendant la cascade de reveal (lanes 200/800/1400ms + verdict 1500ms),
  // puis on le met à jour JUSTE APRÈS (les chiffres roulent à ce moment-là).
  const [shownWins, setShownWins] = useState({ you: roundWinsYou, opp: roundWinsOpp });
  useEffect(() => {
    if (phase === "reveal") {
      const id = window.setTimeout(
        () => setShownWins({ you: roundWinsYou, opp: roundWinsOpp }),
        REVEAL_SCORE_DELAY_MS,
      );
      return () => window.clearTimeout(id);
    }
    // Hors reveal (pick / matched / fin de match) : le score est à jour tout de suite.
    setShownWins({ you: roundWinsYou, opp: roundWinsOpp });
  }, [phase, roundWinsYou, roundWinsOpp]);

  return (
    <div className="relative flex flex-col gap-1 sm:gap-2 flex-1 min-h-0 overflow-hidden pt-0 -mt-6 [@media(max-height:560px)]:-mt-3">
      {/* -mt-6 : récupère l'espace haut gaspillé (le pt-12 global de <main> pour
          le burger) UNIQUEMENT dans le match → tout remonte, le bouton Verrouiller
          rentre dans la vue sans scroll. Ciblé match, les menus ne bougent pas.
          Le burger vit maintenant DANS la rangée d'en-tête (plus de flottant), donc
          plus aucun besoin de réserver la bande du haut. */}
      {onLeave && (
        <RankedBackGuard ref={backHandleRef} onLeave={onLeave} label={t("lanes.forfeitMatch")} />
      )}

      <AnimatePresence>
        {showSplash && (
          <MatchFoundSplash
            you={nickname}
            opp={match.opponent}
          />
        )}
      </AnimatePresence>

      {/* En-tête en DEUX rangées (Alex 2026-07, retour device) : flanquer le
          score entre les boutons l'écrasait (nom coupé, chiffres serrés). Rangée
          1 = les 2 boutons sur LEUR ligne, inchangés (burger gauche, retour
          droite). Rangée 2 = le score PLEINE LARGEUR en dessous → il respire,
          plus rien n'est coupé. Le burger/back flottants restent masqués. */}
      <div className="shrink-0 flex items-center justify-between">
        <InlineBurger className="w-9 h-9 sm:w-10 sm:h-10" />
        {onLeave && (
          <InlineBackButton
            onClick={() => backHandleRef.current?.triggerConfirm()}
            label={t("lanes.forfeitMatch")}
          />
        )}
      </div>

      {/* Score pleine largeur SOUS les boutons. `compact` = barre resserrée
          (padding + chiffres réduits). Caption RETIRÉE (Alex 2026-07 « prend de
          la place pour rien ») → une ligne de gagnée pour que le bouton Verrouiller
          rentre sans scroll ; le n° de manche reste affiché à la résolution. */}
      <MatchScoreBar
        compact
        youName={nickname}
        oppName={match.opponent || "—"}
        youScore={shownWins.you}
        oppScore={shownWins.opp}
        youTag={t("lanes.you")}
        oppTag={t("lanes.opponent")}
      />

      {/* Fin de match : écran COMMUN plein écran (portail), cf. RankedMatchEnd. */}
      {phase === "match-end" && end && (
        <RankedMatchEnd
          end={end}
          youName={nickname}
          oppName={match.opponent || t("end.opponent")}
          winTo={match.winTo}
          onNext={onNext}
          onRematch={onRematch}
          onLeave={onLeave}
        />
      )}

      {/* PICK PHASE — gère SA PROPRE hauteur (hors ScaleToFit). Le board est
          enveloppé dans BoardFillSlot (cadre fixe, scale-down seulement s'il
          déborde) et le mobilier (chips/mana/main/picker/Lock) reste DEHORS du
          slot mesuré — même découpe qu'en Constellation Pro (ArenaGame). Ça
          empêche tout le sous-arbre de se re-scaler (« le pad panique ») quand
          des chips apparaissent/disparaissent en cours de manche. */}
      {phase === "picking" && round && (
        <div className="relative flex-1 min-h-0 w-full flex flex-col">
          <RankedPickPhase
            youName={nickname}
            opponentName={match.opponent}
            picks={picks}
            augurRevealed={augurRevealed}
            cardPlayed={cardPlayed}
            mana={mana}
            manaMax={manaMax}
            passives={passives}
            braiseStacks={braiseStacks}
            activeEffects={activeEffects}
            compassRevealed={compassRevealed}
            oracleRevealed={oracleRevealed}
            oppHandRevealed={oppHandRevealed}
            hand={hand}
            oppHandSize={oppHandSize}
            augurCooldown={augurCooldown}
            startedAt={round.startedAt}
            deadlineMs={round.deadlineMs}
            showTimer={showTimer}
            onPickMove={onPickMove}
            onClearLane={onClearLane}
            onPlayCard={onPlayCard}
            onCancelCard={onCancelCard}
            onLock={onLock}
            revealAugurFor={revealAugurFor}
            onBoardMeasure={(h) => setPickBoardH((p) => (Math.abs(p - h) > 1 ? h : p))}
          />
        </div>
      )}

      {/* MATCHED + REVEAL — plus de ScaleToFit (c'était la source du board qui
          change d'échelle entre pick et reveal). Le board rend en hauteur
          NATURELLE, identique à la phase pick → taille du plateau STABLE d'une
          phase à l'autre. Scroll de secours si l'écran est trop court (jamais
          de clip), au lieu de tout rétrécir. */}
      {(phase === "matched" || phase === "reveal") && (
      <div className="relative flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center py-1">
        {phase === "matched" && !showSplash && (
          <div className="flex flex-col items-center gap-3 max-w-sm px-4">
            <div className="text-sm text-ink-muted">{t("lanes.preparingFirstRound")}</div>
            <LoadingTip category="strategy" rotateMs={4000} className="justify-center text-center" />
          </div>
        )}

        {phase === "reveal" && lastResult && !revealReady && <RevealCountdown />}
        {phase === "reveal" && lastResult && revealReady && (
          <RankedRevealPhase
            youName={nickname}
            opponentName={match.opponent}
            yourPicks={lastResult.yourPicks}
            oppPicks={lastResult.oppPicks}
            myCard={lastResult.myCard}
            oppCard={lastResult.oppCard}
            augurRevealed={lastResult.augurRevealed}
            laneResults={lastResult.laneResults}
            bonuses={lastResult.bonuses}
            roundWinner={lastResult.roundWinner}
            yourTotal={lastResult.yourTotal}
            oppTotal={lastResult.oppTotal}
            oppHandSize={oppHandSize}
            boardH={pickBoardH}
          />
        )}
      </div>
      )}
    </div>
  );
}
