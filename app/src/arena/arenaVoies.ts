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
    "anchor", "barricade", "jet-caillou", "eboulement", // défense + anti-aggro + removal / AOE
    "rempart", "contrefort", "strate-vive",  // mur + bouclier + escalade ATK
    "veine-minerale", "grondement",          // pioche + aura chip récurrent (Alex 2026-06-30)
    "veine-gaia", "gardien-pierre",          // sustain + verrou tardif (riposte/ancre)
    "ecrasement", "eboulis-final",           // perce-mur anti-heal + DÉGÂTS signature
  ],
  lizard: [
    // DECK RESSERRÉ 15→12 (Alex 2026-06-29, confort-fusion) : retiré echappee +
    // tide (tempo neutres) + fuite-masquee (doublon d'Esquive le + faible, −1 ATK)
    // → moins de dilution, les MOITIÉS de fusion + le closer remontent plus souvent
    // (deck ~28→~22 cartes). Les retirées restent dispo au DeckManager. Réversible.
    "mascarade", "reflet-echo",                      // illusion / cycle (ingrédients fusion)
    "mirror", "mascarade-enchainee",                 // copie (ingrédient fusion) + montée d'Esquive
    "prescience",                                    // pioche signature
    "coup-dans-lombre",                              // DÉGÂTS signature (= Esquive, imblocable ; ingrédient fusion)
    "derobade", "frappe-spectrale", "eclipse",       // repositionnement / dépense d'esquive / sauvetage
    "sillage-spectral", "faux-semblant",             // aura tempo (esquive→pioche) / illusion offensive (ingrédient fusion)
    "nuee-spectrale",                                // closer légendaire (ingrédient fusion)
  ],
  scissors: [
    // (Alex 2026-06-30) double-mot GARDÉ : c'est la puissance brute qui gagne la
    // course d'usure vs Forêt (le trim coûtait le matchup 54→46 au sim). Les 3
    // nouvelles cartes ajoutent des RÔLES (reach/pioche/anti-fade), pas du buff.
    "precision", "surge", "surcharge",          // burst ATK précoce
    "coup-de-taille", "acuite", "frenesie",     // perforation + re-affûtage + frénésie
    "riposte", "double-mot",                    // punition + doublement d'ATK
    "estafilade", "saignee", "fureur-emoussee", // reach + pioche aggro + payoff Émoussé (anti-fade)
    "taillade-mortelle",                        // DÉGÂTS signature (Lame injecté à 3⭐, PAS deckable)
  ],
  paper: [
    "seve", "second-wind", "sangsue",            // soin créature + sustain héros + vol de vie (capé)
    "rempart", "ramure", "phenix",               // mur PV + bouclier vivant + renaissance
    "photosynthese", "ronces",                   // régen+ATK perm + représailles épineuses (riposte)
    "greffe",                                    // pioche flavor (texture non-soin, profondeur deck — Alex 2026-06-30)
    "drain-vital",                               // DÉGÂTS signature (drain : 2 dmg + 2 PV à toi, nerf)
  ],                                             // (Verger éternel injecté à 3⭐, PAS deckable)
  spock: [
    "dilatation-temporelle", "sablier", "offre",  // ramp bas → ce-tour → permanent
    "chronomancien", "loi-de-causalite",          // burst tempo + stase (Augure RETIRÉ du Pro : révéler la main ne prédit pas les invocations — cf. ARENA_EXCLUDED)
    "trou-noir", "convergence-cosmique",          // removal froid + inévitabilité-éco
    "intrication-quantique",                      // DÉGÂTS signature (= mes Spock, +1 si ≥2)
  ],                                              // (Grand Calcul injecté à 3⭐, PAS deckable)
};
