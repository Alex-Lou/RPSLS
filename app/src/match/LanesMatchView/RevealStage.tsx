import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Hand } from "../../icons";
import { type Move } from "../../engine/game";
import { useT } from "../../i18n";
import {
  detectOutcomeCombo,
  detectPlayerCombo,
  laneIdentityAt,
  laneFavoursMove,
  type ComboTheme,
} from "../../engine/lanesCombos";
import { GameTable } from "./GameTable";
import { IDENTITY_KEYS } from "./data";
import type { LanesRoundResultData } from "./types";

/**
 * Reveal is staged tempo-style: lane 1 → 2 → 3 → verdict. Each lane "drops"
 * with a 0.6s gap so the player gets to feel each one. The outcome combo
 * banner (sweep / wipeout / mirror / classic trinity / triple) animates in
 * last, on top of the lanes.
 */
export function RevealStage({
  result, opponentName, youName,
}: {
  result: LanesRoundResultData;
  opponentName: string;
  youName: string;
}) {
  const t = useT();
  const yourPicks = result.yourPlays.map((p) => p.mv);
  const oppPicks  = result.oppPlays.map((p)  => p.mv);

  const yourCombo = detectPlayerCombo(yourPicks);
  const oppCombo  = detectPlayerCombo(oppPicks);
  const outcomeCombo = detectOutcomeCombo(
    result.yourPoints, result.oppPoints, yourPicks, oppPicks,
  );

  // Pick the most visually-impactful combo to show as the headline banner.
  // Priority: outcome combo (sweep / wipeout / mirror) → winning side's
  // combo → whichever side has any combo. Critically, the *winning* side
  // gets the spotlight when both sides have one — even when they're the
  // opponent — so a defeat doesn't drown out their highlight.
  const youWonRound = result.yourPoints >  result.oppPoints;
  const oppWonRound = result.oppPoints >  result.yourPoints;
  const headlineCombo =
    outcomeCombo ??
    (oppWonRound ? oppCombo : null) ??
    (youWonRound ? yourCombo : null) ??
    // Draw: just pick whichever side actually has a combo.
    (yourCombo || oppCombo);

  // Sequential lane reveal — flag each lane "ready" on a timer cascade.
  const [revealedLanes, setRevealedLanes] = useState(0);
  useEffect(() => {
    setRevealedLanes(0);
    const timers = [
      window.setTimeout(() => setRevealedLanes(1), 200),
      window.setTimeout(() => setRevealedLanes(2), 800),
      window.setTimeout(() => setRevealedLanes(3), 1400),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [result]);

  // Per-lane verdicts from the player's perspective.
  const laneVerdicts: ("win" | "loss" | "draw")[] = result.laneResults.map((lr, i) => {
    const you = result.yourPlays[i].mv;
    if (lr.winner === "draw") return "draw";
    const youWon = (lr.winner === "a" && lr.a_play.mv === you)
                || (lr.winner === "b" && lr.b_play.mv === you);
    return youWon ? "win" : "loss";
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex flex-col items-center gap-2 sm:gap-3"
    >
      <div className="w-full flex items-center justify-center">
      <GameTable
        opponentName={opponentName}
        youName={youName}
        oppRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {result.laneResults.map((_, i) => (
              <SideLaneCard
                key={i}
                lane={i}
                move={result.oppPlays[i].mv}
                verdictForSide={
                  laneVerdicts[i] === "draw" ? "draw"
                  : laneVerdicts[i] === "win" ? "loss" /* opp lost = lost from opp side */
                  : "win"
                }
                revealed={i < revealedLanes}
                side="opp"
              />
            ))}
          </div>
        }
        youRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {result.laneResults.map((_, i) => (
              <SideLaneCard
                key={i}
                lane={i}
                move={result.yourPlays[i].mv}
                verdictForSide={laneVerdicts[i]}
                revealed={i < revealedLanes}
                side="you"
              />
            ))}
          </div>
        }
      />
      </div>

      {/* Verdict line — appears once all 3 lanes have dropped. */}
      <AnimatePresence>
        {revealedLanes >= 3 && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center mt-1 px-2"
          >
            {result.yourPoints > result.oppPoints && (
              <div className="text-emerald-300 text-lg font-bold">
                {t("lanes.roundWon", { a: result.yourPoints, b: result.oppPoints })}
              </div>
            )}
            {result.yourPoints < result.oppPoints && (
              <div className="text-rose-300 text-lg font-bold">
                {t("lanes.roundLost", { a: result.yourPoints, b: result.oppPoints })}
              </div>
            )}
            {result.yourPoints === result.oppPoints && (
              <div className="text-ink-muted text-lg font-bold">
                {t("lanes.roundDraw", { a: result.yourPoints, b: result.oppPoints })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo banner — drops in after the verdict. */}
      <AnimatePresence>
        {revealedLanes >= 3 && headlineCombo && (
          <ComboBanner combo={headlineCombo} />
        )}
      </AnimatePresence>

      {/* Opponent-combo reveal line — pedagogic. Only shows when they had
          a named combo AND it's different from the headline (otherwise
          the banner already covered it). */}
      <AnimatePresence>
        {revealedLanes >= 3 && oppCombo && oppCombo.id !== headlineCombo?.id && (
          <motion.div
            key="opp-combo"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="text-[11px] text-ink-muted mt-1 text-center px-3"
          >
            {t("lanes.opponentCombo", {
              combo: `${oppCombo.glyph} ${t(`combo.${oppCombo.id}.name`)}`,
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Big animated banner that names the combo (ROCKSLIDE, FLAWLESS SWEEP…).
 * Tier drives the size + treatment — epics shake the layout, commons fade in.
 */
function ComboBanner({ combo }: { combo: ComboTheme }) {
  const t = useT();
  const epic = combo.tier === "epic";
  const rare = combo.tier === "rare";
  // i18n keys follow the convention combo.<id>.{name,tag} — falls back to
  // the in-code defaults if a locale doesn't translate them yet.
  const name = t(`combo.${combo.id}.name`);
  const tag  = t(`combo.${combo.id}.tag`);
  return (
    <motion.div
      key={combo.id}
      initial={{ opacity: 0, scale: 0.5, y: -10 }}
      animate={{
        opacity: 1,
        scale: epic ? [0.5, 1.25, 1] : 1,
        y: 0,
        x: epic ? [0, -6, 6, -3, 3, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.8, y: -8 }}
      transition={{ duration: epic ? 0.7 : 0.4, type: "spring", stiffness: 220, damping: 14 }}
      className="flex flex-col items-center gap-1 mt-2 w-full max-w-full px-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0 max-w-full min-w-0">
        <motion.span
          animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.8, repeat: epic ? Infinity : 1, repeatType: "loop" }}
          className={"text-2xl sm:text-4xl shrink-0"}
        >
          {combo.glyph}
        </motion.span>
        <span
          className={
            // Smaller on mobile + wrap-friendly so long names (ANÉANTISSEMENT…)
            // never bleed off the screen edge.
            (epic ? "text-2xl sm:text-4xl" : rare ? "text-xl sm:text-3xl" : "text-lg sm:text-2xl") +
            " font-black tracking-tight bg-gradient-to-br " + combo.gradient +
            " bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)] text-center break-words min-w-0 max-w-full"
          }
        >
          {name}
        </span>
        <motion.span
          animate={{ rotate: [0, 10, -10, 5, -5, 0] }}
          transition={{ duration: 0.8, repeat: epic ? Infinity : 1, repeatType: "loop" }}
          className="text-2xl sm:text-4xl shrink-0"
        >
          {combo.glyph}
        </motion.span>
      </div>
      <div className={"text-[11px] sm:text-xs uppercase tracking-[0.25em] text-center px-3 " +
        (epic ? "text-amber-300/90" : rare ? "text-fuchsia-300/80" : "text-ink-muted")}>
        {tag}
      </div>
      {combo.bonus != null && combo.bonus > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mt-1">
          {t("lanes.styleBonus", { n: combo.bonus })}
        </div>
      )}
    </motion.div>
  );
}

/** Single-side lane card: one Hand + lane identity + per-lane verdict from
 *  the perspective of that side. Used twice per lane (once opp, once you). */
function SideLaneCard({
  lane, move, verdictForSide, revealed, side,
}: {
  lane: number;
  move: Move;
  verdictForSide: "win" | "loss" | "draw";
  revealed: boolean;
  side: "opp" | "you";
}) {
  const t = useT();
  const identity = laneIdentityAt(lane);
  const idKey = IDENTITY_KEYS[lane];
  const favoured = laneFavoursMove(lane, move);
  const isWin  = verdictForSide === "win";
  const isLoss = verdictForSide === "loss";

  const ring =
    isWin  ? "ring-emerald-400/60" :
    isLoss ? "ring-rose-400/50"    :
             "ring-zinc-500/30";
  const border =
    isWin  ? "border-emerald-400/40" :
    isLoss ? "border-rose-400/30"    :
             "border-zinc-500/20";
  const bg =
    isWin  ? "bg-emerald-600/25" :
    isLoss ? "bg-rose-600/25"    :
             "bg-surface-2";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotateY: 90 }}
      animate={revealed
        ? { opacity: 1, scale: 1, rotateY: 0 }
        : { opacity: 0.3, scale: 0.85, rotateY: 90 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={
        "aspect-square rounded-xl border-2 ring-2 px-1 py-1 flex flex-col items-center justify-center gap-0.5 " +
        ring + " " + border + " " + bg
      }
      style={{ transformPerspective: 800 }}
    >
      <div className={
        "flex items-center gap-0.5 text-[8px] uppercase tracking-wider leading-none " +
        (identity.accent === "amber"  ? "text-amber-300/80"   :
         identity.accent === "sky"    ? "text-sky-300/80"     :
                                        "text-emerald-300/80")
      }>
        <span>{identity.glyph}</span>
        <span className="truncate">{t(`${idKey}.title`)}</span>
      </div>
      <div className="relative">
        <Hand move={move} size="sm" emphasis={isWin ? "winner" : isLoss ? "loser" : "default"} />
        {favoured && revealed && <FavouredBadge winning={isWin} />}
      </div>
      <span className={
        "text-[9px] uppercase tracking-wider font-bold leading-none " +
        (isWin ? "text-emerald-300" : isLoss ? "text-rose-300" : "text-ink-faint")
      }>
        {isWin
          ? (side === "you" ? t("lanes.win") : t("lanes.loss"))
          : isLoss
          ? (side === "you" ? t("lanes.loss") : t("lanes.win"))
          : t("lanes.drawShort")}
      </span>
    </motion.div>
  );
}

/**
 * Badge that pops on a lane reveal when the placed move was on its
 * favoured lane. The "+1" floats upward when it actually won the lane,
 * making the identity bonus *visible* in the moment.
 */
function FavouredBadge({ winning }: { winning: boolean }) {
  return (
    <>
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 12, delay: 0.1 }}
        className="absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-zinc-900 shadow-lg flex items-center gap-1"
      >
        ✨
      </motion.span>
      {winning && (
        <motion.span
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: -28, scale: [0.5, 1.4, 1.2, 1] }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="absolute -top-1 left-1/2 -translate-x-1/2 text-amber-300 text-base font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
        >
          +1 ✨
        </motion.span>
      )}
    </>
  );
}
