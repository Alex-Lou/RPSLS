import { motion } from "motion/react";
import { hapticTap } from "../../haptic";
import type { ArenaTargeting } from "../arenaTypes";

/** FIN DE TOUR — bouton ROND doré fixe (ancre visuelle façon Hearthstone),
 *  badge MANA PLANIFIÉ intégré. Remplace l'ancien pill centré + la ligne texte
 *  "Mana restant" (info dans le bouton). */
export function ArenaLockButton({
  canLock, targeting, setTargeting, onLock,
}: {
  canLock: boolean;
  targeting: ArenaTargeting;
  setTargeting: (t: ArenaTargeting) => void;
  onLock: () => void;
}) {
  return (
    <div className="relative shrink-0 pb-1.5 pr-0.5">
      {canLock && (
        <motion.div
          aria-hidden
          animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.94, 1.1, 0.94] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(252,211,77,0.85), transparent 70%)", filter: "blur(10px)" }}
        />
      )}
      <button
        type="button"
        onClick={() => {
          if (targeting) setTargeting(null);
          if (canLock) {
            hapticTap();
            onLock();
          }
        }}
        disabled={!canLock}
        className={
          "relative w-14 h-14 rounded-full flex flex-col items-center justify-center leading-none transition active:scale-[0.94] " +
          (canLock
            ? "text-zinc-900 shadow-xl ring-2 ring-amber-200/80"
            : "bg-hairline text-ink-faint cursor-not-allowed ring-2 ring-white/10")
        }
        style={canLock ? {
          background: "linear-gradient(140deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)",
          fontFamily: "var(--font-headline)",
          boxShadow: "0 6px 18px -4px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.5)",
          touchAction: "manipulation",
        } : { touchAction: "manipulation" }}
      >
        {/* Badge mana retiré (Alex 2026-06-13 : "le chiffre + flèche pas
         *  clair") — le mana est déjà lisible sur le strip you. Le bouton
         *  ne dit plus que "FIN". */}
        <span className="text-[12px] font-black tracking-wider leading-none">FIN</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-80 leading-none mt-0.5">de tour</span>
      </button>
    </div>
  );
}
