/**
 * Couches de fond du shell (scène codée, FX tactiles premium, pluie, Quartz,
 * voiles de lisibilité) — JSX extrait verbatim d'App.tsx. Les hooks (palier
 * graphique, peek, store) restent dans App, qui passe leurs valeurs ici.
 */
import { ThemedBackdrop, ThemedBackdropStaticFallback, type BackdropScene } from "./backdrops/ThemedBackdrop";
import { QuartzBackdropWithLayer } from "./backdrops/QuartzBackdrop";
import { PremiumTouchLayer, isPremiumFxScene } from "./backdrops/PremiumTouchLayer";
import { StormRain } from "./backdrops/StormRain";

export interface AppBackdropLayersProps {
  stage: "splash" | "welcome" | "auth" | "shell";
  backgroundId: string;
  customBgUrl: string | undefined;
  activeScene: BackdropScene | undefined;
  premiumScene: string | undefined;
  peek: boolean;
  gfxThemes: boolean;
  gfxStorm: boolean;
  gfxQuartz: boolean;
}

export function AppBackdropLayers({
  stage, backgroundId, customBgUrl, activeScene, premiumScene, peek, gfxThemes, gfxStorm, gfxQuartz,
}: AppBackdropLayersProps) {
  return (
    <>
    {/* Backdrop stays gated on `stage !== "splash"` — Splash already mounts
        its own ThemedBackdrop via SplashShader, doubling it would render two
        WebGL canvases at z-0 and waste a context. */}
    {activeScene && stage !== "splash" && stage !== "auth" && (
      gfxThemes ? <ThemedBackdrop scene={activeScene} /> : <ThemedBackdropStaticFallback scene={activeScene} />
    )}
    {/* Per-theme touch/slide FX for the coded premium scenes (storm/tempus/
        emberforge/phantom/eclipse) — each reacts in its own voice. Passive in
        menus (taps still reach the UI), active during the full-screen peek.
        Quartz has its own bespoke layer just below. Active from splash
        onwards so the opening already has its theme signature (Alex: "if
        something is meant to be shown, it must be visible from the start"). */}
    {activeScene && isPremiumFxScene(activeScene) && (
      <PremiumTouchLayer scene={activeScene} active />
    )}
    {/* Tempest = a REAL gravity-driven downpour over the storm backdrop.
        Mounted during splash too: the rain IS the theme — hiding it on
        opening means the splash looks dead for a beat. Performance: one
        canvas + rAF, runs alongside the cosmic shader without contention. */}
    {activeScene === "storm" && gfxStorm && <StormRain />}
    {premiumScene === "quartz" && (
      gfxQuartz ? (
        // Interactive layer is wired ONLY during peek (full-screen preview):
        // outside peek the regular UI taps must keep reaching their buttons.
        // The wrapper switches `pointerEvents` inline so the same component
        // serves both passive and active modes without duplication.
        <div className={"fixed inset-0 z-0 " + (peek ? "" : "pointer-events-none")}>
          <QuartzBackdropWithLayer interactive={peek} />
        </div>
      ) : (
        // Palier perf bas : fallback STATIQUE prismatique (zéro SVG/SMIL).
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 85% at 50% 28%, rgba(232,210,250,0.20) 0%, transparent 52%)," +
              "radial-gradient(85% 70% at 72% 78%, rgba(200,174,240,0.15) 0%, transparent 58%)," +
              "linear-gradient(180deg, #141019 0%, #0a0710 100%)",
          }}
        />
      )
    )}
    {/* Readability scrim over a player's OWN uploaded image — coded scenes
        already ship their own vignette, but a raw photo can be bright/busy
        enough to drown menu text. A very light dark wash keeps every page
        legible without hiding the chosen picture. ALSO shows during peek:
        the preview MUST match the final rendering exactly, otherwise the
        player buys/picks a look that turns out brighter in use than what
        they saw in the picker. */}
    {backgroundId === "custom" && customBgUrl && (
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
        wash keeps titles + nav legible while leaving the scene visible. Also
        rendered during peek — preview = exact rendering, see comment above. */}
    {backgroundId !== "custom" && activeScene && (
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.46) 0%, rgba(0,0,0,0.22) 24%, rgba(0,0,0,0.22) 68%, rgba(0,0,0,0.48) 100%)",
        }}
      />
    )}
    </>
  );
}
