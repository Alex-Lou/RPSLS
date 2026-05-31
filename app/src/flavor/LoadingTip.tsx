/**
 * LoadingTip — single-line rotating "did you know" surfaced anywhere we
 * make the user wait (splash screens, match-found pause, CPU
 * auto-simulation idle, etc.).
 *
 * Picks a tip on mount and (optionally) cycles every `rotateMs` ms with a
 * small fade. Pure presentation: no analytics, no persistence. Pulls
 * translated text through the i18n key `tip.<id>` and falls back to the
 * English string baked into TIPS.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { pickRandomTip, type Tip, type TipCategory } from "./tips";
import { useT } from "../i18n";

export function LoadingTip({
  category,
  rotateMs = 3500,
  className = "",
}: {
  /** Narrow the pool — e.g. "gameplay" for an in-match splash. */
  category?: TipCategory;
  /** How often to rotate to a new tip (ms). 0 = pick once, don't rotate. */
  rotateMs?: number;
  className?: string;
}) {
  const t = useT();
  const [tip, setTip] = useState<Tip>(() => pickRandomTip({ category }));

  useEffect(() => {
    if (rotateMs <= 0) return;
    const id = window.setInterval(() => {
      setTip((prev) => pickRandomTip({ category, exclude: prev.id }));
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [category, rotateMs]);

  // i18n.ts uses keyed strings; tip.<id> is the agreed shape. Fall back to
  // the English baked-in if the key isn't translated for the current locale.
  const text = (() => {
    const translated = t(`tip.${tip.id}`);
    return translated.startsWith("tip.") ? tip.text : translated;
  })();

  return (
    <div className={"flex items-start gap-2 text-zinc-300/90 " + className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={tip.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35 }}
          className="flex items-start gap-2 min-w-0"
        >
          <span aria-hidden className="text-base leading-tight shrink-0">
            {tip.icon}
          </span>
          <span className="text-xs sm:text-sm leading-snug">
            {text}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
