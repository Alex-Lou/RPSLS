import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store/store";
import { useArenaOverride } from "./ranked/arenaOverride";
import { applyTheme } from "./theme/theme";
import { BACKGROUNDS_BY_ID } from "./theme/themes";
import { RTL_LOCALES } from "./i18n";
import { useBackdropPeek } from "./backdrops/previewScene";
import { ThemeTouchFX } from "./fx/ThemeTouchFX";
import { Sidebar, MobileShell, useOwnChrome, type Page } from "./Sidebar";
// PlayPage stays eagerly imported — it's the initial route after splash
// so lazy-loading it would just add a flicker for no gain.
import { PlayPage } from "./pages/PlayPage";
import { useMatchFullscreen } from "./match/matchFullscreenStore";
import { AppTopBar, PAGE_TITLE_KEY } from "./nav/AppTopBar";
import { useImmersiveActive } from "./nav/topBarStore";
import { UserHeader } from "./UserHeader";
import { LevelUpWatcher } from "./fx/LevelUpOverlay";
import { useT } from "./i18n";
import { useGfxAutoDetect } from "./graphics/useGfxAutoDetect";
import { useGfxAllows } from "./graphics/graphicsQuality";
import { setHapticSettings } from "./haptic";
import { initSentry, shutdownSentry } from "./monitoring/sentry";
import { startSyncSubscriber } from "./online/playerSync";
import { runBootSync, restoreAnchorIntoStore } from "./online/bootSync";
import { flushWallet, startWalletListener } from "./online/wallet";
import { AuthGate } from "./auth/AuthGate";
// Sous-modules extraits d'App.tsx (verbatim) : splash, enveloppes de routes,
// couches de fond, effets DOM du fond d'écran.
import { Splash } from "./AppSplash";
import { RouteFallback, PageWrap } from "./AppRouteParts";
import { AppBackdropLayers } from "./AppBackdropLayers";
import { useAppBackgroundVars, useAppHtmlBgFlags } from "./useAppBackgroundDom";

