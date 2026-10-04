import { useEffect, useState, type RefObject } from "react";
import { motion } from "motion/react";
import { InlineBurger } from "../ui/ModeLobbyShell";
import { useTopBarSpec } from "./topBarStore";
import type { Page } from "../Sidebar";

/** Titre par défaut de la barre du haut pour chaque page (hors accueil). */
export const PAGE_TITLE_KEY: Record<Page, string> = {
  play: "nav.home", online: "nav.online", leaderboard: "nav.leaderboard", shop: "nav.shop",
  quests: "nav.quests", packs: "nav.packs", profile: "nav.profile", history: "nav.history",
  about: "nav.about", contact: "nav.contact", privacy: "nav.privacy",
};

/**
 * AppTopBar — barre du haut UNIQUE des écrans hors match (pages secondaires +
 * lobbies). Remplace le burger flottant + la flèche « retour » flottante qui
 * chevauchaient le contenu.
 *
 *   ┌ [☰][←]        Titre centré        [actions] ┐  56 px (44 en paysage bas)
 *
 * Dans le FLUX (pas en position fixe) : #root paie déjà la safe-area du haut,
 * la barre se pose juste dessous et <main> (seul conteneur scrollable) commence
 * sous elle → aucun chevauchement, même au scroll.
 * Titre « large title » façon iOS : si la page affiche déjà son propre <h1>, le
 * titre de la barre n'apparaît qu'une fois ce <h1> passé sous la barre.
 */
export function AppTopBar({
  defaultTitle, defaultBack, defaultBackLabel, mainRef,
}: {
  defaultTitle: string;
  defaultBack?: () => void;
  defaultBackLabel: string;
  mainRef: RefObject<HTMLElement | null>;
}) {
  const spec = useTopBarSpec();
  const title = spec?.title || defaultTitle;
  const onBack = spec?.onBack ?? defaultBack;
  const backLabel = spec?.backLabel ?? defaultBackLabel;
  const titleShown = useBarTitleShown(mainRef);

  return (
    <motion.header
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      data-no-touchfx
      className="relative z-20 shrink-0 w-full overflow-hidden"
    >
      <div className="h-14 [@media(max-height:540px)]:h-11 px-3 sm:px-4 grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 bg-surface backdrop-blur-md">
        <div className="flex items-center gap-2 justify-self-start">
          {/* Burger masqué quand la sidebar desktop est visible (même règle que Sidebar). */}
          <InlineBurger className="w-10 h-10 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 portrait:min-[900px]:hidden [@media(max-height:600px)]:!flex" />
          {onBack && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onBack}
              aria-label={backLabel}
              title={backLabel}
              className="shrink-0 w-10 h-10 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl border border-hairline bg-black/40 flex items-center justify-center text-ink transition hover:bg-black/60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </motion.button>
          )}
        </div>
        <div
          role="heading"
          aria-level={1}
          className="min-w-0 truncate text-center text-base sm:text-lg font-extrabold tracking-tight text-themed transition-opacity duration-200"
          style={{ fontFamily: "var(--font-headline)", opacity: titleShown ? 1 : 0 }}
        >
          {title}
        </div>
        <div className="flex items-center gap-2 justify-self-end">{spec?.right}</div>
      </div>
      {/* Filet bas aux couleurs du thème. */}
      <div
        aria-hidden
        className="h-px w-full"
        style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--theme-primary) 55%, transparent) 30%, color-mix(in oklab, var(--theme-secondary) 55%, transparent) 70%, transparent)" }}
      />
    </motion.header>
  );
}

/** Vrai quand le titre de la barre doit s'afficher : aucun <h1> dans <main>, ou
 *  le premier <h1> est passé sous la barre (scroll). Recalculé au scroll et
 *  quand le contenu de <main> change (pages chargées à la demande). */
function useBarTitleShown(mainRef: RefObject<HTMLElement | null>): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const h1 = main.querySelector("h1");
      setShown(!h1 || h1.getBoundingClientRect().bottom <= main.getBoundingClientRect().top + 4);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    const mo = new MutationObserver(schedule);
    mo.observe(main, { childList: true, subtree: true });
    main.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      main.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [mainRef]);
  return shown;
}
