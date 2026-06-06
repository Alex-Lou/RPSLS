/**
 * MatchPrepScreen — pre-match staging for a Constellation Ranked duel.
 *
 * Three jobs, all before the first round:
 *  1. Confirm your deck (mini read-only row + a "Gérer" shortcut).
 *  2. Quick-swap your battle pad on the spot (persists — "au cas où").
 *  3. Decide WHOSE theme + pad dresses the board for this match:
 *     - tap "Céder le terrain" to play on the opponent's arena, or
 *     - flip an animated coin and let fate decide.
 *
 * The winning side's `{ themeId, padId }` is handed back via `onReady` and
 * applied as a MATCH-SCOPED override (never persisted) by the caller.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { PadId, ThemeId } from "../types";
import { THEMES } from "../theme/theme";
import { useStore } from "../store/store";
import { isAvatarImage, avatarImgStyle } from "../theme/avatar";
import { hapticTap, hapticMatchStart } from "../haptic";
import { FloatingMatchBackButton, hapticTick } from "../match/sharedMatchUI";

export interface Arena {
  side: "you" | "opp";
  themeId: ThemeId;
  padId: PadId;
}

export function MatchPrepScreen({
  youName, youAvatar, youThemeId,
  oppName, oppAvatar, oppThemeId, oppPadId,
  onReady, onBack,
}: {
  youName: string;
  youAvatar: string;
  youThemeId: ThemeId;
  oppName: string;
  oppAvatar: string;
  oppThemeId: ThemeId;
  oppPadId: PadId;
  onReady: (arena: Arena) => void;
  onBack: () => void;
}) {
  // Deck is prepared earlier (in the ranked lobby), so this screen is just
  // the coin flip for the arena — no deck management here.
  const youPadId = useStore((s) => s.player.padId);

  // Coin state: idle → flipping → landed. `winner` is the resolved side.
  const [phase, setPhase] = useState<"idle" | "flipping" | "landed">("idle");
  const [winner, setWinner] = useState<"you" | "opp" | null>(null);

  const youTheme = THEMES[youThemeId];
  const oppTheme = THEMES[oppThemeId];

  function flip() {
    if (phase === "flipping") return;
    hapticTick();
    const result: "you" | "opp" = Math.random() < 0.5 ? "you" : "opp";
    setWinner(result);
    setPhase("flipping");
    // Haptic pulses during the toss
    const t1 = window.setTimeout(() => hapticTick(), 400);
    const t2 = window.setTimeout(() => hapticTick(), 900);
    // The coin animation runs ~2.6s; reveal the verdict when it settles.
    const t3 = window.setTimeout(() => {
      hapticMatchStart();
      setPhase("landed");
    }, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }

  function concede() {
    hapticTick();
    setWinner("opp");
    setPhase("landed");
  }

  function start() {
    hapticTap();
    const side = winner ?? "you";
    onReady(
      side === "you"
        ? { side: "you", themeId: youThemeId, padId: youPadId }
        : { side: "opp", themeId: oppThemeId, padId: oppPadId },
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 flex-1 min-h-0 py-2 px-3 max-w-md mx-auto w-full justify-center"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center shrink-0">
        <h1
          className="text-xl sm:text-2xl font-extrabold text-themed leading-tight"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Préparation du duel
        </h1>
      </div>

      {/* VS — you vs opponent, each with avatar + theme swatch. */}
      <div className="flex items-stretch gap-2">
        <FighterCard name={youName} avatar={youAvatar} theme={youTheme} tag="Toi" highlight={winner === "you"} />
        <div className="flex items-center text-lg font-black text-ink-faint">VS</div>
        <FighterCard name={oppName} avatar={oppAvatar} theme={oppTheme} tag="Adv." highlight={winner === "opp"} />
      </div>

      {/* Coin flip — the centrepiece. */}
      <div className="rounded-2xl bg-surface-raised border border-hairline p-3 flex flex-col items-center gap-2.5">
        <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted text-center">
          À qui le terrain ?
        </div>

        <Coin phase={phase} winner={winner} youTheme={youTheme} oppTheme={oppTheme} />

        <AnimatePresence mode="wait">
          {phase === "landed" && winner ? (
            <motion.div
              key="verdict"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-sm font-black" style={{ color: winner === "you" ? "var(--theme-primary)" : oppTheme.primary }}>
                {winner === "you" ? "Ton terrain l'emporte" : `Terrain de ${oppName}`}
              </div>
              <div className="text-[11px] text-ink-faint mt-0.5">
                {winner === "you"
                  ? "Tes couleurs et ton pad habillent le duel."
                  : "Tu joues sur le terrain adverse — adapte-toi."}
              </div>
              <div className="text-[10px] text-emerald-300 font-bold mt-1">✓ {oppName} est prêt</div>
            </motion.div>
          ) : (
            <p key="hint" className="text-[11px] text-ink-faint text-center max-w-xs">
              La pièce décide quel thème + pad habille le plateau pendant le duel.
            </p>
          )}
        </AnimatePresence>

        {phase !== "landed" ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={flip}
              disabled={phase === "flipping"}
              className="w-full max-w-xs py-3 rounded-2xl font-bold text-white bg-themed shadow-lg disabled:opacity-60"
              style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
            >
              {phase === "flipping" ? "La pièce tourne…" : "🪙 Lancer la pièce"}
            </motion.button>
            <button
              onClick={concede}
              disabled={phase === "flipping"}
              className="text-[11px] font-bold text-ink-muted hover:text-white transition disabled:opacity-40"
            >
              Céder le terrain à l'adversaire
            </button>
          </div>
        ) : (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={start}
            className="w-full max-w-xs py-3.5 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-violet-500/30 hover:scale-[1.01] transition"
            style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
          >
            Commencer le duel →
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────── Fighter card ─────────── */

function FighterCard({
  name, avatar, theme, tag, highlight,
}: {
  name: string;
  avatar: string;
  theme: { primary: string; secondary: string };
  tag: string;
  highlight: boolean;
}) {
  return (
    <motion.div
      animate={highlight ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      className={
        "flex-1 rounded-2xl p-3 flex flex-col items-center gap-1.5 border transition " +
        (highlight ? "border-white/50 shadow-lg" : "border-hairline")
      }
      style={{
        background: `linear-gradient(150deg, color-mix(in oklab, ${theme.primary} 22%, transparent), color-mix(in oklab, ${theme.secondary} 14%, transparent))`,
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl overflow-hidden ring-1 ring-white/20"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        {isAvatarImage(avatar) ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(avatar)} />
        ) : (
          <span>{avatar}</span>
        )}
      </div>
      <div className="text-[11px] font-bold truncate max-w-full">{name}</div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full" style={{ background: theme.primary }} />
        <span className="w-3 h-3 rounded-full" style={{ background: theme.secondary }} />
      </div>
      <span className="text-[8px] uppercase tracking-wider text-ink-faint font-bold">{tag}</span>
    </motion.div>
  );
}

/* ─────────── The coin ─────────── */

const COIN = 120;

function Coin({
  phase, winner, youTheme, oppTheme,
}: {
  phase: "idle" | "flipping" | "landed";
  winner: "you" | "opp" | null;
  youTheme: { primary: string; secondary: string };
  oppTheme: { primary: string; secondary: string };
}) {
  const spins = 8;
  const target = phase === "idle" ? 0 : spins * 360 + (winner === "opp" ? 180 : 0);
  const winColor = winner === "opp" ? oppTheme.primary : youTheme.primary;

  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 900, width: COIN + 48, height: COIN + 64 }}>
      {/* Dynamic drop shadow under the coin */}
      <motion.div
        aria-hidden
        animate={{
          opacity: phase === "flipping" ? [0.2, 0.06, 0.12, 0.35] : 0.25,
          scaleX: phase === "flipping" ? [1, 0.6, 0.8, 1.1] : 1,
          scaleY: phase === "flipping" ? [1, 0.4, 0.6, 1] : 1,
          y: phase === "flipping" ? [0, 40, 20, 4] : 0,
        }}
        transition={{ duration: 2.6, ease: "easeInOut" }}
        className="absolute rounded-full blur-xl"
        style={{ width: COIN * 0.8, height: 18, bottom: 4, background: "rgba(0,0,0,0.6)" }}
      />

      {/* Ambient glow halo */}
      <motion.div
        aria-hidden
        animate={{
          opacity: phase === "flipping" ? [0.3, 0.6, 0.3] : phase === "landed" ? 0.7 : 0.35,
          scale: phase === "flipping" ? [1, 1.3, 1] : phase === "landed" ? 1.2 : 1,
        }}
        transition={{ duration: phase === "flipping" ? 1.2 : 0.5, repeat: phase === "flipping" ? Infinity : 0 }}
        className="absolute rounded-full blur-3xl"
        style={{ width: COIN * 1.4, height: COIN * 1.4, background: `radial-gradient(circle, ${winColor}88, transparent 70%)` }}
      />

      {/* Landing shockwave — double ring burst */}
      <AnimatePresence>
        {phase === "landed" && [0, 0.12].map((delay, ri) => (
          <motion.div
            key={"shock" + ri}
            aria-hidden
            initial={{ opacity: 0.7 - ri * 0.2, scale: 0.4 }}
            animate={{ opacity: 0, scale: 2.4 - ri * 0.3 }}
            transition={{ duration: 0.9, delay, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{ width: COIN, height: COIN, border: `${2.5 - ri}px solid ${winColor}` }}
          />
        ))}
      </AnimatePresence>

      {/* Landing sparkles — more, varied sizes and velocities */}
      <AnimatePresence>
        {phase === "landed" && Array.from({ length: 14 }).map((_, i) => {
          const ang = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
          const dist = 55 + (i % 3) * 25;
          const size = 1 + (i % 4) * 0.6;
          return (
            <motion.span
              key={"sp" + i}
              aria-hidden
              initial={{ opacity: 1, x: 0, y: 0, scale: 1.2 }}
              animate={{
                opacity: 0,
                x: Math.cos(ang) * dist,
                y: Math.sin(ang) * dist - 10,
                scale: 0,
              }}
              transition={{ duration: 0.8 + (i % 3) * 0.15, delay: (i % 4) * 0.03, ease: "easeOut" }}
              className="absolute rounded-full"
              style={{
                width: size * 2, height: size * 2,
                background: i % 3 === 0 ? "#fff" : winColor,
                boxShadow: `0 0 ${6 + (i % 3) * 4}px ${winColor}`,
              }}
            />
          );
        })}
      </AnimatePresence>

      {/* The coin — parabolic toss arc with hang time at the peak */}
      <motion.div
        animate={
          phase === "idle"
            ? { y: [0, -6, 0], rotateZ: [0, 1, 0, -1, 0] }
            : { y: [0, -80, -85, -70, -10, 6, -2, 0], scale: [1, 1.12, 1.15, 1.08, 0.95, 1.06, 0.98, 1] }
        }
        transition={
          phase === "idle"
            ? { duration: 3, ease: "easeInOut", repeat: Infinity }
            : { duration: 2.6, ease: [0.22, 0.68, 0.36, 1], times: [0, 0.28, 0.36, 0.48, 0.72, 0.82, 0.92, 1] }
        }
        style={{ width: COIN, height: COIN }}
        className="relative"
      >
        <motion.div
          animate={{
            rotateY: target,
            rotateX: phase === "flipping" ? [0, 25, -15, 10, 0] : 0,
            rotateZ: phase === "flipping" ? [0, 8, -6, 3, 0] : 0,
          }}
          transition={
            phase === "idle"
              ? { duration: 0 }
              : {
                  rotateY: { duration: 2.6, ease: [0.15, 0.6, 0.3, 1] },
                  rotateX: { duration: 2.6, ease: "easeInOut", times: [0, 0.3, 0.55, 0.8, 1] },
                  rotateZ: { duration: 2.6, ease: "easeInOut", times: [0, 0.25, 0.5, 0.8, 1] },
                }
          }
          style={{ transformStyle: "preserve-3d", width: COIN, height: COIN }}
          className="relative"
        >
          <CoinFace theme={youTheme} label="TOI" rotate={0} size={COIN} />
          <CoinFace theme={oppTheme} label="ADV" rotate={180} size={COIN} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function CoinFace({
  theme, label, rotate, size,
}: {
  theme: { primary: string; secondary: string };
  label: string;
  rotate: number;
  size: number;
}) {
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
      style={{
        background: `
          conic-gradient(from 160deg at 50% 50%,
            color-mix(in oklab, ${theme.primary} 90%, #fff) 0deg,
            ${theme.primary} 90deg,
            color-mix(in oklab, ${theme.secondary} 80%, #000) 180deg,
            ${theme.primary} 270deg,
            color-mix(in oklab, ${theme.primary} 90%, #fff) 360deg
          )`,
        transform: `rotateY(${rotate}deg)`,
        backfaceVisibility: "hidden",
        border: "3.5px solid rgba(255,255,255,0.5)",
        boxShadow: `
          inset 0 0 18px rgba(0,0,0,0.5),
          inset 0 4px 8px rgba(255,255,255,0.45),
          inset 0 -3px 6px rgba(0,0,0,0.3),
          0 10px 30px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Inner relief ring */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 8,
          border: "1.5px solid rgba(255,255,255,0.2)",
          boxShadow: "inset 0 1px 3px rgba(255,255,255,0.15)",
        }}
      />
      {/* Glint sweep — faster during flip for strobing effect */}
      <motion.div
        aria-hidden
        animate={{ x: ["-140%", "140%"] }}
        transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8 }}
        className="absolute inset-y-0 w-2/5 -skew-x-12"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
      />
      {/* Edge notch marks for coin authenticity */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r = size / 2 - 4;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: size / 2 + Math.cos(a) * r - 1,
              top: size / 2 + Math.sin(a) * r - 1,
              width: 2, height: 2,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
            }}
          />
        );
      })}
      <span
        className="relative text-xl font-black text-white"
        style={{
          fontFamily: "var(--font-headline)",
          letterSpacing: "0.06em",
          textShadow: "0 2px 6px rgba(0,0,0,0.7), 0 0 12px rgba(255,255,255,0.15)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
