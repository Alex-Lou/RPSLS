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
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { formatNumber } from "../i18n/format";
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

  // Reset to idle ONLY when a different set opens. This effect must NOT
  // depend on `onClose` — the parent passes a fresh inline onClose on every
  // render, and the purchase itself triggers a parent re-render (store
  // update). If onClose were a dep, that re-render would re-run this effect
  // and slam phase back to "idle" the instant the celebration started —
  // which is exactly why the unlock animation was invisible. `set` is a
  // stable module-const reference per id, so this fires only on a real open.
  useEffect(() => {
    if (set) setPhase("idle");
  }, [set]);

  // Esc-to-close, idle phase only. Separate effect so its onClose dependency
  // can't reset the celebration phase.
  useEffect(() => {
    if (!set) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && phase === "idle") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set, onClose, phase]);

  if (!set) return null;
  const affordable = stars >= set.cost;

  const handleBuy = () => {
    if (owned || phase !== "idle") return;
    // Affordability pre-check so we can start the animation BEFORE the heavy
    // store mutation. The buy() call below triggers Zustand persist, which
    // serialises the whole player state to localStorage synchronously — if
    // that runs on the same tick as setPhase, it janks the celebration's
    // first frame (the freeze Alex saw). We start the burst first, then defer
    // buy() by two animation frames so the opening frames render smoothly.
    if (stars < set.cost) { hapticTap(); return; }
    hapticMatchStart();
    setPhase("celebrating");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      buy(set.id, set.cost);
      window.setTimeout(() => hapticMatchWin(), 60);
    }));
    window.setTimeout(() => onClose(), 2200);
  };

  // Portal to <body> so the modal escapes any stacking context created by
  // the profile page / the full-screen peek it opens over. WITHOUT this, the
  // peek (portaled to body at z-[9999]) sits ON TOP of the modal and its
  // celebration — the player saw nothing on purchase. z-[10000] clears it.
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    >
      {/* Full-screen celebration — rendered as a SIBLING of the card (not
          inside it) so the burst fills the whole screen instead of being
          clipped to the small card. z above the card. */}
      <AnimatePresence>
        {phase === "celebrating" && (
          <CelebrationOverlay label={t("premium.unlocked")} setId={set.id} />
        )}
      </AnimatePresence>
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
              <span className="text-lg leading-none">✦</span>{formatNumber(set.cost)}
            </span>
          </div>
          <div className="text-[11px] text-ink-faint text-center">
            {t("premium.youHave", { n: formatNumber(stars) })}
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
                className="text-[11px] uppercase tracking-wider font-bold text-amber-300 py-2 rounded-lg border border-amber-300/40 bg-amber-300/5 hover:bg-amber-300/15 transition"
              >
                ✦ +1000 TEST (dev)
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
    </motion.div>,
    document.body,
  );
}

/* ───── Themed celebration overlay ─────
 *
 * Burst, rings, label — every parameter switches per set so each purchase
 * feels like a different ritual:
 *   eclipse    → corona gold + 8 radial spokes + amber wash
 *   phantom    → spectral teal wisps rising + ghost flash
 *   tempus     → bronze sand grains pouring in a cyclone
 *   storm      → cyan-purple lightning forks + screen flash
 *   emberforge → orange-gold ember burst + shock ring (kept "powerful" per
 *                user's love for this theme)
 *   quartz     → prismatic dichroic shards radiating + spectral sweep
 *   default    → original gold burst (legacy fallback)
 *
 * Mounts above modal card (z-[5]), pointer-events-none, ~2s self-fade. */
