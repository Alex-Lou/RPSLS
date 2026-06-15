import { motion } from "motion/react";
import { ATOUTS, MAX_ATOUTS, type AtoutId } from "../../../ranked/atouts";
import { FloatingMatchBackButton, hapticTick } from "../../../match/sharedMatchUI";

export function AtoutPicker({
  chosen, onToggle, onConfirm, onBack,
}: {
  chosen: AtoutId[];
  onToggle: (id: AtoutId) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const ready = chosen.length === MAX_ATOUTS;
  const remaining = MAX_ATOUTS - chosen.length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />
      <div className="text-center mt-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Choisis tes Atouts
        </h1>
        <p className="text-[11px] text-ink-muted mt-1">2 atouts · chacun utilisable une fois dans le match</p>
      </div>
      <div className="flex flex-col gap-2">
        {ATOUTS.map((a) => {
          const on = chosen.includes(a.id);
          const full = chosen.length >= MAX_ATOUTS && !on;
          return (
            <motion.button
              key={a.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => { hapticTick(); onToggle(a.id); }}
              disabled={full}
              className={"text-left rounded-2xl p-3 flex items-center gap-3 transition " + (full ? "opacity-40 pointer-events-none" : "")}
              style={{
                background: on
                  ? "linear-gradient(150deg, color-mix(in oklab, var(--theme-primary) 30%, transparent), color-mix(in oklab, var(--theme-secondary) 22%, transparent))"
                  : "rgba(255,255,255,0.04)",
                border: on
                  ? "1px solid color-mix(in oklab, var(--theme-primary) 65%, transparent)"
                  : "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <span className="text-2xl shrink-0">{a.glyph}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">{a.label}</span>
                  <span className="text-[9px] uppercase tracking-wider px-1 rounded-full bg-hairline text-ink-muted">
                    {a.kind === "manual" ? "manuel" : "auto"}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted leading-snug">{a.desc}</div>
              </div>
              <span className={"shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs " +
                (on ? "bg-emerald-400 border-emerald-400 text-zinc-900" : "border-white/30 text-transparent")}>✓</span>
            </motion.button>
          );
        })}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => { hapticTick(); onConfirm(); }}
        disabled={!ready}
        className="mt-1 w-full px-7 py-3.5 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-themed transition hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
        style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
      >
        {ready ? "Commencer →" : `Choisis encore ${remaining} atout${remaining > 1 ? "s" : ""}`}
      </motion.button>
    </motion.div>
  );
}
