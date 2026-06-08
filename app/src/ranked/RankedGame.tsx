/**
 * RankedGame — top-level orchestrator for Constellation Ranked vs CPU.
 *
 * Owns: battle state (deck/hand/discard/roundWins/bonusHistory), round state
 * (picks, card-in-flight, mana, augur-revealed), refs for CPU decision and
 * player history (never leaked to children).
 *
 * The round loop:
 *   splash → drawing → picking → lock → reveal-intro → reveal → inter-round
 *   → drawing → ... → match-end → recordMatch.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { AiMood, Move } from "../engine/game";
import { useStore } from "../store/store";
import {
  resolveLanesRound,
  rpslsBeats,
  type RoundOutcome,
} from "../engine/lanesEngine";
import { detectPlayerCombo, shuffleLaneIdentities } from "../engine/lanesCombos";
import { eclatsReward } from "../engine/economy";
import {
  hapticLock, hapticMatchStart, hapticMatchWin, hapticMatchLoss,
  hapticTap, hapticWin, hapticLoss,
} from "../haptic";
import type { LanePlay, PlayerSlot } from "../online/online";
import {
  RankedMatchView,
  type RankedMatchInfo,
  type RankedRoundData,
  type RankedRoundResultData,
  type RankedEndData,
} from "./RankedMatchView";
import {
  applyCardEffects, applyVortex, computeRoundBonuses, finalRoundWinner,
} from "./rankedRules";
import {
  starterDeck, shuffle, drawN, HAND_CAP, STARTING_HAND, CARDS, discardRandom,
  isPassiveCard,
} from "./cards";
import { cpuRankedDecision } from "./rankedAI";
import type {
  CardId, CpuRoundDecision, LaneTarget, PlayedCard,
  RankedBattleState,
} from "./rankedTypes";

const LANE_COUNT = 3;
const PICK_DEADLINE_MS = 20_000;

/** Canonical RPSLS counters — used by Le Choix de Schrödinger to compute
 *  the "superposed" second move for each lane. */
const COUNTER_MOVE: Record<Move, Move> = {
  rock: "paper",
  paper: "scissors",
  scissors: "rock",
  lizard: "rock",
  spock: "lizard",
};
const ROUND_PAUSE_MS = 7_500;
const REVEAL_SUSPENSE_MS = 1_400;
const MATCH_FOUND_SPLASH_MS = 2_500;
const MAX_MANA = 4;
/** Sudden Death cadence — kept tight so the duel feels punchy, not laggy.
 *  PRE  = how long the reveal sits before the overlay slides in.
 *  POST = how long the verdict banner sits before applySuddenDeath fires.
 *  DUEL_TIE = how long a tied duel sits before re-picking. */
const SUDDEN_DEATH_PRE_MS = 1_500;
const SUDDEN_DEATH_POST_MS = 2_200;
const SUDDEN_DEATH_DUEL_TIE_MS = 1_700;

/** CPU's notional hand pool — the cards the AI may consider each round. The
 *  CPU doesn't track a real deck/hand, but we filter one-shots out across the
 *  match so it can't replay an epic/legendary it already played. */
const BASE_CPU_HAND_POOL: CardId[] = [
  "aegis", "surge", "augur", "curse", "precision", "riposte",
  "heist", "tide", "vortex",
  // Bonus Lot 1 actives the CPU can throw (passives are player-only).
  "sangsue", "rempart", "trou-noir",
  // V3 actives the CPU can also play (simpler effects only — anything
  // requiring a player-side modal stays off the CPU's menu).
  "sablier", "remanence", "braise", "crepuscule", "cascade",
  "fardeau", "benediction",
];

/** Pool the player draws from when a successful Heist nets them a card. Heist
 *  itself is excluded (you can't steal someone's one-shot they've already
 *  burned). */
const STEALABLE_FROM_CPU: CardId[] = [
  "aegis", "surge", "augur", "curse", "precision", "riposte", "tide", "vortex",
];

