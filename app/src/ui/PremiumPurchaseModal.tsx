/**
 * PremiumPurchaseModal — test-only purchase flow for ✦ Étoiles cosmetics.
 *
 * Status: SIMULATION. The "Acheter" button calls store.simulatePremiumPurchase
 * which never touches a real payment provider. Production swap-in is a server
 * call that verifies the IAP receipt before granting the set — wiring stays
 * the same on the client (debit ✦, push ownedPremiumSets), only the gate
 * moves server-side.
 *
 * Dev affordance: "+1000 ✦ TEST" credits stars locally so you can iterate on
 * the modal without grinding receipts. Hidden on release builds via the
 * `__DEV_PREMIUM__` flag at the top of the file.
 */

import { useEffect } from "react";
import { motion } from "motion/react";
import { useStore } from "../store/store";
import { PremiumBadge } from "./PremiumBadge";
import { useT } from "../i18n";
import { hapticMatchWin, hapticTap } from "../haptic";

const __DEV_PREMIUM__ = true;

export interface PremiumSet {
  id: string;
  /** Display name (already-translated string, not an i18n key, because each
   *  set name has its own poetry). */
  name: string;
  /** Short one-liner shown under the name. */
  tagline: string;
  /** Cost in ✦ Étoiles. Sets are priced per "set" (bg + pad + HUD bundled). */
  cost: number;
  /** Hero artwork to preview at the top of the modal. Background or pad
   *  thumbnail, whichever sells the set best. */
  previewArt: React.ReactNode;
}

export function PremiumPurchaseModal({
  set,
  onClose,
}: {
  set: PremiumSet | null;
  onClose: () => void;
}) {
  const stars = useStore((s) => s.player.stars ?? 0);
  const owned = useStore((s) => (s.player.ownedPremiumSets ?? []).includes(set?.id ?? ""));
  const buy = useStore((s) => s.simulatePremiumPurchase);
  const grant = useStore((s) => s.grantStars);
  const t = useT();

  useEffect(() => {
    if (!set) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set, onClose]);

  if (!set) return null;
  const affordable = stars >= set.cost;

  const handleBuy = () => {
    if (owned) return;
    const ok = buy(set.id, set.cost);
    if (ok) {
      hapticMatchWin();
      onClose();
    } else {
      hapticTap();
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.92, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="relative w-full max-w-sm rounded-3xl border border-amber-300/30 bg-zinc-950/95 shadow-[0_30px_80px_-10px_rgba(251,191,36,0.35)] overflow-hidden"
      >
        <div className="absolute top-3 right-3 z-10">
          <PremiumBadge variant="pill" label={t("premium.label")} />
        </div>
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-black relative overflow-hidden">
          {set.previewArt}
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold">
              {t("premium.setKindLabel")}
            </div>
            <h2 className="text-xl font-black text-ink leading-tight">{set.name}</h2>
            <p className="text-xs text-ink-muted mt-1">{set.tagline}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-300/30 px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-amber-200/80 font-bold">
              {t("premium.priceLabel")}
            </span>
            <span className="text-base font-black text-amber-200 inline-flex items-center gap-1">
              <span className="text-lg leading-none">✦</span>{set.cost.toLocaleString("fr-FR")}
            </span>
          </div>
          <div className="text-[11px] text-ink-faint text-center">
            {t("premium.youHave", { n: stars.toLocaleString("fr-FR") })}
          </div>
          <div className="flex flex-col gap-2 mt-1">
            {owned ? (
              <div className="text-center text-emerald-300 font-bold text-sm py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40">
                {t("premium.alreadyOwned")}
              </div>
            ) : (
              <button
                onClick={handleBuy}
                disabled={!affordable}
                className={
                  "py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition " +
                  (affordable
                    ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-zinc-900 shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-hairline text-ink-faint cursor-not-allowed")
                }
              >
                {affordable ? t("premium.buy") : t("premium.notEnough")}
              </button>
            )}
            {__DEV_PREMIUM__ && !owned && (
              <button
                onClick={() => { hapticTap(); grant(1000); }}
                className="text-[10px] uppercase tracking-wider text-ink-muted py-1 rounded hover:text-amber-300 transition"
              >
                {t("premium.devGrant")}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs text-ink-muted py-1.5 hover:text-ink transition"
            >
              {t("premium.close")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
