import { motion } from "motion/react";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import { laneFavoursMove, laneIdentityAt, type ComboTheme } from "../engine/lanesCombos";
import type { LaneTarget, PlayedCard, RoundBonusBreakdown } from "./rankedTypes";
import { totalBonusForSide } from "./rankedRules";

/**
 * Détail des bonus du reveal Classé (hints + lignes) — extrait VERBATIM de RankedRevealPhase.tsx.
 */

/** Localised lane name for inline hints — reads the live per-match lane
 *  permutation so the hint matches the shuffled board, not a fixed order. */
export type TFn = (k: string, vars?: Record<string, string | number>) => string;
export const LANE_IDENTITY_KEYS = ["lanes.identity.force", "lanes.identity.wisdom", "lanes.identity.cunning"];
export const laneName = (t: TFn, i: number) => t(`${LANE_IDENTITY_KEYS[laneIdentityAt(i).index]}.title`);

/* ──────────── Bonus breakdown ──────────── */

/** Build short inline hints explaining WHY each bonus fired — turns the
 *  cryptic "+1 Favorisé" into "Pierre jouée sur FORCE". The aim is exactly
 *  one short FR phrase per scored bonus on each side, so players learn the
 *  rules by reading instead of guessing. */
export function favouredHints(
  t: TFn,
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
      hints.push(t("ranked.hint.favoured", { move: t(`element.${mv}`), lane: laneName(t, i) }));
    } else if (precisionLane === i) {
      hints.push(t("ranked.hint.precision", { lane: laneName(t, i) }));
    }
  }
  return hints;
}

export function surgeHint(
  t: TFn,
  side: "a" | "b",
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
  laneResults: LaneResult[],
): string | null {
  const card = side === "a" ? myCard : oppCard;
  if (card?.id !== "surge") return null;
  const lane = (card as { lane: LaneTarget }).lane;
  if (laneResults[lane]?.winner !== side) return null;
  return t("ranked.hint.surge", { lane: laneName(t, lane) });
}

export function tideHint(
  t: TFn,
  side: "a" | "b",
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
  laneResults: LaneResult[],
): string | null {
  const card = side === "a" ? myCard : oppCard;
  if (card?.id !== "tide") return null;
  const wins = laneResults.filter((l) => l.winner === side).length;
  if (wins < 2) return null;
  return t("ranked.hint.tide", { n: wins });
}

export function BonusBreakdown({
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

  const youFavHints = favouredHints(t, "a", yourPicks, laneResults, aPrecisionLane);
  const oppFavHints = favouredHints(t, "b", oppPicks, laneResults, bPrecisionLane);
  const youSurgeHint = surgeHint(t, "a", myCard, oppCard, laneResults);
  const oppSurgeHint = surgeHint(t, "b", myCard, oppCard, laneResults);
  const youTideHint = tideHint(t, "a", myCard, oppCard, laneResults);
  const oppTideHint = tideHint(t, "b", myCard, oppCard, laneResults);

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

export function Row({
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
