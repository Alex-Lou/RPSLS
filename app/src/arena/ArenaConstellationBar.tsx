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
  /** Pendant la résolution : gèle les pulses idle (étoiles + finisher) pour
   *  rendre le budget GPU aux anims de combat (Alex 2026-06-17 perf). */
  calm?: boolean;
  /** Voie ADVERSE encore CACHÉE (révélation progressive, Alex 2026-06-17 rethink
   *  Phase 0) : avant sa 1ʳᵉ étoile, on n'affiche ni glyphe ni nom de Voie et la
   *  couleur reste neutre — seul un « ? » + des étoiles anonymes. Dévoilé dès la
   *  1ʳᵉ invocation du symbole d'Affinité. Cf. ARENA-RETHINK.md. */
  concealed?: boolean;
}

const STAR_COUNT = 3;

export function ArenaConstellationBar({
  count, affinity, side, finisherUnlocked, calm = false, concealed = false,
}: ArenaConstellationBarProps) {
  const filledCount = Math.min(STAR_COUNT, count);
  const isComplete = filledCount >= STAR_COUNT;
  const pal = affinity ? MOVE_PALETTE[affinity] : null;
  // Voie adverse cachée → couleur NEUTRE (ardoise) pour ne pas fuiter l'affinité
  // par la teinte (bg/bord/étoiles). Révélée → couleur signature de la Voie.
  const accentColor = concealed ? "#94a3b8" : (pal?.hex ?? "#a78bfa"); // violet par défaut

  // Pas d'affichage si le hero n'a pas choisi d'Affinité — le compteur
  // n'aurait aucun sens.
  if (!affinity) return null;

  // Alex feedback 2026-06-09 point #2 : progression lumineuse plus claire,
  // 1⭐ → discret, 2⭐ → moyen, 3⭐ → flash MAX. Avant 3 c'est "progression",
  // après 3 c'est "climax" — la différence DOIT sauter aux yeux.
  // Halo extérieur du badge scale avec filledCount :
  const glowIntensity =
    filledCount === 0 ? 0 :
    filledCount === 1 ? 0.35 :
    filledCount === 2 ? 0.65 :
    1.0;
  const bgOpacityPct =
    filledCount === 0 ? 12 :
    filledCount === 1 ? 18 :
    filledCount === 2 ? 26 :
    42; // 3⭐ : fond bien teinté
  return (
    <div
      className={
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full backdrop-blur shrink-0 " +
        (side === "you" ? "self-start" : "self-end")
      }
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${accentColor} ${bgOpacityPct}%, rgba(0,0,0,0.55)), rgba(0,0,0,0.65))`,
        border: `1px solid color-mix(in oklab, ${accentColor} ${45 + filledCount * 12}%, rgba(255,255,255,0.05))`,
        boxShadow: isComplete
          ? `0 0 22px -1px ${accentColor}cc, 0 0 8px ${accentColor}88, inset 0 0 12px color-mix(in oklab, ${accentColor} 40%, transparent)`
          : `0 0 ${4 + glowIntensity * 10}px -1px ${accentColor}${Math.round(glowIntensity * 200 + 30).toString(16).padStart(2, "0")}, 0 1px 3px rgba(0,0,0,0.4)`,
      }}
      aria-label={concealed ? "Voie adverse cachée" : `Constellation ${filledCount} sur ${STAR_COUNT}`}
    >
      {/* Voie adverse cachée → « ? » neutre au lieu du glyphe d'affinité (qui
       *  trahirait la Voie). Révélée → glyphe signature. */}
      {concealed ? (
        <span
          className="w-3 h-3 shrink-0 flex items-center justify-center text-[11px] font-black leading-none opacity-80"
          style={{ color: accentColor }}
          aria-hidden
        >
          ?
        </span>
      ) : (
        <MoveGlyph
          move={affinity}
          className="w-3 h-3 shrink-0 opacity-90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
        />
      )}
      {/* Round 9 fix Alex point #2 : label texte "Voie de X" pour que le
       *  joueur SACHE quel style l'autre a choisi (et donc quels bonus
       *  s'appliquent aux créatures opp). CACHÉ tant que la Voie adverse n'est
       *  pas révélée (Alex 2026-06-17 rethink Phase 0). */}
      {!concealed && (
        <span
          className="text-[8px] uppercase tracking-wide font-bold leading-none"
          style={{ color: accentColor }}
        >
          {affinity === "rock" ? "Montagne" :
           affinity === "paper" ? "Forêt" :
           affinity === "scissors" ? "Tranchant" :
           affinity === "lizard" ? "Mirage" :
           "Cosmos"}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: STAR_COUNT }).map((_, i) => {
          const filled = i < filledCount;
          // glow étoile : plus lumineuse plus le compteur monte (1 → 2 → 3).
          const starGlowPx = filled
            ? (filledCount === 1 ? 3 : filledCount === 2 ? 5 : 7)
            : 0;
          return (
            <motion.span
              key={i}
              initial={false}
              animate={
                filled
                  ? (calm
                      ? { scale: 1, filter: `drop-shadow(0 0 ${starGlowPx}px ${accentColor})` }
                      : {
                          scale: isComplete ? [1, 1.22, 1] : (filledCount === 2 ? [1, 1.1, 1] : 1),
                          filter: isComplete
                            ? [
                                `drop-shadow(0 0 3px ${accentColor})`,
                                `drop-shadow(0 0 9px ${accentColor})`,
                                `drop-shadow(0 0 3px ${accentColor})`,
                              ]
                            : `drop-shadow(0 0 ${starGlowPx}px ${accentColor})`,
                        })
                  : { scale: 1, filter: "none" }
              }
              transition={
                calm
                  ? { duration: 0 }
                  : isComplete
                  ? { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.16 }
                  : filledCount === 2
                  ? { duration: 2.0, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }
                  : { type: "spring", stiffness: 320, damping: 20 }
              }
              className={
                "leading-none " +
                (isComplete ? "text-[13px] font-black" : filledCount === 2 ? "text-[12px] font-bold" : "text-[11px]") + " " +
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
          animate={calm ? { opacity: 0.95, scale: 1 } : {
            opacity: [0.9, 1, 0.9],
            scale: [1, 1.05, 1],
          }}
          transition={calm ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="text-[8px] uppercase tracking-wide font-black text-amber-200"
          style={{ textShadow: `0 0 8px ${accentColor}, 0 0 4px #fbbf24` }}
        >
          ✦
        </motion.span>
      )}
    </div>
  );
}
