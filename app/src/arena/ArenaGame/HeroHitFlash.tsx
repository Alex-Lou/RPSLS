import { AnimatePresence, motion } from "motion/react";

/** FLASH ÉCRAN dégâts héros (Alex 2026-06-11) — vignette bord d'écran qui
 *  pulse quand un héros prend un coup : ROUGE = TOI qui prends, DORÉ = tu
 *  infliges. Très "Hearthstone", rend la perte de PV palpable. Ne fire
 *  que sur dégât réel (heroHit n'est posé que si dmg > 0). */
export function HeroHitFlash({ heroHit }: { heroHit: { side: "you" | "opp"; key: number } | null }) {
  return (
    <AnimatePresence>
      {heroHit && (
        <motion.div
          key={`hitflash-${heroHit.key}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: heroHit.side === "you" ? [0, 0.9, 0] : [0, 0.45, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, times: [0, 0.18, 1], ease: "easeOut" }}
          className="fixed inset-0 z-[70] pointer-events-none"
          style={{
            background: heroHit.side === "you"
              ? "radial-gradient(ellipse 120% 90% at center, transparent 42%, rgba(244,63,94,0.6) 100%)"
              : "radial-gradient(ellipse 120% 90% at center, transparent 55%, rgba(252,211,77,0.4) 100%)",
          }}
        />
      )}
    </AnimatePresence>
  );
}
