/**
 * ModeLobbyShell — TEMPLATE de cadrage commun aux lobbies de mode (Pro,
 * Classé, Constellation, En ligne…). Alex 2026-06-12 : "un véritable design
 * de cadrage qui pourra parfaitement aller aussi dans le mode constellation
 * normale et classé comme template — on évite les redondances".
 *
 * Plein écran, SANS scroll de page :
 *   ┌ [☰ themed]   TITRE + tagline   [← retour] ┐  header symétrique (40px)
 *   ├ identité compacte 1 ligne (optionnelle)   ┤  LobbyIdentityRow
 *   ├ CONTENU flex-1 min-h-0                    ┤  sections du mode ;
 *   │   (scroll interne UNIQUEMENT si déborde)  │  jamais le viewport
 *   ├ CTA principal docké — toujours visible    ┤
 *   └ rangée secondaire (grid) — optionnelle    ┘
 *
 * Le burger flottant global est masqué tant que le shell est monté : le
 * burger themed INLINE du header (même style que le menu principal) ouvre
 * le même drawer. Le retour vit à droite (symétrie) — plus de
 * FloatingMatchBackButton par-dessus le contenu.
 */

import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { openMobileMenu, setBurgerHidden } from "../Sidebar";
import { avatarImgStyle } from "../theme/avatar";

/** Burger themed inline — PARTAGÉ menu principal + lobbies (zéro redondance).
 *  Style color-mix sur var(--theme-*) : suit le thème équipé (OK WebView). */
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

/** Identité compacte 1 LIGNE : avatar + nom + chips à droite. Toutes les
 *  surfaces lobby utilisent la même (cohérence + pas de gros pavé profil). */
export function LobbyIdentityRow({
  avatar, name, chips, onTap,
}: {
  avatar: string;
  name: string;
  /** Chips compacts à droite (Lv, WR%, badge mode…). */
  chips?: ReactNode;
  onTap?: () => void;
}) {
  const isImage = /^(data:|\/|https?:)/.test(avatar);
  const Tag = onTap ? "button" : "div";
  return (
    <Tag
      {...(onTap ? { onClick: onTap, type: "button" as const } : {})}
      className="shrink-0 w-full flex items-center gap-2.5 rounded-2xl border border-hairline bg-surface-raised backdrop-blur px-3 py-2.5 text-left"
    >
      <div
        className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-xl shrink-0 ring-1 ring-white/15"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 32%, transparent))",
        }}
      >
        {isImage ? <img src={avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(avatar)} /> : avatar}
      </div>
      <span className="flex-1 min-w-0 font-bold text-sm truncate">{name}</span>
      <div className="shrink-0 flex items-center gap-1.5">{chips}</div>
    </Tag>
  );
}

/** Chip uniforme pour la rangée identité / stats des lobbies. */
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

export function ModeLobbyShell({
  title, tagline, titleGradient = "from-fuchsia-300 to-violet-300",
  onBack, identity, children, cta, secondary, dockCta = true,
}: {
  title: string;
  /** 1 ligne max — l'esprit du mode. */
  tagline?: string;
  /** Classes tailwind du gradient de titre (par mode). */
  titleGradient?: string;
  onBack?: () => void;
  /** Rangée identité (LobbyIdentityRow) — omise si l'écran n'en veut pas. */
  identity?: ReactNode;
  /** Sections du mode — zone flex-1, scroll interne seulement si déborde. */
  children: ReactNode;
  /** CTA principal docké en bas — TOUJOURS visible, jamais sous le fold. */
  cta?: ReactNode;
  /** Rangée secondaire sous le CTA (grid de petits boutons). */
  secondary?: ReactNode;
  /** Docker le CTA en bas (défaut) OU le laisser couler DANS la zone scroll
   *  (dockCta=false) — utile quand une section dépliable doit POUSSER le CTA
   *  vers le bas et défiler pour le lire, sans recentrer le haut de l'écran
   *  (Alex 2026-06-13, fiche Voie Pro). */
  dockCta?: boolean;
}) {
  // Burger flottant global OFF tant qu'un lobby est monté (le header a le
  // burger inline). Même mécanique que le menu principal.
  useEffect(() => {
    setBurgerHidden(true);
    return () => setBurgerHidden(false);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col flex-1 min-h-0 w-full max-w-lg mx-auto px-1 pb-1 gap-2"
    >
      {/* Header — burger | titre centré | retour. Symétrique : les deux
       *  boutons font 40px, le titre est VRAIMENT centré. */}
      <div className="shrink-0 flex items-center gap-2 -mt-10">
        <InlineBurger />
        <div className="flex-1 min-w-0 text-center">
          <h1
            className={"text-lg sm:text-2xl font-extrabold tracking-tight leading-tight bg-gradient-to-br bg-clip-text text-transparent truncate " + titleGradient}
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {title}
          </h1>
          {tagline && (
            <p className="text-[10px] sm:text-xs text-ink-muted leading-tight truncate">{tagline}</p>
          )}
        </div>
        {onBack ? (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onBack}
            aria-label="Retour"
            data-no-touchfx
            className="shrink-0 w-10 h-10 rounded-xl border border-hairline bg-black/45 backdrop-blur flex items-center justify-center text-ink active:scale-95 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </motion.button>
        ) : (
          <div className="shrink-0 w-10 h-10" aria-hidden />
        )}
      </div>

      {identity}

      {/* Zone contenu — flex-1, scroll INTERNE seulement si ça déborde. Le CTA
       *  reste docké (défaut) OU coule ici en bas (dockCta=false) → poussé vers
       *  le bas par une section dépliée, atteignable au scroll. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
        {children}
        {!dockCta && cta && <div className="shrink-0">{cta}</div>}
        {!dockCta && secondary && <div className="shrink-0">{secondary}</div>}
      </div>

      {dockCta && cta && <div className="shrink-0">{cta}</div>}
      {dockCta && secondary && <div className="shrink-0">{secondary}</div>}
    </motion.div>
  );
}
