import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../../../store/store";
import type { GameMode, Difficulty } from "../../../types";
import { FloatingMatchBackButton, hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";
import { ModeIcon } from "./menuShared";
import { SANDBOX_MODES, DIFFS_META, MAX_WIN_TO, type SandboxMode } from "./sandboxShared";

/* ─────────── Entraînement — solo sandbox (mode + difficulty + format/deck) ─────────── */

export function SandboxView({
  onStart, onGoConstellation, onGoRanked, onBack,
}: {
  onStart: (mode: GameMode, bestOf: number) => void;
  onGoConstellation: (winTo: number) => void;
  onGoRanked: () => void;
  onBack: () => void;
}) {
  const difficulty = useStore((s) => s.player.difficulty);
  const updateProfile = useStore((s) => s.updateProfile);
  const [mode, setMode] = useState<SandboxMode>("classic");
  const [winTo, setWinTo] = useState(2); // rounds to win
  useAndroidBackPrompt(onBack);

  function play() {
    hapticTick();
    if (mode === "cards") return onGoRanked();
    if (mode === "lanes") return onGoConstellation(winTo);
    onStart("casual", winTo * 2 - 1);
  }
  function surprise() {
    hapticTick();
    const ms: SandboxMode[] = ["classic", "lanes", "cards"];
    const ds: Difficulty[] = ["easy", "normal", "hard"];
    setMode(ms[Math.floor(Math.random() * ms.length)]);
    updateProfile({ difficulty: ds[Math.floor(Math.random() * ds.length)] });
    setWinTo(1 + Math.floor(Math.random() * 6));
  }

  const cur = SANDBOX_MODES.find((m) => m.id === mode)!;
  const curDiff = DIFFS_META.find((d) => d.id === difficulty) ?? DIFFS_META[1];
  const recap =
    mode === "cards"
      ? cur.label + " · " + curDiff.label + " · tournoi"
      : cur.label + " · " + curDiff.label + " · premier à " + winTo;

  const selOn = "linear-gradient(150deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 24%, transparent))";
  const fill = "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      {/* 🎲 docked top-right, at the same height as the burger + back arrow, so
          the whole config fits on one screen without scrolling to a bottom row. */}
      <button
        onClick={surprise}
        title="Config aléatoire"
        aria-label="Config aléatoire"
        className="fixed z-30 top-[max(var(--sai-top),32px)] right-[max(var(--sai-right),12px)] [@media(max-height:540px)]:top-1 h-11 [@media(max-height:540px)]:h-8 px-3 rounded-2xl bg-black/55 backdrop-blur border border-hairline hover:bg-black/70 transition flex items-center gap-1.5 text-ink text-xs font-semibold shadow-lg"
      >
        🎲 <span className="[@media(max-width:360px)]:hidden">Aléatoire</span>
      </button>

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Entraînement
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">Solo vs IA — règle ta partie comme tu veux</p>
      </div>

      {/* Mode — same icons/names as the home menu */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Type de jeu</div>
        <div className="grid grid-cols-3 gap-2">
          {SANDBOX_MODES.map((m) => {
            const on = mode === m.id;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticTick(); setMode(m.id); }}
                className="rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center transition min-h-[104px] justify-center"
                style={{
                  background: on ? selOn : "rgba(255,255,255,0.04)",
                  border: on ? "1px solid color-mix(in oklab, var(--theme-primary) 65%, transparent)" : "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <ModeIcon mode={m.icon} />
                <span className={"text-[11px] font-bold leading-tight " + (on ? "text-white" : "text-ink-muted")}>{m.label}</span>
              </motion.button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug min-h-[2.2em]">{cur.tag}</p>
      </div>

      {/* Difficulty + live hint */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Difficulté</div>
        <div className="grid grid-cols-3 gap-2">
          {DIFFS_META.map((d) => {
            const on = difficulty === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { hapticTick(); updateProfile({ difficulty: d.id }); }}
                className={"rounded-xl py-2.5 text-sm font-bold transition " + (on ? "text-white" : "text-ink-muted bg-hairline border border-hairline hover:bg-hairline")}
                style={on ? { background: fill } : undefined}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug min-h-[2.2em]">{curDiff.hint}</p>
      </div>

      {/* Rounds — pick as many as you want (stepper) */}
      {mode !== "cards" && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Manches</div>
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={() => { hapticTick(); setWinTo((w) => Math.max(1, w - 1)); }}
              disabled={winTo <= 1}
              className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
            >−</button>
            <div className="text-center min-w-[6rem]">
              <div className="text-4xl font-black text-themed tabular-nums leading-none">{winTo}</div>
              <div className="text-[10px] text-ink-faint mt-1">{mode === "lanes" ? "couloirs à gagner" : "manches à gagner"}</div>
            </div>
            <button
              onClick={() => { hapticTick(); setWinTo((w) => Math.min(MAX_WIN_TO, w + 1)); }}
              disabled={winTo >= MAX_WIN_TO}
              className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
            >+</button>
          </div>
          <p className="text-[11px] text-ink-muted text-center mt-2">
            Premier à <b className="text-ink">{winTo}</b> {winTo > 1 ? "victoires" : "victoire"} l'emporte
            {mode !== "lanes" ? " · Best of " + (winTo * 2 - 1) : ""}
          </p>
        </div>
      )}

      {/* Recap + Play */}
      <div className="mt-auto pt-1">
        <div className="text-center text-[11px] text-ink-muted mb-4">
          <span className="px-3 py-1 rounded-full bg-hairline border border-hairline">{recap}</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={play}
          className="w-full px-7 py-3.5 rounded-2xl font-bold text-white shadow-lg transition hover:scale-[1.01] bg-themed-br"
          style={{ boxShadow: "0 8px 24px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent)", fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
        >
          {mode === "cards" ? "Ouvrir le lobby Cartes →" : "Jouer →"}
        </motion.button>
      </div>
    </motion.div>
  );
}
