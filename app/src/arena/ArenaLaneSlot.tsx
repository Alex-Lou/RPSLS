/**
 * ArenaLaneSlot — single lane cell on the board.
 *
 * Renders one of three states:
 *   1. Real creature (with stats, status icons, damage flash, dmg popup)
 *   2. Ghost-preview of a planned summon (dashed border, "en attente")
 *   3. Empty placeholder ("vide")
 *
 * Extracted from ArenaBoard.tsx to keep that file under the project's
 * 400-line ceiling. Only consumed by ArenaBoard's LaneRow.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { CREATURE_STATS, type Creature, type LaneIndex } from "./arenaTypes";

export interface ArenaLaneSlotProps {
  lane: LaneIndex;
  creature: Creature | null;
  plannedSummon: { lane: LaneIndex; move: Creature["move"] } | null;
  isPlayer: boolean;
  /** When false, the ghost-preview branch is skipped (used to suppress the
   *  player's own planned summons from rendering on the opp row, etc.). */
  showPlanned?: boolean;
}

export function ArenaLaneSlot({
  creature, plannedSummon, isPlayer, showPlanned = false,
}: ArenaLaneSlotProps) {
  // Track previous HP so we can spawn a "-N" floating popup when this lane's
  // creature takes damage. We guard by move identity to avoid false-positives
  // when one creature dies and another spawns on the same lane.
  const prevRef = useRef<{ hp: number; move: Creature["move"] | null } | null>(null);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (creature && prev && prev.move === creature.move && creature.hp < prev.hp) {
      const dmg = prev.hp - creature.hp;
      setDmgPop({ n: dmg, key: Date.now() });
      const id = window.setTimeout(() => setDmgPop(null), 1000);
      prevRef.current = { hp: creature.hp, move: creature.move };
      return () => window.clearTimeout(id);
    }
    prevRef.current = creature ? { hp: creature.hp, move: creature.move } : null;
  }, [creature]);

  if (creature) {
    const stats = CREATURE_STATS[creature.move];
    const atk = Math.max(0, stats.atk + creature.atkBuff);
    const lowHp = creature.hp <= 1;
    const pal = MOVE_PALETTE[creature.move];
    const rim = moveRim(pal.hex);
    const glow = moveGlow(pal.hex);
    // Side affinity tinting: player creatures get an emerald inner badge,
    // opp creatures get a rose one — visual ownership cue independent of
    // the move's signature color (kept on the frame rim).
    const sideTint = isPlayer ? "rgba(52,211,153,0.55)" : "rgba(244,63,94,0.55)";
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: isPlayer ? 12 : -12, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="aspect-[5/4] w-full rounded-xl relative flex flex-col items-center justify-center overflow-hidden transition"
        style={{
          background: "linear-gradient(160deg, rgba(20,22,32,0.94) 0%, rgba(10,12,20,0.94) 100%)",
          border: `2px solid ${creature.divineShield ? "rgba(252,211,77,0.95)" : rim}`,
          boxShadow:
            (creature.divineShield
              ? "0 0 20px -2px rgba(252,211,77,0.7), "
              : `0 0 14px -3px ${glow}, `) +
            `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${sideTint}30`,
        }}
      >
        {/* Side-affinity dot top-left */}
        <div
          className="absolute top-1 left-1 w-2 h-2 rounded-full"
          style={{ background: sideTint, boxShadow: `0 0 6px ${sideTint}` }}
          aria-hidden
        />
        <MoveGlyph move={creature.move} className="w-10 h-10 sm:w-12 sm:h-12" />
        <span
          className="text-[7px] uppercase tracking-wider font-black leading-none mt-0.5"
          style={{ color: rim }}
        >
          {creature.move}
        </span>
        {/* ATK and HP corner badges */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-1 pb-0.5">
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/85 text-amber-50 text-[10px] font-black leading-none tabular-nums shadow">
            ⚔ {atk}
            {creature.atkBuff > 0 && <span className="text-[7px] opacity-90">+{creature.atkBuff}</span>}
            {creature.atkBuff < 0 && <span className="text-[7px] opacity-90">{creature.atkBuff}</span>}
          </span>
          <motion.span
            key={creature.hp}
            initial={{ scale: 1.3, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#fee2e2" }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-600/85 text-[10px] font-black leading-none tabular-nums shadow"
          >
            ❤ {creature.hp}/{stats.hp}
          </motion.span>
        </div>
        {/* Status icons top-right */}
        <div className="absolute top-1 right-1 flex items-center gap-0.5">
          {creature.divineShield && <span className="text-[10px]" title="Bouclier divin">🛡️</span>}
          {creature.anchored && <span className="text-[10px]" title="Ancré">⚓</span>}
          {creature.ripostePrimed && <span className="text-[10px]" title="Riposte">⚔️</span>}
        </div>
        {/* Floating damage popup */}
        <AnimatePresence>
          {dmgPop && (
            <motion.div
              key={dmgPop.key}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -28, scale: 1.15 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
              style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
            >
              −{dmgPop.n}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (plannedSummon && showPlanned) {
    const pal = MOVE_PALETTE[plannedSummon.move];
    const rim = moveRim(pal.hex);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        className="aspect-[5/4] w-full rounded-xl relative flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(20,22,32,0.55) 0%, rgba(10,12,20,0.55) 100%)",
          border: `2px dashed ${rim}`,
          boxShadow: `0 0 10px -3px ${moveGlow(pal.hex)}80`,
        }}
      >
        <MoveGlyph move={plannedSummon.move} className="w-10 h-10 sm:w-12 sm:h-12 opacity-80" />
        <span
          className="text-[7px] uppercase tracking-wider font-bold leading-none mt-0.5 opacity-90"
          style={{ color: rim }}
        >
          {plannedSummon.move}
        </span>
        <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-emerald-200/90 uppercase tracking-[0.18em] font-black">
          en attente
        </span>
      </motion.div>
    );
  }

  return (
    <div className="aspect-[5/4] w-full rounded-xl border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center">
      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">vide</span>
    </div>
  );
}
