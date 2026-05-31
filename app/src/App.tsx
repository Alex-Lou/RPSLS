import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { applyTheme } from "./theme";
import { BACKGROUNDS_BY_ID } from "./themes";
import { RTL_LOCALES } from "./i18n";
import { Sidebar, MobileShell, type Page } from "./Sidebar";
import { PlayPage } from "./PlayPage";
import { OnlinePage } from "./OnlinePage";
import { ProfilePage } from "./ProfilePage";
import { HistoryPage } from "./HistoryPage";
import { QuestsPage } from "./QuestsPage";
import { PacksPage } from "./PacksPage";
import { AboutPage } from "./AboutPage";
import { ContactPage } from "./ContactPage";
import { Welcome } from "./Welcome";
import { FloatingMatchBackButton } from "./sharedMatchUI";
import { UserHeader } from "./UserHeader";
import { LevelUpWatcher } from "./LevelUpOverlay";
import { useT } from "./i18n";
import { setHapticSettings } from "./haptic";

type Stage = "splash" | "welcome" | "shell";

export default function App() {
  const themeId = useStore((s) => s.player.themeId);
  const backgroundId = useStore((s) => s.player.backgroundId ?? "default");
  const onboarded = useStore((s) => s.onboarded);
  const locale = useStore((s) => s.locale);
  const hapticEnabled  = useStore((s) => s.player.hapticEnabled ?? true);
  const hapticIntensity = useStore((s) => s.player.hapticIntensity ?? "med");
  const [stage, setStage] = useState<Stage>("splash");
  const [page, setPage] = useState<Page>("play");
  // Nonce bumped every time the user explicitly clicks "Home" so PlayPage
  // can reset its internal view (kick out of a Game / LanesMatch back to
  // the mode-select home).
  const [homeNonce, setHomeNonce] = useState(0);
  const t = useT();

  function navigateTo(next: Page) {
    if (next === "play") setHomeNonce((n) => n + 1);
    setPage(next);
  }

  // Sync the player's vibration preferences down to the haptic module so
  // every vibrate() call honors them (module-level state, read sync).
  useEffect(() => {
    setHapticSettings({ enabled: hapticEnabled, intensity: hapticIntensity });
  }, [hapticEnabled, hapticIntensity]);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Apply the chosen cosmetic background image to <body> via a CSS variable.
  // The variable is consumed by body { background-image: var(--app-bg-image) }
  // in App.css; "default" clears the var so the original gradient remains.
  useEffect(() => {
    const def = BACKGROUNDS_BY_ID[backgroundId];
    const root = document.documentElement;
    if (def?.src) {
      root.style.setProperty("--app-bg-image", `url("${def.src}")`);
    } else {
      root.style.removeProperty("--app-bg-image");
    }
  }, [backgroundId]);

  // Mirror the locale onto <html> so Tailwind / browser can pick up text
  // direction and language-aware features (forms, hyphenation, screen reader).
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  }, [locale]);

  // Android back button handling:
  // - On Play: default behavior (Android closes app)
  // - On any other page: pop back to Play
  useEffect(() => {
    if (page === "play") return;
    // Push a history entry so that the Android back button (which navigates
    // history backwards in the WebView) brings us to Play instead of closing.
    history.pushState({ rpslsPage: page }, "");
    const onPop = () => setPage("play");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [page]);

  const afterSplash = () => setStage(onboarded ? "shell" : "welcome");

  return (
    <div className="h-full w-full select-none overflow-hidden">
      <AnimatePresence mode="wait">
        {stage === "splash" && (
          <Splash key="splash" onDone={afterSplash} />
        )}
        {stage === "welcome" && (
          <Welcome key="welcome" onDone={() => setStage("shell")} />
        )}
        {stage === "shell" && (
          <motion.div
            key="shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex h-full min-h-0"
          >
            <Sidebar page={page} onNavigate={navigateTo} />
            <MobileShell page={page} onNavigate={navigateTo} />
            {/* Global LEVEL UP celebration — catches an XP gain from any surface. */}
            <LevelUpWatcher />
            {/* Global "back to Play" arrow, parked right next to the burger
                on every non-Play page. Avoids the Android system back button
                (which closes the app) being the only escape route. */}
            {page !== "play" && (
              <FloatingMatchBackButton
                onClick={() => navigateTo("play")}
                label={t("nav.backToPlay")}
              />
            )}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Mobile: clear the floating hamburger (top:max(safe,32)+44h)
                  with a measured gap, and keep content above the Android
                  nav bar via safe-area-bottom. Desktop (md+) has no burger. */}
              {/* Top pad = just enough to clear the 44px floating burger (the
                  safe-area itself is already paid once by #root, so we don't
                  double-count it here). Bottom pad = minimal nav-bar clearance
                  on top of #root's safe-area. Keeps the match using the full
                  vertical space instead of floating with big top/bottom voids. */}
              <main className="flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-auto pt-12 pb-4 md:pt-0 md:pb-0">
                {/* Persistent player header — shown on every menu page, never on
                    a match surface (Play / Online own internal match states). Its
                    XP bar is where quest/match XP gains visibly land. */}
                {page !== "play" && page !== "online" && (
                  <UserHeader onNavigate={navigateTo} />
                )}
                <AnimatePresence mode="wait">
                  {page === "play"    && <PageWrap key="play"><PlayPage onNavigate={navigateTo} homeNonce={homeNonce} /></PageWrap>}
                  {page === "online"  && <PageWrap key="online"><OnlinePage /></PageWrap>}
                  {page === "quests"  && <PageWrap key="quests"><QuestsPage /></PageWrap>}
                  {page === "packs"   && <PageWrap key="packs"><PacksPage /></PageWrap>}
                  {page === "profile" && <PageWrap key="profile"><ProfilePage /></PageWrap>}
                  {page === "history" && <PageWrap key="history"><HistoryPage /></PageWrap>}
                  {page === "about"   && <PageWrap key="about"><AboutPage /></PageWrap>}
                  {page === "contact" && <PageWrap key="contact"><ContactPage /></PageWrap>}
                </AnimatePresence>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col min-h-0"
    >
      {children}
    </motion.div>
  );
}

/* ─────────────── Splash ─────────────── */

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      onClick={onDone}
      className="h-full cursor-pointer flex flex-col items-center justify-center gap-6 sm:gap-10 py-10 px-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4 }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 14 }}
        className="relative"
      >
        {/* Halo */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.45, 0.25] }}
          transition={{ delay: 0.4, duration: 1.6, ease: "easeOut" }}
          className="absolute -inset-12 -z-10 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.55), rgba(45,212,191,0.3) 50%, transparent 75%)",
          }}
        />
        <motion.img
          src="/Logo-RLSPS.png"
          alt="RPSLS"
          className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 drop-shadow-2xl"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-br from-violet-300 via-fuchsia-400 to-teal-300 bg-clip-text text-transparent"
      >
        RPSLS
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="text-zinc-400 text-xs sm:text-sm tracking-widest uppercase"
      >
        Rock · Paper · Scissors · Lizard · Spock
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.8, duration: 0.4 }}
        className="text-zinc-500 text-xs"
      >
        tap to continue
      </motion.p>
    </motion.div>
  );
}
