import { motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE } from "../../icons";
import type { Move } from "../../engine/game";
import { RANKED_MOVES } from "./rankedOverlayShared";

/* ──────────── Sudden-death sub-phase UI ──────────── */

export function SuddenDeathOverlay({
  data,
  onPick,
}: {
  data: { phase: "pick" | "reveal"; round: number; playerMove?: Move; cpuMove?: Move; winner?: "a" | "b" | null };
  onPick: (mv: Move) => void;
}) {
  const verdict = data.phase === "reveal"
    ? data.winner === "a" ? "win" : data.winner === "b" ? "loss" : "draw"
    : null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-md px-4 overflow-hidden"
    >
      {/* Dramatic backdrop: throbbing red/gold radial that signals high
       *  stakes. The blackout layer fades in over it so the rest of the UI
       *  reads "frozen" but the duel arena reads "alive". */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            "radial-gradient(60% 50% at 50% 50%, rgba(244,63,94,0.55) 0%, rgba(0,0,0,0.92) 70%)",
            "radial-gradient(72% 60% at 50% 50%, rgba(251,191,36,0.55) 0%, rgba(0,0,0,0.92) 70%)",
            "radial-gradient(60% 50% at 50% 50%, rgba(244,63,94,0.55) 0%, rgba(0,0,0,0.92) 70%)",
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Lightning spark layer — 6 thin rays converging from the edges,
       *  each rotating + fading on its own period. Pure decoration; pointer-
       *  events-none so it never blocks the picker below. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <motion.div
            key={deg}
            className="absolute top-1/2 left-1/2 origin-left"
            style={{
              width: "55vw", height: 2,
              background: "linear-gradient(90deg, rgba(252,211,77,0.0) 0%, rgba(252,211,77,0.85) 60%, rgba(244,63,94,0.95) 100%)",
              transform: `rotate(${deg}deg)`,
              filter: "blur(0.5px)",
            }}
            animate={{ opacity: [0, 0.9, 0], scaleX: [0.2, 1.05, 0.2] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15, ease: "easeOut" }}
          />
        ))}
      </div>
      {/* Title — bigger, with a continuous wobble to signal "live event". */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
        animate={{
          scale: [0.4, 1.25, 1, 1.04, 1],
          opacity: 1,
          rotate: [-6, 5, 0, -2, 0],
        }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="relative text-4xl sm:text-6xl font-black tracking-[0.14em] mb-1.5 text-center bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent"
        style={{ filter: "drop-shadow(0 2px 22px rgba(244,63,94,0.75))" }}
      >
        ⚡ MORT SUBITE ⚡
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="relative text-xs sm:text-sm text-amber-200/90 mb-6 max-w-xs text-center font-bold tracking-wider"
      >
        Match point des deux côtés — un seul coup décide tout.
      </motion.div>
      {data.phase === "pick" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.3 }}
          className="relative grid grid-cols-5 gap-2 w-full max-w-md"
        >
          {RANKED_MOVES.map((mv, i) => {
            const pal = MOVE_PALETTE[mv];
            return (
              <motion.button
                key={mv}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.05, duration: 0.2 }}
                onClick={() => onPick(mv)}
                className={
                  "aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-1 py-1.5 transition active:scale-92 " +
                  "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring + " " + pal.glow +
                  " text-zinc-900 shadow-md"
                }
              >
                <MoveGlyph move={mv} className="w-7 h-7" />
                <span className="text-[8px] uppercase tracking-wider font-bold leading-none">{mv}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
      {data.phase === "reveal" && data.playerMove && data.cpuMove && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.7 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">Toi</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.playerMove].from + " " + MOVE_PALETTE[data.playerMove].to +
                " ring-2 " + MOVE_PALETTE[data.playerMove].ring}>
                <MoveGlyph move={data.playerMove} className="w-9 h-9" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: [0.5, 1.3, 1] }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="text-3xl font-black text-ink-faint"
            >
              vs
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.7 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[10px] uppercase tracking-wider text-rose-300">CPU</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.cpuMove].from + " " + MOVE_PALETTE[data.cpuMove].to +
                " ring-2 " + MOVE_PALETTE[data.cpuMove].ring}>
                <MoveGlyph move={data.cpuMove} className="w-9 h-9" />
              </div>
            </motion.div>
          </div>
          <motion.div
            key={verdict ?? "none"}
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{
              opacity: 1,
              scale: verdict === "draw" ? 1 : [0.6, 1.25, 1],
              y: 0,
              x: verdict === "win" ? [0, -3, 3, -2, 2, 0] : verdict === "loss" ? [0, 2, -2, 1, -1, 0] : 0,
            }}
            transition={{ delay: 0.35, duration: verdict === "draw" ? 0.25 : 0.5, type: "spring", stiffness: 240, damping: 14 }}
            className={
              "text-xl sm:text-3xl font-black tracking-wide text-center px-3 py-1 rounded-lg " +
              (verdict === "win"
                ? "text-emerald-200 bg-emerald-500/15 ring-1 ring-emerald-400/40"
                : verdict === "loss"
                ? "text-rose-200 bg-rose-500/15 ring-1 ring-rose-400/40"
                : "text-ink-muted")
            }
            style={
              verdict === "win"
                ? { filter: "drop-shadow(0 0 18px rgba(52,211,153,0.55))" }
                : verdict === "loss"
                ? { filter: "drop-shadow(0 0 14px rgba(244,63,94,0.45))" }
                : undefined
            }
          >
            {verdict === "win" ? "Tu remportes la manche !"
              : verdict === "loss" ? "Manche perdue en mort subite."
              : "Encore égalité — on rejoue !"}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
