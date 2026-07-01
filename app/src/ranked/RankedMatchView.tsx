/**
 * RankedMatchView — top-level match UI orchestrator.
 *
 * Picks/cards/mana state lives in `RankedGame`; this view receives it as
 * props and decides which phase to render (splash → picking → reveal-intro
 * → reveal → match-end). Thin assembler — pick/reveal heavy lifting is in
 * `RankedPickPhase` and `RankedRevealPhase`.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Move } from "../engine/game";
import type { LaneResult, PlayerSlot } from "../online/online";
import { useT } from "../i18n";
import {
  MatchScoreBar,
  CinematicMatchEnd,
  FloatingMatchBackButton,
  useAndroidBackPrompt,
  type MatchBackHandle,
} from "../match/sharedMatchUI";
import { InlineBurger } from "../ui/ModeLobbyShell";
import { setBurgerHidden } from "../Sidebar";
import { LoadingTip } from "../flavor/LoadingTip";
import { RankedPickPhase } from "./RankedPickPhase";
import { RankedRevealPhase } from "./RankedRevealPhase";
import { CARDS } from "./cards";
import type {
  CardId,
  LaneTarget,
  PlayedCard,
  RoundBonusBreakdown,
} from "./rankedTypes";

/* ──────────── Public surface ──────────── */

export interface RankedMatchInfo {
  matchId: string;
  opponent: string;
  youAre: PlayerSlot;
  lanes: number;
  winTo: number;
}

export interface RankedRoundData {
  no: number;
  deadlineMs: number;
  startedAt: number;
}

export interface RankedRoundResultData {
  yourPicks: [Move, Move, Move];
  oppPicks: [Move, Move, Move];
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  laneResults: LaneResult[];
  bonuses: RoundBonusBreakdown;
  roundWinner: "a" | "b" | "draw";
  yourTotal: number;
  oppTotal: number;
  roundWinsYou: number;
  roundWinsOpp: number;
}

export interface RankedEndData {
  winner: PlayerSlot | null;
  roundWinsYou: number;
  roundWinsOpp: number;
  forfeit: boolean;
  /** XP awarded for this match — shown as an animated reward on the end screen. */
  xpGained?: number;
  /** Boutique éclats granted on this match end — same logic as LanesEndData. */
  eclatsGained?: number;
  /** Every card the player played during the match — fed into a "Cartes
   *  utilisées" recap below the cinematic so the player gradually learns
   *  the cards by reading them in context, no rulebook open. */
  youCardsPlayed?: CardId[];
  /** Same on the opponent side — visible to the player so they understand
   *  what was thrown at them and can plan a counter next time. */
  oppCardsPlayed?: CardId[];
}

