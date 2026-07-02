/**
 * ArenaTurnRecap — petit recap de FIN DE TOUR en bas du pad (Pro, vs-CPU + online).
 *
 * Affiche quelques instants (piloté par ArenaGame) une accroche + des micro-stats
 * du tour qui vient de se résoudre, dans l'esprit du reveal des manches. Purement
 * cosmétique/local (chaque joueur voit SA perspective). One-shot via key +
 * AnimatePresence → auto-démonté, zéro fuite. Données calculées par buildTurnRecap.
 */
import { AnimatePresence, motion } from "motion/react";
import type { RecapChip, TurnRecap } from "./arenaRecap";

const HEADLINE_COLOR: Record<TurnRecap["tone"], string> = {
  good: "#6ee7b7",     // emerald-300
  bad: "#fda4af",      // rose-300
  neutral: "var(--theme-secondary)",
};

function chipStyle(tone: RecapChip["tone"]): React.CSSProperties {
  if (tone === "good") return { color: "#6ee7b7", background: "rgba(16,185,129,0.16)", border: "1px solid rgba(110,231,183,0.35)" };
  if (tone === "bad") return { color: "#fda4af", background: "rgba(244,63,94,0.16)", border: "1px solid rgba(253,164,175,0.35)" };
  return { color: "var(--theme-primary)", background: "color-mix(in oklab, var(--theme-primary) 18%, transparent)", border: "1px solid color-mix(in oklab, var(--theme-primary) 40%, transparent)" };
}

export function ArenaTurnRecap({ recap }: { recap: TurnRecap | null }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0.5 pointer-events-none flex justify-center px-3"
      // Tout en BAS, sous les cartes (Alex 2026-07). La safe-area Android est
      // DÉJÀ gérée par #root (padding-bottom: var(--sai-bottom)) → on ne la
      // ré-applique PAS ici (sinon on remonterait dans les cartes) ; bottom-0.5
      // est donc déjà au-dessus des boutons système.
      style={{ zIndex: 56 }}
      aria-hidden
    >
      <AnimatePresence>
        {recap && (
          <motion.div
            key={`recap-${recap.key}`}
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="flex flex-col items-center gap-1 rounded-2xl px-4 py-2 max-w-[92%] bg-black/72 backdrop-blur-md border border-white/10 shadow-xl"
          >
            <div
              className="text-sm font-black uppercase tracking-wide leading-none"
              style={{ color: HEADLINE_COLOR[recap.tone], textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
            >
              {recap.headline}
            </div>
            {recap.chips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {recap.chips.map((c, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums leading-none"
                    style={chipStyle(c.tone)}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
