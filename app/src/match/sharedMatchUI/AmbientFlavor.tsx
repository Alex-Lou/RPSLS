import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../../i18n";

/* ──────────── Ambient flavor (atmosphere only) ──────────── */

const FLAVOR_COUNT = 10;

/**
 * Random tiny one-liner from the `lanes.flavor.*` i18n bucket, rotating
 * every ~3.5s with soft fades. Used wherever there's idle pick time.
 */
export function AmbientFlavor() {
  const t = useT();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FLAVOR_COUNT));
  useEffect(() => {
    const id = setInterval(
      () => setIdx((cur) =>
        (cur + 1 + Math.floor(Math.random() * (FLAVOR_COUNT - 1))) % FLAVOR_COUNT),
      3500,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-[1.4em] flex items-center justify-center px-4 text-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.55, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4 }}
          className="text-[10px] italic text-ink-faint font-light tracking-wide"
        >
          {t(`lanes.flavor.${idx}`)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