export interface RankedMatchViewProps {
  nickname: string;
  match: RankedMatchInfo;
  round: RankedRoundData | null;
  lastResult: RankedRoundResultData | null;
  end: RankedEndData | null;
  // Round-time state
  picks: [Move | null, Move | null, Move | null];
  cardPlayed: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  mana: number;
  /** Mana ceiling for the pip display — 5 with Cadence, else 4. */
  manaMax?: number;
  /** Equipped passive cards — shown as an always-on strip in the pick phase. */
  passives?: CardId[];
  /** Braise (Ember) stacks — discount in mana on the next card played. */
  braiseStacks?: number;
  /** Cross-round V3 effects gathered for the chip strip. Each field corresponds
   *  to one card's pending/active state; the pick phase renders a chip per
   *  truthy field so the player SEES what's queued for next round. */
  activeEffects?: {
    mascaradePoison: boolean;
    bonusManaNext: number;
    cascadeArmed: boolean;
    echoActive: boolean;
    anchorRoundsLeft: number;
    gaiaCharged: boolean;
  };
  /** Boussole (Phare) reveal: opp card scheduled for THIS round — `lane` is
   *  null if the card has no lane target; `cardId` names the card so the chip
   *  can say "Adv jouera Surge → lane 2". */
  compassRevealed?: { lane: LaneTarget | null; cardId?: CardId } | null;
  /** Oracle / Télépathie reveal: opponent's 3 moves shown face-up during pick. */
  oracleRevealed?: [Move, Move, Move] | null;
  /** Oracle Inverse reveal: 3 cards peeked from the opponent's notional hand. */
  oppHandRevealed?: CardId[] | null;
  hand: CardId[];
  oppHandSize: number;
  // Actions
  onPickMove: (mv: Move) => void;
  onClearLane: (lane: LaneTarget) => void;
  onPlayCard: (card: PlayedCard) => void;
  onCancelCard: () => void;
  onLock: () => void;
  revealAugurFor: (lane: LaneTarget) => Move;
  /** Persistent round-win counts — never resets between rounds. */
  roundWinsYou: number;
  roundWinsOpp: number;
  /** Rounds remaining before Augur/Oracle can be played. 0 = available. */
  augurCooldown: number;
  onLeave?: () => void;
  onRematch?: () => void;
  /** Tournament flow: "Suivant" button after match end. */
  onNext?: () => void;
  /** Show the pick countdown. Ranked vs CPU passes false (no time pressure,
   *  no move auto-played for you). */
  showTimer?: boolean;
}

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

      {/* Match-end is rendered FULL-BLEED (no ScaleToFit). The cinematic +
          cards recap don't compete with a Lock button for vertical space —
          they're the climax of the screen and need the entire viewport to
          breathe. ScaleToFit's `transform: scale(<1)` was the cause of the
          "rectangle inside a rectangle" framing Alex flagged: when the
          content overran height, the WHOLE subtree shrank uniformly and
          read as a small floating card instead of a full-screen celebration. */}
      {phase === "match-end" && end && (
        <div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto py-1">
          <CinematicMatchEnd
            outcome={
              end.roundWinsYou > end.roundWinsOpp ? "win" :
              end.roundWinsYou < end.roundWinsOpp ? "loss" : "draw"
            }
            forfeit={end.forfeit}
            forfeitByYou={end.forfeit && end.winner === "b"}
            scoreLine={`${end.roundWinsYou} — ${end.roundWinsOpp}`}
            youScore={end.roundWinsYou}
            oppScore={end.roundWinsOpp}
            bestOf={match.winTo * 2 - 1}
            onRematch={onNext ? undefined : onRematch}
            onBack={onNext ? onNext : onLeave!}
            backLabel={onNext ? "Suivant →" : undefined}
            reward={{ xp: end.xpGained, eclats: end.eclatsGained }}
          />
          <MatchCardsRecap
            youCards={end.youCardsPlayed ?? []}
            oppCards={end.oppCardsPlayed ?? []}
          />
        </div>
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

/* ──────────── End-of-match cards recap ──────────── */

/**
 * MatchCardsRecap — small "Cartes utilisées" block under the cinematic.
 *
 * Lists the unique cards each side actually played during the match, with
 * their name and short description. Stays inside the same panel so the
 * screen never overflows: the player learns by reading the cards in
 * context instead of opening a rulebook.
 */
function MatchCardsRecap({ youCards, oppCards }: { youCards: CardId[]; oppCards: CardId[] }) {
  const t = useT();
  const youUnique = unique(youCards);
  const oppUnique = unique(oppCards);
  if (youUnique.length === 0 && oppUnique.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.35 }}
      className="mt-3 w-full max-w-2xl mx-auto rounded-2xl bg-surface border border-hairline p-3 sm:p-4"
    >
      <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-faint text-center mb-2">
        Cartes utilisées
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CardsColumn label="Toi" cards={youUnique} tone="emerald" t={t} />
        <CardsColumn label="Adv." cards={oppUnique} tone="rose" t={t} />
      </div>
    </motion.div>
  );
}

