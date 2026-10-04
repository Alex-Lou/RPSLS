import { forwardRef, useImperativeHandle, useRef } from "react";
import { motion } from "motion/react";
import { useT } from "../i18n";
import { FloatingMatchBackButton, useAndroidBackPrompt, type MatchBackHandle } from "../match/sharedMatchUI";

/* Contrôles d'en-tête du match Classé (garde « retour » + bouton retour
 * inline), extraits VERBATIM de RankedMatchView. */

/** Wraps FloatingMatchBackButton so the Android system back button (which
 *  would otherwise blow past every confirm) routes to the same modal as the
 *  inline back arrow. Le bouton flottant est `hidden` : le retour est désormais
 *  rendu INLINE dans la rangée d'en-tête (à droite du score), qui déclenche le
 *  même modal via le handle exposé ici. */
export const RankedBackGuard = forwardRef<MatchBackHandle, { onLeave: () => void; label: string }>(
  function RankedBackGuard({ onLeave, label }, ref) {
    const t = useT();
    const handleRef = useRef<MatchBackHandle | null>(null);
    useAndroidBackPrompt(() => handleRef.current?.triggerConfirm());
    useImperativeHandle(ref, () => ({
      triggerConfirm: () => handleRef.current?.triggerConfirm(),
    }), []);
    return (
      <FloatingMatchBackButton
        ref={handleRef}
        hidden
        onClick={onLeave}
        label={label}
        confirm={{
          title: t("match.quitConfirm"),
          body: t("ranked.quit.body"),
          confirmLabel: t("arena.quit.confirm"),
          cancelLabel: t("arena.quit.cancel"),
          severity: "danger",
        }}
      />
    );
  },
);

/** Bouton retour INLINE themed — miroir de l'InlineBurger (même gabarit + même
 *  traitement color-mix var(--theme-*)) pour une symétrie parfaite [burger] …
 *  [retour] de part et d'autre du score. Ne fait QUE déclencher le modal forfait
 *  (via le handle du RankedBackGuard) : aucune logique de sortie propre ici. */
export function InlineBackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      data-no-touchfx
      className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center active:scale-95 transition backdrop-blur"
      style={{
        background: "color-mix(in oklab, var(--theme-primary) 16%, rgba(10,12,20,0.82))",
        borderColor: "color-mix(in oklab, var(--theme-primary) 55%, transparent)",
        color: "color-mix(in oklab, var(--theme-primary) 80%, #fff)",
        boxShadow: "0 0 16px -6px var(--theme-primary), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </motion.button>
  );
}
