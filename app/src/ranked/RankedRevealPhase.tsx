/**
 * RankedRevealPhase — shows the resolved round.
 *
 * Sequential lane reveal is driven by `LanesBoard` (mode="reveal").
 * On top of that we surface a verdict line, a breakdown of bonuses
 * (Aegis save, Combo, Favoured, Surge) and any combo banner.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import {
  detectPlayerCombo,
  detectOutcomeCombo,
  laneFavoursMove,
  laneIdentityAt,
  type ComboTheme,
} from "../engine/lanesCombos";
import { LanesBoard } from "./LanesBoard";
import { CARDS } from "./cards";
import type { LaneTarget, PlayedCard, RoundBonusBreakdown } from "./rankedTypes";
import { totalBonusForSide } from "./rankedRules";
import { useT } from "../i18n";

/** Localised lane name for inline hints — reads the live per-match lane
 *  permutation so the hint matches the shuffled board, not a fixed order. */
const laneFr = (i: number) => laneIdentityAt(i).titleFr;
const MOVE_FR: Record<Move, string> = {
  rock: "Pierre",
  paper: "Feuille",
  scissors: "Ciseaux",
  lizard: "Lézard",
  spock: "Spock",
};

export interface RankedRevealPhaseProps {
  youName: string;
  opponentName: string;
  yourPicks: [Move, Move, Move];
  oppPicks: [Move, Move, Move];
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  laneResults: LaneResult[];
  bonuses: RoundBonusBreakdown;
  /** Final round-winner once all bonuses were tallied. */
  roundWinner: "a" | "b" | "draw";
  yourTotal: number;
  oppTotal: number;
  oppHandSize: number;
}

