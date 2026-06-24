import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { useGfxAllows } from "../../graphics/graphicsQuality";

export function QueueRadar({
  position,
  startedAt,
  bestOf,
  onCancel,
  botTimeoutMs,
  onExtend,
}: {
  position: number;
  startedAt: number | null;
  bestOf: number;
  onCancel: () => void;
  /** Total ms the matchmaker will wait for a real opponent before offering
   *  a CPU fallback. Used here only for display — the actual timer lives
   *  in armBotFallback() above. */
  botTimeoutMs: number;
  /** Re-arm the bot-fallback timer by another `botTimeoutMs`. Lets a patient
   *  player tell the system "I'd rather wait for a real one" without having
   *  to cancel and re-queue from scratch. */
  onExtend?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  // Palier perf : en 'low' on coupe les décorations animées lourdes (anneaux de
  // pulsation infinis, particules en orbite, blobs de gradient en rotation) et
  // on garde un loader minimal. Le matchmaking lui-même n'est pas affecté.
  const queueFx = useGfxAllows("queueFx");
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!id) id = setInterval(() => setNow(Date.now()), 250); };
    const stop = () => { if (id) { clearInterval(id); id = undefined; } };
    const onVis = () => { if (document.hidden) stop(); else { setNow(Date.now()); start(); } };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const elapsedSec = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  // Progression toward the bot fallback, from the most recent (re)arm. The
  // armBot timer is reset when `onExtend` fires, so `startedAt` already
  // reflects that — we simply count up here.
  const elapsedMs = startedAt ? now - startedAt : 0;
  const botRemainingSec = Math.max(0, Math.ceil((botTimeoutMs - elapsedMs) / 1000));
  const botProgress = Math.max(0, Math.min(1, elapsedMs / botTimeoutMs));

  // 8 orbiting particles around the logo — pre-computed angles so the
  // parent's 250ms re-renders don't re-allocate the array each tick.
  const ORBIT_DOTS = 8;
  const orbitAngles = Array.from({ length: ORBIT_DOTS }, (_, i) => (i / ORBIT_DOTS) * 360);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col items-center gap-6 py-6 w-full min-h-[440px] justify-center overflow-hidden"
    >
      {/* Nebulous bg shimmer — three blurred radial blobs slowly rotate so
          the loader sits inside a living atmosphere instead of a flat card. */}
      {queueFx && (
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 38, ease: "linear", repeat: Infinity }}
            className="absolute -inset-10"
            style={{
              background:
                "radial-gradient(circle at 30% 35%, rgba(168,85,247,0.20), transparent 38%)," +
                "radial-gradient(circle at 70% 65%, rgba(34,211,238,0.16), transparent 40%)," +
                "radial-gradient(circle at 50% 50%, rgba(244,114,182,0.12), transparent 55%)",
              filter: "blur(8px)",
            }}
          />
        </div>
      )}

      {/* Logo + orbits stack */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
        {/* Outer expanding pulses — three rings, staggered, share the same
            scale-fade animation so the whole stage breathes. */}
        {queueFx && [0, 1, 2].map((i) => (
          <motion.div
            key={"pulse-" + i}
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-violet-400/40"
            initial={{ opacity: 0.55, scale: 0.55 }}
            animate={{ opacity: 0, scale: 1.18 }}
            transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity, ease: "easeOut" }}
          />
        ))}

        {/* Counter-rotating conic-gradient rings sandwich the logo with a
            thin scanning arc each — gives the matchmaker a sci-fi feel. */}
        {queueFx && (
          <>
            <motion.div
              aria-hidden
              animate={{ rotate: 360 }}
              transition={{ duration: 14, ease: "linear", repeat: Infinity }}
              className="absolute inset-2 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(168,85,247,0.0) 0%, rgba(168,85,247,0.6) 30%, rgba(168,85,247,0.0) 60%, rgba(168,85,247,0.0) 100%)",
                WebkitMask:
                  "radial-gradient(circle, transparent 47%, black 49%, black 50%, transparent 51%)",
                mask:
                  "radial-gradient(circle, transparent 47%, black 49%, black 50%, transparent 51%)",
              }}
            />
            <motion.div
              aria-hidden
              animate={{ rotate: -360 }}
              transition={{ duration: 22, ease: "linear", repeat: Infinity }}
              className="absolute inset-6 rounded-full"
              style={{
                background:
                  "conic-gradient(from 90deg, rgba(244,114,182,0.0) 0%, rgba(244,114,182,0.55) 25%, rgba(244,114,182,0.0) 55%, rgba(244,114,182,0.0) 100%)",
                WebkitMask:
                  "radial-gradient(circle, transparent 45%, black 47%, black 48%, transparent 49%)",
                mask:
                  "radial-gradient(circle, transparent 45%, black 47%, black 48%, transparent 49%)",
              }}
            />
          </>
        )}

        {/* Orbiting particles. Each dot sits at the 12 o'clock of an absolute
            layer that rotates the dot along a circular path around the logo. */}
        {queueFx && orbitAngles.map((angle, i) => (
          <motion.div
            key={"orbit-" + i}
            aria-hidden
            initial={{ rotate: angle }}
            animate={{ rotate: angle + 360 }}
            transition={{ duration: 9 + (i % 3) * 2, ease: "linear", repeat: Infinity }}
            className="absolute inset-0 pointer-events-none"
          >
            <motion.div
              animate={{ scale: [0.7, 1.1, 0.7], opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 1.8 + (i % 3) * 0.3, ease: "easeInOut", repeat: Infinity, delay: i * 0.12 }}
              className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 ? "#f0abfc" : "#a78bfa",
                boxShadow:
                  (i % 2 ? "0 0 8px rgba(240,171,252,0.9)" : "0 0 8px rgba(167,139,250,0.9)"),
              }}
            />
          </motion.div>
        ))}

        {/* Logo at the centre — gentle scale pulse + soft drift + glow halo. */}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center"
        >
          <motion.div
            aria-hidden
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.65) 0%, transparent 70%)" }}
          />
          <motion.img
            src="/Logo-RLSPS.png"
            alt=""
            animate={{ rotate: [0, 4, 0, -4, 0] }}
            transition={{ duration: 6.5, ease: "easeInOut", repeat: Infinity }}
            className="relative w-full h-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
          />
        </motion.div>
      </div>

      {/* Headline + status */}
      <div className="text-center w-full max-w-sm px-4 relative">
        <motion.div
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 5, ease: "linear", repeat: Infinity }}
          className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #ddd6fe, #f0abfc, #67e8f9, #f0abfc, #ddd6fe)",
            backgroundSize: "300% 100%",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.02em",
          }}
        >
          À la recherche d'un adversaire
        </motion.div>
        <div className="text-xs text-zinc-400 mt-2 flex items-center justify-center gap-2">
          <span>{position > 0 ? `Position #${position}` : "Scan du réseau…"}</span>
          <span className="text-zinc-600">·</span>
          <span>Bo {bestOf}</span>
          <span className="text-zinc-600">·</span>
          <span className="tabular-nums">{elapsedSec}s</span>
        </div>

        {/* Bot-fallback budget bar — violet→amber gradient so the wait
            visibly bleeds toward the CPU offer. The player chooses by
            seeing the time, not by guessing it. */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
            <span>Vrai adversaire</span>
            <span className="text-amber-300 tabular-nums">🤖 IA dans {botRemainingSec}s</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden ring-1 ring-white/5">
            <motion.div
              animate={{ width: `${botProgress * 100}%` }}
              transition={{ duration: 0.25, ease: "linear" }}
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #a78bfa 0%, #f0abfc 50%, #fbbf24 100%)",
              }}
            />
          </div>
        </div>

        {/* "Attendre encore" surfaces near the budget end so a patient
            player has a tangible way to insist on a real human without
            cancelling and re-queueing. */}
        <AnimatePresence>
          {onExtend && botRemainingSec <= 10 && (
            <motion.button
              key="extend"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.96 }}
              onClick={onExtend}
              className="mt-3 px-4 py-1.5 rounded-full text-[11px] font-bold bg-white/10 border border-white/20 text-white hover:bg-white/15 transition"
            >
              ⏳ Attendre encore un humain
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <button
        onClick={onCancel}
        className="mt-2 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
      >
        Cancel
      </button>
    </motion.div>
  );
}
