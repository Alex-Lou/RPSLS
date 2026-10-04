import { hapticMatchStart } from "../../haptic";
import type { RankedGameCtx } from "./rankedGameContext";
import { makeBattle } from "./rankedGameHelpers";
import { MATCH_FOUND_SPLASH_MS } from "./rankedGameConstants";

/**
 * createMatchLifecycle — fabrique (appelée À CHAQUE rendu) de rematch
 * (remise à zéro complète) et handleLeave (sortie / forfait). Extrait VERBATIM
 * de RankedGame.
 */
export function createMatchLifecycle(ctx: RankedGameCtx, startNextRound: () => void) {
  const {
    end, battle, rng, winTo, savedDeck, recordMatch, onQuit, onMatchResult,
    recordedOutcomeRef, leftRef, setRound, setLastResult, setEnd, setPicks, setCardPlayed,
    setAugurRevealed, setOracleRevealed, setCompassRevealed, setOppHandRevealed,
    setRiposteData, setSuddenDeathData, setAugurCooldown, setMana, setBattle, setGaiaCharged,
    cpuDecisionRef, setMascaradePoison, playerHistoryRef, moodRef, roundNoRef,
    wonLastRoundRef, compensationDrawNextRef, cpuOneShotsRef, youCardsPlayedRef,
    oppCardsPlayedRef, braiseActiveRef, setBraiseStacks, setBonusManaNext, manaMaxBoostRef,
    setCascadeArmed, cascadeFreeNextRoundRef, setEchoActive, anchorSnapshotRef,
    setAnchorRoundsLeft, anchorLossStreakRef, paradoxeUsedRef, genesisUsedRef,
    genesisPendingRef, fardeauNextCpuRef, prevOppPicksRef, pharePendingRef, deadlineTimerRef,
  } = ctx;

  function rematch() {
    recordedOutcomeRef.current = null;
    leftRef.current = false;
    setRound(null);
    setLastResult(null);
    setEnd(null);
    setPicks([null, null, null]);
    setCardPlayed(null);
    setAugurRevealed(null);
    setOracleRevealed(null);
    setCompassRevealed(null);
    setOppHandRevealed(null);
    setRiposteData(null);
    setSuddenDeathData(null);
    setAugurCooldown(0);
    setMana(1);
    const fresh = makeBattle(savedDeck, rng);
    setBattle(fresh);
    setGaiaCharged(fresh.passives.includes("gaia"));
    cpuDecisionRef.current = null;
    setMascaradePoison(false);
    playerHistoryRef.current = [];
    moodRef.current = "random";
    roundNoRef.current = 0;
    wonLastRoundRef.current = false;
    compensationDrawNextRef.current = false;
    cpuOneShotsRef.current = [];
    youCardsPlayedRef.current = [];
    oppCardsPlayedRef.current = [];
    // Reset all V3 cross-round state.
    braiseActiveRef.current = false;
    setBraiseStacks(0);
    setBonusManaNext(0);
    manaMaxBoostRef.current = 0;
    setCascadeArmed(false);
    cascadeFreeNextRoundRef.current = false;
    setEchoActive(false);
    anchorSnapshotRef.current = null;
    setAnchorRoundsLeft(0);
    anchorLossStreakRef.current = 0;
    paradoxeUsedRef.current = false;
    genesisUsedRef.current = false;
    genesisPendingRef.current = false;
    fardeauNextCpuRef.current = null;
    prevOppPicksRef.current = null;
    pharePendingRef.current = false;
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    hapticMatchStart();
    window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
  }

  // Explicit leave. A mid-match leave (no `end` yet) is a forfeit: record the
  // ranked loss + the escalating repeat-abandon LP penalty. Leaving AFTER the
  // match is over (end set) — or a genuine app/network interruption that never
  // calls this — carries no penalty. The RankedBackGuard confirms first.
  //
  // Tournament context: when onMatchResult is set, route the forfeit into the
  // bracket as a loss instead of unmounting back to the lobby — that keeps the
  // bracket consistent (no orphan slot) and respects the confirm dialog.
  function handleLeave() {
    // Double tap sur « Forfait » pendant la sortie animée : une seule fois.
    if (leftRef.current) return;
    leftRef.current = true;
    const recorded = recordedOutcomeRef.current;
    if (!end && !recorded) {
      recordMatch({
        id: `ranked-forfeit-${Date.now()}`,
        mode: "constellation",
        bestOf: winTo,
        opponent: { kind: "cpu", mood: moodRef.current },
        scorePlayer: battle.roundWinsA,
        scoreOpponent: winTo,
        outcome: "loss",
        rounds: [],
        xpDelta: 0,
        lpDelta: 0,
        timestamp: Date.now(),
        forfeit: true,
      });
    }
    // Match déjà gagné (écran de fin pas encore affiché) : on remonte le VRAI
    // résultat au tournoi, pas une défaite.
    if (onMatchResult) onMatchResult(recorded === "win");
    else onQuit();
  }

  return { rematch, handleLeave };
}