export function RankedRevealPhase({
  youName, opponentName,
  yourPicks, oppPicks, myCard, oppCard, augurRevealed,
  laneResults, bonuses, roundWinner, yourTotal, oppTotal, oppHandSize,
}: RankedRevealPhaseProps) {
  const t = useT();

  // Wait for the board cascade to finish (~1.4 s) before flooding the bonus
  // breakdown in.
  const [showAfter, setShowAfter] = useState(false);
  useEffect(() => {
    setShowAfter(false);
    const id = window.setTimeout(() => setShowAfter(true), 1500);
    return () => window.clearTimeout(id);
  }, [laneResults]);

  const yourCombo = detectPlayerCombo(yourPicks);
  const oppCombo = detectPlayerCombo(oppPicks);
  // Outcome combo from raw lane points (use the base counts, not bonuses).
  const baseYou = laneResults.filter((lr) => lr.winner === "a").length;
  const baseOpp = laneResults.filter((lr) => lr.winner === "b").length;
  const outcomeCombo = detectOutcomeCombo(baseYou, baseOpp, yourPicks, oppPicks);

  const youWonRound = roundWinner === "a";
  const oppWonRound = roundWinner === "b";
  const headlineCombo: ComboTheme | null =
    outcomeCombo ??
    (oppWonRound ? oppCombo : null) ??
    (youWonRound ? yourCombo : null) ??
    (yourCombo || oppCombo);
  // Who owns the headline combo — drives the visible "Toi" / "Adv." chip on
  // the banner so the player understands whose hand earned it.
  const headlineAttribution: "you" | "opp" | "both" | null = (() => {
    if (!headlineCombo) return null;
    if (headlineCombo === outcomeCombo) {
      if (outcomeCombo?.id === "sweep") return "you";
      if (outcomeCombo?.id === "wipeout") return "opp";
      return "both";
    }
    if (headlineCombo === oppCombo) return "opp";
    if (headlineCombo === yourCombo) return "you";
    return null;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex flex-col items-center gap-2 sm:gap-3"
    >
      <div className="w-full flex items-center justify-center">
        <LanesBoard
          youName={youName}
          opponentName={opponentName}
          picks={yourPicks as [Move, Move, Move]}
          oppPicks={oppPicks}
          augurRevealed={augurRevealed}
          myCard={myCard}
          oppCard={oppCard}
          mode="reveal"
          laneResults={laneResults}
          oppHandSize={oppHandSize}
        />
      </div>

      {/* Verdict + combo + bonus — kept in a shrink-0 block so they ALWAYS
          have their own room and the board (flex-1, min-h-0) absorbs any
          vertical squeeze instead of clipping the combo punch-line. */}
      <div className="shrink-0 w-full flex flex-col items-center gap-1">
        <AnimatePresence>
          {showAfter && (
            <motion.div
              key="verdict"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center px-2"
            >
              {youWonRound && (
                <div className="text-emerald-300 text-lg font-bold">
                  {t("lanes.roundWon", { a: yourTotal, b: oppTotal })}
                </div>
              )}
              {oppWonRound && (
                <div className="text-rose-300 text-lg font-bold">
                  {t("lanes.roundLost", { a: yourTotal, b: oppTotal })}
                </div>
              )}
              {!youWonRound && !oppWonRound && (
                <div className="text-ink-muted text-lg font-bold">
                  {t("lanes.roundDraw", { a: yourTotal, b: oppTotal })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards played this round — a plain-language line per side so the
            player understands what each card did and why the result changed. */}
        <AnimatePresence>
          {showAfter && (myCard || oppCard) && (
            <motion.div
              key="cards-recap"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col items-center gap-1 mt-1 w-full px-2"
            >
              {myCard && <CardLine side="you" card={myCard} t={t} />}
              {oppCard && <CardLine side="opp" card={oppCard} t={t} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Combo banner — the custom punch-line for the hand played. */}
        <AnimatePresence>
          {showAfter && headlineCombo && (
            <ComboBanner combo={headlineCombo} attribution={headlineAttribution} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAfter && (
            <BonusBreakdown
              bonuses={bonuses}
              t={t}
              yourPicks={yourPicks}
              oppPicks={oppPicks}
              laneResults={laneResults}
              myCard={myCard}
              oppCard={oppCard}
              yourCombo={yourCombo}
              oppCombo={oppCombo}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ──────────── Bonus breakdown ──────────── */

/** Build short inline hints explaining WHY each bonus fired — turns the
 *  cryptic "+1 Favorisé" into "Pierre jouée sur FORCE". The aim is exactly
 *  one short FR phrase per scored bonus on each side, so players learn the
 *  rules by reading instead of guessing. */
function favouredHints(
  side: "a" | "b",
  picks: [Move, Move, Move],
  laneResults: LaneResult[],
  precisionLane: LaneTarget | null,
): string[] {
  const hints: string[] = [];
  for (let i = 0; i < laneResults.length; i++) {
    if (laneResults[i].winner !== side) continue;
    const mv = picks[i];
    if (laneFavoursMove(i, mv)) {
      hints.push(`${MOVE_FR[mv]} sur ${laneFr(i)}`);
    } else if (precisionLane === i) {
      hints.push(`🎯 Précision sur ${laneFr(i)}`);
    }
  }
  return hints;
}

function surgeHint(
  side: "a" | "b",
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
  laneResults: LaneResult[],
): string | null {
  const card = side === "a" ? myCard : oppCard;
  if (card?.id !== "surge") return null;
  const lane = (card as { lane: LaneTarget }).lane;
  if (laneResults[lane]?.winner !== side) return null;
  return `⚡ Surge gagnant sur ${laneFr(lane)}`;
}

function tideHint(
  side: "a" | "b",
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
  laneResults: LaneResult[],
): string | null {
  const card = side === "a" ? myCard : oppCard;
  if (card?.id !== "tide") return null;
  const wins = laneResults.filter((l) => l.winner === side).length;
  if (wins < 2) return null;
  return `🌊 Marée — +1 par lane gagnée (${wins})`;
}

function BonusBreakdown({
  bonuses, t, yourPicks, oppPicks, laneResults, myCard, oppCard, yourCombo, oppCombo,
}: {
  bonuses: RoundBonusBreakdown;
  t: (k: string, vars?: Record<string, string | number>) => string;
  yourPicks: [Move, Move, Move];
  oppPicks: [Move, Move, Move];
  laneResults: LaneResult[];
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  yourCombo: ComboTheme | null;
  oppCombo: ComboTheme | null;
}) {
  const youTotal = totalBonusForSide("a", bonuses);
  const oppTotal = totalBonusForSide("b", bonuses);
  if (youTotal === 0 && oppTotal === 0 &&
      !bonuses.aegisSavedA && !bonuses.aegisSavedB) {
    return null;
  }
  const aPrecisionLane = myCard?.id === "precision" ? (myCard as { lane: LaneTarget }).lane : null;
  const bPrecisionLane = oppCard?.id === "precision" ? (oppCard as { lane: LaneTarget }).lane : null;

  const youFavHints = favouredHints("a", yourPicks, laneResults, aPrecisionLane);
  const oppFavHints = favouredHints("b", oppPicks, laneResults, bPrecisionLane);
  const youSurgeHint = surgeHint("a", myCard, oppCard, laneResults);
  const oppSurgeHint = surgeHint("b", myCard, oppCard, laneResults);
  const youTideHint = tideHint("a", myCard, oppCard, laneResults);
  const oppTideHint = tideHint("b", myCard, oppCard, laneResults);

  return (
    <motion.div
      key="breakdown"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col items-center gap-0.5 text-[11px] text-ink-muted mt-1"
    >
      <Row
        label={t("ranked.bonus.combo")}
        you={bonuses.comboBonusA}
        opp={bonuses.comboBonusB}
        youHint={yourCombo ? `🎴 ${t(`combo.${yourCombo.id}.name`)}` : null}
        oppHint={oppCombo ? `🎴 ${t(`combo.${oppCombo.id}.name`)}` : null}
      />
      <Row
        label={t("ranked.bonus.favoured")}
        you={bonuses.favouredBonusA}
        opp={bonuses.favouredBonusB}
        youHint={youFavHints.join(" · ") || null}
        oppHint={oppFavHints.join(" · ") || null}
      />
      <Row
        label={t("ranked.bonus.surge")}
        you={bonuses.surgeBonusA}
        opp={bonuses.surgeBonusB}
        youHint={youSurgeHint}
        oppHint={oppSurgeHint}
      />
      {(bonuses.tideBonusA > 0 || bonuses.tideBonusB > 0) && (
        <Row
          label={t("ranked.bonus.tide")}
          you={bonuses.tideBonusA}
          opp={bonuses.tideBonusB}
          youHint={youTideHint}
          oppHint={oppTideHint}
        />
      )}
      {(bonuses.aegisSavedA || bonuses.aegisSavedB) && (
        <div className="text-[10px] text-sky-300 mt-0.5 flex items-center gap-2">
          {bonuses.aegisSavedA && (
            <span>🛡️ {t("ranked.bonus.aegisSaved")} ({t("lanes.you")})</span>
          )}
          {bonuses.aegisSavedB && (
            <span>🛡️ {t("ranked.bonus.aegisSaved")} ({t("lanes.opponent")})</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Row({
  label, you, opp, youHint, oppHint,
}: {
  label: string; you: number; opp: number;
  youHint?: string | null; oppHint?: string | null;
}) {
  if (you === 0 && opp === 0) return null;
  return (
    <div className="flex flex-col items-center gap-px px-1 w-full">
      <div className="flex items-center gap-3">
        <span className={"font-mono w-6 text-right " + (you > 0 ? "text-emerald-300" : "text-zinc-600")}>
          {you > 0 ? `+${you}` : "·"}
        </span>
        <span className="uppercase tracking-[0.2em] text-[9px] text-ink-faint min-w-[5rem] text-center">
          {label}
        </span>
        <span className={"font-mono w-6 " + (opp > 0 ? "text-rose-300" : "text-zinc-600")}>
          {opp > 0 ? `+${opp}` : "·"}
        </span>
      </div>
      {((you > 0 && youHint) || (opp > 0 && oppHint)) && (
        <div className="flex items-center gap-2 text-[9px] text-ink-faint leading-tight max-w-[22rem] text-center">
          {you > 0 && youHint && (
            <span className="text-emerald-400/80">{youHint}</span>
          )}
          {you > 0 && youHint && opp > 0 && oppHint && (
            <span className="text-zinc-600">·</span>
          )}
          {opp > 0 && oppHint && (
            <span className="text-rose-400/80">{oppHint}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────── Card-played recap line ──────────── */

/** One plain-language line: which card a side played + what it does.
 *  Tight inline layout — the chip sits right next to the card name with no
 *  empty gap. Text size bumped to text-xs so the opp card line reads cleanly
 *  even when the player didn't play one. */
function CardLine({
  side, card, t,
}: {
  side: "you" | "opp";
  card: PlayedCard;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const meta = CARDS[card.id];
  if (!meta) return null;
  const isYou = side === "you";
  return (
    <div className="flex items-baseline gap-1.5 max-w-sm text-left">
      <span className={
        "text-[9px] uppercase tracking-wider font-bold px-1.5 py-px rounded shrink-0 " +
        (isYou ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
              : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30")
      }>
        {isYou ? "Toi" : "Adv."}
      </span>
      <span className="text-sm shrink-0 self-center">🃏</span>
      <span className="text-xs leading-snug">
        <b className={"font-bold " + (isYou ? "text-emerald-200" : "text-rose-200")}>{t(meta.nameKey)}</b>
        <span className="text-ink-muted"> — {t(meta.descKey)}</span>
      </span>
    </div>
  );
}

/* ──────────── Combo banner (compact version) ──────────── */

function ComboBanner({
  combo, attribution,
}: {
  combo: ComboTheme;
  attribution: "you" | "opp" | "both" | null;
}) {
  const t = useT();
  const epic = combo.tier === "epic";
  const rare = combo.tier === "rare";
  const name = t(`combo.${combo.id}.name`);
  const tag = t(`combo.${combo.id}.tag`);
  const chip = attribution === "you" ? "Toi"
             : attribution === "opp" ? "Adv."
             : attribution === "both" ? "Toi & Adv."
             : null;
  const chipCls = attribution === "you"
    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
    : attribution === "opp"
    ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
    : "bg-surface-2 text-ink-muted ring-zinc-500/30";
  return (
    <motion.div
      key={combo.id + ":" + (attribution ?? "x")}
      initial={{ opacity: 0, scale: 0.6, y: -8 }}
      animate={{
        opacity: 1,
        scale: epic ? [0.6, 1.2, 1] : 1,
        y: 0,
        x: epic ? [0, -4, 4, -2, 2, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.85, y: -6 }}
      transition={{ duration: epic ? 0.6 : 0.4, type: "spring", stiffness: 220, damping: 16 }}
      className="flex flex-col items-center gap-0.5 mt-1 w-full px-2"
    >
      {chip && (
        <div className={
          "text-[9px] uppercase tracking-[0.25em] font-bold px-1.5 py-px rounded ring-1 " + chipCls
        }>
          {chip}
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5 w-full">
        <span className="text-xl shrink-0">{combo.glyph}</span>
        <span
          className={
            (epic ? "text-xl sm:text-2xl" : rare ? "text-lg sm:text-xl" : "text-base sm:text-lg") +
            " font-black tracking-wide whitespace-nowrap bg-gradient-to-br " + combo.gradient +
            " bg-clip-text text-transparent"
          }
        >
          {name}
        </span>
        <span className="text-xl shrink-0">{combo.glyph}</span>
      </div>
      <div className={
        "text-[11px] tracking-wide text-center leading-tight " +
        (epic ? "text-amber-300/90" : rare ? "text-fuchsia-300/80" : "text-ink-muted")
      }>
        {tag}
      </div>
      {combo.bonus != null && combo.bonus > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-amber-300/70">
          +{combo.bonus}
        </div>
      )}
    </motion.div>
  );
}
