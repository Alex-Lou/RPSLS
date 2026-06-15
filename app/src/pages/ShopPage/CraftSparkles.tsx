import { motion } from "motion/react";

/* ─────────── Craft sparkles ─────────── */

/**
 * CraftSparkles — short burst of violet motes that converge into the row
 * the moment a card is forged. Pure decoration; lives ~1.8s in sync with
 * the parent's `justCrafted` window.
 */
export function CraftSparkles() {
  const DOTS = 14;
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none z-30">
      {/* Soft violet wash so the row reads "just lit up" before the dust
          arrives — primes the eye for the sparkle layer. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 1.6 }}
        className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-400/30 via-fuchsia-400/20 to-transparent"
      />
      {Array.from({ length: DOTS }).map((_, i) => {
        // Particles start at random positions across the row and travel
        // toward the icon on the left (the freshly-forged card thumbnail).
        const startX = 30 + (i * 7) % 70;
        const startY = -20 + (i * 11) % 60;
        const endX = -10 + (i * 3) % 14;
        const endY = 18 + (i * 5) % 12;
        const delay = (i % 5) * 0.05;
        const size = 3 + (i % 3);
        return (
          <motion.div
            key={i}
            initial={{ x: `${startX}%`, y: startY, opacity: 0, scale: 0.4 }}
            animate={{ x: `${endX}%`, y: endY, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.2] }}
            transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: i % 2 ? "#c4b5fd" : "#f0abfc",
              boxShadow: i % 2
                ? "0 0 8px rgba(196,181,253,0.9)"
                : "0 0 8px rgba(240,171,252,0.9)",
            }}
          />
        );
      })}
    </div>
  );
}