function CardsColumn({
  label, cards, tone, t,
}: {
  label: string;
  cards: CardId[];
  tone: "emerald" | "rose";
  t: (k: string) => string;
}) {
  const ring = tone === "emerald" ? "ring-emerald-400/30" : "ring-rose-400/30";
  const head = tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <div>
      <div className={"text-[10px] uppercase tracking-wider font-bold mb-1 " + head}>{label}</div>
      {cards.length === 0 ? (
        <p className="text-[11px] text-ink-faint italic">Aucune carte jouée</p>
      ) : (
        <div className="flex flex-col gap-1">
          {cards.map((id) => {
            const c = CARDS[id];
            return (
              <div key={id} className={"rounded-lg p-2 bg-hairline ring-1 " + ring}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-base">{c.glyph}</span>
                  <span className="text-[11px] font-bold text-ink">{t(c.nameKey)}</span>
                </div>
                <p className="text-[10px] text-ink-muted leading-snug">{t(c.descKey)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Dedupe while keeping first-seen order. */
function unique<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
}

/* ──────────── Sub-pieces ──────────── */

/** Wraps FloatingMatchBackButton so the Android system back button (which
 *  would otherwise blow past every confirm) routes to the same modal as the
 *  inline back arrow. Le bouton flottant est `hidden` : le retour est désormais
 *  rendu INLINE dans la rangée d'en-tête (à droite du score), qui déclenche le
 *  même modal via le handle exposé ici. */
const RankedBackGuard = forwardRef<MatchBackHandle, { onLeave: () => void; label: string }>(
  function RankedBackGuard({ onLeave, label }, ref) {
    const handleRef = useRef<MatchBackHandle | null>(null);
    useAndroidBackPrompt(() => handleRef.current?.triggerConfirm());
    useImperativeHandle(ref, () => ({
      triggerConfirm: () => handleRef.current?.triggerConfirm(),
    }), []);
    return (
      <FloatingMatchBackButton
        ref={handleRef}
        hidden
        onClick={onLeave}
        label={label}
        confirm={{
          title: "Quitter le match ?",
          body: "Tu vas perdre la manche en cours. Ce sera compté comme défaite et appliquera la pénalité de LP si applicable.",
          confirmLabel: "Forfait",
          cancelLabel: "Continuer",
          severity: "danger",
        }}
      />
    );
  },
);

/** Bouton retour INLINE themed — miroir de l'InlineBurger (même gabarit + même
 *  traitement color-mix var(--theme-*)) pour une symétrie parfaite [burger] …
 *  [retour] de part et d'autre du score. Ne fait QUE déclencher le modal forfait
 *  (via le handle du RankedBackGuard) : aucune logique de sortie propre ici. */
function InlineBackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      data-no-touchfx
      className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center active:scale-95 transition backdrop-blur"
      style={{
        background: "color-mix(in oklab, var(--theme-primary) 16%, rgba(10,12,20,0.82))",
        borderColor: "color-mix(in oklab, var(--theme-primary) 55%, transparent)",
        color: "color-mix(in oklab, var(--theme-primary) 80%, #fff)",
        boxShadow: "0 0 16px -6px var(--theme-primary), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </motion.button>
  );
}

function MatchFoundSplash({ you, opp }: { you: string; opp: string }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-xs tracking-[0.5em] text-fuchsia-300/80 uppercase mb-3 text-center px-4"
      >
        {t("ranked.match.foundKicker")}
      </motion.div>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
        className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-md px-4"
      >
        <NameTag name={you} accent="emerald" align="right" />
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="shrink-0 text-5xl sm:text-7xl font-black bg-gradient-to-br from-fuchsia-300 to-rose-400 bg-clip-text text-transparent"
        >
          VS
        </motion.div>
        <NameTag name={opp} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-ink-muted text-center px-4"
      >
        Best of 5 · Mana & Cartes
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.4 }}
        className="mt-6 max-w-sm px-4"
      >
        <LoadingTip category="strategy" rotateMs={0} className="justify-center text-center" />
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name, accent, align,
}: { name: string; accent: "emerald" | "rose"; align: "left" | "right" }) {
  const t = useT();
  const grad = accent === "emerald"
    ? "from-emerald-300 to-teal-400"
    : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex-1 min-w-0 flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">
        {accent === "emerald" ? t("lanes.you") : t("lanes.opponent")}
      </div>
      <div className={
        "mt-1 text-xl sm:text-3xl font-black truncate w-full bg-gradient-to-r " +
        (align === "right" ? "text-right " : "text-left ") +
        grad + " bg-clip-text text-transparent"
      }>
        {name || "Anonymous"}
      </div>
    </div>
  );
}

function RevealCountdown() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-ink-faint">{t("lanes.reveal")}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {[t("online.reveal.rock"), t("online.reveal.paper"), t("online.reveal.scissors"), t("online.reveal.lizard"), t("online.reveal.spock")].map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.13 }}
            className="bg-gradient-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent"
          >
            {w}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: [0.7, 1.3, 1] }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent"
      >
        {t("lanes.shoot")}
      </motion.div>
    </motion.div>
  );
}
