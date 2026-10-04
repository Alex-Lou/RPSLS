import { useRef, useState } from "react";
import type { AiMood, Move } from "../../engine/game";
import type { Rng } from "../../engine/rng";
import { useStore } from "../../store/store";
import type { RankedRoundData, RankedRoundResultData, RankedEndData } from "../RankedMatchView";
import type { CardId, CpuRoundDecision, LaneTarget, PlayedCard, RankedBattleState } from "../rankedTypes";
import { makeBattle } from "./rankedGameHelpers";
import { ROUND_PAUSE_MS } from "./rankedGameConstants";
import { usePickPhase } from "./usePickPhase";

/**
 * useRankedGameState — DÉCLARATIONS d'état du match Classé (round, picks,
 * carte jouée, révélations, mana, battle, fin de match, sous-phases Riposte /
 * Mort subite) + refs internes (jamais transmises aux enfants). Extrait VERBATIM
 * de RankedGame, MÊME ordre de hooks. Aucune logique de match / timing ici :
 * l'orchestrateur destructure le retour aux MÊMES noms.
 */
export function useRankedGameState(savedDeck: Parameters<typeof makeBattle>[0], rng: Rng) {
  /* ──────────── State ──────────── */
  const [round, setRound] = useState<RankedRoundData | null>(null);
  const { picks, setPicks, handlePickMove, handleClearLane } = usePickPhase();
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
  const [battle, setBattle] = useState<RankedBattleState>(() => makeBattle(savedDeck, rng));
  // Toujours le DERNIER état rendu. startNextRound est appelé depuis des
  // setTimeout programmés plusieurs secondes avant : il lisait la main/pioche
  // d'AVANT la résolution (closure périmée) puis l'écrasait → la carte jouée
  // revenait en main, la défausse s'annulait, le reset de Genèse / du rematch
  // était perdu.
  // Réglage « combat rapide » (Profil) : pause post-manche raccourcie (lue au
  // moment où chaque délai est programmé).
  const fastCombat = useStore((s) => s.player.fastCombat);
  const roundPauseMs = fastCombat ? Math.round(ROUND_PAUSE_MS * 0.6) : ROUND_PAUSE_MS;
  const battleRef = useRef(battle);
  battleRef.current = battle;
  // Issue déjà enregistrée pour CE match (victoire/défaite), en attendant
  // l'écran de fin (5,5 s plus tard) : sans ça, Retour → Forfait pendant ce
  // délai enregistrait EN PLUS une défaite par forfait.
  const recordedOutcomeRef = useRef<"win" | "loss" | null>(null);
  const leftRef = useRef(false);
  const aliveRef = useRef(true);
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

  return {
    round, setRound,
    picks, setPicks, handlePickMove, handleClearLane,
    cardPlayed, setCardPlayed,
    youCardsPlayedRef, oppCardsPlayedRef,
    augurRevealed, setAugurRevealed,
    oracleRevealed, setOracleRevealed,
    compassRevealed, setCompassRevealed,
    pharePendingRef,
    mana, setMana,
    battle, setBattle,
    roundPauseMs, battleRef,
    recordedOutcomeRef, leftRef, aliveRef,
    lastResult, setLastResult,
    end, setEnd,
    riposteData, setRiposteData,
    suddenDeathData, setSuddenDeathData,
    cpuDecisionRef, playerHistoryRef, moodRef, roundNoRef, deadlineTimerRef, wonLastRoundRef,
    augurCooldown, setAugurCooldown,
    compensationDrawNextRef, cpuOneShotsRef,
  };
}
