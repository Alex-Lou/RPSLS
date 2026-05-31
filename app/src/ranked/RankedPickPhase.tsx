/**
 * RankedPickPhase — picking + card targeting UI.
 *
 * Augur targets OPPONENT lanes (top row). Aegis/Surge target YOUR lanes
 * (bottom row). Layout mirrors Constellation casual spacing.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MOVES, type Move } from "../game";
import { MOVE_ICON, MOVE_PALETTE } from "../icons";
import { hapticAlert, hapticTap } from "../haptic";
import { hapticTick, PickShock } from "../sharedMatchUI";
import { useT } from "../i18n";
import { LanesBoard } from "./LanesBoard";
import { CardHand } from "./CardHand";
import { ManaBar } from "./ManaBar";
import { CARDS } from "./cards";
import type { CardId, LaneTarget, PlayedCard } from "./rankedTypes";

export interface RankedPickPhaseProps {
  youName: string;
  opponentName: string;
  picks: [Move | null, Move | null, Move | null];
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  cardPlayed: PlayedCard | null;
  mana: number;
  hand: CardId[];
  oppHandSize: number;
  augurCooldown: number;
  startedAt: number;
  deadlineMs: number;
  onPickMove: (mv: Move) => void;
  onPlayCard: (card: PlayedCard) => void;
  onCancelCard: () => void;
  onClearLane: (lane: LaneTarget) => void;
  onLock: () => void;
  revealAugurFor: (lane: LaneTarget) => Move;
}

export function RankedPickPhase({
  youName, opponentName,
  picks, augurRevealed, cardPlayed, mana, hand, oppHandSize, augurCooldown,
  startedAt, deadlineMs,
  onPickMove, onPlayCard, onCancelCard, onClearLane, onLock,
  revealAugurFor,
}: RankedPickPhaseProps) {
  const t = useT();
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);

  const allFilled = picks.every((p) => p !== null);
  const remaining = 3 - picks.filter(Boolean).length;
  const reservedMana = cardPlayed ? CARDS[cardPlayed.id].cost : 0;
  const isAugurTargeting = selectedCard === "augur";
  const isOracleTargeting = selectedCard === "oracle";
  const [echoFromLane, setEchoFromLane] = useState<LaneTarget | null>(null);

  function handleMyLaneTap(lane: LaneTarget) {
    if (selectedCard) {
      const card = CARDS[selectedCard];
      if (card.target === "lane") {
        onPlayCard({ id: selectedCard as "aegis" | "surge" | "precision" | "anchor" | "curse" | "tide", lane });
        setSelectedCard(null);
      } else if (card.target === "lane-copy") {
        // Echo: first tap = source, second tap = target
        if (echoFromLane === null) {
          setEchoFromLane(lane);
        } else if (echoFromLane !== lane) {
          onPlayCard({ id: "echo", fromLane: echoFromLane, toLane: lane });
          setSelectedCard(null);
          setEchoFromLane(null);
        }
      }
      return;
    }
    if (picks[lane]) onClearLane(lane);
  }

  function handleOppLaneTap(lane: LaneTarget) {
    if (isAugurTargeting) {
      const revealed = revealAugurFor(lane);
      onPlayCard({ id: "augur", lane, revealed });
      setSelectedCard(null);
    }
  }

  function handleSelectCard(id: CardId | null) {
    if (cardPlayed) onCancelCard();
    setEchoFromLane(null);
    const card = id ? CARDS[id] : null;
    // Cards with no lane target: activate immediately
    if (card && (card.target === "lane-reveal-all" || card.target === "lane-rotate" || card.target === "self" || card.target === "gamble")) {
      if (id === "oracle") {
        const r: [Move, Move, Move] = [revealAugurFor(0), revealAugurFor(1), revealAugurFor(2)];
        onPlayCard({ id: "oracle", revealed: r });
      } else if (id === "vortex") {
        onPlayCard({ id: "vortex" });
      } else if (id === "supernova") {
        onPlayCard({ id: "supernova" });
      } else if (id === "second-wind") {
        onPlayCard({ id: "second-wind" });
      } else if (id === "tide") {
        // Tide targets "self" but we store a dummy lane 0
        onPlayCard({ id: "tide", lane: 0 as LaneTarget });
      }
      return;
    }
    setSelectedCard(id);
  }

  function handleLock() {
    if (!allFilled) return;
    if (selectedCard && !cardPlayed) { setSelectedCard(null); setEchoFromLane(null); }
    onLock();
  }

  const targetingHint = (() => {
    if (!selectedCard) return null;
    const card = CARDS[selectedCard];
    if (card.target === "lane-reveal") return t("ranked.cta.augurReveal");
    if (card.target === "lane-copy") return echoFromLane === null ? t("ranked.cards.echo.targetHint") : "Touche la lane cible";
    return t("ranked.cta.playCard");
  })();

  return (
    <div className="w-full h-full flex flex-col items-center gap-1.5 sm:gap-3 pb-2 sm:pb-3">
      <TimerBar startedAt={startedAt} durationMs={deadlineMs} />

      {/* Mana + Cards strip — top zone, always visible */}
      <div className="w-full max-w-md flex items-center gap-2 px-1">
        <ManaBar mana={mana} spent={reservedMana} />
        <div className="flex-1 min-w-0">
          <CardHand
            hand={hand}
            mana={mana}
            selected={selectedCard}
            playedId={cardPlayed?.id ?? null}
            onSelect={handleSelectCard}
            disabled={false}
            augurCooldown={augurCooldown}
          />
        </div>
      </div>

      {/* Targeting hint */}
      <AnimatePresence>
        {targetingHint && (
          <motion.div
            key={targetingHint}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold flex items-center gap-1.5"
          >
            {targetingHint}
            <button
              onClick={() => setSelectedCard(null)}
              className="px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/15 text-[9px]"
            >
              {t("ranked.cta.cancelCard")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <LanesBoard
          youName={youName}
          opponentName={opponentName}
          picks={picks}
          oppPicks={null}
          augurRevealed={augurRevealed}
          myCard={cardPlayed}
          oppCard={null}
          mode="picking"
          oppHandSize={oppHandSize}
          onLaneClick={handleMyLaneTap}
          onOppLaneClick={handleOppLaneTap}
          augurTargeting={isAugurTargeting || isOracleTargeting}
        />
      </div>

      {/* Moves + Lock — bottom zone */}
      <PickerBar onPickInNextEmpty={onPickMove} />

      <button
        onClick={handleLock}
        disabled={!allFilled}
        className={
          "shrink-0 mt-1 sm:mt-2 px-7 py-2.5 rounded-2xl font-bold text-white text-sm transition " +
          (allFilled
            ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-teal-400 shadow-lg shadow-violet-500/30 hover:scale-[1.02]"
            : "bg-white/5 text-zinc-500 cursor-not-allowed")
        }
      >
        {allFilled ? t("lanes.lockButton") : t("lanes.pickRemaining", { n: remaining })}
      </button>
    </div>
  );
}

function PickerBar({ onPickInNextEmpty }: { onPickInNextEmpty: (m: Move) => void }) {
  const [shockMove, setShockMove] = useState<Move | null>(null);
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md">
      {MOVES.map((mv, i) => {
        const Icon = MOVE_ICON[mv];
        const pal = MOVE_PALETTE[mv];
        return (
          <motion.button
            key={mv}
            onClick={() => {
              hapticTick();
              setShockMove(mv);
              setTimeout(() => setShockMove((cur) => (cur === mv ? null : cur)), 450);
              onPickInNextEmpty(mv);
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.86 }}
            className={
              "relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 " +
              "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring + " " + pal.glow +
              " text-zinc-900 shadow-md transition"
            }
          >
            <PickShock show={shockMove === mv} />
            <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
            <span className="text-[8px] uppercase tracking-wider font-bold leading-none">{mv}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function TimerBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  const prevLevel = useRef<"calm" | "urgent" | "critical">("calm");
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remaining / durationMs));
  const urgent = remaining < 3000 && remaining > 0;
  const critical = remaining < 1000 && remaining > 0;
  const level: "calm" | "urgent" | "critical" = critical ? "critical" : urgent ? "urgent" : "calm";
  useEffect(() => {
    if (level !== prevLevel.current) {
      if (level === "urgent") hapticTap();
      if (level === "critical") hapticAlert();
      prevLevel.current = level;
    }
  }, [level]);
  const color = critical ? "bg-rose-500" : urgent ? "bg-amber-400" : "bg-violet-400";
  const num = Math.ceil(remaining / 1000);
  return (
    <div className="w-full max-w-md flex items-center gap-3">
      <motion.span
        key={num}
        initial={{ scale: critical ? 1.4 : 1 }}
        animate={{ scale: 1 }}
        className={"text-sm font-mono tabular-nums w-10 text-right font-bold " +
          (critical ? "text-rose-300" : urgent ? "text-amber-300" : "text-zinc-300")}
      >{num}s</motion.span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={"h-full " + color}
          animate={{ width: `${(progress * 100).toFixed(1)}%`, opacity: critical ? [0.5, 1, 0.5] : 1 }}
          transition={{ width: { duration: 0.1, ease: "linear" }, opacity: critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.1 } }}
        />
      </div>
      {urgent && !critical && (
        <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">{tr("lanes.hurry")}</span>
      )}
    </div>
  );
}
