import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../../../store/store";
import { FloatingMatchBackButton, hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";
import { DIFFS_META, MAX_WIN_TO } from "./sandboxShared";

/* ─────────── Constellation — prep menu before a lanes match ─────────── */

export function ConstellationLobby({
  onBack, onPlay,
}: {
  onBack: () => void;
  onPlay: (winTo: number) => void;
}) {
  const difficulty = useStore((s) => s.player.difficulty);
  const updateProfile = useStore((s) => s.updateProfile);
  const [winTo, setWinTo] = useState(2);
  useAndroidBackPrompt(onBack);

  const curDiff = DIFFS_META.find((d) => d.id === difficulty) ?? DIFFS_META[1];
  const fill = "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))";

  const LANES = [
    { glyph: "⚔️", title: "FORCE",   fav: "Pierre & Ciseaux", accent: "text-amber-300" },
    { glyph: "🧠", title: "SAGESSE", fav: "Feuille & Spock",  accent: "text-sky-300" },
    { glyph: "🦎", title: "RUSE",    fav: "Lézard",           accent: "text-emerald-300" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Constellation
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">3 couloirs joués en parallèle — gagne la majorité</p>
      </div>

      {/* The 3 lanes — what each one favours */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Les 3 couloirs</div>
        <div className="grid grid-cols-3 gap-2">
          {LANES.map((l) => (
            <div key={l.title} className="rounded-2xl p-3 bg-surface border border-hairline flex flex-col items-center gap-1 text-center">
              <span className="text-2xl">{l.glyph}</span>
              <span className={"text-[11px] font-black tracking-wide " + l.accent}>{l.title}</span>
              <span className="text-[9px] text-ink-muted leading-tight">{l.fav}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug">
          <b className="text-ink">Astuce :</b> gagne un couloir en y jouant l'un de ses coups favoris (listés ci-dessus) → <b className="text-emerald-300">+1 point bonus</b>. Ex : Pierre ou Ciseaux dans FORCE.
        </p>
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

      {/* Rounds stepper */}
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
            <div className="text-[10px] text-ink-faint mt-1">couloirs à gagner</div>
          </div>
          <button
            onClick={() => { hapticTick(); setWinTo((w) => Math.min(MAX_WIN_TO, w + 1)); }}
            disabled={winTo >= MAX_WIN_TO}
            className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
          >+</button>
        </div>
        <p className="text-[11px] text-ink-muted text-center mt-2">
          Premier à <b className="text-ink">{winTo}</b> {winTo > 1 ? "couloirs gagnés" : "couloir gagné"} l'emporte
        </p>
      </div>

      {/* Play */}
      <div className="mt-auto pt-1">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { hapticTick(); onPlay(winTo); }}
          className="w-full px-7 py-3.5 rounded-2xl font-bold text-white shadow-lg transition hover:scale-[1.01] bg-themed-br"
          style={{ boxShadow: "0 8px 24px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent)", fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
        >
          Jouer →
        </motion.button>
      </div>
    </motion.div>
  );
}
