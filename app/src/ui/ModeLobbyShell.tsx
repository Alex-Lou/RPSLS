/**
 * ModeLobbyShell — TEMPLATE UNIQUE des lobbies de mode (Entraînement,
 * Constellation, Classé, Constellation Classée, Pro, En ligne).
 *
 *   Portrait                         Paysage
 *   ┌ barre du haut (AppTopBar) ┐    ┌ barre du haut ─────────────────┐
 *   ├ HÉROS du mode (élastique) ┤    ├ HÉROS      │ réglages (scroll) │
 *   ├ réglages (scroll si besoin)┤   │ (colonne)  │ CTA docké         │
 *   ├ CTA principal docké        ┤   └────────────┴───────────────────┘
 *   └ rangée secondaire          ┘
 *
 * Le titre + le retour vivent dans la barre du haut (useTopBar) : retour
 * TOUJOURS à gauche, plus de bouton flottant sur le contenu. Le héros absorbe
 * la hauteur libre → plus de grand vide noir avant « Jouer » ; sur petit écran
 * il se compacte et seuls les réglages défilent, le CTA reste à portée de
 * pouce. Sur tablette très haute (héros plafonné) le bloc se centre.
 */

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { openMobileMenu } from "../Sidebar";
import { useTopBar } from "../nav/topBarStore";

/** Burger themed inline — PARTAGÉ barre du haut + menu principal + HUD de
 *  match. Style color-mix sur var(--theme-*) : suit le thème équipé. */
export function InlineBurger({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={openMobileMenu}
      aria-label="Menu"
      data-no-touchfx
      className={"shrink-0 rounded-xl border flex items-center justify-center active:scale-95 transition backdrop-blur " + className}
      style={{
        background: "color-mix(in oklab, var(--theme-primary) 16%, rgba(10,12,20,0.82))",
        borderColor: "color-mix(in oklab, var(--theme-primary) 55%, transparent)",
        color: "color-mix(in oklab, var(--theme-primary) 80%, #fff)",
        boxShadow: "0 0 16px -6px var(--theme-primary), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </motion.button>
  );
}

/** Chip uniforme pour les stats des lobbies. */
export function LobbyChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" }) {
  const cls =
    tone === "accent" ? "bg-fuchsia-500/25 text-fuchsia-100 border-fuchsia-400/40" :
    tone === "good"   ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" :
    "bg-zinc-700/40 text-zinc-200 border-zinc-500/40";
  return (
    <span className={"px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap " + cls}>
      {children}
    </span>
  );
}

/** Section de réglages : petit intitulé en capitales + contenu + aide optionnelle. */
export function LobbySection({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="shrink-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">{label}</div>
      {children}
      {hint && <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug">{hint}</p>}
    </section>
  );
}

/** CTA principal des lobbies (gros bouton themed docké en bas). */
export function LobbyPrimaryButton({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={"w-full rounded-2xl px-5 py-3.5 font-bold text-white shadow-lg transition hover:brightness-110 bg-themed-br " + className}
      style={{
        boxShadow: "0 10px 28px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent), 0 0 22px color-mix(in oklab, var(--theme-secondary) 28%, transparent)",
        fontFamily: "var(--font-headline)",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </motion.button>
  );
}

/** Héros du mode : icône (image ou emoji) qui grandit avec la place dispo
 *  (unités de conteneur cqh), accroche, et un slot libre (stats, statut…). */
function LobbyHero({ icon, tagline, accent, extra }: { icon: ReactNode; tagline?: string; accent: string; extra?: ReactNode }) {
  const iconNode = typeof icon === "string" && /^(\/|data:|https?:)/.test(icon)
    ? <img src={icon} alt="" draggable={false} className="w-full h-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]" />
    : <span className="leading-none" style={{ fontSize: "clamp(36px, 26cqh, 88px)" }}>{icon}</span>;
  return (
    <div
      className="relative overflow-hidden rounded-3xl border flex flex-col items-center justify-center gap-1.5 px-4 py-3 text-center
        flex-1 min-h-[132px] max-h-[440px] landscape:max-h-none landscape:min-h-0 landscape:flex-none landscape:w-[38%] landscape:self-stretch"
      style={{
        containerType: "size",
        borderColor: `color-mix(in oklab, ${accent} 38%, transparent)`,
        background:
          `radial-gradient(120% 90% at 50% 38%, color-mix(in oklab, ${accent} 30%, transparent) 0%, transparent 62%),` +
          "linear-gradient(180deg, color-mix(in oklab, var(--theme-primary) 10%, rgba(10,12,20,0.78)), rgba(8,10,16,0.86))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px -18px ${accent}`,
      }}
    >
      <motion.div
        aria-hidden
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex items-center justify-center shrink-0"
        style={{ width: "clamp(52px, 46cqh, 184px)", height: "clamp(52px, 46cqh, 184px)" }}
      >
        {/* Halo qui respire derrière l'icône (opacité seule → coût GPU nul). */}
        <motion.span
          className="absolute inset-[8%] rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, color-mix(in oklab, ${accent} 55%, transparent), transparent 70%)` }}
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative w-full h-full flex items-center justify-center">{iconNode}</span>
      </motion.div>
      {tagline && <p className="text-[12.5px] sm:text-[13px] text-ink leading-snug max-w-xs shrink-0 opacity-80">{tagline}</p>}
      {extra && <div className="shrink-0 flex flex-wrap items-center justify-center gap-1.5 w-full">{extra}</div>}
    </div>
  );
}

export function ModeLobbyShell({
  title, tagline, icon, accent = "var(--theme-primary)", heroExtra,
  onBack, right, children, cta, secondary, dockCta = true,
}: {
  /** Titre affiché dans la barre du haut. */
  title: string;
  /** Accroche du mode (héros) — peut tenir sur 2 lignes. */
  tagline?: string;
  /** Icône du héros : chemin d'image ou emoji. */
  icon: ReactNode;
  /** Couleur d'identité du mode (lueur du héros). */
  accent?: string;
  /** Contenu libre sous l'accroche (chips de stats, statut serveur…). */
  heroExtra?: ReactNode;
  /** Retour (barre du haut, à gauche). */
  onBack?: () => void;
  /** Actions compactes à droite de la barre du haut. */
  right?: ReactNode;
  /** Réglages du mode — défilent seuls si la place manque. */
  children: ReactNode;
  /** CTA principal docké en bas — toujours visible. */
  cta?: ReactNode;
  /** Rangée secondaire sous le CTA. */
  secondary?: ReactNode;
  /** false = le CTA coule DANS la zone de défilement (une section dépliée le
   *  pousse vers le bas au lieu de comprimer l'écran — fiche Voie du Pro). */
  dockCta?: boolean;
}) {
  useTopBar({ title, onBack, right });
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col landscape:flex-row justify-center flex-1 min-h-0 w-full max-w-lg landscape:max-w-4xl mx-auto px-1 pb-1 gap-3"
    >
      <LobbyHero icon={icon} tagline={tagline} accent={accent} extra={heroExtra} />
      <div className="flex flex-col gap-2.5 min-h-0 shrink landscape:flex-1">
        <div className="min-h-0 shrink landscape:flex-1 overflow-y-auto overscroll-contain flex flex-col gap-3 px-0.5 pb-0.5">
          {children}
          {!dockCta && cta && <div className="shrink-0">{cta}</div>}
          {!dockCta && secondary && <div className="shrink-0">{secondary}</div>}
        </div>
        {dockCta && cta && <div className="shrink-0">{cta}</div>}
        {dockCta && secondary && <div className="shrink-0">{secondary}</div>}
      </div>
    </motion.div>
  );
}
