import type { Move } from "../../engine/game";
import { rngInt } from "../../engine/rng";
import { eclatsReward } from "../../engine/economy";
import { hapticMatchWin, hapticMatchLoss, hapticTap, hapticWin, hapticLoss } from "../../haptic";
import { drawN, CARDS, discardRandom } from "../cards";
import type { CardId, LaneTarget } from "../rankedTypes";
import { removeFirst } from "./rankedGameHelpers";
import { STEALABLE_FROM_CPU } from "./rankedGameData";
import { REVEAL_SUSPENSE_MS, SUDDEN_DEATH_PRE_MS } from "./rankedGameConstants";
import type { RankedGameCtx } from "./rankedGameContext";
import { scoreRankedRound } from "./scoreRankedRound";

/**
 * createResolveAndAdvance — fabrique (appelée À CHAQUE rendu) de
 * resolveAndAdvance : résolution d'une manche (Paradoxe, score via
 * scoreRankedRound, effets inter-manches, battle, reveal, fin de match /
 * Riposte / Mort subite / manche suivante). Extrait VERBATIM de RankedGame.
 */
export function createResolveAndAdvance(ctx: RankedGameCtx, startNextRound: () => void) {
  const {
    battle, cardPlayed, augurRevealed, rng, winTo, roundPauseMs, savedDeck,
    recordMatch, awardCardMasteryXp,
    cpuDecisionRef, setCardPlayed, setPicks, setBattle, setRound, setMana, setLastResult, setEnd,
    setRiposteData, setSuddenDeathData, wonLastRoundRef, prevOppPicksRef, braiseActiveRef,
    braiseStacksRef, setBraiseStacks, anchorRoundsLeftRef, setAnchorRoundsLeft,
    anchorLossStreakRef, anchorSnapshotRef, cascadeArmedRef, setCascadeArmed,
    cascadeFreeNextRoundRef, cpuOneShotsRef, compensationDrawNextRef, setBonusManaNext,
    bonusManaNextRoundRef, recordedOutcomeRef, moodRef, roundNoRef,
    youCardsPlayedRef, oppCardsPlayedRef,
  } = ctx;

  function resolveAndAdvance(playerPicks: [Move, Move, Move], timedOut: boolean) {
    const cpu = cpuDecisionRef.current!;
    const cpuPicks: [Move, Move, Move] = [
      cpu.plays[0].mv, cpu.plays[1].mv, cpu.plays[2].mv,
    ];

    // Paradoxe Temporel: skip resolution entirely. Refund the played card
    // and the mana spent on it — the round simply never happens.
    if (!timedOut && cardPlayed?.id === "paradoxe") {
      setCardPlayed(null);
      setPicks([null, null, null]);
      // Refund: leave hand untouched (the card was never removed yet) and
      // skip mana spend. The card itself still BURNS because it's an epic
      // one-shot (limit 1/match enforced by usedOneShotCards check below).
      setBattle((b) => ({
        ...b,
        // Burn the paradoxe card as one-shot.
        hand: removeFirst(b.hand, "paradoxe"),
        usedOneShotCards: [...b.usedOneShotCards, "paradoxe"],
      }));
      setRound(null);
      window.setTimeout(() => startNextRound(), 600);
      return;
    }

    // Calcul du score (extrait dans scoreRankedRound — MÊME ordre, mêmes effets).
    const {
      prevOppPicksThisRound, displayPlayerPicks, myCard, oppCard, fx, bonuses,
      finalWinner, echoRefund, gambitActive, gambitWinBonus, yourTotal, oppTotal,
    } = scoreRankedRound(ctx, cpu, cpuPicks, playerPicks, timedOut);

    wonLastRoundRef.current = finalWinner === "a";

    // Bookkeeping for cross-round effects.
    if (!timedOut) prevOppPicksRef.current = prevOppPicksThisRound;
    // Braise: every loss past the played-card moment shaves 1 off the next
    // card's cost (cap +stacks per round, never sub-1). A played card
    // consumes the discount → reset to 0.
    if (braiseActiveRef.current && finalWinner === "b" && !myCard) {
      setBraiseStacks(braiseStacksRef.current + 1);
    } else if (myCard) {
      setBraiseStacks(0);
    }
    // Ancre temporelle watchdog.
    if (anchorRoundsLeftRef.current > 0) {
      setAnchorRoundsLeft(anchorRoundsLeftRef.current - 1);
      if (finalWinner === "b") anchorLossStreakRef.current += 1;
      else anchorLossStreakRef.current = 0;
      if (anchorLossStreakRef.current >= 2 && anchorSnapshotRef.current) {
        // Restore the snapshot — apply at the end of this resolve so the
        // visible reveal still plays out before the rewind.
        const snap = anchorSnapshotRef.current;
        anchorSnapshotRef.current = null;
        setAnchorRoundsLeft(0);
        anchorLossStreakRef.current = 0;
        window.setTimeout(() => {
          setBattle((b) => ({
            ...b,
            roundWinsA: snap.winsA,
            roundWinsB: snap.winsB,
            hand: snap.hand,
            deck: snap.deck,
            discard: snap.discard,
            usedOneShotCards: snap.usedOneShotCards,
          }));
        }, roundPauseMs - 200);
      }
    }
    // Cascade post-resolve: WIN refills hand for free next round, LOSS dumps it.
    if (cascadeArmedRef.current) {
      setCascadeArmed(false);
      if (finalWinner === "a") cascadeFreeNextRoundRef.current = true;
      else if (finalWinner === "b") {
        window.setTimeout(() => {
          setBattle((b) => ({
            ...b,
            discard: [...b.discard, ...b.hand.filter((c) => CARDS[c].rarity !== "epic" && CARDS[c].rarity !== "legendary")],
            usedOneShotCards: [...b.usedOneShotCards, ...b.hand.filter((c) => CARDS[c].rarity === "epic" || CARDS[c].rarity === "legendary")],
            hand: [],
          }));
        }, roundPauseMs - 200);
      }
    }

    // Heist resolution — trigger only when the heister's targeted lane was
    // actually won by them.
    const myHeistLane = myCard?.id === "heist" ? (myCard as { lane: LaneTarget }).lane : null;
    const oppHeistLane = oppCard?.id === "heist" ? (oppCard as { lane: LaneTarget }).lane : null;
    const myHeistSuccess = myHeistLane !== null && fx.outcome.lanes[myHeistLane]?.winner === "a";
    const oppHeistSuccess = oppHeistLane !== null && fx.outcome.lanes[oppHeistLane]?.winner === "b";

    // Track CPU one-shots burned this match (the CPU has a notional, infinite
    // pool but we still want epic/legendary to be one-and-done). Uses cpu.card
    // (raw) so a Trou-noir-negated card is still spent.
    if (cpu.card) {
      const oppRarity = CARDS[cpu.card.id].rarity;
      if (oppRarity === "epic" || oppRarity === "legendary") {
        cpuOneShotsRef.current = [...cpuOneShotsRef.current, cpu.card.id];
      }
    }
    // CPU successfully Heisted us → grant the victim (us) a free draw next round.
    if (oppHeistSuccess) compensationDrawNextRef.current = true;

    // Échappée +1 mana payoff for next round — applied OUTSIDE the setBattle
    // closure so it's a clean separate state update. The draw 1 still lives
    // inside setBattle (below) because it mutates the deck/hand together.
    if (!timedOut && cardPlayed?.id === "echappee") {
      setBonusManaNext(bonusManaNextRoundRef.current + 1);
    }

    // Battle state update: discard played card, spend mana, lose 1 card if loss.
    // Braise discount: the next card costs (cost - braiseStacks), min 1. The
    // discount is applied here so the player only pays the reduced cost.
    const playedCost = myCard ? Math.max(1, CARDS[myCard.id].cost - braiseStacksRef.current) : 0;
    const spentMana = playedCost;
    setBattle((b) => {
      // Écho refund: if the stop-loss fired, the card is RETURNED to the
      // player's hand and the mana spend is reversed (handled by setMana below).
      const cardKeptInHand = echoRefund && myCard?.id === "echo-temporel";
      let handAfter = myCard && !cardKeptInHand ? removeFirst(b.hand, myCard.id) : b.hand;
      let discardAfter = b.discard;
      let usedOneShotAfter = b.usedOneShotCards;
      if (myCard && !cardKeptInHand) {
        const rarity = CARDS[myCard.id].rarity;
        if (rarity === "epic" || rarity === "legendary") {
          usedOneShotAfter = [...usedOneShotAfter, myCard.id];
        } else {
          discardAfter = [...discardAfter, myCard.id];
        }
      }
      // Échappée draws 1 card immediately (above the cap by 1 if necessary)
      // AND grants +1 mana at the start of next round — the payoff that turns
      // a blind sacrifice ("I might lose this lane") into a tempo trade
      // ("I burn the lane for a card NOW + a fatter mana pool next round").
      if (myCard?.id === "echappee") {
        const dr = drawN(b.deck, handAfter, discardAfter, 1, handAfter.length + 1, rng);
        handAfter = dr.hand;
        discardAfter = dr.discard;
        // Reassign the deck reference for the rest of this update block.
        b = { ...b, deck: dr.deck };
      }
      // Player Heist landed → steal a random card from the CPU's notional hand.
      if (myHeistSuccess) {
        const stolen = STEALABLE_FROM_CPU[
          rngInt(rng, STEALABLE_FROM_CPU.length)
        ];
        handAfter = [...handAfter, stolen];
      }
      // CPU Heist landed → yank a random card out of our hand.
      if (oppHeistSuccess && handAfter.length > 0) {
        const idx = rngInt(rng, handAfter.length);
        handAfter = [...handAfter.slice(0, idx), ...handAfter.slice(idx + 1)];
      }
      // Lose round → discard 1 random card from hand
      if (finalWinner === "b" && handAfter.length > 0) {
        const dr = discardRandom(handAfter, discardAfter, usedOneShotAfter, rng);
        handAfter = dr.hand;
        discardAfter = dr.discard;
        usedOneShotAfter = dr.usedOneShotCards;
        // Gambit backfire: a lost Gambit round burns an EXTRA card.
        if (gambitActive && handAfter.length > 0) {
          const dr2 = discardRandom(handAfter, discardAfter, usedOneShotAfter, rng);
          handAfter = dr2.hand;
          discardAfter = dr2.discard;
          usedOneShotAfter = dr2.usedOneShotCards;
        }
      }
      // Prescience (Foresight): draw 1 card immediately, above the hand cap.
      // Resolved here (after the loss-discard) so it's a guaranteed net +1 card.
      let deckAfter = b.deck;
      if (myCard?.id === "prescience") {
        const dr = drawN(deckAfter, handAfter, discardAfter, 1, handAfter.length + 1, rng);
        deckAfter = dr.deck;
        handAfter = dr.hand;
        discardAfter = dr.discard;
      }
      const winsA = b.roundWinsA + (finalWinner === "a" ? 1 : 0) + gambitWinBonus;
      const winsB = b.roundWinsB + (finalWinner === "b" ? 1 : 0);
      // Mirror the player's draw/discard rules onto the notional opp hand so
      // the indicator above OpponentRow tracks meaningfully across rounds.
      let oppHandAfter = b.oppHandSize;
      if (cpu.card) oppHandAfter -= 1; // they played a card this round (even if negated)
      if (myHeistSuccess) oppHandAfter -= 1; // we stole from them
      if (oppHeistSuccess) oppHandAfter += 1; // they stole from us
      if (finalWinner === "b") oppHandAfter += 1; // they win → draw 1
      else if (finalWinner === "a") oppHandAfter -= 1; // they lose → discard 1
      oppHandAfter = Math.max(0, Math.min(4, oppHandAfter));
      return {
        ...b,
        deck: deckAfter,
        hand: handAfter,
        discard: discardAfter,
        usedOneShotCards: usedOneShotAfter,
        oppHandSize: oppHandAfter,
        roundWinsA: winsA,
        roundWinsB: winsB,
        roundsPlayed: b.roundsPlayed + 1,
        bonusHistory: [...b.bonusHistory, bonuses],
      };
    });
    // Mana spend: skipped entirely if Écho refunded the card.
    if (!echoRefund) setMana((m) => Math.max(0, m - spentMana));

    const nextRoundWinsA = battle.roundWinsA + (finalWinner === "a" ? 1 : 0) + gambitWinBonus;
    const nextRoundWinsB = battle.roundWinsB + (finalWinner === "b" ? 1 : 0);

    // Hand to reveal phase.
    setRound(null);
    setLastResult({
      yourPicks: displayPlayerPicks,
      oppPicks: cpuPicks,
      myCard, oppCard,
      augurRevealed,
      laneResults: fx.outcome.lanes,
      bonuses,
      roundWinner: finalWinner,
      yourTotal, oppTotal,
      roundWinsYou: nextRoundWinsA,
      roundWinsOpp: nextRoundWinsB,
    });

    // Reveal haptic — delayed to land with the visual flip.
    window.setTimeout(() => {
      if (yourTotal > oppTotal) hapticWin();
      else if (yourTotal < oppTotal) hapticLoss();
      else hapticTap();
    }, REVEAL_SUSPENSE_MS);

    // Riposte: if the player played Riposte on a lane that ended up lost,
    // defer end-of-match and next-round; instead schedule the Riposte
    // sub-phase to fire after the reveal.
    const myRiposteLane = !timedOut && myCard?.id === "riposte"
      ? (myCard as { lane: LaneTarget }).lane
      : null;
    const riposteWillFire =
      myRiposteLane !== null && fx.outcome.lanes[myRiposteLane]?.winner === "b";

    // End-of-match check (skipped when Riposte is pending — the rematch can
    // still flip the round).
    if (!riposteWillFire && (nextRoundWinsA >= winTo || nextRoundWinsB >= winTo)) {
      const youWon = nextRoundWinsA >= winTo;
      recordedOutcomeRef.current = youWon ? "win" : "loss";
      recordMatch({
        id: `ranked-cpu-${Date.now()}`,
        mode: "constellation",
        bestOf: winTo,
        opponent: { kind: "cpu", mood: moodRef.current },
        scorePlayer: nextRoundWinsA,
        scoreOpponent: nextRoundWinsB,
        outcome: youWon ? "win" : "loss",
        rounds: [],
        xpDelta: youWon ? 60 : 15,
        lpDelta: 0,
        timestamp: Date.now(),
        forfeit: false,
      });
      window.setTimeout(() => {
        if (youWon) hapticMatchWin(); else hapticMatchLoss();
        awardCardMasteryXp((savedDeck ?? []) as CardId[], youWon ? "win" : "loss");
        setEnd({
          winner: youWon ? "a" : "b",
          roundWinsYou: nextRoundWinsA,
          roundWinsOpp: nextRoundWinsB,
          forfeit: false,
          xpGained: youWon ? 60 : 15,
          eclatsGained: eclatsReward("constellation", youWon ? "win" : "loss", winTo),
          youCardsPlayed: youCardsPlayedRef.current.slice(),
          oppCardsPlayed: oppCardsPlayedRef.current.slice(),
        });
      }, roundPauseMs);
    } else if (riposteWillFire) {
      window.setTimeout(() => {
        setRiposteData({ lane: myRiposteLane as LaneTarget, phase: "pick" });
      }, roundPauseMs);
    } else if (
      finalWinner === "draw" && !timedOut &&
      nextRoundWinsA === winTo - 1 && nextRoundWinsB === winTo - 1
    ) {
      // Sudden Death only fires at match point on both sides — a perfectly
      // tied round there would otherwise leave the match unable to finish.
      // Every other draw just continues to the next round, which keeps SD
      // feeling rare and decisive instead of laggy noise on every tie.
      window.setTimeout(() => {
        setSuddenDeathData({ phase: "pick", round: roundNoRef.current });
      }, SUDDEN_DEATH_PRE_MS);
    } else {
      window.setTimeout(() => startNextRound(), roundPauseMs);
    }
  }

  return resolveAndAdvance;
}
