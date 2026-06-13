/**
 * ArenaCastOnDrawFX — animation ⚡ « carte à la pioche » (Cast When Drawn).
 *
 * Alex 2026-06-13 « à fond grave sur la qualité des animations ». Séquence
 * one-shot jouée quand une carte se déclenche AU TIRAGE (cf. arenaCastOnDraw) :
 *   1. ÉCLAIR — un zigzag SVG frappe du haut vers la carte (pathLength) ;
 *   2. IMPACT — flash de foudre teinté au point de chute ;
 *   3. CARTE — l'art jaillit (scale + ring lumineux) et tient ;
 *   4. ONDES — 2 anneaux teintés s'étendent ;
 *   5. CHIP — le résumé de l'effet (« +2 MANA ») punch sous la carte ;
 *   6. PAILLETTES — ~12 micro-étincelles radient.
 * Teinte pilotée par fxKind (mana/heal/draw/risk/chaos). 100% transform/opacity
 * + screen → fluide WebView. ONE-SHOT : onDone après la séquence (timer NETTOYÉ),
 * aucun repeat:Infinity, AnimatePresence parent démonte → zéro fuite.
 *
 * Côté ADVERSAIRE (side "b") : plus compact, posé en haut, tag « ADVERSAIRE ».
 */

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CardImage } from "../ranked/CardImage";
import { CARDS } from "../ranked/cards";
import { useT } from "../i18n";
import type { BoardState, CastFxKind, CastOnDrawEvent, Side } from "./arenaTypes";

const THEME: Record<CastFxKind, { ring: string; glow: string; bolt: string; chip: string; icon: string }> = {
  mana:  { ring: "#38bdf8", glow: "rgba(56,189,248,0.85)",  bolt: "#bae6fd", chip: "from-sky-500 to-cyan-500",       icon: "⚡" },
  heal:  { ring: "#34d399", glow: "rgba(52,211,153,0.85)",  bolt: "#a7f3d0", chip: "from-emerald-500 to-teal-500",   icon: "✚" },
  draw:  { ring: "#22d3ee", glow: "rgba(34,211,238,0.85)",  bolt: "#a5f3fc", chip: "from-cyan-500 to-sky-500",       icon: "✦" },
  risk:  { ring: "#fb923c", glow: "rgba(251,146,60,0.85)",  bolt: "#fed7aa", chip: "from-orange-500 to-rose-500",    icon: "⚠" },
  chaos: { ring: "#e879f9", glow: "rgba(232,121,249,0.85)", bolt: "#f5d0fe", chip: "from-fuchsia-500 to-amber-500",  icon: "🎲" },
};

const SPARKLES = Array.from({ length: 12 }, (_, i) => i);

interface ArenaCastOnDrawFXProps {
  event: CastOnDrawEvent & { side: Side };
  onDone: () => void;
}

