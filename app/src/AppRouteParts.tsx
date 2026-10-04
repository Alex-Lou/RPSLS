/**
 * Petits enveloppes de routes du shell (repli Suspense + transition de page)
 * — extraits verbatim d'App.tsx.
 */
import { motion } from "motion/react";

/** Minimal Suspense fallback for lazy-loaded routes. Renders a dark
 *  full-screen panel with a faint pulse — short enough that even on a
 *  slow chunk fetch it doesn't feel like an error state. */
export function RouteFallback() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex-1 flex items-center justify-center"
      aria-busy
      aria-live="polite"
    >
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="w-2.5 h-2.5 rounded-full bg-violet-400"
      />
    </motion.div>
  );
}

export function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col min-h-0"
    >
      {children}
    </motion.div>
  );
}
