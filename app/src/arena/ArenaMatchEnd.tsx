/**
 * ArenaMatchEnd — celebration screen after a Constellation Pro match.
 *
 * Cinematic VICTOIRE / DÉFAITE / ÉGALITÉ with reward chip, match stats
 * summary and clear "Rejouer" + "Retour au menu" CTAs. Extracted to its
 * own file so ArenaGame stays under the 400-line ceiling and so this
 * polish can grow (anim, particles, mastery XP, etc.) without bloating
 * the orchestrator.
 *
 * Reward economy mirrors the recordArenaMatch store action (ARENA_ECLATS).
 * Numbers shown here are display-only — the actual credit happened in the
 * store (or on the server, online) before this screen mounted.
 */

import { motion } from "motion/react";
import { useStore } from "../store/store";
import { useT } from "../i18n";
import { ARENA_ECLATS, ARENA_XP } from "../engine/economy";
import type { BoardState, Side } from "./arenaTypes";

export interface ArenaMatchEndProps {
  board: BoardState;
  /** Camp du joueur LOCAL (en ligne, le serveur peut lui donner « b »). */
  mySide: Side;
  onQuit: () => void;
  /** Absent = pas de revanche proposée (en ligne : la session est close). */
  onRematch?: () => void;
}

export function ArenaMatchEnd({ board, mySide, onQuit, onRematch }: ArenaMatchEndProps) {
  const t = useT();
  const me = board[mySide];
  const opp = board[mySide === "a" ? "b" : "a"];
  const playerName = useStore((s) => s.player.nickname) || t("lanes.you");
  const meDead = me.hp <= 0;
  const oppDead = opp.hp <= 0;
  const youWon = oppDead && !meDead;
  const draw = meDead && oppDead;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : youWon ? "win" : "loss";

  const title = draw ? t("lanes.endDraw") : youWon ? t("lanes.victory") : t("lanes.defeat");
  const titleColor = draw ? "text-zinc-300" : youWon ? "text-emerald-300" : "text-rose-300";
  const auraColor =
    draw ? "rgba(161,161,170,0.4)" :
    youWon ? "rgba(52,211,153,0.55)" :
    "rgba(244,63,94,0.55)";
  const subtitle =
    draw ? t("arena.end.subDraw")
    : youWon ? t("arena.end.subWin", { name: playerName })
    : t("arena.end.subLoss");

  const reward = ARENA_ECLATS[outcome];
  const xpGained = ARENA_XP[outcome];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 relative overflow-hidden">
      {/* Pulsing aura behind the title — outcome-tinted radial. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            `radial-gradient(50% 40% at 50% 45%, ${auraColor} 0%, rgba(0,0,0,0) 70%)`,
            `radial-gradient(58% 48% at 50% 45%, ${auraColor} 0%, rgba(0,0,0,0) 70%)`,
            `radial-gradient(50% 40% at 50% 45%, ${auraColor} 0%, rgba(0,0,0,0) 70%)`,
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Title — big, cinematic */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 30 }}
        animate={{
          scale: youWon ? [0.5, 1.3, 1, 1.05, 1] : [0.5, 1.15, 1],
          opacity: 1,
          y: 0,
        }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={"relative text-5xl sm:text-7xl font-black tracking-[0.12em] " + titleColor}
        style={{ filter: "drop-shadow(0 4px 24px " + auraColor + ")" }}
      >
        {title}
      </motion.div>

      {/* Subtitle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="text-sm text-ink-muted text-center"
      >
        {subtitle}
      </motion.div>

      {/* Stats line */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="flex items-center gap-4 text-xs text-ink"
      >
        <div className="flex flex-col items-center">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted">{t("lanes.you")}</span>
          <span className={"font-black text-base " + (youWon ? "text-emerald-300" : "text-white")}>
            ❤ {me.hp}
          </span>
        </div>
        <div className="text-ink-faint">vs</div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted">{t("arena.end.opp")}</span>
          <span className={"font-black text-base " + (youWon ? "text-rose-300/70" : "text-rose-300")}>
            ❤ {opp.hp}
          </span>
        </div>
        <div className="text-ink-faint">·</div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted">{t("arena.end.turn")}</span>
          <span className="font-black text-base text-sky-300">{board.turn}</span>
        </div>
      </motion.div>

      {/* Eclats reward chip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.85, type: "spring", stiffness: 240, damping: 20 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/30 to-sky-500/15 ring-2 ring-cyan-400/50 shadow-lg"
      >
        <span className="text-xl">💎</span>
        <span className="text-cyan-100 font-black text-sm tabular-nums">+{reward}</span>
        <span className="text-[10px] text-cyan-200 uppercase tracking-wider">{t("arena.end.eclats")}</span>
        <span className="text-cyan-200/40">·</span>
        <span className="text-amber-200 font-black text-sm tabular-nums">+{xpGained}</span>
        <span className="text-[10px] text-amber-200 uppercase tracking-wider">XP</span>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.3 }}
        className="flex items-center gap-2 mt-2"
      >
        {onRematch && <button
          onClick={onRematch}
          className="px-5 py-2.5 rounded-2xl font-bold text-white text-sm shadow-lg"
          style={{
            background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
            boxShadow: "0 8px 24px -8px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.06em",
          }}
        >
          {t("lanes.rematch")}
        </button>}
        <button
          onClick={onQuit}
          className="px-5 py-2.5 rounded-2xl font-bold text-ink-muted hover:text-white text-sm bg-hairline ring-1 ring-hairline"
        >
          {t("lanes.backToMenu")}
        </button>
      </motion.div>
    </div>
  );
}
