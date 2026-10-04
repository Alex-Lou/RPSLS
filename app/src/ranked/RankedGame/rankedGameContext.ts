import type { Rng } from "../../engine/rng";
import type { AppState } from "../../store/storeTypes";
import type { useRankedGameState } from "./useRankedGameState";
import type { useV3BonusState } from "./useV3BonusState";

/**
 * Contexte d'UN rendu de RankedGame : états/refs (useRankedGameState +
 * useV3BonusState) + props / sélecteurs du store. Reconstruit À CHAQUE rendu et
 * passé aux fabriques (createStartNextRound, createResolveAndAdvance…) → leurs
 * fonctions capturent exactement les mêmes valeurs que les anciennes fonctions
 * déclarées dans le composant (closures identiques, y compris « périmées » quand
 * elles sont appelées depuis un setTimeout).
 */
export type RankedGameCtx = ReturnType<typeof useRankedGameState> & ReturnType<typeof useV3BonusState> & {
  rng: Rng;
  difficulty: AppState["player"]["difficulty"];
  winTo: number;
  savedDeck: AppState["player"]["rankedDeck"];
  recordMatch: AppState["recordMatch"];
  awardCardMasteryXp: AppState["awardCardMasteryXp"];
  onQuit: () => void;
  onMatchResult?: (won: boolean) => void;
};