type CelebrationFlavor = {
  wash: string;                        // big radial flash background
  ringColor: string;                   // expanding shockwave ring border
  particleA: string;
  particleB: string;
  particleShadow: string;
  labelGradient: string;               // CSS linear-gradient for the unlock label
  labelGlow: string;                   // text-shadow colour
  shapes: "dots" | "shards" | "wisps" | "grains" | "forks" | "sparks";
};
const FLAVORS: Record<string, CelebrationFlavor> = {
  eclipse: {
    wash: "radial-gradient(circle at 50% 45%, rgba(255,206,120,0.78), rgba(212,167,69,0.32) 32%, rgba(40,28,18,0) 70%)",
    ringColor: "#f6cf80",
    particleA: "#fde9bf",
    particleB: "#d4a745",
    particleShadow: "0 0 14px rgba(246,207,128,0.95)",
    labelGradient: "linear-gradient(90deg, #fde9bf, #d4a745, #fde9bf)",
    labelGlow: "rgba(212,167,69,0.85)",
    shapes: "sparks",
  },
  phantom: {
    wash: "radial-gradient(circle at 50% 45%, rgba(160,200,235,0.75), rgba(106,138,170,0.28) 35%, rgba(20,28,42,0) 70%)",
    ringColor: "#cfe3f4",
    particleA: "#e0eef9",
    particleB: "#8ba6c2",
    particleShadow: "0 0 16px rgba(207,227,244,0.80)",
    labelGradient: "linear-gradient(90deg, #ffffff, #b8d0e6, #ffffff)",
    labelGlow: "rgba(180,210,235,0.80)",
    shapes: "wisps",
  },
  tempus: {
    wash: "radial-gradient(circle at 50% 50%, rgba(214,167,106,0.72), rgba(139,105,20,0.30) 35%, rgba(26,18,8,0) 70%)",
    ringColor: "#d4a76a",
    particleA: "#f0d4a0",
    particleB: "#b8956a",
    particleShadow: "0 0 12px rgba(212,167,106,0.90)",
    labelGradient: "linear-gradient(90deg, #f0d4a0, #b8956a, #f0d4a0)",
    labelGlow: "rgba(180,140,80,0.85)",
    shapes: "grains",
  },
  storm: {
    wash: "radial-gradient(circle at 50% 45%, rgba(120,220,255,0.78), rgba(160,120,255,0.32) 35%, rgba(8,12,24,0) 70%)",
    ringColor: "#7adcff",
    particleA: "#a8f0ff",
    particleB: "#a078ff",
    particleShadow: "0 0 18px rgba(122,220,255,0.95)",
    labelGradient: "linear-gradient(90deg, #b0f0ff, #a078ff, #b0f0ff)",
    labelGlow: "rgba(120,220,255,0.90)",
    shapes: "forks",
  },
  emberforge: {
    wash: "radial-gradient(circle at 50% 45%, rgba(255,148,38,0.82), rgba(255,106,20,0.35) 35%, rgba(26,8,4,0) 70%)",
    ringColor: "#ff9426",
    particleA: "#ffd9a3",
    particleB: "#ff6a14",
    particleShadow: "0 0 16px rgba(255,148,38,0.95)",
    labelGradient: "linear-gradient(90deg, #ffd9a3, #ff9426, #ffd9a3)",
    labelGlow: "rgba(255,106,20,0.95)",
    shapes: "sparks",
  },
  quartz: {
    wash: "radial-gradient(circle at 50% 45%, rgba(232,210,250,0.72), rgba(200,174,240,0.30) 35%, rgba(30,20,50,0) 70%)",
    ringColor: "#dabffa",
    particleA: "#f6a5b8",
    particleB: "#c8aef0",
    particleShadow: "0 0 16px rgba(218,191,250,0.90)",
    labelGradient: "linear-gradient(90deg, #ffe2f7, #c8aef0, #ffe2f7)",
    labelGlow: "rgba(200,174,240,0.85)",
    shapes: "shards",
  },
};
const DEFAULT_FLAVOR: CelebrationFlavor = {
  wash: "radial-gradient(circle at 50% 45%, rgba(251,191,36,0.55), rgba(251,191,36,0.18) 35%, transparent 70%)",
  ringColor: "#fcd34d",
  particleA: "#fde68a",
  particleB: "#fbbf24",
  particleShadow: "0 0 10px rgba(251,191,36,0.85)",
  labelGradient: "linear-gradient(90deg, #fde68a, #fbbf24, #fde68a)",
  labelGlow: "rgba(251,191,36,0.65)",
  shapes: "dots",
};
function CelebrationOverlay({ label, setId }: { label: string; setId?: string }) {
  // 18 (was 28): on mid-range phones, 28 simultaneously-animated compositor
  // layers ON TOP of the still-running WebGL backdrop dropped frames. 18 reads
  // just as full but stays at 60fps. Each particle carries willChange:transform
  // so the compositor promotes it once up-front instead of mid-animation.
  const PARTICLES = 18;
  const f = (setId && FLAVORS[setId]) || DEFAULT_FLAVOR;
  return (
    <motion.div
      className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Themed wash flood. */}
      <motion.span
        className="absolute inset-0"
        style={{ background: f.wash }}
        animate={{ opacity: [0, 0.98, 0.6, 0] }}
        transition={{ duration: 2.0, times: [0, 0.18, 0.5, 1], ease: "easeOut" }}
      />
      {/* Three expanding shockwave rings — staggered, themed border colour. */}
      {[0, 0.16, 0.32].map((delay, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: 12, height: 12, border: `2px solid ${f.ringColor}` }}
          initial={{ scale: 0, opacity: 0.92 }}
          animate={{ scale: [0, 16], opacity: [0.95, 0] }}
          transition={{ duration: 1.3, delay, ease: "easeOut" }}
        />
      ))}
      {/* Themed particle burst. Each FLAVOR.shapes value renders a slightly
          different particle aesthetic without doubling the codepath: a single
          motion.span with width/height/border-radius/rotate that varies. */}
      {Array.from({ length: PARTICLES }).map((_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        // Forks shoot straight down (lightning), wisps drift upward only.
        const dist = 110 + (i % 4) * 28;
        let dx = Math.cos(angle) * dist;
        let dy = Math.sin(angle) * dist;
        if (f.shapes === "wisps") {
          dx = Math.cos(angle) * 60;
          dy = -Math.abs(Math.sin(angle)) * 140 - 30;
        } else if (f.shapes === "forks") {
          dx = (((i % 5) - 2) / 2) * 90 + Math.cos(angle) * 18;
          dy = 60 + (i % 4) * 30;
        } else if (f.shapes === "grains") {
          dx = Math.cos(angle * 1.6) * (60 + (i % 4) * 12);
          dy = 30 + (i % 7) * 20;
        }
        let width = 5 + (i % 4);
        let height = width;
        let borderRadius = "9999px";
        let rotate = 0;
        if (f.shapes === "shards") {
          width = 3 + (i % 3);
          height = 14 + (i % 5) * 3;
          borderRadius = "2px";
          rotate = (angle * 180) / Math.PI + 90;
        } else if (f.shapes === "wisps") {
          width = 4 + (i % 3);
          height = 22 + (i % 6) * 2;
          borderRadius = "9999px";
        } else if (f.shapes === "forks") {
          width = 2;
          height = 36 + (i % 4) * 8;
          borderRadius = "1px";
        } else if (f.shapes === "grains") {
          width = 3 + (i % 3);
          height = 3 + (i % 3);
          borderRadius = "9999px";
        }
        return (
          <motion.span
            key={i}
            className="absolute"
            style={{
              width,
              height,
              borderRadius,
              background: i % 2 === 0 ? f.particleA : f.particleB,
              boxShadow: f.particleShadow,
              willChange: "transform, opacity",
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate }}
            animate={{
              x: dx,
              y: dy,
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.2, 1, 0.5],
              rotate: rotate + (f.shapes === "shards" ? 60 : 0),
            }}
            transition={{ duration: 1.6, delay: i * 0.008, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
      {/* Unlock label — themed gradient + glow. */}
      <motion.div
        className="relative text-center"
        initial={{ scale: 0.4, opacity: 0, y: 12 }}
        animate={{ scale: [0.4, 1.22, 1], opacity: 1, y: 0 }}
        transition={{ duration: 0.75, times: [0, 0.55, 1], ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="text-2xl sm:text-3xl font-black uppercase tracking-[0.18em]"
          style={{
            background: f.labelGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            textShadow: `0 0 28px ${f.labelGlow}`,
          }}
        >
          ✦ {label}
        </div>
      </motion.div>
    </motion.div>
  );
}
