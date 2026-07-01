/**
 * ArenaBoardChips — overlays de feedback combat affichés au CENTRE du pad.
 * Extraits verbatim du render d'ArenaBoard ; présentationnels purs (pilotés
 * par props), rendus dans le même ordre/z-index (tous z-40) que l'original :
 *   AugurFlash → TauntBlockChip → AntiTauntChip.
 */

import { AnimatePresence, motion } from "motion/react";
import type { LaneIndex, Side, TurnIntent } from "../arenaTypes";
import type { ArenaBoardProps } from "./ArenaBoard";

/** AUGUR FLASH — when EITHER side cast Augur this turn, a banner pops
 *  at the center during the spells phase so the player KNOWS the
 *  reveal just happened (then the chips on the hero strip show the
 *  actual cards). Alex flagged that Augur was invisible. */
export function AugurFlash({
  resolveStep, oppPreview, playerPreview,
}: {
  resolveStep: ArenaBoardProps["resolveStep"];
  oppPreview: TurnIntent | null | undefined;
  playerPreview: TurnIntent | null | undefined;
}) {
  return (
    <AnimatePresence>
      {(resolveStep === "spells" || resolveStep === "summons") &&
        ((oppPreview?.spells?.some((s) => s.id === "augur") ?? false) ||
          (playerPreview?.spells?.some((s) => s.id === "augur") ?? false)) && (
        <motion.div
          key="augur-flash"
          initial={{ opacity: 0, scale: 0.6, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 240, damping: 18 }}
          className="absolute left-1/2 top-[44%] -translate-x-1/2 z-40 pointer-events-none"
        >
          <div
            className="relative flex items-center gap-2 px-4 py-2 rounded-2xl backdrop-blur-sm shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(217,119,6,0.95) 0%, rgba(252,211,77,0.95) 50%, rgba(245,158,11,0.95) 100%)",
              border: "1px solid rgba(252,211,77,0.7)",
              boxShadow: "0 8px 32px -4px rgba(245,158,11,0.55), 0 0 24px rgba(252,211,77,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="text-2xl leading-none drop-shadow"
            >
              👁
            </motion.span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[8.5px] uppercase tracking-[0.22em] font-black text-amber-50/95">
                Augur
              </span>
              <span className="text-[12px] uppercase tracking-[0.14em] font-black text-white drop-shadow">
                Main révélée
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** TAUNT BLOCK CHIP — modern cosmic chip, lateral position so two
 *  consecutive deflects on the same row don't overlap. Anchored to
 *  the Pierre that absorbed the attack (rockLane drives left/center/
 *  right). Lighter anim (3 sparks instead of 6) for smoother frame
 *  pacing on mobile. */
export function TauntBlockChip({
  tauntBlock, playerSide,
}: {
  tauntBlock: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null;
  playerSide: Side;
}) {
  return (
    <AnimatePresence>
      {tauntBlock && (
        <motion.div
          key={tauntBlock.key}
          initial={{ opacity: 0, scale: 0.75, y: tauntBlock.defenderSide === playerSide ? 18 : -18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={
            "absolute z-40 pointer-events-none " +
            (tauntBlock.defenderSide === playerSide ? "bottom-[42%] " : "top-[42%] ") +
            (tauntBlock.rockLane === 0 ? "left-[6%]" :
             tauntBlock.rockLane === 2 ? "right-[6%]" :
             "left-1/2 -translate-x-1/2")
          }
        >
          {/* Outer glow halo — single short pulse (lighter than before). */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 0.8, 0], scale: [0.85, 1.8, 2.4] }}
            transition={{ duration: 0.95, ease: "easeOut" }}
            className="absolute inset-0 rounded-3xl"
            style={{
              background: "radial-gradient(circle, rgba(252,211,77,0.7) 0%, rgba(168,85,247,0.3) 40%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
          {/* Three sparkle motes — same radial pattern, fewer particles. */}
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.cos((i / 3) * Math.PI * 2) * 28,
                y: Math.sin((i / 3) * Math.PI * 2) * 28,
                scale: [0.5, 1.1, 0.4],
              }}
              transition={{ duration: 0.8, delay: 0.05 + i * 0.04, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-amber-200"
              style={{ boxShadow: "0 0 6px rgba(252,211,77,0.9)", marginLeft: -3, marginTop: -3 }}
            />
          ))}
          <div
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-sm shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.92) 0%, rgba(217,119,6,0.94) 70%, rgba(252,211,77,0.94) 100%)",
              border: "1px solid rgba(252,211,77,0.65)",
              boxShadow: "0 6px 24px -4px rgba(168,85,247,0.5), 0 0 18px rgba(252,211,77,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            <span className="text-base leading-none drop-shadow">🪨</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[7.5px] uppercase tracking-[0.2em] font-black text-amber-50/95">
                Pierre protège
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-black text-white drop-shadow">
                Attaque détournée
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** ANTI-TAUNT BYPASS CHIP — fires when a charged Pierre is BYPASSED
 *  because the attacker carries Étouffe (Feuille) or Logique (Spock).
 *  Pops on the bypassed Pierre so "pourquoi MA Pierre ne défend pas ?"
 *  is answered IN the combat, not only in the ArenaHowItWorks tooltip.
 *  Lighter than the deflect chip (no halo/sparkles) — it's a "why" note,
 *  not a celebratory save. */
export function AntiTauntChip({
  antiTaunt, playerSide,
}: {
  antiTaunt: { bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null;
  playerSide: Side;
}) {
  return (
    <AnimatePresence>
      {antiTaunt && (
        <motion.div
          key={"antitaunt-" + antiTaunt.key}
          initial={{ opacity: 0, scale: 0.75, y: antiTaunt.bypassedSide === playerSide ? 18 : -18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={
            "absolute z-40 pointer-events-none " +
            (antiTaunt.bypassedSide === playerSide ? "bottom-[42%] " : "top-[42%] ") +
            (antiTaunt.rockLane === 0 ? "left-[6%]" :
             antiTaunt.rockLane === 2 ? "right-[6%]" :
             "left-1/2 -translate-x-1/2")
          }
        >
          <div
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-sm shadow-2xl"
            style={{
              background: antiTaunt.cause === "paper"
                ? "linear-gradient(135deg, rgba(16,185,129,0.94) 0%, rgba(5,150,105,0.94) 100%)"
                : "linear-gradient(135deg, rgba(56,189,248,0.94) 0%, rgba(2,132,199,0.94) 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "0 6px 24px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <span className="text-base leading-none drop-shadow">🚫🪨</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[7.5px] uppercase tracking-[0.2em] font-black text-white/90">
                {antiTaunt.cause === "paper" ? "🍃 Étouffe" : "🖖 Logique"}
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-black text-white drop-shadow">
                Provoc annulée
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** RIPOSTE D'ESQUIVE CHIP — répond au « pourquoi l'attaquant meurt sans raison ? »
 *  (Alex 2026-06-28). Pop sur la lane de l'ATTAQUANT quand il frappe un Lézard qui
 *  esquive : le Lézard se dérobe ET contre-attaque. Note « pourquoi », légère. */
export function RiposteChip({
  riposteFX, playerSide,
}: {
  riposteFX: { attackerSide: "a" | "b"; lane: LaneIndex; key: number } | null;
  playerSide: Side;
}) {
  return (
    <AnimatePresence>
      {riposteFX && (
        <motion.div
          key={"riposte-" + riposteFX.key}
          initial={{ opacity: 0, scale: 0.75, y: riposteFX.attackerSide === playerSide ? 18 : -18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={
            "absolute z-40 pointer-events-none " +
            (riposteFX.attackerSide === playerSide ? "bottom-[42%] " : "top-[42%] ") +
            (riposteFX.lane === 0 ? "left-[6%]" :
             riposteFX.lane === 2 ? "right-[6%]" :
             "left-1/2 -translate-x-1/2")
          }
        >
          <div
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-sm shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.94) 0%, rgba(124,58,237,0.94) 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "0 6px 24px -4px rgba(124,58,237,0.5), 0 0 16px rgba(34,211,238,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <span className="text-base leading-none drop-shadow">✨⚔</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[7.5px] uppercase tracking-[0.2em] font-black text-white/90">
                🦎 Esquive
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-black text-white drop-shadow">
                Riposte !
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
