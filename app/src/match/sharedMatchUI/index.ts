/**
 * Shared "cinematic" match UI bits — extracted so the classic 1v1 modes
 * (Training / Casual / Ranked / Hot-seat) can wear the same look-and-feel
 * as the Constellation Lanes mode.
 *
 * Components exported:
 *   - RollingScore: chiffre STATIQUE (maj en place, ni motion ni key → zéro
 *     empilement), fonte mono tabulaire garantie sur tous les thèmes.
 *   (L'écran de fin de match vit désormais dans ../matchEnd — MatchEndScreen,
 *    commun à tous les modes.)
 *   - AmbientFlavor: ~10 rotating geek one-liners. Atmosphere, not signal.
 *
 * Découpé par responsabilité ; ce barrel ré-exporte tout verbatim pour que le
 * chemin "../match/sharedMatchUI" reste identique pour les 10 consommateurs.
 */

export * from "./ScaleToFit";
export * from "./androidBack";
export * from "./MatchScoreBar";
export * from "./FloatingMatchBackButton";
export { CelebrationBurst } from "./CelebrationBurst";
export * from "./PickVFX";
export * from "./AmbientFlavor";
