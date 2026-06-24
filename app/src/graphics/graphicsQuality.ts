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
  // Le DPR n'est PLUS utilisé (Alex 2026-06-24) : c'était un mauvais proxy GPU —
  // il classait en 'low' des appareils parfaitement capables mais à écran peu
  // dense (DPR < 2.2, ex. mon PC en DPR 1, des téléphones 1080p), coupant à tort
  // les effets. On fait désormais CONFIANCE par défaut ('high') et on ne
  // rétrograde QUE sur des signaux specs FIABLES d'appareil VRAIMENT faible. La
  // vraie jank (ex. la tablette qui rame malgré ses specs) est mesurée au
  // RUNTIME par useGfxAutoDetect, qui rétrograde alors le palier per-appareil.
  if ((mem > 0 && mem <= 2) || (cores > 0 && cores <= 2)) return "low";
  if ((mem > 0 && mem <= 3) || (cores > 0 && cores <= 4)) return "medium";
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

/** Contenu PREMIUM (PAYANT) — thèmes premium + traînées de toucher. RÈGLE
 *  SPÉCIALE (Alex 2026-06-24) : on ne le coupe JAMAIS via l'AUTO ni la mesure
 *  FPS — UNIQUEMENT si le joueur choisit MANUELLEMENT 'Bas'. Un thème acheté ne
 *  doit pas paraître cassé parce qu'un appareil a été mal détecté. Ces effets
 *  IGNORENT donc MIN_LEVEL et le palier effectif. */
const PREMIUM_EFFECTS = new Set<string>(["premiumThemes", "premiumTouch"]);

/** L'effet nommé doit-il être rendu ? PREMIUM → autorisé sauf si l'override
 *  MANUEL est 'low'. Autres → palier effectif (donné, ou courant) >= minimum. */
export function gfxAllows(effect: string, level?: GraphicsLevel): boolean {
  if (PREMIUM_EFFECTS.has(effect)) {
    return useStore.getState().player.graphicsQuality !== "low";
  }
  const eff = level ?? getGraphicsLevel();
  const min = MIN_LEVEL[effect] ?? "low";
  return ORDER[eff] >= ORDER[min];
}

/** Hook RÉACTIF : l'effet nommé est-il autorisé ? UN SEUL useStore (sélecteur
 *  qui retourne le booléen) → même empreinte de hooks que les autres lectures,
 *  re-render uniquement quand le verdict change. Premium → override manuel seul ;
 *  autres → palier effectif (override > mesuré > specs). */
export function useGfxAllows(effect: string): boolean {
  return useStore((s) =>
    PREMIUM_EFFECTS.has(effect)
      ? s.player.graphicsQuality !== "low"
      : gfxAllows(effect, resolveLevel(s.player.graphicsQuality, s.player.graphicsMeasured)),
  );
}

/** Multiplicateur de densité [0..1] pour les effets à intensité variable (pluie
 *  premium, particules de célébration) : low=0.45, medium=0.75, high=1. */
export function gfxDensity(level?: GraphicsLevel): number {
  const eff = level ?? getGraphicsLevel();
  return eff === "low" ? 0.45 : eff === "medium" ? 0.75 : 1;
}
