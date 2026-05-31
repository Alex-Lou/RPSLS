import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { levelFromXp } from "./leveling";
import { THEMES } from "./theme";
import { useT } from "./i18n";
import { LanguagePicker } from "./LanguagePicker";
import { avatarImgStyle } from "./avatar";

export type Page = "play" | "online" | "quests" | "packs" | "profile" | "history" | "about" | "contact";

interface NavItem {
  id: Page;
  labelKey: string;
  /** Path to the PNG badge icon under /public/Burger Icons/. */
  iconSrc: string;
}

const NAV: NavItem[] = [
  { id: "play",    labelKey: "nav.home",    iconSrc: "/Burger Icons/nav_accueil.png"    },
  { id: "online",  labelKey: "nav.online",  iconSrc: "/Burger Icons/nav_en_ligne.png"   },
  { id: "quests",  labelKey: "nav.quests",  iconSrc: "/Burger Icons/nav_quetes.png"     },
  { id: "packs",   labelKey: "nav.packs",   iconSrc: "/Burger Icons/nav_variantes.png"  },
  { id: "profile", labelKey: "nav.profile", iconSrc: "/Burger Icons/nav_profil.png"     },
  { id: "history", labelKey: "nav.history", iconSrc: "/Burger Icons/nav_historique.png" },
  { id: "about",   labelKey: "nav.about",   iconSrc: "/Burger Icons/nav_a_propos.png"   },
  { id: "contact", labelKey: "nav.contact", iconSrc: "/Burger Icons/nav_contact.png"    },
];

/* ─────────── Body shared between desktop sidebar and mobile drawer ─────────── */

function SidebarBody({
  page,
  onNavigate,
  onAfterPick,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  onAfterPick?: () => void;
}) {
  const player = useStore((s) => s.player);
  const info = levelFromXp(player.xp);
  const theme = THEMES[player.themeId];
  const t = useT();

  const handleNav = (id: Page) => {
    onNavigate(id);
    onAfterPick?.();
  };

  return (
    <>
      {/* Profile block */}
      <button
        onClick={() => handleNav("profile")}
        className="flex items-center gap-3 p-2 -mx-2 rounded-2xl hover:bg-white/5 transition text-left"
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ring-2 shadow-lg overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
          }}
        >
          {/^(data:|\/|https?:)/.test(player.avatar) ? (
            <img
              src={player.avatar}
              alt=""
              className="w-full h-full object-cover"
              style={avatarImgStyle(player.avatar)}
            />
          ) : (
            <span>{player.avatar}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{player.nickname}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
            {t("sidebar.lvl")} {info.level}
          </div>
        </div>
      </button>

      {/* XP bar */}
      <div className="mt-3">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${info.progress * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
              boxShadow: `0 0 12px ${theme.primary}80`,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
          <span>{info.xpInLevel} / {info.xpForNext} {t("sidebar.xp")}</span>
          <span className="text-zinc-400">{player.rankLp} {t("sidebar.lp")}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition " +
                (active
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5")
              }
            >
              <span
                className={
                  "inline-block w-1 h-5 rounded-r-full transition " +
                  (active ? "" : "opacity-0")
                }
                style={{ background: theme.primary }}
              />
              <img
                src={item.iconSrc}
                alt=""
                draggable={false}
                className="w-7 h-7 shrink-0 select-none"
              />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <LanguagePicker variant="sidebar" />
        <div className="text-[10px] text-zinc-600 text-center">RPSLS · v0.1</div>
      </div>
    </>
  );
}

/* ─────────── Desktop fixed sidebar ─────────── */

export function Sidebar({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
}) {
  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col h-screen sticky top-0 p-4 bg-black/30 backdrop-blur border-r border-white/10">
      <SidebarBody page={page} onNavigate={onNavigate} />
    </aside>
  );
}

/* ─────────── Mobile shell: hamburger button + slide-in drawer ─────────── */

export function MobileShell({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
}) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Hamburger trigger (mobile only) */}
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 w-11 h-11 rounded-2xl bg-black/55 backdrop-blur border border-white/15 flex items-center justify-center text-zinc-100 active:scale-95 transition shadow-lg"
        style={{
          top: "max(env(safe-area-inset-top), 32px)",
          left: "max(env(safe-area-inset-left), 12px)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-40"
            />
            {/* Panel */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-zinc-950/95 backdrop-blur-md border-r border-white/10 p-4 flex flex-col"
              style={{
                paddingTop:    "max(env(safe-area-inset-top),    32px)",
                paddingBottom: "max(env(safe-area-inset-bottom), 40px)",
                paddingLeft:   "max(env(safe-area-inset-left),   16px)",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300"
                style={{ top: "max(env(safe-area-inset-top), 32px)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>

              <SidebarBody
                page={page}
                onNavigate={onNavigate}
                onAfterPick={() => setOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
