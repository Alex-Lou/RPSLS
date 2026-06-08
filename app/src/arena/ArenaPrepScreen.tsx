/**
 * ArenaPrepScreen — pre-match preparation for Constellation Pro.
 *
 * Stages BEFORE the match begins:
 *   1. VS face-off (player avatar + name | coin | CPU persona + name)
 *   2. Animated coin flip that decides whose THEME + PAD dresses the
 *      board for this match (you win → your theme; opp wins → CPU's
 *      randomized theme + pad)
 *   3. "?" button opens the full "Comment ça marche" modal — Alex's
 *      pain: "y'a pas le temps d'apprendre pendant les matchs"
 *   4. Confirm button starts the match with the resolved theme + pad
 *
 * The component is self-contained (no external prep machinery) — once
 * the player taps "✓ COMMENCER", the parent receives the resolved
 * { coinWinner, themeId, padId } and mounts ArenaGame with the override.
 */

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { hapticTap, hapticMatchStart } from "../haptic";
import { ArenaHowItWorks } from "./ArenaHowItWorks";
import { THEMES } from "../theme/theme";
import type { PadId, ThemeId } from "../types";

/** Reasonable pool of themes the CPU can roll. Trimmed to the visually
 *  distinct ones so a coin-lost match feels different from your usual. */
const CPU_THEME_POOL: ThemeId[] = [
  "violet", "neon", "sunset", "ember", "aurora", "gold",
  "cyber", "rose", "quartz", "eclipse", "phantom",
  "emberforge", "tempus", "storm",
];
const CPU_PAD_POOL: PadId[] = [
  "cosmos", "galaxy", "neon", "cyberpunk", "casino",
  "nebula", "aurora_borealis", "casino_noir", "quantum",
  "volcanic", "eclipse", "phantom", "emberforge", "storm",
];

const CPU_PERSONA_NAMES = [
  "Sentinelle", "Oracle", "Nyx", "Spectre", "Vortex",
  "Halcyon", "Eidolon", "Crépus", "Aether", "Ravenna",
];

export interface ArenaPrepResult {
  coinWinner: "you" | "opp";
  themeId: ThemeId;
  padId: PadId;
  cpuName: string;
}

