import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useImmersive } from "./topBarStore";

/**
 * MatchStage — conteneur d'une surface de MATCH (duel, couloirs, arène…).
 * Fondu d'entrée/sortie + marque la surface « immersive » tant qu'elle est
 * montée : la barre du haut s'efface, le match garde son HUD flottant.
 * Monté/démonté par AnimatePresence → la barre ne revient qu'APRÈS la sortie
 * du match (pas de saut pendant l'animation).
 */
export function MatchStage({ children }: { children: ReactNode }) {
  useImmersive(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col min-h-0"
    >
      {children}
    </motion.div>
  );
}
