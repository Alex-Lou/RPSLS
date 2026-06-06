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

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { PremiumBadge } from "./PremiumBadge";
import { useT } from "../i18n";
import { hapticMatchStart, hapticMatchWin, hapticTap } from "../haptic";

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
  /** Three phases:
   *   idle        — preview + buttons (normal)
   *   celebrating — gold burst + "✦ DÉBLOQUÉ" pulse, auto-closes ~2.2s later
   *   The closing handoff back to onClose is the parent's responsibility. */
  const [phase, setPhase] = useState<"idle" | "celebrating">("idle");

  useEffect(() => {
    if (!set) return;
    setPhase("idle"); // reset whenever a fresh set opens
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && phase === "idle") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // phase intentionally outside deps — we don't want closing-during-celebrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, onClose]);

  if (!set) return null;
  const affordable = stars >= set.cost;

  const handleBuy = () => {
    if (owned || phase !== "idle") return;
    const ok = buy(set.id, set.cost);
    if (!ok) { hapticTap(); return; }
    // Tap-confirm haptic NOW, success haptic at the burst peak (~280ms later)
    // so the player feels two distinct beats: "tap accepted" → "REWARD".
    hapticMatchStart();
    setPhase("celebrating");
    window.setTimeout(() => hapticMatchWin(), 280);
    window.setTimeout(() => onClose(), 2200);
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
        <AnimatePresence>
          {phase === "celebrating" && <CelebrationOverlay label={t("premium.unlocked")} />}
        </AnimatePresence>
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

/* ───── Celebration overlay — gold burst + shockwave + "✦ DÉBLOQUÉ !" ─────
 *
 * Pure CSS / motion. Sits on top of the modal card (absolute inset-0, z-[5])
 * so it covers the preview + content without breaking the rounded outline.
 * Twenty-four particles burst from the centre, a ring shockwave expands, and
 * the unlock label scales in with a slight rubber-band overshoot. Auto-fades
 * out after 2 s so the parent's setTimeout-onClose lands on a clean exit.
 */
function CelebrationOverlay({ label }: { label: string }) {
  const PARTICLES = 24;
  return (
    <motion.div
      className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Gold wash that floods the card on entry. */}
      <motion.span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(251,191,36,0.55), rgba(251,191,36,0.18) 35%, transparent 70%)",
        }}
        animate={{ opacity: [0, 0.95, 0.6, 0] }}
        transition={{ duration: 1.9, times: [0, 0.18, 0.5, 1], ease: "easeOut" }}
      />
      {/* Two expanding shockwave rings — staggered. */}
      {[0, 0.18].map((delay, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border-2 border-amber-300"
          style={{ width: 12, height: 12 }}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: [0, 14], opacity: [0.95, 0] }}
          transition={{ duration: 1.1, delay, ease: "easeOut" }}
        />
      ))}
      {/* Burst particles. Angle + distance chosen per index — deterministic,
          no Math.random so motion doesn't desync between StrictMode mounts. */}
      {Array.from({ length: PARTICLES }).map((_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        const dist = 110 + (i % 3) * 24;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const size = 5 + (i % 4);
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: i % 2 === 0 ? "#fde68a" : "#fbbf24",
              boxShadow: "0 0 10px rgba(251,191,36,0.85)",
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: dx,
              y: dy,
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.2, 1, 0.6],
            }}
            transition={{ duration: 1.4, delay: i * 0.008, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
      {/* Unlock label — big, with a rubber-band scale-in + sustained shimmer. */}
      <motion.div
        className="relative text-center"
        initial={{ scale: 0.4, opacity: 0, y: 12 }}
        animate={{ scale: [0.4, 1.18, 1], opacity: 1, y: 0 }}
        transition={{ duration: 0.7, times: [0, 0.55, 1], ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="text-2xl sm:text-3xl font-black uppercase tracking-[0.18em]"
          style={{
            background: "linear-gradient(90deg, #fde68a, #fbbf24, #fde68a)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 24px rgba(251,191,36,0.65)",
          }}
        >
          ✦ {label}
        </div>
      </motion.div>
    </motion.div>
  );
}
