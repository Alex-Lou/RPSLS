/**
 * ArenaConstellationBar — compteur 3⭐ d'Affinité.
 *
 * Posé au-dessus / à côté du portrait du héros. Affiche 3 emplacements
 * d'étoiles, remplies progressivement à mesure que le hero invoque son
 * symbole d'Affinité (cf arenaRules.applySummons).
 *
 * À 3/3 : glow cosmique + halo amplifié signalent que le Finisher
 * (Lot D, à câbler) est débloqué.
 *
 * KISS : pas de logique métier ici — uniquement de l'affichage à partir
 * des props. Le compteur vit dans HeroState.constellationCount.
 */

import { motion } from "motion/react";
import { MoveGlyph, MOVE_PALETTE } from "../icons";
import type { Move } from "../engine/game";

interface ArenaConstellationBarProps {
  /** Valeur 0–3 du compteur (capée à 3 pour l'affichage, peut excéder). */
  count: number;
  /** Affinité du hero — utilisée pour la couleur des étoiles + le glyph
   *  central. Si non définie : barre grisée (le hero ne joue pas la Voie). */
  affinity?: Move;
  /** Côté du hero, pour l'orientation visuelle (you = en bas, opp = haut). */
  side: "you" | "opp";
  /** Flag "Finisher débloqué" (passé 3/3 au moins une fois ce match). */
  finisherUnlocked?: boolean;
}

const STAR_COUNT = 3;

export function ArenaConstellationBar({
  count, affinity, side, finisherUnlocked,
}: ArenaConstellationBarProps) {
  const filledCount = Math.min(STAR_COUNT, count);
  const isComplete = filledCount >= STAR_COUNT;
  const pal = affinity ? MOVE_PALETTE[affinity] : null;
  const accentColor = pal?.hex ?? "#a78bfa"; // violet par défaut

  // Pas d'affichage si le hero n'a pas choisi d'Affinité — le compteur
  // n'aurait aucun sens.
  if (!affinity) return null;

  return (
    <div
      className={
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full backdrop-blur " +
        (side === "you" ? "self-start" : "self-end")
      }
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${accentColor} 12%, rgba(0,0,0,0.55)), rgba(0,0,0,0.65))`,
        border: `1px solid color-mix(in oklab, ${accentColor} 45%, rgba(255,255,255,0.05))`,
        boxShadow: isComplete
          ? `0 0 18px -2px ${accentColor}aa, inset 0 0 10px color-mix(in oklab, ${accentColor} 35%, transparent)`
          : `0 1px 3px rgba(0,0,0,0.4)`,
      }}
      aria-label={`Constellation ${filledCount} sur ${STAR_COUNT}`}
    >
      <MoveGlyph
        move={affinity}
        className="w-3 h-3 shrink-0 opacity-90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
      />
      <div className="flex items-center gap-0.5">
        {Array.from({ length: STAR_COUNT }).map((_, i) => {
          const filled = i < filledCount;
          return (
            <motion.span
              key={i}
              initial={false}
              animate={
                filled
                  ? {
                      scale: isComplete ? [1, 1.18, 1] : 1,
                      filter: isComplete
                        ? [
                            `drop-shadow(0 0 2px ${accentColor})`,
                            `drop-shadow(0 0 6px ${accentColor})`,
                            `drop-shadow(0 0 2px ${accentColor})`,
                          ]
                        : `drop-shadow(0 0 3px ${accentColor})`,
                    }
                  : { scale: 1, filter: "none" }
              }
              transition={
                isComplete
                  ? { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }
                  : { type: "spring", stiffness: 320, damping: 20 }
              }
              className={
                "text-[11px] leading-none " +
                (filled ? "" : "opacity-25")
              }
              style={{ color: filled ? accentColor : "#71717a" }}
            >
              ★
            </motion.span>
          );
        })}
      </div>
      {finisherUnlocked && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="text-[8px] uppercase tracking-wider font-black text-amber-200"
          style={{ textShadow: `0 0 6px ${accentColor}` }}
        >
          FINISHER ✦
        </motion.span>
      )}
    </div>
  );
}
