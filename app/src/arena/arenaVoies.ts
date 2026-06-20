/**
 * arenaVoies — SOURCE DE VÉRITÉ UNIQUE des 5 Voies de Constellation Pro
 * (Phase A du chantier « Voies = archétypes », Alex 2026-06-17 ; cf.
 * VOIE-ARCHETYPES.md). Avant, la définition d'une Voie était éclatée :
 * AFFINITY_TO_FINISHER (arenaFinishers), VOIE_LABEL/VOIE_ICON (ArenaLobby),
 * le label court (ArenaConstellationBar). On centralise — 1 Voie = 1 entrée.
 *
 * Phase A = data inerte/iso-comportement : ce fichier ne fait QUE rassembler
 * l'existant (mêmes valeurs). Le tag `voie?` sur les cartes (rankedTypes) et le
 * deck orienté Voie (buildPlayerDeck) sont câblés en Phase B (pilote Montagne).
 *
 * Noms THÉMATIQUES (choix Alex) : Montagne / Forêt / Tranchant / Mirage / Cosmos.
 */

import type { Move } from "../engine/game";
import type { CardId } from "../ranked/rankedTypes";

export interface VoieDef {
  move: Move;
  /** Nom complet affiché (lobby, fiche). */
  label: string;
  /** Label COURT (badge Constellation in-match). */
  shortLabel: string;
  /** Icône custom de la Voie (lobby ; en match les MoveGlyph restent). */
  icon: string;
  /** CardId du Finisher injecté en main à 3⭐ (1× par match). */
  finisher: CardId;
}

const ICON_DIR = "/MenuIcons/IconConstellationPro";

/** Le registre. Une seule entrée par Voie — toute la def vit ici. */
export const VOIE_DEF: Record<Move, VoieDef> = {
  rock: {
    move: "rock", label: "Voie de la Montagne", shortLabel: "Montagne",
    icon: `${ICON_DIR}/voie-montagne.png`, finisher: "finisher-forteresse",
  },
  paper: {
    move: "paper", label: "Voie de la Forêt", shortLabel: "Forêt",
    icon: `${ICON_DIR}/voie-foret.png`, finisher: "finisher-verger",
  },
  scissors: {
    move: "scissors", label: "Voie du Tranchant", shortLabel: "Tranchant",
    icon: `${ICON_DIR}/voie-tranchant.png`, finisher: "finisher-lame",
  },
  lizard: {
    move: "lizard", label: "Voie du Mirage", shortLabel: "Mirage",
    icon: `${ICON_DIR}/voie-mirage.png`, finisher: "finisher-metamorphose",
  },
  spock: {
    move: "spock", label: "Voie du Cosmos", shortLabel: "Cosmos",
    icon: `${ICON_DIR}/voie-cosmos.png`, finisher: "finisher-calcul",
  },
};
