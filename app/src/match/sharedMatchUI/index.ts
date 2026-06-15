/**
 * Shared "cinematic" match UI bits — extracted so the classic 1v1 modes
 * (Training / Casual / Ranked / Hot-seat) can wear the same look-and-feel
 * as the Constellation Lanes mode.
 *
 * Components exported:
 *   - RollingScore: AnimatePresence popLayout digit, no pile-up on change.
 *   - CinematicMatchEnd: trophy/skull/handshake glyph that springs in then
 *     gently floats, gradient VICTOIRE/ÉGALITÉ/DÉFAITE wordmark that
 *     breathes, optional forfeit pill, score card, Rematch + Back buttons,
 *     end-of-match author quote (random per mount).
 *   - AmbientFlavor: ~10 rotating geek one-liners. Atmosphere, not signal.
 *
 * Découpé par responsabilité ; ce barrel ré-exporte tout verbatim pour que le
 * chemin "../match/sharedMatchUI" reste identique pour les 10 consommateurs.
 * (CountUp reste interne au module — utilisé par CinematicMatchEnd, non public.)
 */

export * from "./ScaleToFit";
export * from "./androidBack";
export * from "./MatchScoreBar";
export * from "./FloatingMatchBackButton";
export * from "./CinematicMatchEnd";
export { CelebrationBurst } from "./CelebrationBurst";
export * from "./PickVFX";
export * from "./AmbientFlavor";
