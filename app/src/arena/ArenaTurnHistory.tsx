/**
 * ArenaTurnHistory — historique des tours (Pro, vs-CPU + online).
 *
 * Le recap de fin de tour (ArenaTurnRecap) ne reste que ~3 s : sur une longue
 * partie, impossible de revenir sur « qu'est-ce qui s'est passé au tour 4 ? ».
 * Ici : un petit bouton 📜 dans le coin haut-droit (colonne réservée, cf.
 * ArenaDebugOverlay) ouvre la liste des recaps déjà vus, du plus récent au plus
 * ancien. Purement local/cosmétique — mêmes données que le recap (buildTurnRecap).
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../i18n";
import type { RecapChip, TurnRecap } from "./arenaRecap";

export interface TurnHistoryEntry {
  turn: number;
  recap: TurnRecap;
}

const HEADLINE_COLOR: Record<TurnRecap["tone"], string> = {
  good: "#6ee7b7",
  bad: "#fda4af",
  neutral: "var(--theme-secondary)",
};

function chipClass(tone: RecapChip["tone"]): string {
  if (tone === "good") return "text-emerald-300 bg-emerald-500/15 border-emerald-300/35";
  if (tone === "bad") return "text-rose-300 bg-rose-500/15 border-rose-300/35";
  return "text-sky-200 bg-sky-500/15 border-sky-300/35";
}

export function ArenaTurnHistory({ entries }: { entries: TurnHistoryEntry[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("arena.history.title")}
        className="fixed right-1 z-[60] w-10 h-10 rounded-full bg-zinc-900/85 border border-white/15 text-lg shadow-lg flex items-center justify-center"
        // Sous le coin du bouton debug (dev) : colonne droite laissée libre par le strip adverse.
        style={{ top: "calc(max(var(--sai-top), 32px) + 36px)" }}
      >
        📜
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="turn-history"
            className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="w-full sm:max-w-md max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">{t("arena.history.title")}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-ink-muted bg-hairline"
                >
                  {t("arena.history.close")}
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-2" style={{ paddingBottom: "calc(var(--sai-bottom) + 20px)" }}>
                {entries.length === 0 ? (
                  <p className="text-xs text-ink-faint py-6 text-center">{t("arena.history.empty")}</p>
                ) : (
                  [...entries].reverse().map((e) => (
                    <div key={e.recap.key} className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint shrink-0">
                          {t("arena.history.turn", { n: e.turn })}
                        </span>
                        <span className="text-sm font-black" style={{ color: HEADLINE_COLOR[e.recap.tone] }}>
                          {e.recap.headline}
                        </span>
                      </div>
                      {e.recap.chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {e.recap.chips.map((c, i) => (
                            <span key={i} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border tabular-nums " + chipClass(c.tone)}>
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
