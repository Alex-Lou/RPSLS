/**
 * Effets DOM liés au fond d'écran du shell (variables CSS image/typo/accent,
 * classes theme-light / theme-flashy, data-premium) — extraits verbatim
 * d'App.tsx, appelés au même endroit (même ordre de hooks).
 */
import { useEffect } from "react";
import { useStore } from "./store/store";
import { THEMES } from "./theme/theme";
import { BACKGROUNDS_BY_ID, resolveFontFamily } from "./theme/themes";
import type { ThemeId } from "./types";

export function useAppBackgroundVars(
  backgroundId: keyof typeof BACKGROUNDS_BY_ID,
  stage: "splash" | "welcome" | "auth" | "shell",
  themeId: ThemeId,
) {
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
    // Typography precedence: a coded scene background (nebula/casino/holy…)
    // owns a bespoke font skin harmonised with its art, so it WINS. On the
    // plain "default" or the player's own "custom" image there is no scene
    // identity, so the chosen HUD colour palette drives the fonts too — which
    // gives every "Couleurs" theme its own type mood, not just colours.
    const skin = def?.scene ? def.skin : THEMES[themeId];
    if (skin) {
      root.style.setProperty("--font-headline", resolveFontFamily(skin.fontHeadline));
      root.style.setProperty("--font-body",     resolveFontFamily(skin.fontBody));
      root.style.setProperty("--font-mono",     resolveFontFamily(skin.fontMono));
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
  }, [backgroundId, stage, customBgUrl, themeId]);
  return customBgUrl;
}

// Toggle the global `theme-light` / `theme-flashy` classes and the
// `data-premium` attribute on <html> so App.css can:
//  - darken text + thicken surfaces for pastel / flashy backdrops
//  - apply per-set frame identity (border colour, shadow, radius,
//    typography) via [data-premium="…"] selectors
export function useAppHtmlBgFlags(
  isLightBg: boolean,
  isFlashyBg: boolean,
  premiumSetId: string | undefined,
) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-light", isLightBg);
    root.classList.toggle("theme-flashy", isFlashyBg);
    if (premiumSetId) {
      root.dataset.premium = premiumSetId;
    } else {
      delete root.dataset.premium;
    }
  }, [isLightBg, isFlashyBg, premiumSetId]);
}
