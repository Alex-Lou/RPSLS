import { motion } from "motion/react";
import { MOVES } from "../../engine/game";
import type { Move } from "../../engine/game";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { hapticTap } from "../../haptic";
import type { CardId } from "../../ranked/rankedTypes";
import type { ArenaTargeting, TurnIntent } from "../arenaTypes";

/** RPSLS move picker — compact strip. Tap to enter targeting mode THEN tap a
 *  lane on the board, OR drag the symbol directly onto a lane for one-gesture
 *  commit. State + drag-commit logic stay in ArenaPlanPhase; this is the
 *  presentational strip rendering the 5 buttons. */
export function ArenaMovePicker({
  intent, manaLeft, disabled, targeting,
  pickMoveToSummon, setInspecting, setTargeting, commitDragDrop,
}: {
  intent: TurnIntent;
  manaLeft: number;
  disabled: boolean;
  targeting: ArenaTargeting;
  pickMoveToSummon: (mv: Move) => void;
  setInspecting: (id: CardId | null) => void;
  setTargeting: (t: ArenaTargeting) => void;
  commitDragDrop: (point: { x: number; y: number }, current: ArenaTargeting) => boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-1 sm:gap-1.5 max-w-md mx-auto w-full landscape:w-[340px] landscape:max-w-none landscape:mx-0 landscape:shrink-0">
      {MOVES.map((mv) => {
        const pal = MOVE_PALETTE[mv];
        const cannotAfford = manaLeft < 1;
        // isTargeting OU déjà confirmé dans intent.summons (Alex 2026-06-11) :
        // le glow gold sur le picker remplace la mini-carte chip de la queue.
        const isPlannedSummon = intent.summons.some((s) => s.move === mv);
        const isTargeting = (targeting?.kind === "summon" && targeting.move === mv) || isPlannedSummon;
        const rim = moveRim(pal.hex);
        const glow = moveGlow(pal.hex);
        const canDrag = !cannotAfford && !disabled;
        return (
          <motion.button
            key={mv}
            type="button"
            drag={canDrag}
            dragSnapToOrigin
            dragMomentum={false}
            dragElastic={0.18}
            dragTransition={{ bounceStiffness: 720, bounceDamping: 28, power: 0.35 }}
            whileDrag={{ scale: 1.12, zIndex: 60, transition: { type: "spring", stiffness: 520, damping: 32 } }}
            onTap={() => pickMoveToSummon(mv)}
            onDragStart={() => {
              if (!canDrag) return;
              hapticTap();
              setInspecting(null);
              setTargeting({ kind: "summon", move: mv });
            }}
            onDragEnd={(_e, info) => {
              if (!canDrag) return;
              commitDragDrop(info.point, { kind: "summon", move: mv });
            }}
            disabled={cannotAfford || disabled}
            className={
              "relative h-12 sm:h-14 rounded-lg flex items-center justify-center active:scale-92 select-none overflow-hidden " +
              (cannotAfford ? "opacity-30 grayscale " : "") +
              (isTargeting ? "scale-105 " : "")
            }
            style={{
              touchAction: "none",
              background: `linear-gradient(160deg, color-mix(in oklab, ${pal.hex} 24%, rgba(20,22,32,0.95)) 0%, color-mix(in oklab, ${pal.hex} 8%, rgba(10,12,20,0.95)) 100%)`,
              border: `2px solid ${isTargeting ? "rgba(252, 211, 77, 0.95)" : rim}`,
              boxShadow: isTargeting
                ? `0 0 18px -2px rgba(252, 211, 77, 0.85), inset 0 0 14px ${glow}, inset 0 1px 0 rgba(255,255,255,0.12)`
                : `0 0 14px -3px ${glow}, inset 0 0 10px color-mix(in oklab, ${pal.hex} 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.14)`,
            }}
          >
            {/* Subtle pulse ring — slow breathe in idle, hidden when targeting (overlap with the strong amber ring). */}
            {!isTargeting && !cannotAfford && (
              <motion.span
                aria-hidden
                animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.04, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-[2px] rounded-md pointer-events-none"
                style={{ boxShadow: `inset 0 0 8px ${glow}` }}
              />
            )}
            <MoveGlyph move={mv} className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
            <span
              className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
              style={{ background: pal.hex, boxShadow: `0 0 5px ${pal.hex}` }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
