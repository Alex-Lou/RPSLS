/**
 * graphicsQuality — palier de qualité graphique (perf), PAR APPAREIL.
 *
 * Pourquoi (Alex 2026-06-20) : la tablette (moins de budget GPU/compositing que
 * le tél) rame sur les effets lourds — shader d'intro, motif d'aura de Voie,
 * traînées tactiles, pluie premium, particules de menu. On expose 3 paliers :
 *   - 'low'    → coupe les effets coûteux (fluidité avant tout)
 *   - 'medium' → intermédiaire
 *   - 'high'   → plein régime (téléphone capable)
 *
 * SOURCE DE VÉRITÉ : `player.graphicsQuality`.
 *   - `undefined` (défaut) → AUTO : résolu vers le palier détecté pour CET
 *     appareil (detectGraphicsLevel, calculé UNE fois au chargement du module).
 *   - 'low'|'medium'|'high' → override MANUEL du joueur (Profil), prioritaire.
 *
 * PER-APPAREIL : la valeur vit dans `player` (persistée en localStorage via
 * partialize) mais n'est JAMAIS dans la struct serveur → JAMAIS synchronisée.
 * Régler la tablette en 'low' ne touche donc pas le réglage du téléphone.
 */

import { useStore } from "../store/store";

export type GraphicsLevel = "low" | "medium" | "high";

/** Détection best-effort du palier selon les capacités de l'appareil. WebView
 *  Android = Chromium → `navigator.deviceMemory` + `hardwareConcurrency` dispos.
 *  CONSERVATEUR : au moindre signal faible → 'low' (mieux vaut fluide que joli).
 *  L'override manuel (Profil) reste le contrôle EXACT si la détection se trompe. */
export function detectGraphicsLevel(): GraphicsLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 0; // Go (0 = inconnu / non exposé)
  const cores = nav.hardwareConcurrency ?? 0; // cœurs logiques (0 = inconnu)
  const dpr = window.devicePixelRatio || 1;
  // DPR < 2.2 = signal FORT « tablette / appareil modeste » : les flagships sont
  // à 2.6-3.5 ; une tablette haute-résolution mais densité basse (ex. Lenovo
  // TB336FU = 1600×2560 mais DPR 2.0) rame en WebView malgré 8 Go/8 cœurs. Ce
  // signal-là (pas la RAM/les cœurs « sur le papier ») la classe correctement.
  if (dpr < 2.2 || (mem > 0 && mem <= 3) || (cores > 0 && cores <= 4)) return "low";
  // Milieu de gamme → 'medium'.
  if ((mem > 0 && mem <= 6) || (cores > 0 && cores <= 6) || dpr < 2.6) return "medium";
  return "high";
}

/** Palier auto de CET appareil, calculé une seule fois (valeurs stables). */
export const AUTO_LEVEL: GraphicsLevel = detectGraphicsLevel();

/** Résout le palier effectif. Précédence : override MANUEL (Profil) > palier
 *  MESURÉ au runtime (détection FPS, [[useGfxAutoDetect]]) > AUTO (specs). */
export function resolveLevel(override: GraphicsLevel | undefined, measured?: GraphicsLevel): GraphicsLevel {
  return override ?? measured ?? AUTO_LEVEL;
}

/** Palier effectif courant, HORS React (init de canvas, helpers non-hook). */
export function getGraphicsLevel(): GraphicsLevel {
  const p = useStore.getState().player;
  return resolveLevel(p.graphicsQuality, p.graphicsMeasured);
}

/** Palier effectif courant, RÉACTIF (composants React). */
export function useGraphicsLevel(): GraphicsLevel {
  return useStore((s) => resolveLevel(s.player.graphicsQuality, s.player.graphicsMeasured));
}

/** Ordre des paliers : un effet s'affiche si le palier effectif >= son minimum. */
const ORDER: Record<GraphicsLevel, number> = { low: 0, medium: 1, high: 2 };

/** Effets gérés → palier MINIMUM auquel ils sont rendus. */
const MIN_LEVEL: Record<string, GraphicsLevel> = {
  voieMotif: "medium", // motif animé des auras de Voie (le + lourd en arène)
  cardBackAnim: "medium", // animations des dos de carte (sinon statiques)
  splashShader: "medium", // shader cosmique d'intro (WebGL) — 'low' = fallback CSS
  premiumTouch: "high", // traînées tactiles premium (le + cher, par pointeur)
  menuParticles: "medium", // particules de menu (ThemeTouchFX)
  queueFx: "medium", // anneaux/particules du radar de matchmaking
  premiumThemes: "medium", // ThemedBackdrop WebGL continu (20 scènes) — STATIQUE en 'low'
  quartzScene: "medium", // QuartzBackdrop SVG/SMIL continu — STATIQUE en 'low'
  stormRainLayer: "medium", // pluie premium (overlay) — COUPÉE en 'low'
};

/** L'effet nommé doit-il être rendu au palier donné (ou courant si omis) ? */
export function gfxAllows(effect: string, level?: GraphicsLevel): boolean {
  const eff = level ?? getGraphicsLevel();
  const min = MIN_LEVEL[effect] ?? "low";
  return ORDER[eff] >= ORDER[min];
}

/** Hook RÉACTIF : l'effet nommé est-il autorisé au palier courant ? */
export function useGfxAllows(effect: string): boolean {
  const level = useGraphicsLevel();
  return gfxAllows(effect, level);
}

/** Multiplicateur de densité [0..1] pour les effets à intensité variable (pluie
 *  premium, particules de célébration) : low=0.45, medium=0.75, high=1. */
export function gfxDensity(level?: GraphicsLevel): number {
  const eff = level ?? getGraphicsLevel();
  return eff === "low" ? 0.45 : eff === "medium" ? 0.75 : 1;
}
