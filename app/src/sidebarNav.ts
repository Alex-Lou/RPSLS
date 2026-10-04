/**
 * Entrées de navigation du menu (sidebar desktop + drawer mobile) — extraites
 * verbatim de Sidebar.tsx.
 */
import type { Page } from "./Sidebar";

export interface NavItem {
  id: Page;
  labelKey: string;
  /** Path to the PNG badge icon under /public/Burger Icons/. */
  iconSrc?: string;
  /** Emoji glyph used when there's no PNG badge. */
  glyph?: string;
}

export const NAV: NavItem[] = [
  { id: "play",        labelKey: "nav.home",        iconSrc: "/Burger Icons/nav_accueil.png"    },
  { id: "online",      labelKey: "nav.online",      iconSrc: "/Burger Icons/nav_en_ligne.png"   },
  { id: "leaderboard", labelKey: "nav.leaderboard", glyph: "🏆"                                  },
  { id: "shop",        labelKey: "nav.shop",        glyph: "🎁"                                  },
  { id: "quests",      labelKey: "nav.quests",      iconSrc: "/Burger Icons/nav_quetes.png"     },
  { id: "packs",   labelKey: "nav.packs",   iconSrc: "/Burger Icons/nav_variantes.png"  },
  { id: "profile", labelKey: "nav.profile", iconSrc: "/Burger Icons/nav_profil.png"     },
  { id: "history", labelKey: "nav.history", iconSrc: "/Burger Icons/nav_historique.png" },
  { id: "about",   labelKey: "nav.about",   iconSrc: "/Burger Icons/nav_a_propos.png"   },
  { id: "contact", labelKey: "nav.contact", iconSrc: "/Burger Icons/nav_contact.png"    },
];