function makeBattle(savedDeck?: string[]): RankedBattleState {
  const cleaned = (savedDeck ?? []).filter(
    (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
  );
  const source = cleaned.length > 0 ? cleaned : starterDeck();
  // Passives are pulled OUT of the draw pile — they're always-on for the whole
  // match and never enter the hand. Everything else is the shuffled draw deck.
  const passives = source.filter(isPassiveCard);
  const drawSource = source.filter((id) => !isPassiveCard(id));
  return {
    deck: shuffle(drawSource),
    hand: [],
    discard: [],
    usedOneShotCards: [],
    passives,
    oppHandSize: STARTING_HAND,
    roundWinsA: 0,
    roundWinsB: 0,
    roundsPlayed: 0,
    bonusHistory: [],
  };
}

/** Pick the lowest-rarity (then random) sacrificial card in a hand, excluding
 *  the card being played itself. Used by Métamorphose. */
function pickSacrifice(hand: CardId[], exclude: CardId): CardId | null {
  const pool = hand.filter((c) => c !== exclude);
  if (pool.length === 0) return null;
  const order: CardId[] = pool.slice().sort((a, b) => {
    const ra = ["common", "rare", "epic", "legendary"].indexOf(CARDS[a].rarity);
    const rb = ["common", "rare", "epic", "legendary"].indexOf(CARDS[b].rarity);
    return ra - rb;
  });
  return order[0];
}

/** Rarity ladder: returns the rarity one tier above (legendary loops to itself
 *  per the design — sacrificing a legendary draws TWO of the same tier). */
function nextRarityUp(r: "common" | "rare" | "epic" | "legendary"): "common" | "rare" | "epic" | "legendary" {
  return r === "common" ? "rare" : r === "rare" ? "epic" : "legendary";
}

function removeFirst<T>(arr: T[], v: T): T[] {
  const i = arr.indexOf(v);
  if (i === -1) return arr;
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

export function RankedGame({
  winTo, opponentName = "CPU", onQuit, onMatchResult,
}: {
  winTo: number;
  opponentName?: string;
  onQuit: () => void;
  onMatchResult?: (won: boolean) => void;
}) {
  const profileNickname = useStore((s) => s.player.nickname);
  const difficulty = useStore((s) => s.player.difficulty);
  const recordMatch = useStore((s) => s.recordMatch);
  const savedDeck = useStore((s) => s.player.rankedDeck);
  const awardCardMasteryXp = useStore((s) => s.awardCardMasteryXp);

  // Shuffle the lane arrangement once per match — synchronously during this
  // (parent) render so the board children read the SAME arrangement on first
  // paint. The ref guards against re-shuffling on re-renders / StrictMode.
  const laneShuffled = useRef(false);
  if (!laneShuffled.current) { shuffleLaneIdentities(); laneShuffled.current = true; }

  const matchInfo: RankedMatchInfo = {
    matchId: "ranked-local",
    opponent: opponentName,
    youAre: "a" as PlayerSlot,
    lanes: LANE_COUNT,
    winTo,
  };

  /* ──────────── State ──────────── */
  const [round, setRound] = useState<RankedRoundData | null>(null);
  const [picks, setPicks] = useState<[Move | null, Move | null, Move | null]>([null, null, null]);
  const [cardPlayed, setCardPlayed] = useState<PlayedCard | null>(null);
  /** Rolling log of every card actually played per side — used by the
   *  end-of-match "Cartes utilisées" recap so the player reads each card's
   *  description in context (and learns the rules without a rulebook). */
  const youCardsPlayedRef = useRef<CardId[]>([]);
  const oppCardsPlayedRef = useRef<CardId[]>([]);
  const [augurRevealed, setAugurRevealed] = useState<{ lane: LaneTarget; move: Move } | null>(null);
  const [oracleRevealed, setOracleRevealed] = useState<[Move, Move, Move] | null>(null);
  /** Boussole (Phare): the opponent's card scheduled for THIS round —
   *  surfaced at the START of the round (before the player picks) when the
   *  player armed Boussole the round BEFORE. `lane: null` = the card has no
   *  lane target (e.g. Vortex). `cardId` lets the chip name the threat.
   *  See pharePendingRef + the look-ahead block in startNextRound. */
  const [compassRevealed, setCompassRevealed] = useState<{ lane: LaneTarget | null; cardId?: CardId } | null>(null);
  /** Phare pending: the player played Boussole this round → next round, before
   *  they pick, reveal the opp card identity + lane so they can plan picks
   *  AND react with a counter card in the same round. Resolves the "1 card
   *  per round" tension by decoupling the reveal from the counter slot. */
  const pharePendingRef = useRef(false);
  const [mana, setMana] = useState(1);
  const [battle, setBattle] = useState<RankedBattleState>(() => makeBattle(savedDeck));
  const [lastResult, setLastResult] = useState<RankedRoundResultData | null>(null);
  const [end, setEnd] = useState<RankedEndData | null>(null);
  /** Riposte sub-phase: when set, the player played Riposte on a lane and
   *  lost it. The reveal finishes first, then a mini "rejoue ce lane" phase
   *  fires — picking it correctly flips the lane outcome from loss to win
   *  and possibly the round winner. */
  const [riposteData, setRiposteData] = useState<{
    lane: LaneTarget;
    phase: "pick" | "reveal";
    playerMove?: Move;
    cpuMove?: Move;
    flipped?: boolean;
  } | null>(null);

  /** Sudden-death sub-phase: a perfectly tied round (equal totals) triggers a
   *  single-move duel to break the tie — the winner takes the round point.
   *  `winner` null in reveal = the duel itself tied → it re-picks. */
  const [suddenDeathData, setSuddenDeathData] = useState<{
    phase: "pick" | "reveal";
    round: number;
    playerMove?: Move;
    cpuMove?: Move;
    winner?: "a" | "b" | null;
  } | null>(null);

  /* ──────────── Refs (never leaked to children) ──────────── */
  const cpuDecisionRef = useRef<CpuRoundDecision | null>(null);
  const playerHistoryRef = useRef<Move[]>([]);
  const moodRef = useRef<AiMood>("random");
  const roundNoRef = useRef(0);
  const deadlineTimerRef = useRef<number | null>(null);
  const wonLastRoundRef = useRef(false);
  /** Augur cooldown: rounds remaining before Augur can be played again. */
  const [augurCooldown, setAugurCooldown] = useState(0);
  /** Set true when the CPU successfully Heists the player; consumed at next
   *  startNextRound to give the victim one free draw (bypassing the hand cap
   *  if they were a roundwinner this turn and would otherwise hit it). */
  const compensationDrawNextRef = useRef(false);
  /** CPU one-shots burned this match — filtered out of BASE_CPU_HAND_POOL. */
  const cpuOneShotsRef = useRef<CardId[]>([]);
  /** Mascarade (Bluff): when set, the NEXT round's CPU decision is computed
   *  from an empty history so the hard AI can't read the player's habits —
   *  the player's disinformation lands one round later (consumed at draw). */
  const mascaradePoisonRef = useRef(false);
  const [mascaradePoison, setMascaradePoisonState] = useState(false);
  const setMascaradePoison = (b: boolean) => {
    mascaradePoisonRef.current = b;
    setMascaradePoisonState(b);
  };

  /* ──────────── V3 bonus-card state ──────────── */
  /** Braise (Ember): once played, each subsequent ROUND LOST shaves 1 mana off
   *  the cost of your next card (cumulative, min cost = 1). The discount is
   *  reset to 0 every time a card is actually played. Ref + state mirror —
   *  the ref lives across renders for synchronous logic; the state drives the
   *  CardHand pip/playable display so the player SEES the discount. */
  const braiseActiveRef = useRef(false);
  const braiseStacksRef = useRef(0);
  const [braiseStacks, setBraiseStacksState] = useState(0);
  // Helper so the ref and the state never drift.
  const setBraiseStacks = (n: number) => {
    braiseStacksRef.current = n;
    setBraiseStacksState(n);
  };
  /** Extra mana granted at the start of the NEXT round only — fed by Offre
   *  (+2), Sablier (+1). Consumed in startNextRound. Ref + state mirror so
   *  the UI can show "+N mana prochain round" as a chip. */
  const bonusManaNextRoundRef = useRef(0);
  const [bonusManaNext, setBonusManaNextState] = useState(0);
  const setBonusManaNext = (n: number) => {
    bonusManaNextRoundRef.current = n;
    setBonusManaNextState(n);
  };
  /** Permanent mana-cap boost from Marchand d'Âmes (+3, repeatable). */
  const manaMaxBoostRef = useRef(0);
  /** Cascade armed this round: after resolve, fill hand to 3 on win / dump
   *  hand on loss. Ref + state mirror for the chip. */
  const cascadeArmedRef = useRef(false);
  const [cascadeArmed, setCascadeArmedState] = useState(false);
  const setCascadeArmed = (b: boolean) => {
    cascadeArmedRef.current = b;
    setCascadeArmedState(b);
  };
  /** Cascade just paid off: next round's draws are free (mana-discounted).
   *  Implemented by clearing the cost of the first card played next round. */
  const cascadeFreeNextRoundRef = useRef(false);
  /** Écho temporel: if armed and the round ends in YOUR loss, the result is
   *  rewritten as a draw — your card is refunded, no discard penalty. The
   *  CPU isn't actually rewound (their cards are kept) — it's a "stop-loss". */
  const echoActiveRef = useRef(false);
  const [echoActive, setEchoActiveState] = useState(false);
  const setEchoActive = (b: boolean) => {
    echoActiveRef.current = b;
    setEchoActiveState(b);
  };
  /** Ancre temporelle snapshot: state to restore if you lose the next 2 rounds.
   *  Cleared if you win any of them. */
  const anchorSnapshotRef = useRef<{
    winsA: number; winsB: number;
    hand: CardId[]; deck: CardId[]; discard: CardId[]; usedOneShotCards: CardId[];
  } | null>(null);
  /** Rounds left on the anchor watch (2 → 1 → 0). */
  const anchorRoundsLeftRef = useRef(0);
  const [anchorRoundsLeft, setAnchorRoundsLeftState] = useState(0);
  const setAnchorRoundsLeft = (n: number) => {
    anchorRoundsLeftRef.current = n;
    setAnchorRoundsLeftState(n);
  };
  /** Anchor loss-streak counter — increments per loss while watching, restores at 2. */
  const anchorLossStreakRef = useRef(0);
  /** Gaïa (Bouclier de Gaïa): passive, charged at match start if equipped.
   *  Consumed once per match the first time the round would be a loss. */
  const gaiaChargedRef = useRef(false);
  const [gaiaCharged, setGaiaChargedState] = useState(false);
  const setGaiaCharged = (b: boolean) => {
    gaiaChargedRef.current = b;
    setGaiaChargedState(b);
  };
  /** Once-per-match limiter for Paradoxe Temporel. */
  const paradoxeUsedRef = useRef(false);
  /** Once-per-match limiter for Genèse. */
  const genesisUsedRef = useRef(false);
  /** Fardeau (Burden): force the CPU to play this card NEXT round (consumed). */
  const fardeauNextCpuRef = useRef<CardId | null>(null);
  /** Previous round's CPU picks — used by Rémanence to summon the ghost of the
   *  opponent's last move on a chosen lane. */
  const prevOppPicksRef = useRef<Move[] | null>(null);
  /** Oracle Inverse (Mind Reader): the 3 random CPU-hand cards revealed this
   *  round. Shown as a soft chip strip during pick phase. Cleared at next round. */
  const [oppHandRevealed, setOppHandRevealed] = useState<CardId[] | null>(null);
  /** Genèse pending reset — applied at the start of next round. */
  const genesisPendingRef = useRef(false);

  /* ──────────── Lifecycle ──────────── */
  useEffect(() => {
    hapticMatchStart();
    // Seed Bouclier de Gaïa charge if the passive is equipped — consumed once
    // per match on the first round you'd lose.
    setGaiaCharged(battle.passives.includes("gaia"));
    const id = window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (deadlineTimerRef.current) window.clearTimeout(deadlineTimerRef.current);
    };
  }, []);

  /* ──────────── Round loop ──────────── */

  function startNextRound() {
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
          deck: shuffle(fullSource),
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
    // Cadence (passive) lifts the cap from 4 to 5 so 4-cost cards arc earlier.
    // Marchand d'Âmes adds a permanent +3 ceiling on top.
    const manaCap = (battle.passives.includes("cadence") ? 5 : MAX_MANA) + manaMaxBoostRef.current;
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
    const drawn = drawN(battle.deck, battle.hand, battle.discard, drawCount, drawCap);

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
      const lane = Math.floor(Math.random() * LANE_COUNT) as LaneTarget;
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

  /* ──────────── Player actions ──────────── */

  function handlePickMove(mv: Move) {
    setPicks((cur) => {
      const i = cur.findIndex((p) => p === null);
      if (i === -1) return cur;
      const next = cur.slice() as [Move | null, Move | null, Move | null];
      next[i] = mv;
      return next;
    });
  }
  function handleClearLane(lane: LaneTarget) {
    setPicks((cur) => {
      const next = cur.slice() as [Move | null, Move | null, Move | null];
      next[lane] = null;
      return next;
    });
  }
  function handlePlayCard(card: PlayedCard) {
    setCardPlayed(card);
    if (card.id === "augur") {
      setAugurRevealed({ lane: card.lane, move: card.revealed });
      setAugurCooldown(3); // Can't play Augur/Oracle for 2 more rounds (decremented at round start)
    } else if (card.id === "oracle") {
      // Oracle reveals all 3 — show via oracleRevealed or 3 augur states
      const r = card.revealed;
      setAugurRevealed(null); // Clear single augur, we use oracle state
      setOracleRevealed(r);
      setAugurCooldown(3);
    } else if (card.id === "telepathie") {
      // Télépathie — same reveal as Oracle but flavored "secret": no extra
      // UI hint, just the 3 picks revealed silently in oracle slots.
      const cpu = cpuDecisionRef.current;
      if (cpu) {
        const r: [Move, Move, Move] = [cpu.plays[0].mv, cpu.plays[1].mv, cpu.plays[2].mv];
        setOracleRevealed(r);
      }
    } else if (card.id === "mascarade") {
      // Bluff: poison the NEXT round's CPU read (disinformation lands later).
      setMascaradePoison(true);
    } else if (card.id === "boussole") {
      // Boussole (re-designed): reveal happens at the START OF NEXT ROUND so
      // the player can BOTH plan their picks AND play a counter card with the
      // same mana — the old in-round reveal was useless because the player
      // had already burned their card slot on Boussole itself. The chip +
      // compass peek visuals fire in startNextRound when this flag is set.
      pharePendingRef.current = true;
    }
    /* ─────────── V3 instant effects ─────────── */
    else if (card.id === "sablier") {
      // Sand-bender. Vs CPU the deadline is moot, so the card grants tempo:
      // +1 card NOW + +1 mana NEXT round — keeps the time-manipulation
      // theme by trading "saved seconds" for resource velocity.
      setBonusManaNext(bonusManaNextRoundRef.current + 1);
      setBattle((b) => {
        const dr = drawN(b.deck, b.hand, b.discard, 1, b.hand.length + 1);
        return { ...b, deck: dr.deck, hand: dr.hand, discard: dr.discard };
      });
    }
    else if (card.id === "offre") {
      // Pure mana-bank — +2 next round in exchange for telegraphing your move
      // (the CPU doesn't use that info, so vs CPU the offer is generous).
      setBonusManaNext(bonusManaNextRoundRef.current + 2);
    }
    else if (card.id === "braise") {
      // Comeback charge: from now on, each round you LOSE shaves 1 mana off
      // your next card's cost (cumulative; min cost 1, reset when a card lands).
      braiseActiveRef.current = true;
      setBraiseStacks(0);
    }
    else if (card.id === "oracle-inverse") {
      // Reveal 3 random cards from the CPU's notional hand — shown as a chip
      // strip in the pick phase so the player can plan around them.
      const usedOneShots = new Set(cpuOneShotsRef.current);
      const pool = BASE_CPU_HAND_POOL.filter((id) => !usedOneShots.has(id));
      const picked: CardId[] = [];
      const work = pool.slice();
      for (let i = 0; i < 3 && work.length > 0; i++) {
        const idx = Math.floor(Math.random() * work.length);
        picked.push(work[idx]);
        work.splice(idx, 1);
      }
      setOppHandRevealed(picked);
    }
    else if (card.id === "fardeau") {
      // Stuff a weak card into the CPU's NEXT hand and force them to play it.
      // "second-wind" is a no-target, low-impact common — perfect as a poison.
      fardeauNextCpuRef.current = "second-wind";
    }
    else if (card.id === "cascade") {
      // All-in: WIN this round → refill hand to full for next round. LOSE →
      // empty hand. Decided at resolveAndAdvance — we just arm it here.
      setCascadeArmed(true);
    }
    else if (card.id === "ancre-temporelle") {
      // Snapshot the battle state RIGHT NOW (pre-resolve). Restored after
      // you lose 2 rounds in a row while the anchor watches; cleared if you
      // win any of them.
      anchorSnapshotRef.current = {
        winsA: battle.roundWinsA,
        winsB: battle.roundWinsB,
        hand: battle.hand.slice(),
        deck: battle.deck.slice(),
        discard: battle.discard.slice(),
        usedOneShotCards: battle.usedOneShotCards.slice(),
      };
      setAnchorRoundsLeft(2);
      anchorLossStreakRef.current = 0;
    }
    else if (card.id === "echo-temporel") {
      // Stop-loss: if THIS round ends in your loss, it's rewritten as a draw
      // and your card is refunded. The CPU's card still fires and burns.
      setEchoActive(true);
    }
    else if (card.id === "metamorphose") {
      // Sacrifice one card (auto: lowest rarity in hand) → draw a card of
      // one rarity higher. Legendary sacrifice draws TWO legendaries.
      setBattle((b) => {
        const sacrifice = pickSacrifice(b.hand, "metamorphose");
        if (!sacrifice) return b;
        const sacrificeRarity = CARDS[sacrifice].rarity;
        const targetRarity = nextRarityUp(sacrificeRarity);
        const drawCount = sacrificeRarity === "legendary" ? 2 : 1;
        // Burn the sacrifice (epics/legendaries to usedOneShotCards, else discard).
        let handAfter = removeFirst(b.hand, sacrifice);
        let discardAfter = b.discard;
        let usedAfter = b.usedOneShotCards;
        if (sacrificeRarity === "epic" || sacrificeRarity === "legendary") {
          usedAfter = [...usedAfter, sacrifice];
        } else {
          discardAfter = [...discardAfter, sacrifice];
        }
        // Pull from the deck — favor the target rarity, fall back to any card
        // if none in deck. Implemented as a filtered pull from the shuffled deck.
        let deckAfter = b.deck.slice();
        const drawn: CardId[] = [];
        for (let i = 0; i < drawCount; i++) {
          let idx = deckAfter.findIndex((id) => CARDS[id].rarity === targetRarity);
          if (idx === -1) idx = 0; // fallback to top of deck
          if (deckAfter.length === 0) break;
          drawn.push(deckAfter[idx]);
          deckAfter.splice(idx, 1);
        }
        return {
          ...b,
          deck: deckAfter,
          hand: [...handAfter, ...drawn],
          discard: discardAfter,
          usedOneShotCards: usedAfter,
        };
      });
    }
    else if (card.id === "marchand-ames") {
      // Faustian trade — discard 1 random card from hand (HP proxy), gain a
      // permanent +3 mana cap, and draw 3 cards.
      manaMaxBoostRef.current += 3;
      setBattle((b) => {
        let handAfter = b.hand.slice();
        let discardAfter = b.discard.slice();
        let usedAfter = b.usedOneShotCards.slice();
        if (handAfter.length > 0) {
          const dr = discardRandom(handAfter, discardAfter, usedAfter);
          handAfter = dr.hand;
          discardAfter = dr.discard;
          usedAfter = dr.usedOneShotCards;
        }
        const draw = drawN(b.deck, handAfter, discardAfter, 3, HAND_CAP + 3);
        return {
          ...b,
          deck: draw.deck,
          hand: draw.hand,
          discard: draw.discard,
          usedOneShotCards: usedAfter,
        };
      });
    }
    else if (card.id === "paradoxe") {
      // Time-skip: this round is voided. We mark it so resolveAndAdvance
      // refunds mana, returns the card to hand, and jumps to the next round.
      // Limit 1/match — guarded at handleSelectCard via a stub flag below.
      paradoxeUsedRef.current = true;
    }
    else if (card.id === "genese") {
      // Match reset. Take effect at the START of the next round so the
      // current round's resolution completes (the card still burns).
      genesisUsedRef.current = true;
      genesisPendingRef.current = true;
    }
    // riposte, vortex, supernova, second-wind, tide, precision, anchor, curse,
    // surge, aegis, heist, sangsue, rempart, trou-noir, trinite, prescience,
    // remanence (lane copy applied at resolve), echappee (lane wipe applied at
    // resolve), crepuscule (lane immunity in fx), benediction (bonus in fx),
    // schrodinger (best-of-two at resolve), juge (stat-based resolve) →
    // applied at resolve time, no immediate UI effect beyond the card badge.
  }
  function handleCancelCard() {
    if (cardPlayed?.id === "augur") setAugurRevealed(null);
    if (cardPlayed?.id === "oracle") setOracleRevealed(null);
    if (cardPlayed?.id === "telepathie") setOracleRevealed(null);
    if (cardPlayed?.id === "mascarade") setMascaradePoison(false);
    if (cardPlayed?.id === "boussole") {
      // Cancel the look-ahead arming AND any visual already on board.
      pharePendingRef.current = false;
      setCompassRevealed(null);
    }
    if (cardPlayed?.id === "oracle-inverse") setOppHandRevealed(null);
    if (cardPlayed?.id === "sablier") setBonusManaNext(Math.max(0, bonusManaNextRoundRef.current - 1));
    if (cardPlayed?.id === "offre") setBonusManaNext(Math.max(0, bonusManaNextRoundRef.current - 2));
    if (cardPlayed?.id === "braise") { braiseActiveRef.current = false; setBraiseStacks(0); }
    if (cardPlayed?.id === "fardeau") fardeauNextCpuRef.current = null;
    if (cardPlayed?.id === "cascade") setCascadeArmed(false);
    if (cardPlayed?.id === "ancre-temporelle") { anchorSnapshotRef.current = null; setAnchorRoundsLeft(0); }
    if (cardPlayed?.id === "echo-temporel") setEchoActive(false);
    if (cardPlayed?.id === "marchand-ames") manaMaxBoostRef.current = Math.max(0, manaMaxBoostRef.current - 3);
    if (cardPlayed?.id === "paradoxe") paradoxeUsedRef.current = false;
    if (cardPlayed?.id === "genese") { genesisUsedRef.current = false; genesisPendingRef.current = false; }
    setCardPlayed(null);
  }
  function revealAugurFor(lane: LaneTarget): Move {
    return cpuDecisionRef.current?.plays[lane].mv ?? ("rock" as Move);
  }
  function handleLock() {
    if (picks.some((p) => p === null)) return;
    hapticLock();
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    resolveAndAdvance(picks as [Move, Move, Move], false);
  }

  /* ──────────── Resolve a round ──────────── */

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

    // Le Choix de Schrödinger: simulate a second move per lane (the move that
    // would have beaten the opp's pick on that lane), pick whichever gives
    // you the better outcome lane-by-lane. Falls back to your real pick if
    // the simulated cover is the same.
    if (!timedOut && cardPlayed?.id === "schrodinger") {
      for (let i = 0; i < playerPlays.length; i++) {
        const yourMv = playerPlays[i].mv;
        const oppMv = cpuPlays[i].mv;
        // Find a move that BEATS the opp's move (the second superposed move).
        const cover = COUNTER_MOVE[oppMv];
        if (cover !== yourMv && cover) {
          // Take the cover — it's strictly better than a tie or loss.
          playerPlays[i] = { mv: cover, mana: 0 };
          displayPlayerPicks[i] = cover;
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
    // Trinité parfaite (Perfect Trinity): if your three picks are ALL different
    // (a true trinity), you win the round outright. Otherwise the card is wasted.
    const trinityActive = !timedOut && myCard?.id === "trinite";
    const trinityHit = trinityActive && new Set(playerPicks).size === 3;
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
        }, ROUND_PAUSE_MS - 200);
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
        }, ROUND_PAUSE_MS - 200);
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
        const dr = drawN(b.deck, handAfter, discardAfter, 1, handAfter.length + 1);
        handAfter = dr.hand;
        discardAfter = dr.discard;
        // Reassign the deck reference for the rest of this update block.
        b = { ...b, deck: dr.deck };
      }
      // Player Heist landed → steal a random card from the CPU's notional hand.
      if (myHeistSuccess) {
        const stolen = STEALABLE_FROM_CPU[
          Math.floor(Math.random() * STEALABLE_FROM_CPU.length)
        ];
        handAfter = [...handAfter, stolen];
      }
      // CPU Heist landed → yank a random card out of our hand.
      if (oppHeistSuccess && handAfter.length > 0) {
        const idx = Math.floor(Math.random() * handAfter.length);
        handAfter = [...handAfter.slice(0, idx), ...handAfter.slice(idx + 1)];
      }
      // Lose round → discard 1 random card from hand
      if (finalWinner === "b" && handAfter.length > 0) {
        const dr = discardRandom(handAfter, discardAfter, usedOneShotAfter);
        handAfter = dr.hand;
        discardAfter = dr.discard;
        usedOneShotAfter = dr.usedOneShotCards;
        // Gambit backfire: a lost Gambit round burns an EXTRA card.
        if (gambitActive && handAfter.length > 0) {
          const dr2 = discardRandom(handAfter, discardAfter, usedOneShotAfter);
          handAfter = dr2.hand;
          discardAfter = dr2.discard;
          usedOneShotAfter = dr2.usedOneShotCards;
        }
      }
      // Prescience (Foresight): draw 1 card immediately, above the hand cap.
      // Resolved here (after the loss-discard) so it's a guaranteed net +1 card.
      let deckAfter = b.deck;
      if (myCard?.id === "prescience") {
        const dr = drawN(deckAfter, handAfter, discardAfter, 1, handAfter.length + 1);
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
          eclatsGained: eclatsReward("constellation", youWon ? "win" : "loss"),
          youCardsPlayed: youCardsPlayedRef.current.slice(),
          oppCardsPlayed: oppCardsPlayedRef.current.slice(),
        });
      }, ROUND_PAUSE_MS);
    } else if (riposteWillFire) {
      window.setTimeout(() => {
        setRiposteData({ lane: myRiposteLane as LaneTarget, phase: "pick" });
      }, ROUND_PAUSE_MS);
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
      window.setTimeout(() => startNextRound(), ROUND_PAUSE_MS);
    }
  }

  function rematch() {
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
    const fresh = makeBattle(savedDeck);
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

  /* ──────────── Riposte sub-phase ──────────── */

  /** Player picks the rematch move. We then roll the CPU's counter and run
   *  the suspense reveal, then apply the flip and either start the next
   *  round or end the match (depending on the recalculated score). */
  function handleRipostePick(move: Move) {
    if (!riposteData || riposteData.phase !== "pick") return;
    hapticLock();
    const cpuPlay = cpuRankedDecision(
      {
        mood: moodRef.current,
        difficulty,
        playerHistory: playerHistoryRef.current,
        mana: 1,
        hand: [],
      },
      1,
    );
    const cpuMove = cpuPlay.plays[0].mv;
    // Determine outcome of the rematch.
    const aBeatsB = rpslsBeats(move, cpuMove);
    const bBeatsA = rpslsBeats(cpuMove, move);
    const playerWonRematch = !!aBeatsB && !bBeatsA;
    setRiposteData({
      lane: riposteData.lane,
      phase: "reveal",
      playerMove: move,
      cpuMove,
      flipped: playerWonRematch,
    });
    window.setTimeout(() => {
      if (playerWonRematch) hapticWin(); else if (bBeatsA) hapticLoss(); else hapticTap();
    }, REVEAL_SUSPENSE_MS);
    // After a short pause, apply the flip and proceed.
    window.setTimeout(() => applyRiposteOutcome(playerWonRematch), ROUND_PAUSE_MS);
  }

  /** Apply the lane flip (if the rematch was won), recompute the round
   *  winner, then either start the next round or end the match. */
  function applyRiposteOutcome(playerWonRematch: boolean) {
    if (!riposteData || !lastResult) {
      setRiposteData(null);
      window.setTimeout(() => startNextRound(), 200);
      return;
    }
    if (!playerWonRematch) {
      // Lane stays as a loss — just continue.
      setRiposteData(null);
      const nextWinsA = lastResult.roundWinsYou;
      const nextWinsB = lastResult.roundWinsOpp;
      if (nextWinsA >= winTo || nextWinsB >= winTo) {
        finalizeMatch(nextWinsA, nextWinsB);
      } else {
        startNextRound();
      }
      return;
    }
    // Flip the targeted lane from "b" to "a", recount the round winner,
    // and patch lastResult + battle scores so the UI reflects the change.
    const flippedLanes = lastResult.laneResults.map((lr, i) =>
      i === riposteData.lane
        ? { ...lr, winner: "a" as const, points: 1 }
        : lr,
    );
    const aWins = flippedLanes.filter((l) => l.winner === "a").length;
    const bWins = flippedLanes.filter((l) => l.winner === "b").length;
    const newRoundWinner: "a" | "b" | "draw" =
      aWins > bWins ? "a" : bWins > aWins ? "b" : "draw";
    // Score delta from the original round outcome → the new one.
    const origRoundWinner = lastResult.roundWinner;
    let deltaA = 0, deltaB = 0;
    if (newRoundWinner === "a" && origRoundWinner !== "a") {
      deltaA = 1;
      if (origRoundWinner === "b") deltaB = -1;
    } else if (newRoundWinner === "b" && origRoundWinner !== "b") {
      deltaB = 1;
      if (origRoundWinner === "a") deltaA = -1;
    } else if (newRoundWinner === "draw") {
      if (origRoundWinner === "a") deltaA = -1;
      if (origRoundWinner === "b") deltaB = -1;
    }
    const nextWinsA = Math.max(0, lastResult.roundWinsYou + deltaA);
    const nextWinsB = Math.max(0, lastResult.roundWinsOpp + deltaB);
    setBattle((b) => ({
      ...b,
      roundWinsA: Math.max(0, b.roundWinsA + deltaA),
      roundWinsB: Math.max(0, b.roundWinsB + deltaB),
    }));
    setLastResult((prev) => prev ? {
      ...prev,
      laneResults: flippedLanes,
      roundWinner: newRoundWinner,
      roundWinsYou: nextWinsA,
      roundWinsOpp: nextWinsB,
    } : prev);
    wonLastRoundRef.current = newRoundWinner === "a";
    setRiposteData(null);
    if (nextWinsA >= winTo || nextWinsB >= winTo) {
      finalizeMatch(nextWinsA, nextWinsB);
    } else {
      window.setTimeout(() => startNextRound(), ROUND_PAUSE_MS / 2);
    }
  }

  /* ──────────── Sudden-death sub-phase ──────────── */

  /** Player picks one move; CPU answers. A clean win takes the round point; a
   *  duel-tie re-picks until decided. */
  function handleSuddenDeathPick(move: Move) {
    if (!suddenDeathData || suddenDeathData.phase !== "pick") return;
    hapticLock();
    const cpuPlay = cpuRankedDecision(
      { mood: moodRef.current, difficulty, playerHistory: playerHistoryRef.current, mana: 1, hand: [] },
      1,
    );
    const cpuMove = cpuPlay.plays[0].mv;
    const playerWins = rpslsBeats(move, cpuMove);
    const cpuWins = rpslsBeats(cpuMove, move);
    if (!playerWins && !cpuWins) {
      // Duel tied → flash it, then re-pick — short delay, the player is
      // already locked in.
      setSuddenDeathData({ phase: "reveal", round: suddenDeathData.round, playerMove: move, cpuMove, winner: null });
      window.setTimeout(() => hapticTap(), 350);
      window.setTimeout(() => setSuddenDeathData({ phase: "pick", round: roundNoRef.current }), SUDDEN_DEATH_DUEL_TIE_MS);
      return;
    }
    const winner: "a" | "b" = playerWins ? "a" : "b";
    setSuddenDeathData({ phase: "reveal", round: suddenDeathData.round, playerMove: move, cpuMove, winner });
    window.setTimeout(() => { if (winner === "a") hapticWin(); else hapticLoss(); }, 300);
    window.setTimeout(() => applySuddenDeath(winner), SUDDEN_DEATH_POST_MS);
  }

  /** Award the broken-tie round point to the duel winner, then continue/finish. */
  function applySuddenDeath(winner: "a" | "b") {
    if (!lastResult) {
      setSuddenDeathData(null);
      window.setTimeout(() => startNextRound(), 200);
      return;
    }
    const deltaA = winner === "a" ? 1 : 0;
    const deltaB = winner === "b" ? 1 : 0;
    const nextWinsA = lastResult.roundWinsYou + deltaA;
    const nextWinsB = lastResult.roundWinsOpp + deltaB;
    setBattle((b) => ({ ...b, roundWinsA: b.roundWinsA + deltaA, roundWinsB: b.roundWinsB + deltaB }));
    setLastResult((prev) => prev ? { ...prev, roundWinner: winner, roundWinsYou: nextWinsA, roundWinsOpp: nextWinsB } : prev);
    wonLastRoundRef.current = winner === "a";
    setSuddenDeathData(null);
    if (nextWinsA >= winTo || nextWinsB >= winTo) {
      finalizeMatch(nextWinsA, nextWinsB);
    } else {
      window.setTimeout(() => startNextRound(), ROUND_PAUSE_MS / 2);
    }
  }

  /** Helper shared by the normal end-of-match path and the post-Riposte
   *  path: record the result + show the cinematic end screen. */
  function finalizeMatch(winsA: number, winsB: number) {
    const youWon = winsA > winsB;
    recordMatch({
      id: `ranked-cpu-${Date.now()}`,
      mode: "constellation",
      bestOf: winTo,
      opponent: { kind: "cpu", mood: moodRef.current },
      scorePlayer: winsA,
      scoreOpponent: winsB,
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
        roundWinsYou: winsA,
        roundWinsOpp: winsB,
        forfeit: false,
        xpGained: youWon ? 60 : 15,
        eclatsGained: eclatsReward("constellation", youWon ? "win" : "loss"),
        youCardsPlayed: youCardsPlayedRef.current.slice(),
        oppCardsPlayed: oppCardsPlayedRef.current.slice(),
      });
    }, ROUND_PAUSE_MS);
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
    if (!end) {
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
    if (onMatchResult) onMatchResult(false);
    else onQuit();
  }

  return (
    <>
      <RankedMatchView
        nickname={profileNickname}
        match={matchInfo}
        round={round}
        lastResult={lastResult}
        end={end}
        picks={picks}
        cardPlayed={cardPlayed}
        augurRevealed={augurRevealed}
        mana={mana}
        manaMax={(battle.passives.includes("cadence") ? 5 : MAX_MANA) + manaMaxBoostRef.current}
        passives={battle.passives}
        braiseStacks={braiseStacks}
        activeEffects={{
          mascaradePoison,
          bonusManaNext,
          cascadeArmed,
          echoActive,
          anchorRoundsLeft,
          gaiaCharged,
        }}
        compassRevealed={compassRevealed}
        oracleRevealed={oracleRevealed}
        oppHandRevealed={oppHandRevealed}
        hand={battle.hand}
        oppHandSize={battle.oppHandSize}
        roundWinsYou={battle.roundWinsA}
        roundWinsOpp={battle.roundWinsB}
        augurCooldown={augurCooldown}
        onPickMove={handlePickMove}
        onClearLane={handleClearLane}
        onPlayCard={handlePlayCard}
        onCancelCard={handleCancelCard}
        onLock={handleLock}
        revealAugurFor={revealAugurFor}
        onLeave={handleLeave}
        onRematch={onMatchResult ? undefined : rematch}
        onNext={onMatchResult && end ? () => onMatchResult(end.winner === "a") : undefined}
        showTimer={false}
      />
      {riposteData && (
        <RiposteOverlay
          data={riposteData}
          onPick={handleRipostePick}
        />
      )}
      {suddenDeathData && (
        <SuddenDeathOverlay
          data={suddenDeathData}
          onPick={handleSuddenDeathPick}
        />
      )}
    </>
  );
}