export function ArenaCastOnDrawFX({ event, onDone }: ArenaCastOnDrawFXProps) {
  const t = useT();
  const isOpp = event.side === "b";
  const th = THEME[event.fxKind];
  const card = CARDS[event.id];

  // ONE-SHOT : démonte (→ onDone) à la fin de la séquence. Timer NETTOYÉ.
  useEffect(() => {
    const id = window.setTimeout(onDone, isOpp ? 1250 : 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!card) return null;

  return (
    <motion.div
      className={
        "fixed inset-0 z-[80] pointer-events-none flex justify-center " +
        (isOpp ? "items-start pt-[14vh]" : "items-center")
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      aria-hidden
    >
      {/* Halo d'ambiance teinté (respiration douce derrière la carte) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 360, height: 360,
          background: `radial-gradient(circle, ${th.glow} 0%, transparent 68%)`,
          mixBlendMode: "screen",
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.7, 0.35, 0], scale: [0.5, 1.05, 1.1, 1.2] }}
        transition={{ duration: 1.3, ease: "easeOut", times: [0, 0.25, 0.7, 1] }}
      />

      <div
        className="relative flex flex-col items-center"
        style={{ transform: isOpp ? "scale(0.72)" : "scale(1)" }}
      >
        {/* Tag ADVERSAIRE (opp uniquement) */}
        {isOpp && (
          <motion.div
            className="mb-1 px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow ring-1 ring-rose-200/50"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: 0 }}
            transition={{ duration: 1.25, times: [0, 0.25, 0.85, 1] }}
          >
            Adversaire
          </motion.div>
        )}

        {/* ── 1+2. ÉCLAIR qui frappe du haut + flash d'impact ── */}
        <svg
          className="absolute left-1/2 -translate-x-1/2 -top-[120px] pointer-events-none"
          width={56} height={134} viewBox="0 0 56 134" fill="none"
          style={{ filter: `drop-shadow(0 0 6px ${th.glow})`, mixBlendMode: "screen" }}
        >
          {/* lueur large */}
          <motion.path
            d="M30 0 L18 44 L34 60 L20 100 L30 122 L24 134"
            stroke={th.ring} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.6}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 1], opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.42, 1] }}
          />
          {/* cœur blanc */}
          <motion.path
            d="M30 0 L18 44 L34 60 L20 100 L30 122 L24 134"
            stroke={th.bolt} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.4, 1] }}
          />
        </svg>
        {/* flash d'impact au point de chute (~0.2) */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 160, height: 160,
            background: "radial-gradient(circle, rgba(255,255,255,0.98) 0%, transparent 62%)",
            mixBlendMode: "screen",
          }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0.2, 0.2, 1.7, 2.1] }}
          transition={{ duration: 0.7, ease: "easeOut", times: [0, 0.2, 0.34, 1] }}
        />

        {/* ── 4. ONDES de choc teintées ── */}
        {[0, 1].map((i) => (
          <motion.div
            key={`ring${i}`}
            className="absolute rounded-full"
            style={{ width: 130, height: 178, border: `2px solid ${th.ring}` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0, 0.85, 0], scale: [0.4, 0.4, 1.7 + i * 0.5, 2.2 + i * 0.5] }}
            transition={{ duration: 0.85, ease: "easeOut", times: [0, 0.22, 0.5 + i * 0.08, 1] }}
          />
        ))}

        {/* ── 3. CARTE qui jaillit ── */}
        <motion.div
          className="relative w-[88px] h-[120px] rounded-xl overflow-hidden shadow-2xl"
          style={{ boxShadow: `0 0 22px 4px ${th.glow}`, outline: `2px solid ${th.ring}` }}
          initial={{ opacity: 0, scale: 0.2, rotate: -16, y: -18 }}
          animate={{
            opacity: [0, 1, 1, 1, 0],
            scale: [0.2, 1.16, 1, 1, 0.92],
            rotate: [-16, 4, 0, 0, 0],
            y: [-18, 0, 0, 0, -8],
          }}
          transition={{ duration: 1.45, ease: "easeOut", times: [0, 0.26, 0.34, 0.82, 1] }}
        >
          <CardImage id={event.id} glyphSize="text-4xl" />
          {/* glaçage de lumière qui balaie la carte */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.7) 50%, transparent 65%)" }}
            initial={{ x: "-120%", opacity: 0 }}
            animate={{ x: ["-120%", "120%"], opacity: [0, 1, 0] }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.28 }}
          />
        </motion.div>

        {/* ── 5. CHIP résumé d'effet ── */}
        <motion.div
          className={
            "mt-2 px-3 py-1 rounded-full bg-gradient-to-r " + th.chip +
            " text-white text-sm font-black uppercase tracking-wide shadow-lg ring-2 ring-white/30 flex items-center gap-1.5 whitespace-nowrap"
          }
          initial={{ opacity: 0, scale: 0.5, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.12, 1, 1], y: [8, 0, 0, -4] }}
          transition={{ duration: 1.2, ease: "easeOut", times: [0, 0.35, 0.85, 1], delay: 0.32 }}
        >
          <span className="text-base leading-none">{th.icon}</span>
          {event.label}
        </motion.div>

        {/* nom de la carte, discret sous le chip */}
        <motion.div
          className="mt-1 text-[11px] font-bold text-white/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 0] }}
          transition={{ duration: 1.3, times: [0, 0.4, 0.6, 1] }}
        >
          {t(card.nameKey)}
        </motion.div>

        {/* ── 6. PAILLETTES micro qui radient ── */}
        {SPARKLES.map((i) => {
          const a = (i / SPARKLES.length) * Math.PI * 2;
          const r = 56 + (i % 3) * 16;
          return (
            <motion.span
              key={`sp${i}`}
              className="absolute left-1/2 top-1/2 w-[3px] h-[3px] -ml-[1.5px] -mt-[1.5px] rounded-full"
              style={{ background: th.bolt, boxShadow: `0 0 5px ${th.glow}` }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{ opacity: [0, 0, 1, 0], x: [0, 0, Math.cos(a) * r], y: [0, 0, Math.sin(a) * r], scale: [0, 0, 1, 0.2] }}
              transition={{ duration: 0.85, ease: "easeOut", times: [0, 0.2, 0.45, 1], delay: 0.18 + (i % 4) * 0.02 }}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

/** File d'attente des événements « à la pioche » (Cast When Drawn) : lit
 *  board.a/b.castOnDrawEvents à CHAQUE changement de tour (la pioche de tour vit
 *  dans advanceToNextTurn) et les expose UN PAR UN. Co-localisé avec son FX —
 *  « au fil de l'eau » : la logique de file sort de l'orchestrateur ArenaGame.
 *  Le garde `lastTurnRef` évite tout double-enqueue (StrictMode / re-render). */
export function useCastOnDrawQueue(board: BoardState): {
  head: (CastOnDrawEvent & { side: Side; key: number }) | undefined;
  shift: () => void;
} {
  const [queue, setQueue] = useState<Array<CastOnDrawEvent & { side: Side; key: number }>>([]);
  const keyRef = useRef(0);
  const lastTurnRef = useRef(0);
  useEffect(() => {
    if (board.turn === lastTurnRef.current) return;
    lastTurnRef.current = board.turn;
    const collect = (evs: CastOnDrawEvent[] | undefined, side: Side) =>
      (evs ?? []).map((e) => ({ ...e, side, key: ++keyRef.current }));
    const next = [...collect(board.a.castOnDrawEvents, "a"), ...collect(board.b.castOnDrawEvents, "b")];
    if (next.length) setQueue((q) => [...q, ...next]);
  }, [board.turn]);
  return { head: queue[0], shift: () => setQueue((q) => q.slice(1)) };
}
