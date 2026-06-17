/**
 * ArenaImpactFX — IMPACT plein-écran « niveau Hearthstone » sur un coup
 * PUISSANT ou FATAL au héros (Alex 2026-06-13). Typé par le MOVE de
 * l'attaquant :
 *   - CISEAUX → grande ENTAILLE diagonale + flash + fissures (écran cassé) ;
 *   - PIERRE  → ÉBRANLEMENT : ondes de choc + poussière + éclats ;
 *   - autres  → impact coloré (palette du move) + onde.
 * `fatal` → plus rouge, plus violent. Le TREMBLEMENT d'écran est géré côté
 * ArenaGame (la racine du match tremble). Ici : 100% transform/opacity, ONE-SHOT
 * (AnimatePresence + key), zéro repeat:Infinity → leak-free.
 */

import { AnimatePresence, motion } from "motion/react";
import { MOVE_PALETTE } from "../icons";
import type { Move } from "../engine/game";

export function ArenaImpactFX({ fx }: { fx: { move: Move; power: "strong" | "fatal"; key: number } | null }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {fx && (
          <motion.div
            key={fx.key}
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {fx.move === "scissors" ? (
              <ScissorsSlash fatal={fx.power === "fatal"} />
            ) : fx.move === "rock" ? (
              <RockQuake fatal={fx.power === "fatal"} />
            ) : (
              <GenericImpact move={fx.move} fatal={fx.power === "fatal"} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GlyphFlash({ glyph, color }: { glyph: string; color: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
      animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 2], rotate: [-12, 0, 8] }}
      transition={{ duration: 0.6, times: [0, 0.4, 1], ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl"
      style={{ filter: `drop-shadow(0 0 16px ${color})` }}
    >
      {glyph}
    </motion.span>
  );
}

function ScissorsSlash({ fatal }: { fatal: boolean }) {
  const glow = fatal ? "rgba(244,63,94,0.95)" : "rgba(255,255,255,0.9)";
  const CRACKS = [-58, -32, -8, 18, 44, 72];
  return (
    <>
      {/* Flash bref (rouge si fatal) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, fatal ? 0.7 : 0.5, 0] }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: fatal ? "rgba(244,63,94,0.55)" : "rgba(255,255,255,0.6)" }}
      />
      {/* GRANDE entaille diagonale qui balaie l'écran */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scaleX: [0, 1, 1, 1] }}
          transition={{ duration: 0.5, times: [0, 0.22, 0.6, 1], ease: "easeOut" }}
          className="w-[160%] h-1.5 origin-left"
          style={{ rotate: "-26deg", background: "linear-gradient(to right, transparent, #fff 25%, #fff 75%, transparent)", boxShadow: `0 0 26px 7px ${glow}` }}
        />
      </div>
      {/* Fissures radiantes (écran cassé) — STAGGER (Alex 2026-06-17, Pro-37) :
          elles jaillissent l'une APRÈS l'autre pour « respirer » (radiation
          séquentielle) au lieu de claquer toutes ensemble = effet moins
          saccadé. Reste dans l'enveloppe ~0.6s (delay max 0.32 + durée 0.3)
          pour ne pas allonger la séquence. */}
      {CRACKS.map((deg, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 0.9, 0], scaleY: [0, 1, 1] }}
          transition={{ duration: 0.3, delay: 0.12 + i * 0.04, times: [0, 0.45, 1], ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-[2px] h-[55%] origin-top"
          style={{ rotate: `${deg}deg`, background: `linear-gradient(to bottom, ${glow}, transparent)` }}
        />
      ))}
      <GlyphFlash glyph="✂" color={glow} />
    </>
  );
}

function RockQuake({ fatal }: { fatal: boolean }) {
  const SPARKS = [0, 40, 80, 120, 160, 200, 240, 280, 320];
  return (
    <>
      {/* 2 ondes de choc qui se propagent */}
      <motion.div
        initial={{ opacity: 0.95, scale: 0.1 }}
        animate={{ opacity: 0, scale: 3.6 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
        style={{ border: `6px solid ${fatal ? "rgba(180,83,9,0.95)" : "rgba(202,138,4,0.9)"}` }}
      />
      <motion.div
        initial={{ opacity: 0.7, scale: 0.1 }}
        animate={{ opacity: 0, scale: 2.6 }}
        transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full border-4 border-amber-700/80"
      />
      {/* Poussière (vignette des bords) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, fatal ? 0.6 : 0.4, 0] }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle, transparent 38%, rgba(60,40,20,0.72) 100%)" }}
      />
      {/* Éclats de roche radiaux */}
      {SPARKS.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: Math.cos(rad) * 160, y: Math.sin(rad) * 160, scale: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-sm bg-amber-300"
            style={{ boxShadow: "0 0 7px rgba(202,138,4,0.9)" }}
          />
        );
      })}
      <GlyphFlash glyph="🪨" color="rgba(202,138,4,0.95)" />
    </>
  );
}

function GenericImpact({ move, fatal }: { move: Move; fatal: boolean }) {
  const hex = MOVE_PALETTE[move]?.hex ?? "#a78bfa";
  const glyph = move === "paper" ? "📜" : move === "lizard" ? "🦎" : "🖖";
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, fatal ? 0.9 : 0.75, 0], scale: [0.3, 2, 2.8] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-48 h-48 -ml-24 -mt-24 rounded-full"
        style={{ background: `radial-gradient(circle, ${hex} 0%, transparent 70%)`, mixBlendMode: "screen" }}
      />
      <motion.div
        initial={{ opacity: 0.9, scale: 0.2 }}
        animate={{ opacity: 0, scale: 3 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
        style={{ border: `4px solid ${hex}` }}
      />
      <GlyphFlash glyph={glyph} color={hex} />
    </>
  );
}