/* ──────────── Riposte sub-phase UI ──────────── */

import { MoveGlyph, MOVE_PALETTE } from "../icons";

const LANE_LABEL = ["FORCE", "SAGESSE", "RUSE"] as const;
const RANKED_MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

function RiposteOverlay({
  data,
  onPick,
}: {
  data: { lane: LaneTarget; phase: "pick" | "reveal"; playerMove?: Move; cpuMove?: Move; flipped?: boolean };
  onPick: (mv: Move) => void;
}) {
  const verdict = data.phase === "reveal" && data.playerMove && data.cpuMove
    ? data.flipped ? "win"
      : data.playerMove === data.cpuMove ? "draw"
      : "loss"
    : null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-amber-300 mb-1.5">
        Riposte
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1 text-center">
        Rejoue la lane {LANE_LABEL[data.lane]}
      </div>
      <div className="text-xs sm:text-sm text-ink-muted mb-6 max-w-xs text-center">
        Gagne ce duel pour flipper la défaite en victoire.
      </div>
      {data.phase === "pick" && (
        <div className="grid grid-cols-5 gap-2 w-full max-w-md">
          {RANKED_MOVES.map((mv) => {
            const pal = MOVE_PALETTE[mv];
            return (
              <button
                key={mv}
                onClick={() => onPick(mv)}
                className={
                  "aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-1 py-1.5 transition active:scale-92 " +
                  "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring + " " + pal.glow +
                  " text-zinc-900 shadow-md"
                }
              >
                <MoveGlyph move={mv} className="w-7 h-7" />
                <span className="text-[8px] uppercase tracking-wider font-bold leading-none">{mv}</span>
              </button>
            );
          })}
        </div>
      )}
      {data.phase === "reveal" && data.playerMove && data.cpuMove && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">Toi</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.playerMove].from + " " + MOVE_PALETTE[data.playerMove].to +
                " ring-2 " + MOVE_PALETTE[data.playerMove].ring}>
                <MoveGlyph move={data.playerMove} className="w-9 h-9" />
              </div>
            </div>
            <div className="text-3xl font-black text-ink-faint">vs</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-rose-300">CPU</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.cpuMove].from + " " + MOVE_PALETTE[data.cpuMove].to +
                " ring-2 " + MOVE_PALETTE[data.cpuMove].ring}>
                <MoveGlyph move={data.cpuMove} className="w-9 h-9" />
              </div>
            </div>
          </div>
          <div className={
            "text-xl sm:text-2xl font-black " +
            (verdict === "win" ? "text-emerald-300" :
             verdict === "loss" ? "text-rose-300" : "text-ink-muted")
          }>
            {verdict === "win" ? "Lane flippée — victoire !"
              : verdict === "loss" ? "Riposte perdue, défaite conservée."
              : "Égalité — la défaite reste."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────── Sudden-death sub-phase UI ──────────── */

function SuddenDeathOverlay({
  data,
  onPick,
}: {
  data: { phase: "pick" | "reveal"; round: number; playerMove?: Move; cpuMove?: Move; winner?: "a" | "b" | null };
  onPick: (mv: Move) => void;
}) {
  const verdict = data.phase === "reveal"
    ? data.winner === "a" ? "win" : data.winner === "b" ? "loss" : "draw"
    : null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md px-4"
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
        animate={{
          scale: [0.4, 1.18, 1],
          opacity: 1,
          rotate: [-6, 4, 0],
        }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="text-3xl sm:text-5xl font-black tracking-[0.12em] mb-1.5 text-center bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent"
        style={{ filter: "drop-shadow(0 2px 16px rgba(244,63,94,0.55))" }}
      >
        MORT SUBITE
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.25 }}
        className="text-xs sm:text-sm text-ink-muted mb-6 max-w-xs text-center"
      >
        Match point des deux côtés — un seul coup décide tout.
      </motion.div>
      {data.phase === "pick" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.25 }}
          className="grid grid-cols-5 gap-2 w-full max-w-md"
        >
          {RANKED_MOVES.map((mv, i) => {
            const pal = MOVE_PALETTE[mv];
            return (
              <motion.button
                key={mv}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.05, duration: 0.2 }}
                onClick={() => onPick(mv)}
                className={
                  "aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-1 py-1.5 transition active:scale-92 " +
                  "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring + " " + pal.glow +
                  " text-zinc-900 shadow-md"
                }
              >
                <MoveGlyph move={mv} className="w-7 h-7" />
                <span className="text-[8px] uppercase tracking-wider font-bold leading-none">{mv}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
      {data.phase === "reveal" && data.playerMove && data.cpuMove && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.7 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">Toi</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.playerMove].from + " " + MOVE_PALETTE[data.playerMove].to +
                " ring-2 " + MOVE_PALETTE[data.playerMove].ring}>
                <MoveGlyph move={data.playerMove} className="w-9 h-9" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: [0.5, 1.3, 1] }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="text-3xl font-black text-ink-faint"
            >
              vs
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.7 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[10px] uppercase tracking-wider text-rose-300">CPU</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.cpuMove].from + " " + MOVE_PALETTE[data.cpuMove].to +
                " ring-2 " + MOVE_PALETTE[data.cpuMove].ring}>
                <MoveGlyph move={data.cpuMove} className="w-9 h-9" />
              </div>
            </motion.div>
          </div>
          <motion.div
            key={verdict ?? "none"}
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{
              opacity: 1,
              scale: verdict === "draw" ? 1 : [0.6, 1.25, 1],
              y: 0,
              x: verdict === "win" ? [0, -3, 3, -2, 2, 0] : verdict === "loss" ? [0, 2, -2, 1, -1, 0] : 0,
            }}
            transition={{ delay: 0.35, duration: verdict === "draw" ? 0.25 : 0.5, type: "spring", stiffness: 240, damping: 14 }}
            className={
              "text-xl sm:text-3xl font-black tracking-wide text-center px-3 py-1 rounded-lg " +
              (verdict === "win"
                ? "text-emerald-200 bg-emerald-500/15 ring-1 ring-emerald-400/40"
                : verdict === "loss"
                ? "text-rose-200 bg-rose-500/15 ring-1 ring-rose-400/40"
                : "text-ink-muted")
            }
            style={
              verdict === "win"
                ? { filter: "drop-shadow(0 0 18px rgba(52,211,153,0.55))" }
                : verdict === "loss"
                ? { filter: "drop-shadow(0 0 14px rgba(244,63,94,0.45))" }
                : undefined
            }
          >
            {verdict === "win" ? "Tu remportes la manche !"
              : verdict === "loss" ? "Manche perdue en mort subite."
              : "Encore égalité — on rejoue !"}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
