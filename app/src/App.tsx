import { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { applyTheme } from "./theme";
import { BACKGROUNDS_BY_ID, resolveFontFamily } from "./themes";
import { RTL_LOCALES } from "./i18n";
import { SplashShader } from "./SplashShader";
import { ThemedBackdrop } from "./backdrops/ThemedBackdrop";
import { ThemeTouchFX } from "./ThemeTouchFX";
import { Sidebar, MobileShell, type Page } from "./Sidebar";
// PlayPage stays eagerly imported — it's the initial route after splash
// so lazy-loading it would just add a flicker for no gain.
import { PlayPage } from "./PlayPage";
import { FloatingMatchBackButton } from "./sharedMatchUI";
import { UserHeader } from "./UserHeader";
import { LevelUpWatcher } from "./LevelUpOverlay";
import { useT } from "./i18n";
import { setHapticSettings } from "./haptic";
import { initSentry, shutdownSentry } from "./monitoring/sentry";

// Code-split heavy pages — each becomes its own JS chunk that Vite ships
// on demand the first time the user navigates there. Cuts the initial
// bundle from ~770 kB to ~250 kB, which is what the splash actually
// blocks on. Vite picks chunk names from the import path so the network
// tab shows "OnlinePage-<hash>.js" rather than an anonymous blob.
const OnlinePage   = lazy(() => import("./OnlinePage").then(m => ({ default: m.OnlinePage })));
const ProfilePage  = lazy(() => import("./ProfilePage").then(m => ({ default: m.ProfilePage })));
const HistoryPage  = lazy(() => import("./HistoryPage").then(m => ({ default: m.HistoryPage })));
const QuestsPage   = lazy(() => import("./QuestsPage").then(m => ({ default: m.QuestsPage })));
const LeaderboardPage = lazy(() => import("./LeaderboardPage").then(m => ({ default: m.LeaderboardPage })));
const PacksPage    = lazy(() => import("./PacksPage").then(m => ({ default: m.PacksPage })));
const AboutPage    = lazy(() => import("./AboutPage").then(m => ({ default: m.AboutPage })));
const ContactPage  = lazy(() => import("./ContactPage").then(m => ({ default: m.ContactPage })));
const PrivacyPage  = lazy(() => import("./legal/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const Welcome      = lazy(() => import("./Welcome").then(m => ({ default: m.Welcome })));

type Stage = "splash" | "welcome" | "shell";

export default function App() {
  const themeId = useStore((s) => s.player.themeId);
  const backgroundId = useStore((s) => s.player.backgroundId ?? "default");
  const onboarded = useStore((s) => s.onboarded);
  const locale = useStore((s) => s.locale);
  const hapticEnabled  = useStore((s) => s.player.hapticEnabled ?? true);
  const hapticIntensity = useStore((s) => s.player.hapticIntensity ?? "med");
  const crashReports = useStore((s) => s.player.crashReports ?? false);
  const fontScale = useStore((s) => s.player.fontScale ?? 1);

  // Accessibility text scale → drives the global --font-scale var that the
  // html font-size (and therefore every rem-based size) keys off.
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  // Honour the privacy toggle: when the user flips "Send crash reports"
  // in Settings we boot or tear down Sentry on the spot.
  useEffect(() => {
    if (crashReports) initSentry(true);
    else shutdownSentry();
  }, [crashReports]);

  // Custom navigation channel used by deep sub-components (e.g. Profile's
  // "View privacy policy" link) to ask the App to switch pages without
  // having to thread an `onNavigate` prop through every level.
  useEffect(() => {
    const onNav = (e: Event) => {
      const target = (e as CustomEvent).detail as Page | undefined;
      if (target) setPage(target);
    };
    window.addEventListener("rpsls:navigate", onNav);
    return () => window.removeEventListener("rpsls:navigate", onNav);
  }, []);
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

  // Apply the chosen cosmetic background image AND skin (fonts) to <body>
  // via CSS variables. body { font-family: var(...) } and
  // body { background-image: var(...) } in App.css consume them. The
  // "default" theme has src: null which clears the var so the original
  // CSS radial-gradient default remains visible.
  //
  // While the splash is showing we deliberately suppress the bg image so
  // the player never sees the theme PNG flash through behind the WebGL
  // shader during boot or during the splash-out transition.
  const customBgUrl = useStore((s) => s.player.customBgUrl);
  useEffect(() => {
    const def = BACKGROUNDS_BY_ID[backgroundId];
    const root = document.documentElement;
    // "custom" paints the player's own uploaded image; coded scenes paint
    // nothing here (the WebGL canvas handles them); everything else clears.
    const customActive = stage !== "splash" && def?.custom && !!customBgUrl;
    const imgSrc = customActive ? customBgUrl : (stage !== "splash" ? def?.src : null);
    if (imgSrc) {
      root.style.setProperty("--app-bg-image", `url("${imgSrc}")`);
    } else {
      root.style.removeProperty("--app-bg-image");
    }
    if (def?.skin) {
      root.style.setProperty("--font-headline", resolveFontFamily(def.skin.fontHeadline));
      root.style.setProperty("--font-body",     resolveFontFamily(def.skin.fontBody));
      root.style.setProperty("--font-mono",     resolveFontFamily(def.skin.fontMono));
    }
    // Accent override — when the chosen background ships an accent palette,
    // it WINS over the global theme. Every "primary action" surface uses
    // var(--theme-primary)/secondary, so this single switch repaints them
    // all (Lock, Fight, rank chips, focus rings) to match the ambience.
    if (def?.accent) {
      root.style.setProperty("--theme-primary",   def.accent.from);
      root.style.setProperty("--theme-secondary", def.accent.to);
    }
    // Note: if def.accent is null (default bg), we leave the theme-driven
    // values alone — they were set by applyTheme(themeId) right above.
  }, [backgroundId, stage, customBgUrl]);

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

  // Live coded backdrop — rendered behind everything when the chosen
  // background is a procedural scene (nebula/aurora/grid) and we're past
  // the splash. Sits at z-0; the app shell renders above it.
  const activeScene = BACKGROUNDS_BY_ID[backgroundId]?.scene;

  return (
    <div className="h-full w-full select-none overflow-hidden">
      {activeScene && stage !== "splash" && <ThemedBackdrop scene={activeScene} />}
      {/* Readability scrim over a player's OWN uploaded image — coded scenes
          already ship their own vignette, but a raw photo can be bright/busy
          enough to drown menu text. A very light dark wash keeps every page
          legible without hiding the chosen picture. */}
      {stage !== "splash" && backgroundId === "custom" && customBgUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.26) 28%, rgba(0,0,0,0.26) 72%, rgba(0,0,0,0.46) 100%)",
          }}
        />
      )}
      {/* Coded scenes ship their own vignette, but the flashy ones (aurora,
          casino, grid…) can still drown menu text. A lighter top/bottom-weighted
          wash keeps titles + nav legible while leaving the scene visible. */}
      {stage !== "splash" && backgroundId !== "custom" && activeScene && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.46) 0%, rgba(0,0,0,0.22) 24%, rgba(0,0,0,0.22) 68%, rgba(0,0,0,0.48) 100%)",
          }}
        />
      )}
      {/* mode="wait" — Alex wanted the sequence to read as "splash ONLY, then
          menu ONLY", never overlapping. The splash fully exits before the
          shell mounts so the player never sees the theme bg leaking through
          mid-transition. */}
      <AnimatePresence mode="wait">
        {stage === "splash" && (
          <Splash key="splash" onDone={afterSplash} scene={activeScene ?? null} />
        )}
        {stage === "welcome" && (
          <Suspense key="welcome" fallback={<RouteFallback />}>
            <Welcome onDone={() => setStage("shell")} />
          </Suspense>
        )}
        {stage === "shell" && (
          <motion.div
            key="shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // Clean fade-in after the splash has fully exited (mode="wait").
            transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
            // relative z-10 keeps the shell above the z-0 coded backdrop.
            className="relative z-10 flex h-full min-h-0"
          >
            <Sidebar page={page} onNavigate={navigateTo} />
            <MobileShell page={page} onNavigate={navigateTo} />
            {/* Theme-coloured touch particles across the menu. Quiet on Contact,
                and inside any game/deck screen (useNoMenuFx) or the open drawer
                ([data-no-touchfx]). */}
            <ThemeTouchFX enabled={page !== "contact" && page !== "online"} />
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
              <main className="flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-auto pt-12 pb-4 md:pt-0 md:pb-0 [@media(max-height:540px)]:pt-2 [@media(max-height:540px)]:pb-1">
                {/* Persistent player header — shown on every menu page, never on
                    a match surface (Play / Online own internal match states). Its
                    XP bar is where quest/match XP gains visibly land. */}
                {page !== "play" && page !== "online" && (
                  <UserHeader onNavigate={navigateTo} />
                )}
                <AnimatePresence mode="wait">
                  {page === "play"    && <PageWrap key="play"><PlayPage onNavigate={navigateTo} homeNonce={homeNonce} /></PageWrap>}
                  {page !== "play" && (
                    <Suspense key="lazy-routes" fallback={<RouteFallback />}>
                      {page === "online"  && <PageWrap key="online"><OnlinePage /></PageWrap>}
                      {page === "leaderboard" && <PageWrap key="leaderboard"><LeaderboardPage /></PageWrap>}
                      {page === "quests"  && <PageWrap key="quests"><QuestsPage /></PageWrap>}
                      {page === "packs"   && <PageWrap key="packs"><PacksPage /></PageWrap>}
                      {page === "profile" && <PageWrap key="profile"><ProfilePage /></PageWrap>}
                      {page === "history" && <PageWrap key="history"><HistoryPage /></PageWrap>}
                      {page === "about"   && <PageWrap key="about"><AboutPage /></PageWrap>}
                      {page === "contact" && <PageWrap key="contact"><ContactPage /></PageWrap>}
                      {page === "privacy" && <PageWrap key="privacy"><PrivacyPage onClose={() => navigateTo("about")} /></PageWrap>}
                    </Suspense>
                  )}
                </AnimatePresence>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Minimal Suspense fallback for lazy-loaded routes. Renders a dark
 *  full-screen panel with a faint pulse — short enough that even on a
 *  slow chunk fetch it doesn't feel like an error state. */
function RouteFallback() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex-1 flex items-center justify-center"
      aria-busy
      aria-live="polite"
    >
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="w-2.5 h-2.5 rounded-full bg-violet-400"
      />
    </motion.div>
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

/**
 * Splash — opening video played fullscreen behind a fade-in logo + title.
 *
 * Choreography (matches the 8s opening.mp4 duration):
 *   0.0s  Video starts dark (cosmic build-up), overlay UI hidden.
 *   1.4s  Logo PNG fades + scale-springs in.
 *   2.2s  RPSLS wordmark + subtitle fade in.
 *   3.0s  "tap to continue" hint fades in.
 *   8.0s  Video onEnded → onDone(). Safety auto-advance at 8.5s.
 *
 * Tap anywhere to skip. Video is muted + playsInline so Android WebView
 * autoplay policy lets it run without user gesture. If the video fails
 * (no codec, no asset), the dark gradient backdrop still shows and the
 * logo/title sequence still fires — graceful degradation.
 */
function Splash({ onDone, scene }: { onDone: () => void; scene: import("./backdrops/ThemedBackdrop").BackdropScene | null }) {
  const t = useT();
  const [phase, setPhase] = useState<"intro" | "logo" | "title" | "hint">("intro");

  useEffect(() => {
    // Reveal the logo → title → "tap to continue" hint on a timeline, but
    // NEVER auto-advance: the splash waits for a real tap (Alex wants
    // "tap or nothing", no silent fall-through into the menu).
    const t1 = window.setTimeout(() => setPhase("logo"),  1100);
    const t2 = window.setTimeout(() => setPhase("title"), 1800);
    const t3 = window.setTimeout(() => setPhase("hint"),  2600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <motion.div
      onClick={onDone}
      // fixed inset-0 escapes the #root safe-area padding so the splash
      // truly fills every pixel of the screen edge-to-edge, including
      // under the status bar and Android nav bar.
      className="fixed inset-0 z-[80] cursor-pointer overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Short clean fade-out — mode="wait" upstream means the shell only
      // mounts AFTER this exit completes, so the player sees: animation
      // only → fade to black → theme. Never both at once.
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
    >
      {/* Procedural WebGL fluid backdrop — replaces the previous <video>
          tag. No native media controls flashing on Android WebView, no
          codec compatibility issues, no asset to ship. Paints frame 1
          instantly and loops forever. When the player has picked a coded
          scene, the splash uses THAT scene instead so the opening matches
          the chosen ambience (galaxy → galaxy splash, neon grid → grid…). */}
      <SplashShader scene={scene} />

      {/* Soft dark gradient overlay for legibility of the logo/title on top. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      <div className="relative h-full flex flex-col items-center justify-center gap-5 [@media(max-height:560px)]:gap-2 px-6 text-center">
        {/* Logo with a glowing halo behind it. */}
        <AnimatePresence>
          {(phase === "logo" || phase === "title" || phase === "hint") && (
            <motion.div
              key="logo-wrap"
              className="relative"
              initial={{ opacity: 0, scale: 0.55, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0.3] }}
                transition={{ duration: 1.8, ease: "easeOut" }}
                className="absolute -inset-12 -z-10 rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(168,85,247,0.7), rgba(45,212,191,0.4) 45%, transparent 75%)",
                }}
              />
              <motion.img
                src="/Logo-RLSPS.png"
                alt="RPSLS"
                className="w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 [@media(max-height:560px)]:w-24 [@media(max-height:560px)]:h-24 drop-shadow-2xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(phase === "title" || phase === "hint") && (
            <motion.h1
              key="title"
              initial={{ opacity: 0, y: 28, filter: "blur(14px)", scale: 0.92 }}
              animate={{ opacity: 1, y: 0,  filter: "blur(0px)",  scale: 1 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl sm:text-6xl [@media(max-height:560px)]:text-3xl font-black tracking-tight bg-gradient-to-br from-violet-300 via-fuchsia-400 to-teal-300 bg-clip-text text-transparent"
              style={{ textShadow: "0 0 28px rgba(168,85,247,0.4)" }}
            >
              RPSLS
            </motion.h1>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(phase === "title" || phase === "hint") && (
            <motion.p
              key="subtitle"
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 0.9, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="text-ink text-xs sm:text-sm tracking-[0.3em] uppercase"
            >
              {t("splash.tagline")}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "hint" && (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 0.5 }}
            className="absolute bottom-10 [@media(max-height:560px)]:bottom-3 left-0 right-0 text-center text-ink-muted text-xs tracking-[0.25em] uppercase pointer-events-none"
          >
            {t("splash.tap")}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
