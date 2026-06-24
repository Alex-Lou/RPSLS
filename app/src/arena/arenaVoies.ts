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

/** DECK SIGNATURE par Voie (Constellation Pro, Alex 2026-06-22 « decks spéciaux »).
 *  Si une Voie a une entrée ici, CHOISIR cette Voie DÉTERMINE le deck du joueur :
 *  buildPlayerDeck remplace le deck sauvegardé par cette liste → fini « n'importe
 *  quelle carte ». Chaque carte est ensuite étendue en copies-par-rareté au build.
 *  Pilote = MONTAGNE ; les autres Voies (absentes) gardent le deck-building libre
 *  actuel. Réversible : retirer l'entrée = retour au libre. Cf. VOIE-ARCHETYPES.md. */
export const SIGNATURE_DECK: Partial<Record<Move, CardId[]>> = {
  rock: [
    "anchor", "jet-caillou", "eboulement",   // défense + removal précoce / AOE
    "rempart", "contrefort", "strate-vive",  // mur + bouclier + escalade ATK
    "veine-gaia", "gardien-pierre",          // sustain + verrou tardif (riposte/ancre)
    "eboulis-final",                         // DÉGÂTS signature (= Pierres × 2 + Strates)
  ],
  lizard: [
    "mascarade", "reflet-echo", "echappee",          // tempo / cycle / fuite
    "mirror", "mascarade-enchainee", "fuite-masquee", // copie + montée d'Esquive
    "prescience", "tide",                            // pioche + poussée tempo (neutres)
    "coup-dans-lombre",                              // DÉGÂTS signature (= charges d'Esquive, imblocable)
  ],
  scissors: [
    "precision", "surge", "surcharge",          // burst ATK précoce
    "coup-de-taille", "acuite", "frenesie",     // perforation + re-affûtage + frénésie
    "riposte", "double-mot",                    // punition + doublement d'ATK (le finisher
    "taillade-mortelle",                        // DÉGÂTS signature (burst brut, légendaire auto-exilée)
  ],                                            // Lame est injecté en main à 3⭐, PAS deckable)
  paper: [
    "seve", "second-wind", "sangsue",            // soin créature + sustain héros + vol de vie
    "rempart", "ramure", "phenix",               // mur PV + bouclier vivant + renaissance
    "photosynthese", "ronces",                   // régen+ATK perm + représailles épineuses
    "drain-vital",                               // DÉGÂTS signature (drain : 4 dmg + 4 PV à toi)
  ],                                             // (Verger éternel injecté à 3⭐, PAS deckable)
  spock: [
    "dilatation-temporelle", "sablier", "offre",  // ramp bas → ce-tour → permanent
    "chronomancien", "augur", "loi-de-causalite", // burst tempo + lecture de main + stase
    "trou-noir", "convergence-cosmique",          // removal froid + inévitabilité-éco
    "intrication-quantique",                      // DÉGÂTS signature (= mes Spock, +1 si ≥2)
  ],                                              // (Grand Calcul injecté à 3⭐, PAS deckable)
};
