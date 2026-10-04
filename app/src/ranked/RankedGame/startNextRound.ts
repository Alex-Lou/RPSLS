import { rngInt } from "../../engine/rng";
import { shuffle, drawN, HAND_CAP, STARTING_HAND } from "../cards";
import { cpuRankedDecision } from "../rankedAI";
import type { CpuRoundDecision, LaneTarget } from "../rankedTypes";
import { BASE_CPU_HAND_POOL } from "./rankedGameData";
import { LANE_COUNT, MAX_MANA, PICK_DEADLINE_MS } from "./rankedGameConstants";
import type { RankedGameCtx } from "./rankedGameContext";

/**
 * createStartNextRound — fabrique (appelée À CHAQUE rendu de RankedGame) de
 * startNextRound, extrait VERBATIM. Lit la battle via battleRef (dernier état
 * rendu) ; le reste vient du contexte du rendu courant, comme avant.
 */
export function createStartNextRound(ctx: RankedGameCtx) {
  const {
    aliveRef, battleRef, roundNoRef, rng, difficulty,
    genesisPendingRef, braiseActiveRef, setBraiseStacks, setBonusManaNext, manaMaxBoostRef,
    setCascadeArmed, cascadeFreeNextRoundRef, setEchoActive, anchorSnapshotRef,
    setAnchorRoundsLeft, anchorLossStreakRef, pharePendingRef, setGaiaCharged, setBattle,
    bonusManaNextRoundRef, setAugurCooldown, wonLastRoundRef, compensationDrawNextRef,
    mascaradePoisonRef, setMascaradePoison, cpuOneShotsRef, fardeauNextCpuRef, moodRef,
    playerHistoryRef, cpuDecisionRef, setOppHandRevealed, setCompassRevealed, setPicks,
    setCardPlayed, setOracleRevealed, setLastResult, setMana, setAugurRevealed, setRound,
  } = ctx;

  function startNextRound() {
    // Écran quitté entre-temps (timer programmé avant le démontage) : rien.
    if (!aliveRef.current) return;
    const battle = battleRef.current;
    const nextNo = roundNoRef.current + 1;
    roundNoRef.current = nextNo;

    // Genèse reset (4-mana legendary): wipe round wins, reshuffle full deck,
    // empty hand/discard. Mana, mana-boost, charges all reset too. The card
    // itself is already burned (it's a legendary one-shot).
    if (genesisPendingRef.current) {
      genesisPendingRef.current = false;
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
      pharePendingRef.current = false;
      // Re-seed gaia if equipped (it gets a fresh charge after Genèse — feels
      // right since the match is "starting over").
      setGaiaCharged(battle.passives.includes("gaia"));
      setBattle((b) => {
        const fullSource = [...b.deck, ...b.hand, ...b.discard, ...b.usedOneShotCards];
        return {
          ...b,
          deck: shuffle(fullSource, rng),
          hand: [],
          discard: [],
          usedOneShotCards: [],
          oppHandSize: STARTING_HAND,
          roundWinsA: 0,
          roundWinsB: 0,
          bonusHistory: [],
        };
      });
      // Schedule the actual round start AFTER the state batch settles —
      // re-enter startNextRound on the fresh state.
      window.setTimeout(() => startNextRound(), 50);
      // Roll back the round number we just bumped — the rerun will bump it.
      roundNoRef.current = nextNo - 1;
      return;
    }

    // +1 base mana so the curve is round1:2 → round3:4. The old `nextNo`
    // curve locked the 4-cost Supernova until round 4, by which point most
    // Bo3 matches are already over — it was effectively a dead card.
    // Cadence (passive) lifts the cap by +1 (MAX_MANA → MAX_MANA+1) so 4-cost
    // cards arc earlier — RELATIF à MAX_MANA (Alex 2026-06-13 « Max → Max+1 »),
    // plus de « 5 » en dur. Marchand d'Âmes adds a permanent +3 ceiling on top.
    const manaCap = (battle.passives.includes("cadence") ? MAX_MANA + 1 : MAX_MANA) + manaMaxBoostRef.current;
    const bonusMana = bonusManaNextRoundRef.current;
    setBonusManaNext(0);
    const newMana = Math.min(manaCap, nextNo + 1 + bonusMana);
    setAugurCooldown((c) => Math.max(0, c - 1));

    const shouldDraw = nextNo === 1 || wonLastRoundRef.current;
    const compensationDraw = compensationDrawNextRef.current;
    compensationDrawNextRef.current = false;
    // Pillage (passive): each round you WON, draw 1 extra card next round.
    const pillageDraw = wonLastRoundRef.current && battle.passives.includes("pillage") ? 1 : 0;
    // Cascade payoff: refill to full hand (3) at the start of next round.
    const cascadeRefill = cascadeFreeNextRoundRef.current;
    cascadeFreeNextRoundRef.current = false;
    const baseDrawCount = nextNo === 1 ? STARTING_HAND : shouldDraw ? 1 : 0;
    const cascadeExtra = cascadeRefill ? Math.max(0, HAND_CAP - battle.hand.length - baseDrawCount) : 0;
    const drawCount = baseDrawCount + (compensationDraw ? 1 : 0) + pillageDraw + cascadeExtra;
    // Bump the cap for this draw cycle so the compensation / Pillage cards are
    // honored even if the player also hit the normal cap this round.
    const drawCap = HAND_CAP + (compensationDraw ? 1 : 0) + pillageDraw;
    const drawn = drawN(battle.deck, battle.hand, battle.discard, drawCount, drawCap, rng);

    // CPU decision now, stored in ref so Augur can read without races.
    // Mascarade (Bluff): a poisoned read makes the hard AI plan from an empty
    // history this round — it can't counter the player's habits.
    const mascaradePoison = mascaradePoisonRef.current;
    setMascaradePoison(false);
    const usedOneShots = new Set(cpuOneShotsRef.current);
    let cpuHand = BASE_CPU_HAND_POOL.filter((id) => !usedOneShots.has(id));
    // Fardeau (Burden): the burdened card is FORCED into the CPU's hand and
    // they MUST play it this round (the AI's natural choice is bypassed).
    const forcedFardeau = fardeauNextCpuRef.current;
    fardeauNextCpuRef.current = null;
    if (forcedFardeau) cpuHand = [forcedFardeau];
    const cpuDecision = cpuRankedDecision(
      {
        mood: moodRef.current,
        difficulty,
        playerHistory: mascaradePoison ? [] : playerHistoryRef.current,
        mana: newMana,
        hand: cpuHand,
      },
      LANE_COUNT,
    );
    // Fardeau guarantee: chooseCpuCard rolls playChance and may skip even when
    // the forced card is the only one in hand. Override here so the burdened
    // card actually lands — that's the whole point of the card.
    if (forcedFardeau && !cpuDecision.card) {
      cpuDecision.card = { id: forcedFardeau } as CpuRoundDecision["card"];
    }
    cpuDecisionRef.current = cpuDecision;
    // Clear last round's Oracle Inverse reveal — fresh round, no peek yet.
    setOppHandRevealed(null);

    // Phare (Boussole armed last round): the cpuDecision for THIS round is
    // now known → surface it BEFORE the player picks so they can both
    // reposition their RPSLS moves AND play a counter card (Anchor / Aegis /
    // Crépuscule) without sacrificing their card slot to the reveal. This is
    // the entire reason the card was re-designed: in-round reveal was dead.
    if (pharePendingRef.current) {
      pharePendingRef.current = false;
      const oc = cpuDecision.card;
      if (oc) {
        const lane = "lane" in oc ? (oc.lane as LaneTarget) : null;
        setCompassRevealed({ lane, cardId: oc.id });
      } else {
        // Opp played no card this round → tell the player explicitly.
        setCompassRevealed({ lane: null });
      }
    }

    // Reset round-time state.
    setPicks([null, null, null]);
    setCardPlayed(null);
    setOracleRevealed(null);
    setCompassRevealed(null);
    setLastResult(null);
    setMana(newMana);
    // Prophétie (passive): a free Augur every round — reveal one random
    // opponent pick. Otherwise clear last round's reveal.
    if (battle.passives.includes("prophetie")) {
      const lane = rngInt(rng, LANE_COUNT) as LaneTarget;
      setAugurRevealed({ lane, move: cpuDecision.plays[lane].mv });
    } else {
      setAugurRevealed(null);
    }
    setBattle((b) => ({ ...b, deck: drawn.deck, hand: drawn.hand, discard: drawn.discard }));
    setRound({
      no: nextNo,
      deadlineMs: PICK_DEADLINE_MS,
      startedAt: Date.now(),
    });

    // Ranked vs CPU is local & solo → NO countdown / auto-loss. The player
    // takes their time; the game never auto-plays (e.g. Rock×3) for them.
  }

  return startNextRound;
}
