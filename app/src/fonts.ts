/**
 * fonts.ts — loads every @fontsource package the theme skins reference.
 *
 * Side-effect-only file: importing a @fontsource module injects its
 * @font-face declarations into the document and bundles the woff2 file with
 * the app. Import this once from main.tsx so every theme's font family is
 * available regardless of which theme is currently selected.
 *
 * Variable fonts where available (Inter, Cinzel, etc.) — they cover the
 * full weight range from a single file.
 */

// Default UI
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@fontsource/jetbrains-mono/400.css";

// Ancient Codex
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/900.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/im-fell-english/400.css";

// Astrolab
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/600.css";

// Casino Royale
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/900.css";
import "@fontsource/bebas-neue/400.css";

// Cyberpunk
import "@fontsource/orbitron/600.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/share-tech-mono/400.css";

// Galaxy
import "@fontsource/audiowide/400.css";
import "@fontsource/exo-2/400.css";
import "@fontsource/exo-2/700.css";
import "@fontsource/space-mono/400.css";

// Quantum Lab
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/fira-code/400.css";

// Steampunk
import "@fontsource/medievalsharp/400.css";
import "@fontsource/bevan/400.css";

/** CSS font-family strings ready to drop into `style.fontFamily` or a CSS
 *  variable. Each value includes a robust fallback chain. */
export const FONT_STACK = {
  inter:       `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  cinzel:      `"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif`,
  cormorant:   `"Cormorant Garamond", Georgia, "Times New Roman", serif`,
  ebGaramond:  `"EB Garamond", Georgia, "Times New Roman", serif`,
  imFell:      `"IM Fell English", Georgia, "Times New Roman", serif`,
  playfair:    `"Playfair Display", Georgia, serif`,
  bebas:       `"Bebas Neue", Impact, "Arial Narrow", sans-serif`,
  orbitron:    `"Orbitron", "Eurostile", "Tahoma", sans-serif`,
  rajdhani:    `"Rajdhani", "Tahoma", Verdana, sans-serif`,
  shareTech:   `"Share Tech Mono", "Consolas", "Courier New", monospace`,
  audiowide:   `"Audiowide", "Tahoma", sans-serif`,
  exo2:        `"Exo 2", "Tahoma", Verdana, sans-serif`,
  spaceMono:   `"Space Mono", "Consolas", "Courier New", monospace`,
  spaceGrotesk:`"Space Grotesk", "Inter", system-ui, sans-serif`,
  ibmPlex:     `"IBM Plex Sans", "Inter", system-ui, sans-serif`,
  jetbrains:   `"JetBrains Mono", "Consolas", "Courier New", monospace`,
  fira:        `"Fira Code", "Consolas", "Courier New", monospace`,
  medieval:    `"MedievalSharp", "Cinzel", Georgia, serif`,
  bevan:       `"Bevan", Impact, Georgia, serif`,
} as const;

export type FontStackKey = keyof typeof FONT_STACK;
