/**
 * Écran d'ouverture (Splash) — extrait verbatim d'App.tsx.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SplashShader } from "./fx/SplashShader";
import { QuartzBackdropWithLayer } from "./backdrops/QuartzBackdrop";
import { useT } from "./i18n";

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
export function Splash({ onDone, scene, premiumScene }: {
  onDone: () => void;
  scene: import("./backdrops/ThemedBackdrop").BackdropScene | null;
  premiumScene?: string | null;
}) {
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
      {/* Procedural WebGL fluid backdrop. When the player has picked a coded
          scene, the splash uses THAT scene instead so the opening matches
          the chosen ambience. When the player owns the Quartz premium set
          (a SVG/SMIL scene, not a fragment shader branch), the splash uses
          the live QuartzBackdrop instead of the shader fallback. */}
      {premiumScene === "quartz" ? (
        <QuartzBackdropWithLayer />
      ) : (
        <SplashShader scene={scene} />
      )}

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
