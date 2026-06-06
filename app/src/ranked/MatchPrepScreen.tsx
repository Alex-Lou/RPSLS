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
import type { CardId } from "./rankedTypes";
import type { PadId, ThemeId } from "../types";
import { PAD_META } from "../types";
import { CardImage } from "./CardImage";
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

/** Coded pads offered for the quick-swap row (excludes the player's custom mat). */
const QUICK_PADS: PadId[] = [
  "chalkboard", "vintage", "cosmos", "galaxy", "neon",
  "comics", "cyberpunk", "holy", "quantum", "casino",
];

export function MatchPrepScreen({
  youName, youAvatar, youThemeId,
  oppName, oppAvatar, oppThemeId, oppPadId,
  onManageDeck, onReady, onBack,
}: {
  youName: string;
  youAvatar: string;
  youThemeId: ThemeId;
  oppName: string;
  oppAvatar: string;
  oppThemeId: ThemeId;
  oppPadId: PadId;
  onManageDeck?: () => void;
  onReady: (arena: Arena) => void;
  onBack: () => void;
}) {
  const deck = (useStore((s) => s.player.rankedDeck) ?? []) as CardId[];
  const youPadId = useStore((s) => s.player.padId);
  const updateProfile = useStore((s) => s.updateProfile);

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
    // The coin animation runs ~1.8s; reveal the verdict when it settles.
    window.setTimeout(() => {
      hapticMatchStart();
      setPhase("landed");
    }, 1800);
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
      className="flex flex-col gap-4 flex-1 py-2 px-2 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center mt-7">
        <h1
          className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Préparation du duel
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">
          Vérifie ton deck, ajuste ton terrain, puis joue la pièce.
        </p>
      </div>

      {/* VS — you vs opponent, each with avatar + theme swatch. */}
      <div className="flex items-stretch gap-2">
        <FighterCard name={youName} avatar={youAvatar} theme={youTheme} tag="Toi" highlight={winner === "you"} />
        <div className="flex items-center text-lg font-black text-ink-faint">VS</div>
        <FighterCard name={oppName} avatar={oppAvatar} theme={oppTheme} tag="Adv." highlight={winner === "opp"} />
      </div>

      {/* Deck check */}
      <div className="rounded-2xl bg-surface border border-hairline p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
            Ton deck
          </span>
          {onManageDeck && (
            <button
              onClick={() => { hapticTick(); onManageDeck(); }}
              className="text-[11px] font-bold text-violet-300 hover:text-violet-200"
            >
              Gérer →
            </button>
          )}
        </div>
        {deck.length === 0 ? (
          <p className="text-[11px] text-ink-faint">Deck par défaut.</p>
        ) : (
          <div className="flex gap-1.5">
            {deck.slice(0, 6).map((id, i) => (
              <div key={i} className="relative w-9 h-12 rounded-md overflow-hidden ring-1 ring-white/15 shrink-0">
                <CardImage id={id} glyphSize="text-sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pad quick-swap — persists immediately (useful tweak before a match). */}
      <div className="rounded-2xl bg-surface border border-hairline p-3">
        <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted mb-2">
          Ton terrain (pad)
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {QUICK_PADS.map((pid) => {
            const on = youPadId === pid;
            return (
              <button
                key={pid}
                onClick={() => { hapticTick(); updateProfile({ padId: pid }); }}
                className={
                  "shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition border " +
                  (on
                    ? "bg-themed text-white border-transparent shadow"
                    : "bg-hairline text-ink-muted border-hairline hover:text-white")
                }
              >
                {PAD_META[pid].emoji} {PAD_META[pid].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Coin flip — the centrepiece. */}
      <div className="rounded-2xl bg-surface-raised border border-hairline p-4 flex flex-col items-center gap-3">
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
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden ring-1 ring-white/20"
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

function Coin({
  phase, winner, youTheme, oppTheme,
}: {
  phase: "idle" | "flipping" | "landed";
  winner: "you" | "opp" | null;
  youTheme: { primary: string; secondary: string };
  oppTheme: { primary: string; secondary: string };
}) {
  // Landing rotation: many full turns + a half-turn when the opponent wins so
  // the "tails" (opp) face ends up toward the camera. You = heads (0°).
  const spins = 5;
  const target = phase === "idle" ? 0 : spins * 360 + (winner === "opp" ? 180 : 0);

  return (
    <div className="relative" style={{ perspective: 900, width: 110, height: 110 }}>
      {/* Glow puck under the coin */}
      <motion.div
        aria-hidden
        animate={{ opacity: phase === "flipping" ? [0.3, 0.7, 0.3] : 0.4, scale: phase === "flipping" ? [0.9, 1.1, 0.9] : 1 }}
        transition={{ duration: 0.6, repeat: phase === "flipping" ? Infinity : 0 }}
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.6), transparent 70%)" }}
      />
      <motion.div
        animate={{ rotateY: target }}
        transition={phase === "idle" ? { duration: 0 } : { duration: 1.8, ease: [0.2, 0.7, 0.2, 1] }}
        style={{ transformStyle: "preserve-3d", width: 110, height: 110 }}
        className="relative mx-auto"
      >
        {/* Heads = you */}
        <CoinFace theme={youTheme} label="TOI" rotate={0} />
        {/* Tails = opponent */}
        <CoinFace theme={oppTheme} label="ADV" rotate={180} />
      </motion.div>
    </div>
  );
}

function CoinFace({
  theme, label, rotate,
}: {
  theme: { primary: string; secondary: string };
  label: string;
  rotate: number;
}) {
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center border-4 border-white/30 shadow-2xl"
      style={{
        background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${theme.primary} 80%, #fff), ${theme.secondary})`,
        transform: `rotateY(${rotate}deg)`,
        backfaceVisibility: "hidden",
      }}
    >
      <span className="text-lg font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" style={{ fontFamily: "var(--font-headline)" }}>
        {label}
      </span>
    </div>
  );
}
