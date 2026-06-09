/**
 * ArenaSuddenDeath — Round 10 VRAI BUT D'OR.
 *
 * Phase tie-break déclenchée quand les 2 héros tombent à 0 HP au MÊME tour
 * (égalité parfaite). Au lieu d'un match-end "Égalité" frustrant, on bascule
 * dans une mini-arène 1-lane :
 *
 *  1. Banner cinématique "🌟 BUT D'OR — Mort subite 🌟" pulse gold.
 *  2. Player tape 1 symbole RPSLS dans un picker (5 boutons).
 *  3. CPU choisit en parallèle (random weighted bag).
 *  4. Reveal cinématique slow-mo : les 2 symboles flippent, counter check.
 *  5. Counter winner = match winner (assigne 1 HP au winner pour fix
 *     ArenaMatchResult). Mirror match (même symbole) = re-trigger sudden
 *     death récursif (autre round).
 *
 * KISS : un component autonome qui prend le board + un callback onResolved
 * (winner: "a" | "b" | null). Pas de state external, pas de spaghetti — c'est
 * l'écran de tie-break, basta.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MoveGlyph } from "../icons";
import { moveCountersMove } from "./arenaTypes";
import type { Move } from "../engine/game";
import type { Side } from "./arenaTypes";

const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
const MOVE_LABEL: Record<Move, string> = {
  rock: "Pierre",
  paper: "Feuille",
  scissors: "Ciseau",
  lizard: "Lézard",
  spock: "Spock",
};

export interface ArenaSuddenDeathProps {
  /** Callback when winner is determined. "a" = player won, "b" = CPU won.
   *  Si mirror match, on re-trigger sudden death interne (jamais null en
   *  output — la phase ne se résout pas tant qu'il n'y a pas de winner). */
  onResolved: (winner: Side) => void;
}

export function ArenaSuddenDeath({ onResolved }: ArenaSuddenDeathProps) {
  const [playerPick, setPlayerPick] = useState<Move | null>(null);
  const [cpuPick, setCpuPick] = useState<Move | null>(null);
  const [reveal, setReveal] = useState(false);
  const [round, setRound] = useState(1);

  function handlePick(move: Move) {
    if (playerPick) return; // déjà choisi ce round
    setPlayerPick(move);
    // CPU choisit en parallèle (random weighted, slight delay pour suspense)
    window.setTimeout(() => {
      // Bag du CPU : random parfait (pas de meta-tilt) — c'est de la chance.
      const cpuChoice = MOVES[Math.floor(Math.random() * MOVES.length)];
      setCpuPick(cpuChoice);
      window.setTimeout(() => setReveal(true), 400);
    }, 600);
  }

  // Reveal complete → counter check + resolve ou re-spin
  if (reveal && playerPick && cpuPick) {
    const counterAB = moveCountersMove(playerPick, cpuPick);
    const counterBA = moveCountersMove(cpuPick, playerPick);
    if (counterAB && !counterBA) {
      window.setTimeout(() => onResolved("a"), 1800);
    } else if (counterBA && !counterAB) {
      window.setTimeout(() => onResolved("b"), 1800);
    } else {
      // Mirror — re-spin
      window.setTimeout(() => {
        setPlayerPick(null);
        setCpuPick(null);
        setReveal(false);
        setRound((r) => r + 1);
      }, 2200);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-amber-950/95 via-zinc-950/97 to-amber-900/85 backdrop-blur-md">
      {/* Banner cinématique gold */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6 text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1], filter: ["drop-shadow(0 0 12px #fbbf24)", "drop-shadow(0 0 22px #fbbf24)", "drop-shadow(0 0 12px #fbbf24)"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-4xl font-black tracking-[0.3em] text-amber-300"
        >
          🌟 BUT D'OR 🌟
        </motion.div>
        <div className="mt-2 text-[12px] uppercase tracking-[0.4em] font-bold text-amber-200/80">
          Mort subite — Round {round}
        </div>
      </motion.div>

      {/* Reveal area */}
      <div className="flex items-center gap-8 mb-8">
        {/* Toi */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider font-black text-emerald-300">TOI</span>
          <div className="w-20 h-20 rounded-2xl bg-zinc-900/80 border-2 border-emerald-400/40 flex items-center justify-center">
            <AnimatePresence>
              {reveal && playerPick && (
                <motion.div
                  key={playerPick}
                  initial={{ rotateY: 90, opacity: 0, scale: 0.6 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <MoveGlyph move={playerPick} className="w-12 h-12 text-emerald-300" />
                </motion.div>
              )}
              {!reveal && playerPick && (
                <span className="text-3xl">?</span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <span className="text-2xl font-black text-amber-300/60">vs</span>
        {/* CPU */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider font-black text-rose-300">CPU</span>
          <div className="w-20 h-20 rounded-2xl bg-zinc-900/80 border-2 border-rose-400/40 flex items-center justify-center">
            <AnimatePresence>
              {reveal && cpuPick && (
                <motion.div
                  key={cpuPick}
                  initial={{ rotateY: 90, opacity: 0, scale: 0.6 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                >
                  <MoveGlyph move={cpuPick} className="w-12 h-12 text-rose-300" />
                </motion.div>
              )}
              {!reveal && cpuPick && (
                <span className="text-3xl">?</span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Player picker (caché après pick) */}
      {!playerPick && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-col items-center gap-3"
        >
          <span className="text-[11px] uppercase tracking-wider font-bold text-amber-100/70">
            Choisis ton symbole — 1 seul, aveugle
          </span>
          <div className="flex gap-2">
            {MOVES.map((move) => (
              <button
                key={move}
                onClick={() => handlePick(move)}
                className="group w-14 h-14 rounded-xl bg-zinc-900/85 border-2 border-amber-400/50 hover:border-amber-300 active:scale-95 transition-all flex items-center justify-center"
                style={{ boxShadow: "0 0 12px rgba(252,211,77,0.25)" }}
                aria-label={MOVE_LABEL[move]}
              >
                <MoveGlyph move={move} className="w-7 h-7 text-amber-200 group-hover:text-amber-100" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Waiting CPU */}
      {playerPick && !reveal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] uppercase tracking-[0.3em] font-bold text-amber-200/70 animate-pulse"
        >
          CPU réfléchit…
        </motion.div>
      )}

      {/* Result reveal */}
      {reveal && playerPick && cpuPick && (() => {
        const counterAB = moveCountersMove(playerPick, cpuPick);
        const counterBA = moveCountersMove(cpuPick, playerPick);
        const isWin = counterAB && !counterBA;
        const isLoss = counterBA && !counterAB;
        const isMirror = !isWin && !isLoss;
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.5, type: "spring", stiffness: 240, damping: 18 }}
            className="text-center"
          >
            {isWin && <div className="text-3xl font-black text-emerald-300 tracking-wider">🏆 VICTOIRE !</div>}
            {isLoss && <div className="text-3xl font-black text-rose-300 tracking-wider">💀 DÉFAITE</div>}
            {isMirror && <div className="text-2xl font-black text-amber-200 tracking-wider">⚔ Égalité — Re-spin</div>}
          </motion.div>
        );
      })()}
    </div>
  );
}
