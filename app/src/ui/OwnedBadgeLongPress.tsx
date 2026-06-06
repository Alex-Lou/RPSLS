/**
 * OwnedBadgeLongPress — interactive wrapper around <PremiumBadge> for premium
 * sets the player owns.
 *
 * Long-press (~800ms) the badge → revoke the set so the purchase flow can be
 * re-tested. A subtle "release to revoke" hint fades in once the press passes
 * the half-way mark — tells the tester something is going to happen, prevents
 * a normal-tap user from doing it by accident.
 *
 * The wrapper renders a transparent overlay over the badge that stops the
 * pointer-down from bubbling to the parent picker button — otherwise the
 * picker would interpret the long-press as a normal tap and apply the bg
 * before the long-press timer fired.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { useLongPress } from "../fx/useLongPress";
import { PremiumBadge } from "./PremiumBadge";
import { useStore } from "../store/store";
import { hapticMatchWin } from "../haptic";

export function OwnedBadgeLongPress({
  setId,
  className = "",
}: {
  setId: string;
  className?: string;
}) {
  const revoke = useStore((s) => s.revokePremiumSet);
  const [pressing, setPressing] = useState(false);

  const handlers = useLongPress({
    delayMs: 800,
    onLongPress: () => {
      hapticMatchWin();
      revoke(setId);
      setPressing(false);
    },
  });

  return (
    <div
      {...handlers}
      onPointerDown={(e) => {
        // Stop the picker'\''s "tap to apply" from also firing — the long-press
        // is a dedicated affordance, not an alternate-tap.
        e.stopPropagation();
        handlers.onPointerDown(e);
        setPressing(true);
      }}
      onPointerUp={(e) => {
        handlers.onPointerUp();
        setPressing(false);
        // Block the click so the picker button doesn'\''t re-apply on release.
        e.stopPropagation();
      }}
      onPointerCancel={() => { handlers.onPointerCancel(); setPressing(false); }}
      onPointerLeave={() => { handlers.onPointerLeave(); setPressing(false); }}
      className={"absolute z-10 " + className}
    >
      <PremiumBadge variant="ribbon" label="✓ OWNED" />
      {pressing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-1.5 -bottom-1.5 -left-1.5 -right-1.5 rounded-full border-2 border-amber-300/70 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.18), transparent 70%)",
          }}
        />
      )}
    </div>
  );
}
