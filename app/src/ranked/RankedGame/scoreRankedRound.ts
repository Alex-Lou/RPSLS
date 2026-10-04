import { localResolve, type Move } from "../../engine/game";
import { resolveLanesRound, type RoundOutcome } from "../../engine/lanesEngine";
import { detectPlayerCombo } from "../../engine/lanesCombos";
import type { LanePlay } from "../../online/online";
import {
  applyCardEffects, applyVortex, computeRoundBonuses, finalRoundWinner,
} from "../rankedRules";
import type { CpuRoundDecision, LaneTarget } from "../rankedTypes";
import { BASE_CPU_HAND_POOL } from "./rankedGameData";
import { LANE_COUNT } from "./rankedGameConstants";
import type { RankedGameCtx } from "./rankedGameContext";

/**
 * scoreRankedRound — CALCUL du score d'une manche (1re moitié de
 * resolveAndAdvance, extraite VERBATIM et dans le MÊME ordre, effets de bord
 * inclus : historique joueur, log des cartes, Gaïa, Écho). Appelée par
 * resolveAndAdvance avec le contexte du rendu courant.
 */
export function scoreRankedRound(
  ctx: RankedGameCtx,
  cpu: CpuRoundDecision,
  cpuPicks: [Move, Move, Move],
  playerPicks: [Move, Move, Move],
  timedOut: boolean,
) {
  const {
    battle, cardPlayed, playerHistoryRef, prevOppPicksRef, cpuOneShotsRef,
    youCardsPlayedRef, oppCardsPlayedRef, gaiaChargedRef, setGaiaCharged,
    echoActiveRef, setEchoActive,
  } = ctx;

  // Remember the round we're playing for Rémanence next time.
  const prevOppPicksThisRound: Move[] = [...cpuPicks];

  if (!timedOut) {
    playerHistoryRef.current.push(...playerPicks);
  }

  const playerPlays: LanePlay[] = playerPicks.map((mv) => ({ mv, mana: 0 }));
  // Vortex: rotate CPU picks if player played it
  const vortexActive = !timedOut && cardPlayed?.id === "vortex";
  const cpuPlays: LanePlay[] = vortexActive ? applyVortex(cpu.plays) : cpu.plays;

  // Mirror: copy the opponent's move on the targeted lane → that lane
  // becomes identical moves → a guaranteed draw, neutralising a coup the
  // player can't otherwise beat. Applied before resolution so the engine
  // scores it naturally. We also patch `displayPlayerPicks` so the reveal
  // shows the post-mirror move (else the lane shows e.g. Rock vs Paper and
  // the player reads it as a wrong resolution).
  const displayPlayerPicks: [Move, Move, Move] = [...playerPicks] as [Move, Move, Move];
  if (!timedOut && cardPlayed?.id === "mirror") {
    const ml = (cardPlayed as { lane: LaneTarget }).lane;
    playerPlays[ml] = { mv: cpuPlays[ml].mv, mana: 0 };
    displayPlayerPicks[ml] = cpuPlays[ml].mv;
  }

  // Rémanence: summon the GHOST of the opponent's last-round move on the
  // chosen lane — your move there is replaced by that ghost. Falls back to
  // the opp's CURRENT pick on that lane if there's no recorded history
  // (round 1, etc.), which essentially mimics a Mirror.
  if (!timedOut && cardPlayed?.id === "remanence") {
    const ml = (cardPlayed as { lane: LaneTarget }).lane;
    const ghost = prevOppPicksRef.current?.[ml] ?? cpuPlays[ml].mv;
    playerPlays[ml] = { mv: ghost, mana: 0 };
    displayPlayerPicks[ml] = ghost;
  }

  // Échappée: clear your move on the chosen lane (we use a synthetic "rock"
  // for the engine call — applyCardEffects then wipes the lane to a draw).
  // The visual reveal shows the empty slot via the lane outcome.
  if (!timedOut && cardPlayed?.id === "echappee") {
    // Engine still needs a valid Move to compare, but we'll erase the lane
    // score in applyCardEffects. Display as the original pick so the player
    // sees "their move ran away" rather than a fake substitution.
    // (No mutation needed — the post-resolve wipe is enough.)
  }

  // Le Choix de Schrödinger (superposition) : sur chaque lane que tu
  // PERDRAIS, ton coup reste « ni gagné ni perdu » → il prend le coup adverse
  // (nul, même mécanique que Mirror). Tu ne peux perdre aucune lane ce round,
  // mais les victoires restent à aller chercher. (Avant : contre canonique
  // sur chaque lane = 3-0 garanti, Alex 2026-10.)
  if (!timedOut && cardPlayed?.id === "schrodinger") {
    for (let i = 0; i < playerPlays.length; i++) {
      const oppMv = cpuPlays[i].mv;
      if (localResolve(playerPlays[i].mv, oppMv).outcome.kind === "b_wins") {
        playerPlays[i] = { mv: oppMv, mana: 0 };
        displayPlayerPicks[i] = oppMv;
      }
    }
  }

  let base: RoundOutcome;
  if (timedOut) {
    base = {
      lanes: playerPlays.map((p, i) => ({
        a_play: p, b_play: cpuPlays[i],
        outcome: { kind: "b_wins" as const, verb: "wins by timeout" },
        winner: "b" as const, points: 1,
      })),
      aPoints: 0,
      bPoints: LANE_COUNT,
      roundWinner: "b" as const,
    };
  } else {
    base = resolveLanesRound(playerPlays, cpuPlays);
  }

  // Le Juge (The Judge): override the RPSLS-based resolution with
  // stat-based judgement — lane 0 = round wins, lane 1 = cards in hand,
  // lane 2 = remaining deck size. Moves are ignored; the judgement is
  // alternative justice.
  if (!timedOut && cardPlayed?.id === "juge") {
    const yourStats = [battle.roundWinsA, battle.hand.length, battle.deck.length];
    const oppStats = [battle.roundWinsB, battle.oppHandSize, BASE_CPU_HAND_POOL.length - cpuOneShotsRef.current.length];
    const judgedLanes = base.lanes.map((lr, i) => {
      if (yourStats[i] > oppStats[i]) return { ...lr, winner: "a" as const, points: 1 };
      if (yourStats[i] < oppStats[i]) return { ...lr, winner: "b" as const, points: 1 };
      return { ...lr, winner: "draw" as const, points: 0 };
    });
    const judgedAPoints = judgedLanes.filter((l) => l.winner === "a").length;
    const judgedBPoints = judgedLanes.filter((l) => l.winner === "b").length;
    base = {
      lanes: judgedLanes,
      aPoints: judgedAPoints,
      bPoints: judgedBPoints,
      roundWinner:
        judgedAPoints > judgedBPoints ? "a" :
        judgedBPoints > judgedAPoints ? "b" : "draw",
    };
  }

  const myCard = timedOut ? null : cardPlayed;
  // Trou noir (Singularity): annul the opponent's card entirely — none of its
  // effects fire this round. `cpu.card` is still used below for logging, the
  // one-shot burn, and the hand-count so a negated card is still consumed.
  const trouNoirActive = !timedOut && myCard?.id === "trou-noir";
  const oppCard = trouNoirActive ? null : cpu.card;

  // Log both sides' cards so the end-of-match recap can teach the player
  // what was played without forcing them to scroll back round-by-round.
  if (myCard?.id) youCardsPlayedRef.current.push(myCard.id);
  if (cpu.card?.id) oppCardsPlayedRef.current.push(cpu.card.id);

  const gaiaCharged = gaiaChargedRef.current;
  const fx = applyCardEffects(base, myCard, oppCard, { gaiaChargedA: gaiaCharged });
  if (fx.gaiaSavedA) setGaiaCharged(false);
  // Conduit (passive): the player's combos pay +1 extra.
  const conduitActive = battle.passives.includes("conduit");
  // Combo detection uses post-Mirror picks so bonus history stays aligned
  // with what the reveal banner shows. AI history (playerHistoryRef) still
  // tracks the player's INTENT (original picks) — that's about reads.
  const yourCombo = detectPlayerCombo(displayPlayerPicks);
  const oppCombo = detectPlayerCombo(cpuPicks);
  const bonuses = computeRoundBonuses(
    fx.outcome,
    playerPlays, cpuPlays,
    myCard, oppCard,
    yourCombo, oppCombo,
    fx,
    conduitActive, false,
  );
  let finalWinner = finalRoundWinner(fx.outcome, bonuses, myCard, oppCard);

  // Écho temporel — stop-loss: if this would be your loss, rewrite as draw.
  // The card itself is refunded to your hand (and to mana) on success.
  let echoRefund = false;
  if (!timedOut && echoActiveRef.current && finalWinner === "b") {
    setEchoActive(false);
    finalWinner = "draw";
    echoRefund = true;
  } else if (!timedOut && echoActiveRef.current) {
    setEchoActive(false); // consume the watch even on win/draw
  }
  // Trinité parfaite (Perfect Trinity): your three picks ALL different AND no
  // lane lost (draws allowed) → you win the round outright. Otherwise the
  // round resolves normally. (Avant : 3 coups différents suffisaient = trivial,
  // Alex 2026-10.)
  const trinityActive = !timedOut && myCard?.id === "trinite";
  const trinityHit = trinityActive && new Set(playerPicks).size === 3
    && fx.outcome.lanes.every((l) => l.winner !== "b");
  if (trinityHit) finalWinner = "a";
  // Gambit (high-roll): a won Gambit round counts DOUBLE toward the match
  // (extra round-win) and doubles the shown points; a lost Gambit round
  // costs an extra card (the normal loss-discard PLUS one). Pure swing.
  const gambitActive = !timedOut && myCard?.id === "gambit";
  const gambitWinBonus = gambitActive && finalWinner === "a" ? 1 : 0;
  const yourTotalRaw = Math.max(0,
    fx.outcome.aPoints + bonuses.comboBonusA + bonuses.favouredBonusA +
    bonuses.surgeBonusA + bonuses.surgePenaltyB + bonuses.tideBonusA -
    bonuses.cursePenaltyA - bonuses.leechPenaltyA);
  let yourTotal = gambitActive ? yourTotalRaw * 2 : yourTotalRaw;
  const oppTotal = Math.max(0,
    fx.outcome.bPoints + bonuses.comboBonusB + bonuses.favouredBonusB +
    bonuses.surgeBonusB + bonuses.surgePenaltyA + bonuses.tideBonusB -
    bonuses.cursePenaltyB - bonuses.leechPenaltyB);
  // A forced Trinity win must read as a win on the score line too.
  if (trinityHit && yourTotal <= oppTotal) yourTotal = oppTotal + 1;

  return {
    prevOppPicksThisRound, displayPlayerPicks, myCard, oppCard, fx, bonuses,
    finalWinner, echoRefund, gambitActive, gambitWinBonus, yourTotal, oppTotal,
  };
}
