import { motion, AnimatePresence } from "motion/react";

/* ──────────── Pick VFX (impact on tap) ──────────── */

/**
 * Trigger a brief haptic buzz on a player tap. Delegates to the central
 * haptic.ts helper so it inherits the user's enable/intensity settings
 * — kept as a re-export under its old name for code-call-site stability.
 */
export { hapticTap as hapticTick } from "../../haptic";

/**
 * Fires a brief inflate-ring "shock" overlay on the parent button, useful for
 * marking the exact moment a pick was committed. Wrap one of these inside any
 * `relative` button next to its <Hand>/<Icon>.
 */
export function PickShock({
  show, color = "rgba(255,255,255,0.85)",
}: {
  show: boolean;
  color?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          key="shock"
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 1.4, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: `0 0 0 3px ${color}, 0 0 24px 6px ${color}` }}
        />
      )}
    </AnimatePresence>
  );
}
