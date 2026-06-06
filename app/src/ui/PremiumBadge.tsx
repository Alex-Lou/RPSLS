/**
 * PremiumBadge — the "Premium" tag stuck on cosmetics that cost ✦ Étoiles.
 *
 * Two variants:
 *   "ribbon" (default) — slim corner ribbon for thumbnails / cards
 *   "pill"             — rounded pill for inline use next to a label
 *
 * Both render an animated gold halo + a subtle shimmer so the badge reads as
 * *prestige* at a glance, not as a sticker. Performance: pure CSS animations,
 * no JS timers, no canvas — drops anywhere without measurable cost.
 */

import { motion } from "motion/react";

export type PremiumBadgeVariant = "ribbon" | "pill";

export function PremiumBadge({
  variant = "ribbon",
  label = "PREMIUM",
  className = "",
}: {
  variant?: PremiumBadgeVariant;
  /** Override the displayed text (default "PREMIUM"). Used for e.g. "OWNED"
   *  once the player has the set so the slot stays decorated, not blank. */
  label?: string;
  /** Extra positioning classes (corner placement, etc.). */
  className?: string;
}) {
  if (variant === "pill") return <PremiumPill label={label} className={className} />;
  return <PremiumRibbon label={label} className={className} />;
}

function PremiumRibbon({ label, className }: { label: string; className: string }) {
  return (
    <div
      className={
        "pointer-events-none absolute select-none flex items-center gap-1 " +
        "px-2 py-0.5 rounded-full overflow-hidden " +
        "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 " +
        "text-[9px] font-black uppercase tracking-[0.18em] text-zinc-900 " +
        "shadow-[0_2px_10px_-2px_rgba(251,191,36,0.6),inset_0_1px_0_rgba(255,255,255,0.5)] " +
        "ring-1 ring-amber-200/70 " + className
      }
    >
      <Shimmer />
      <span aria-hidden className="relative">✦</span>
      <span className="relative">{label}</span>
    </div>
  );
}

function PremiumPill({ label, className }: { label: string; className: string }) {
  return (
    <motion.span
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className={
        "relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full overflow-hidden " +
        "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 " +
        "text-[11px] font-black uppercase tracking-[0.16em] text-zinc-900 " +
        "shadow-[0_4px_14px_-4px_rgba(251,191,36,0.7),inset_0_1px_0_rgba(255,255,255,0.6)] " +
        "ring-1 ring-amber-200/80 " + className
      }
    >
      <Shimmer />
      <Halo />
      <span aria-hidden className="relative text-sm leading-none">✦</span>
      <span className="relative">{label}</span>
    </motion.span>
  );
}

/** Diagonal moving highlight — pure CSS keyframes, no JS. */
function Shimmer() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 rounded-full"
      style={{
        background:
          "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
        backgroundSize: "220% 100%",
        animation: "premium-shimmer 2.8s linear infinite",
      }}
    />
  );
}

/** Soft gold halo behind the pill — sells the "prestige" feel without
 *  reading as gaudy. */
function Halo() {
  return (
    <motion.span
      aria-hidden
      className="absolute -inset-1.5 -z-10 rounded-full blur-md"
      style={{ background: "radial-gradient(circle, rgba(251,191,36,0.55), transparent 70%)" }}
      animate={{ opacity: [0.55, 0.85, 0.55] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* Once-globally injected keyframes for the shimmer. Idempotent. */
if (typeof document !== "undefined" && !document.getElementById("premium-badge-keyframes")) {
  const style = document.createElement("style");
  style.id = "premium-badge-keyframes";
  style.textContent =
    "@keyframes premium-shimmer { 0% { background-position: 220% 0; } 100% { background-position: -120% 0; } }";
  document.head.appendChild(style);
}