// Code-split heavy pages — each becomes its own JS chunk that Vite ships
// on demand the first time the user navigates there. Cuts the initial
// bundle from ~770 kB to ~250 kB, which is what the splash actually
// blocks on. Vite picks chunk names from the import path so the network
// tab shows "OnlinePage-<hash>.js" rather than an anonymous blob.
const OnlinePage   = lazy(() => import("./pages/OnlinePage").then(m => ({ default: m.OnlinePage })));
const ProfilePage  = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const HistoryPage  = lazy(() => import("./pages/HistoryPage").then(m => ({ default: m.HistoryPage })));
const QuestsPage   = lazy(() => import("./pages/QuestsPage").then(m => ({ default: m.QuestsPage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then(m => ({ default: m.LeaderboardPage })));
const ShopPage     = lazy(() => import("./pages/ShopPage").then(m => ({ default: m.ShopPage })));
import { SeasonRolloverModal } from "./ranked/SeasonRolloverModal";
import { backPromptActive } from "./match/sharedMatchUI/androidBack";
const PacksPage    = lazy(() => import("./pages/PacksPage").then(m => ({ default: m.PacksPage })));
const AboutPage    = lazy(() => import("./pages/AboutPage").then(m => ({ default: m.AboutPage })));
const ContactPage  = lazy(() => import("./pages/ContactPage").then(m => ({ default: m.ContactPage })));
const PrivacyPage  = lazy(() => import("./legal/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const Welcome      = lazy(() => import("./pages/Welcome").then(m => ({ default: m.Welcome })));

type Stage = "splash" | "welcome" | "auth" | "shell";

export default function App() {
  const themeId = useStore((s) => s.player.themeId);
  // Match-scoped arena override (set by PlayPage when the coin flip handed
  // the duel to the opponent's full look). When non-null, this REPLACES the
  // player's own backgroundId for the duration of the match — backdrop +
  // scrim + light/flashy/data-premium flags all switch to the opponent's
  // universe. Cleared automatically when the match unmounts.
  const arenaBg = useArenaOverride((s) => s.bg);
  const playerBg = useStore((s) => s.player.backgroundId ?? "default");
  const backgroundId = arenaBg ?? playerBg;
  const onboarded = useStore((s) => s.onboarded);
  const locale = useStore((s) => s.locale);
  const hapticEnabled  = useStore((s) => s.player.hapticEnabled ?? true);
  const hapticIntensity = useStore((s) => s.player.hapticIntensity ?? "med");
  const crashReports = useStore((s) => s.player.crashReports ?? false);
  const fontScale = useStore((s) => s.player.fontScale ?? 1);
  // "Signed in" = has an account e-mail OR any account provider. The provider
  // covers an e-mail-less Google / Play Games identity (still authenticated).
  const signedIn = useStore((s) => !!s.player.accountEmail || !!s.player.accountProvider);

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

  // Logout (from the burger) → drop back to the blocking auth gate and kick a
  // fresh bootSync so the new guest identity (the store action already reset +
  // cleared the anchor) gets its claim token persisted.
  useEffect(() => {
    const onShowAuth = () => { setStage("auth"); runBootSync(); };
    window.addEventListener("rpsls:show-auth", onShowAuth);
    return () => window.removeEventListener("rpsls:show-auth", onShowAuth);
  }, []);
  const [stage, setStage] = useState<Stage>("splash");
  const [page, setPage] = useState<Page>("play");
  // Nonce bumped every time the user explicitly clicks "Home" so PlayPage
  // can reset its internal view (kick out of a Game / LanesMatch back to
  // the mode-select home).
  const [homeNonce, setHomeNonce] = useState(0);
  const t = useT();
  // Détection de perf au runtime : mesure les FPS au boot et rétrograde le palier
  // graphique si l'appareil rame malgré de bonnes specs (cf. tablette 8Go/8cœurs).
  useGfxAutoDetect();
  // Palier perf : les backdrops premium (WebGL/SVG continus) deviennent STATIQUES
  // sur appareil faible (le gros poste de lag des « gros thèmes » signalé par Alex).
  const gfxThemes = useGfxAllows("premiumThemes");
  const gfxStorm = useGfxAllows("stormRainLayer");
  const gfxQuartz = useGfxAllows("quartzScene");
  // Match arène en cours → shell PLEIN ÉCRAN (sidebar masquée + cap max-w-md retiré).
  const matchFullscreen = useMatchFullscreen();
  // Navigation unifiée : barre du haut sur tout écran hors match. Un match
  // (immersif) garde son HUD flottant ; un écran à chrome propre (menu principal,
  // plateau Arena…) n'a ni barre ni burger flottant.
  const immersive = useImmersiveActive() || matchFullscreen;
  const ownChrome = useOwnChrome();
  const showTopBar = !immersive && !ownChrome;
  const mainRef = useRef<HTMLElement>(null);

  function navigateTo(next: Page) {
    if (next === "play") setHomeNonce((n) => n + 1);
    setPage(next);
  }

  // Sync the player's vibration preferences down to the haptic module so
  // every vibrate() call honors them (module-level state, read sync).
  useEffect(() => {
    setHapticSettings({ enabled: hapticEnabled, intensity: hapticIntensity });
  }, [hapticEnabled, hapticIntensity]);

  // Season rollover (B5) — fires the soft-LP-reset + tier reward when the
  // 30-day window has elapsed. We run it once on mount: a session crossing
  // midnight stays on the current season until the next launch (acceptable).
  // Portefeuille actif : la saison est versée par le serveur (online/wallet.ts),
  // qui pose `seasonRollover` dans le store — même écran dans les deux cas.
  const rolloverSeasonIfDue = useStore((s) => s.rolloverSeasonIfDue);
  const seasonRollover = useStore((s) => s.seasonRollover);
  const setSeasonRollover = useStore((s) => s.setSeasonRollover);
  useEffect(() => {
    const r = rolloverSeasonIfDue();
    if (r) setSeasonRollover(r);
    startSyncSubscriber();
    startWalletListener();
    // Restore the durable anchor FIRST (Tauri plugin-store JSON), THEN
    // start the boot sync — so a freshly wiped localStorage (post-reinstall)
    // gets seeded with the previous player.id + claimToken before any
    // server handshake runs. Without this, the bootSync would Hello with a
    // freshly-generated UUID and lose the account.
    void restoreAnchorIntoStore().finally(() => {
      runBootSync();
      // Économie serveur (§9-B) : active/confirme le portefeuille et rejoue les
      // gains en attente. Après le bootSync (jitter 0-8 s) pour ne pas doubler
      // la charge au démarrage ; silencieux, sans effet hors ligne.
      window.setTimeout(() => { void flushWallet(); }, 10_000 + Math.floor(Math.random() * 5_000));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Image de fond + skin typo + accent → variables CSS (cf. useAppBackgroundDom).
  const customBgUrl = useAppBackgroundVars(backgroundId, stage, themeId);

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
    const onPop = () => {
      // Un match / lobby gère le retour lui-même (modale de confirmation).
      if (backPromptActive()) return;
      setPage("play");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [page]);

  // After the splash tap: first-run → onboarding; otherwise a guest (no linked
  // account) hits the blocking auth gate BEFORE the menu loads, while a
  // signed-in user goes straight to the shell.
  const afterSplash = () => {
    if (!onboarded) { setStage("welcome"); return; }
    setStage(signedIn ? "shell" : "auth");
  };

  // Live coded backdrop — rendered behind everything when the chosen
  // background is a procedural scene (nebula/aurora/grid) and we're past
  // the splash. Sits at z-0; the app shell renders above it.
  // Full-screen backdrop peek: when on, the menu shell hides so the live,
  // already-applied animated backdrop fills the screen (real preview).
  const peek = useBackdropPeek((s) => s.peek);
  const activeBg = BACKGROUNDS_BY_ID[backgroundId];
  const activeScene = activeBg?.scene;
  const premiumScene = activeBg?.premiumScene;
  const isLightBg = activeBg?.light === true;
  const isFlashyBg = activeBg?.flashy === true;
  const premiumSetId = activeBg?.premiumSetId;

  // Classes theme-light / theme-flashy + data-premium sur <html> (cf. useAppBackgroundDom).
  useAppHtmlBgFlags(isLightBg, isFlashyBg, premiumSetId);

  return (
    <div className="h-full w-full select-none overflow-hidden">
      <AppBackdropLayers
        stage={stage} backgroundId={backgroundId} customBgUrl={customBgUrl}
        activeScene={activeScene} premiumScene={premiumScene} peek={peek}
        gfxThemes={gfxThemes} gfxStorm={gfxStorm} gfxQuartz={gfxQuartz}
      />
      {/* mode="wait" — Alex wanted the sequence to read as "splash ONLY, then
          menu ONLY", never overlapping. The splash fully exits before the
          shell mounts so the player never sees the theme bg leaking through
          mid-transition. */}
      <AnimatePresence mode="wait">
        {stage === "splash" && (
          <Splash
            key="splash"
            onDone={afterSplash}
            scene={activeScene ?? null}
            premiumScene={premiumScene ?? null}
          />
        )}
        {stage === "welcome" && (
          <Suspense key="welcome" fallback={<RouteFallback />}>
            <Welcome onDone={() => setStage(signedIn ? "shell" : "auth")} />
          </Suspense>
        )}
        {stage === "auth" && (
          <AuthGate key="auth" onDone={() => setStage("shell")} />
        )}
        {stage === "shell" && (
          <motion.div
            key="shell"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            // Confident "arrival" rather than a flat fade — the menu scales up as
            // it lands (esp. after the auth gate's success celebration).
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            // relative z-10 keeps the shell above the z-0 coded backdrop.
            // During a full-screen peek, hide the shell so the live backdrop fills the screen.
            className={"relative z-10 flex h-full min-h-0" + (peek ? " invisible" : "")}
          >
            {!matchFullscreen && <Sidebar page={page} onNavigate={navigateTo} />}
            <MobileShell page={page} onNavigate={navigateTo} floatingTrigger={immersive && !ownChrome} />
            {/* Theme-coloured touch particles across the menu. Quiet on Contact,
                and inside any game/deck screen (useNoMenuFx) or the open drawer
                ([data-no-touchfx]). */}
            <ThemeTouchFX enabled={page !== "contact" && page !== "online"} />
            {/* Global LEVEL UP celebration — catches an XP gain from any surface. */}
            <LevelUpWatcher />
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Barre du haut unifiée (burger + retour à gauche, titre centré).
                  Titre/retour par défaut = page courante → accueil ; un lobby ou
                  un sous-écran les remplace via useTopBar(). */}
              <AnimatePresence initial={false}>
                {showTopBar && (
                  <AppTopBar
                    key="topbar"
                    mainRef={mainRef}
                    defaultTitle={page === "play" ? "" : t(PAGE_TITLE_KEY[page])}
                    defaultBack={page === "play" ? undefined : () => navigateTo(page === "privacy" ? "about" : "play")}
                    defaultBackLabel={t(page === "privacy" ? "nav.back" : "nav.backToPlay")}
                  />
                )}
              </AnimatePresence>
              {/* Haut : avec la barre, simple respiration (pt-3) ; match immersif,
                  dégagement du HUD flottant ; écran à chrome propre (menu
                  principal, plateau Arena) : pt-12 historique. La safe-area est
                  déjà payée par #root. Bas = marge au-dessus de la nav Android. */}
              <main
                ref={mainRef}
                className={"flex-1 flex flex-col min-h-0 w-full overflow-x-hidden overflow-y-auto pb-4 portrait:min-[900px]:pb-0 [@media(max-height:540px)]:pb-1 " +
                  (showTopBar ? "pt-3 [@media(max-height:540px)]:pt-1.5"
                    // Burger + retour flottants (match) : le contenu démarre SOUS eux
                    // (fini le label « TOI » du score masqué) ; bas du bouton =
                    // max(safe-area, 32px) + 54px, #root a déjà payé la safe-area.
                    : immersive && !ownChrome ? "pt-[calc(max(var(--sai-top),32px)+58px-var(--sai-top))] portrait:min-[900px]:pt-0 [@media(max-height:540px)]:pt-2"
                    : "pt-12 portrait:min-[900px]:pt-0 [@media(max-height:540px)]:pt-2") +
                  (matchFullscreen ? "" : " max-w-md mx-auto landscape:max-w-none")}
              >
                {/* Persistent player header — shown on every menu page, never on
                    a match surface (Play / Online own internal match states),
                    and never on Profile (which mounts the SAME PlayerBadge as
                    its hero — rendering both would duplicate the badge stack,
                    the bug Alex flagged). Its XP bar is where quest/match XP
                    gains visibly land. */}
                {/* Pas sur la Boutique non plus : elle affiche déjà ses monnaies
                    (doublon carte joueur + pastilles relevé à l'audit). */}
                {page !== "play" && page !== "online" && page !== "profile" && page !== "shop" && (
                  <UserHeader onNavigate={navigateTo} />
                )}
                <AnimatePresence mode="wait">
                  {page === "play"    && <PageWrap key="play"><PlayPage onNavigate={navigateTo} homeNonce={homeNonce} /></PageWrap>}
                  {page !== "play" && (
                    // key={page} : chaque page différée est un enfant DISTINCT de
                    // AnimatePresence → l'ancienne joue sa sortie (avant : une clé
                    // fixe, l'ancienne page disparaissait sèchement entre 2 pages lazy).
                    <Suspense key={`lazy-${page}`} fallback={<RouteFallback />}>
                      {page === "online"  && <PageWrap key="online"><OnlinePage /></PageWrap>}
                      {page === "leaderboard" && <PageWrap key="leaderboard"><LeaderboardPage /></PageWrap>}
                      {page === "shop"    && <PageWrap key="shop"><ShopPage /></PageWrap>}
                      {page === "quests"  && <PageWrap key="quests"><QuestsPage /></PageWrap>}
                      {page === "packs"   && <PageWrap key="packs"><PacksPage /></PageWrap>}
                      {page === "profile" && <PageWrap key="profile"><ProfilePage onNavigate={navigateTo} /></PageWrap>}
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

      {/* Season rollover modal — fires once at app start when the 30-day
          window has elapsed (the store already credited the reward + soft
          reset LP before we got here). */}
      <AnimatePresence>
        {seasonRollover && (
          <SeasonRolloverModal
            fromSeason={seasonRollover.fromSeason}
            reward={seasonRollover.reward}
            lpBefore={seasonRollover.lpBefore}
            lpAfter={seasonRollover.lpAfter}
            onClose={() => setSeasonRollover(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