export function ArenaPrepScreen({ onConfirm, onCancel }: {
  onConfirm: (result: ArenaPrepResult) => void;
  onCancel: () => void;
}) {
  const player = useStore((s) => s.player);
  const playerName = player.nickname || "Toi";
  const playerAvatar = player.avatar;
  const playerThemeId = player.themeId ?? "violet";
  const playerPadId = player.padId;

  // CPU identity — locked once per mount so the coin flip is fair.
  const cpuRef = useRef<{ name: string; themeId: ThemeId; padId: PadId } | null>(null);
  if (!cpuRef.current) {
    cpuRef.current = {
      name: CPU_PERSONA_NAMES[Math.floor(Math.random() * CPU_PERSONA_NAMES.length)],
      themeId: CPU_THEME_POOL[Math.floor(Math.random() * CPU_THEME_POOL.length)],
      padId: CPU_PAD_POOL[Math.floor(Math.random() * CPU_PAD_POOL.length)],
    };
  }
  const cpu = cpuRef.current;

  // Coin state — resolved randomly at flip-time.
  const [phase, setPhase] = useState<"idle" | "flipping" | "landed">("idle");
  const [winner, setWinner] = useState<"you" | "opp" | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  function flip() {
    if (phase !== "idle") return;
    hapticTap();
    const w: "you" | "opp" = Math.random() < 0.5 ? "you" : "opp";
    setWinner(w);
    setPhase("flipping");
    window.setTimeout(() => setPhase("landed"), 1_600);
  }

  function confirm() {
    if (phase !== "landed" || !winner) return;
    hapticMatchStart();
    onConfirm({
      coinWinner: winner,
      themeId: winner === "you" ? playerThemeId : cpu.themeId,
      padId: winner === "you" ? playerPadId : cpu.padId,
      cpuName: cpu.name,
    });
  }

  // NO auto-flip — Alex's pain: "y'a pas le temps d'apprendre pendant les
  // matchs" → the prep screen exists exactly to give time. The player taps
  // the coin (or the "?" button to read rules) when they're ready.

  const youTheme = THEMES[playerThemeId];
  const oppTheme = THEMES[cpu.themeId];

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center min-h-0 p-3 gap-4">
      <h2 className="text-center text-[11px] uppercase tracking-[0.3em] font-black text-emerald-300/90">
        ⚔ Pré-match · Constellation Pro
      </h2>

      {/* VS face-off + coin */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <Portrait name={playerName} avatar={playerAvatar} side="you" themeColor={youTheme?.primary ?? "#a78bfa"} highlight={phase === "landed" && winner === "you"} />
        <SimpleCoin phase={phase} winner={winner} youColor={youTheme?.primary ?? "#a78bfa"} oppColor={oppTheme?.primary ?? "#f43f5e"} onTap={flip} />
        <Portrait name={cpu.name} avatar={undefined} side="opp" themeColor={oppTheme?.primary ?? "#f43f5e"} highlight={phase === "landed" && winner === "opp"} />
      </div>

      {/* Idle hint — tells the player to tap the coin (or read the rules first). */}
      <AnimatePresence>
        {phase === "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-[11px] uppercase tracking-[0.2em] font-bold text-amber-300"
          >
            ↑ Touche la pièce pour lancer
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result chip — appears after the coin lands. */}
      <AnimatePresence>
        {phase === "landed" && winner && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="text-center"
          >
            <div className="text-[11px] uppercase tracking-[0.25em] font-black text-amber-300">
              {winner === "you" ? "✦ TON THÈME EST APPLIQUÉ" : "✦ THÈME DE L'ADVERSAIRE APPLIQUÉ"}
            </div>
            <div className="text-[13px] font-black mt-0.5 text-zinc-100">
              {THEMES[winner === "you" ? playerThemeId : cpu.themeId]?.label ?? "—"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action row — "?" + COMMENCER + ANNULER */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          onClick={() => { hapticTap(); setHowOpen(true); }}
          className="w-11 h-11 rounded-full bg-zinc-900 border border-emerald-700/50 text-emerald-300 text-base font-black active:scale-95 shadow-md"
          aria-label="Comment ça marche"
          title="Comment ça marche"
        >
          ?
        </button>
        <button
          onClick={confirm}
          disabled={phase !== "landed"}
          className={
            "px-6 py-2 rounded-xl font-black text-white text-sm transition " +
            (phase === "landed" ? "shadow-lg" : "bg-zinc-800 text-zinc-500 cursor-not-allowed")
          }
          style={phase === "landed" ? {
            background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
            boxShadow: "0 4px 18px -4px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.1em",
          } : undefined}
        >
          ✓ COMMENCER LE MATCH
        </button>
        <button
          onClick={() => { hapticTap(); onCancel(); }}
          className="px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-400 text-[11px] font-bold"
          aria-label="Retour menu"
        >
          ✕
        </button>
      </div>

      <p className="text-center text-[10px] text-zinc-500 max-w-sm">
        La pièce décide quel thème + pad habille le board pour ce match. Tape <span className="text-emerald-300 font-black">?</span> pour lire les règles avant de te lancer.
      </p>

      <AnimatePresence>
        {howOpen && <ArenaHowItWorks onClose={() => setHowOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Portrait ───────────────────────── */

function Portrait({ name, avatar, side, themeColor, highlight }: {
  name: string;
  avatar?: string;
  side: "you" | "opp";
  themeColor: string;
  highlight: boolean;
}) {
  const isImage = avatar && (avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:"));
  const ring = side === "you" ? "ring-emerald-400/70" : "ring-rose-400/70";
  return (
    <motion.div
      animate={highlight ? { scale: [1, 1.12, 1.05], y: [0, -4, 0] } : { scale: 1, y: 0 }}
      transition={highlight ? { duration: 0.8, ease: "easeOut" } : { duration: 0.2 }}
      className="flex flex-col items-center gap-1"
    >
      <div
        className={
          "w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 " +
          ring
        }
        style={{ boxShadow: highlight ? `0 0 18px ${themeColor}aa` : undefined }}
      >
        {isImage ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : avatar ? (
          <span className="text-4xl">{avatar}</span>
        ) : (
          <span className="text-4xl">🤖</span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <span
          className={"text-[10px] uppercase tracking-[0.2em] font-black " + (side === "you" ? "text-emerald-300" : "text-rose-300")}
        >
          {side === "you" ? "Toi" : "Adversaire"}
        </span>
        <span className="text-xs font-bold text-zinc-100 truncate max-w-[100px]">{name}</span>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── Simple Coin ───────────────────────── */

function SimpleCoin({ phase, winner, youColor, oppColor, onTap }: {
  phase: "idle" | "flipping" | "landed";
  winner: "you" | "opp" | null;
  youColor: string;
  oppColor: string;
  onTap: () => void;
}) {
  const SPINS = 5;
  const target = phase === "idle" ? 0 : SPINS * 360 + (winner === "opp" ? 180 : 0);
  const winColor = winner === "opp" ? oppColor : youColor;
  return (
    <button
      onClick={onTap}
      disabled={phase !== "idle"}
      className="relative flex items-center justify-center"
      style={{ width: 88, height: 88, perspective: 800 }}
      aria-label="Lancer la pièce"
    >
      {/* Halo */}
      <motion.div
        animate={{ opacity: phase === "landed" ? 0.7 : phase === "flipping" ? 0.4 : 0.25 }}
        transition={{ duration: 0.3 }}
        className="absolute rounded-full blur-2xl"
        style={{ width: 110, height: 110, background: `radial-gradient(circle, ${winColor}80, transparent 70%)` }}
      />
      {/* Shockwave */}
      <AnimatePresence>
        {phase === "landed" && (
          <motion.div
            initial={{ opacity: 0.7, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{ width: 70, height: 70, border: `2px solid ${winColor}` }}
          />
        )}
      </AnimatePresence>
      {/* Coin body — toss arc + spin */}
      <motion.div
        animate={
          phase === "idle"
            ? { y: [0, -5, 0] }
            : { y: [0, -55, -40, 4, 0], scale: [1, 1.12, 1.04, 1.02, 1] }
        }
        transition={
          phase === "idle"
            ? { duration: 2.4, ease: "easeInOut", repeat: Infinity }
            : { duration: 1.6, ease: [0.22, 0.68, 0.36, 1], times: [0, 0.35, 0.6, 0.9, 1] }
        }
        style={{ width: 70, height: 70, willChange: "transform" }}
        className="relative"
      >
        <motion.div
          animate={{
            rotateY: target,
            rotateX: phase === "flipping" ? [0, 18, 0] : 0,
          }}
          transition={
            phase === "idle"
              ? { duration: 0 }
              : {
                  rotateY: { duration: 1.6, ease: [0.18, 0.6, 0.32, 1] },
                  rotateX: { duration: 1.6, ease: "easeInOut" },
                }
          }
          style={{ transformStyle: "preserve-3d", width: 70, height: 70, willChange: "transform" }}
          className="relative"
        >
          {/* Face TOI */}
          <CoinFace label="TOI" bg={youColor} side="front" />
          {/* Face OPP */}
          <CoinFace label="ADV" bg={oppColor} side="back" />
        </motion.div>
      </motion.div>
    </button>
  );
}

function CoinFace({ label, bg, side }: { label: string; bg: string; side: "front" | "back" }) {
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-2xl"
      style={{
        background: `radial-gradient(circle at 30% 30%, ${bg}, ${bg}cc 55%, ${bg}66)`,
        border: "3px solid rgba(255,255,255,0.6)",
        boxShadow: `inset 0 0 12px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.5), 0 0 18px ${bg}66`,
        transform: side === "back" ? "rotateY(180deg)" : undefined,
        backfaceVisibility: "hidden",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        letterSpacing: "0.15em",
      }}
    >
      {label}
    </div>
  );
}
