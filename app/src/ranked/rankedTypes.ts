/**
 * Constellation Ranked — pure types.
 * 46 cards across 4 rarities (15 base + 11 bonus Lot 1 + 20 bonus V3).
 * Deck of 8, hand of 3.
 */

import type { Move } from "../engine/game";
import type { LanePlay } from "../online/online";

/* ──────────── Cards ──────────── */

export type CardId =
  | "aegis" | "precision" | "anchor" | "second-wind"   // commons (1 mana)
  | "surge" | "augur" | "riposte" | "curse" | "mirror" // rares (2 mana)
  | "heist" | "tide" | "oracle" | "vortex" | "gambit"  // epics (3 mana / gambit 2)
  | "supernova"                                         // legendary (4 mana)
  // ── Bonus cards (Lot 1) ──
  | "prescience" | "cadence" | "mascarade" | "boussole" // commons (1 mana)
  | "sangsue" | "rempart" | "pillage"                   // rares (2 mana)
  | "trou-noir" | "prophetie" | "conduit"               // epics (3 mana)
  | "trinite"                                           // legendary (4 mana)
  // ── Bonus cards (V3 — 20 new mechanics) ──
  | "sablier" | "remanence" | "offre" | "braise" | "echappee"             // commons (1 mana)
  | "oracle-inverse" | "fardeau" | "crepuscule" | "cascade"               // rares (2 mana)
  | "echo-temporel" | "ancre-temporelle"                                  //   ↑
  | "metamorphose" | "gaia" | "marchand-ames" | "telepathie"              // epics (3 mana)
  | "paradoxe" | "benediction"                                            //   ↑
  | "schrodinger" | "juge" | "genese"                                     // legendary (4 mana)
  // ── Constellation Pro Finishers (Lot D) — Pro-only, 1× par match, unlocked à 3⭐ ──
  | "finisher-forteresse" | "finisher-verger" | "finisher-lame"
  | "finisher-metamorphose" | "finisher-calcul"                           // legendary (4 mana)
  // ── Nouvelles cartes Constellation Pro (Lot 2026-06-12) ──
  | "jet-caillou" | "seve" | "coup-oeil"                                  // commons (1)
  | "permutation" | "toile-gluante" | "reverberation"                    // rares (2)
  | "gravite" | "doppelganger" | "purge"                                 // epics (3)
  | "roue-destin" | "phenix" | "singularite"                            // legendaries (4-5)
  // ── Voie MONTAGNE — cartes signature (Arena 2026-06-22) ──
  | "eboulement" | "contrefort" | "strate-vive"                         // common / rare / rare
  | "gardien-pierre" | "veine-gaia" | "barricade"                       // rare / epic / common (anti-aggro)
  | "ecrasement" | "veine-minerale" | "grondement"                      // epic anti-heal / common pioche / rare chip récurrent
  // ── Voie MIRAGE — cartes signature (Arena 2026-06-22) ──
  | "reflet-echo" | "mascarade-enchainee" | "fuite-masquee"             // common / rare / rare
  // ── Voie MIRAGE — nouvelles cartes (Arena 2026-06-28) ──
  | "derobade" | "frappe-spectrale" | "sillage-spectral"                // common / rare / rare
  | "faux-semblant" | "nuee-spectrale" | "eclipse"                      // epic / legendary / rare
  // ── Voie TRANCHANT — cartes signature (Arena 2026-06-22) ──
  | "coup-de-taille" | "acuite" | "frenesie"                            // rare / rare / rare
  | "estafilade" | "saignee" | "fureur-emoussee"                        // common reach / rare draw / common payoff Émoussé (2026-06-30)
  // ── Voie FORÊT — cartes signature (Arena 2026-06-23) ──
  | "ramure" | "photosynthese" | "ronces"                               // rare / rare / common
  | "greffe"                                                            // common pioche flavor Forêt (2026-06-30)
  // ── Voie COSMOS — cartes signature (Arena 2026-06-23) ──
  | "dilatation-temporelle" | "loi-de-causalite" | "convergence-cosmique" // common / rare / epic
  // ── Cartes de DÉGÂTS signature par Voie (Arena 2026-06-23) ──
  | "eboulis-final" | "drain-vital" | "coup-dans-lombre"                 // rock epic / paper rare / lizard epic
  | "intrication-quantique" | "taillade-mortelle"                        // spock rare / scissors legendary
  // ── Outils de Forge (Arena 2026-06-13) ──
  | "razzia"                                                             // legendary (2) — vol de la forge adverse
  // ── Arts orphelins câblés (Arena 2026-06-13) — 6 cartes ──
  | "surcharge" | "toxine" | "echo"                                      // rares (2)
  | "rappel" | "double-mot" | "chronomancien"                            // epics (3 / chrono 2)
  // ── Cartes « À LA PIOCHE » (Cast When Drawn, Arena 2026-06-13) — résolvent
  //    leur effet AU TIRAGE, jamais jouées comme sorts (cf. arenaCastOnDraw) ──
  | "coup-de-bol" | "bouffee-air" | "cafeine" | "tuile"                  // commons (à la pioche)
  | "eclair-genie" | "patate-chaude" | "pile-ou-face"                    // rares (à la pioche)
  | "trefle-chance" | "sursaut"                                          // epics (à la pioche)
  // ── Cartes de FUSION (Forge Arena 2026-06-13) — créées par la Forge
  //    uniquement, jamais dans collection/decks/packs/pioche ──
  | "frappe-parfaite" | "bastion" | "avalanche" | "source-vitale"
  | "omniscience" | "cocon" | "apocalypse" | "imposteur"
  | "citadelle" | "cataclysme"                                          // fusions Voie MONTAGNE (2026-06-30)
  | "estocade"                                                          // fusion Voie TRANCHANT (2026-06-30)
  | "bosquet-epineux"                                                   // fusion Voie FORÊT (2026-06-30)
  | "effacement"                                                        // fusion Voie COSMOS (2026-06-30)
  // ── Fusions Voie MIRAGE (Arena 2026-06-28) ──
  | "galerie-des-glaces" | "mascarade-souveraine" | "apotheose-spectrale";

export type CardRarity = "common" | "rare" | "epic" | "legendary";

/** "active" cards are drawn into the hand and played from it (the default).
 *  "passive" cards are never drawn: equipping one in the deck makes its effect
 *  permanently active for the whole match (see {@link RankedBattleState.passives}). */
/** "fusion" (2026-06-13) : cartes créées UNIQUEMENT par la Forge Arena —
 *  jamais dans la collection, les decks, les packs ni la pioche. */
export type CardKind = "active" | "passive" | "fusion";

export type LaneTarget = 0 | 1 | 2;

export interface RankedCard {
  id: CardId;
  cost: 1 | 2 | 3 | 4;
  rarity: CardRarity;
  /** "none" = immediate effect, no target tap. Passives use "none" too (never played). */
  target: "lane" | "lane-reveal" | "lane-reveal-all" | "lane-copy" | "lane-rotate" | "self" | "gamble" | "none";
  /** Defaults to "active" when omitted. */
  kind?: CardKind;
  /** VOIE SIGNATURE (Constellation Pro, Alex 2026-06-17 « Voies = archétypes »).
   *  Si présent, cette carte appartient THÉMATIQUEMENT à cette Voie : le deck
   *  Arena la PRIORISE quand c'est ta Voie et ne l'injecte JAMAIS pour une autre
   *  (cf. arenaDecks.buildPlayerDeck + arenaVoies/VOIE_DEF). Absent = NEUTRE
   *  (jouable par toutes les Voies). Inerte hors Arena. Cf. VOIE-ARCHETYPES.md. */
  voie?: Move;
  palette: string;
  glyph: string;
  nameKey: string;
  descKey: string;
  targetHintKey: string;
  /** Path to card art PNG if available, null = use glyph fallback. */
  art: string | null;
}

export type PlayedCard =
  | { id: "aegis" | "surge" | "precision" | "anchor" | "curse" | "tide" | "heist" | "riposte" | "mirror" | "sangsue"; lane: LaneTarget }
  | { id: "augur"; lane: LaneTarget; revealed: Move }
  | { id: "oracle"; revealed: [Move, Move, Move] }
  | { id: "vortex" }
  | { id: "supernova" }
  | { id: "gambit" }
  | { id: "second-wind" }
  // Bonus Lot 1 actives with no target — immediate, board-wide or self effects.
  | { id: "prescience" | "mascarade" | "boussole" | "rempart" | "trou-noir" | "trinite" }
  // ── V3: lane-targeted ──
  | { id: "remanence" | "echappee" | "crepuscule"; lane: LaneTarget }
  // ── V3: no-target / self / instant ──
  | { id: "sablier" | "offre" | "braise" | "cascade" | "echo-temporel"
        | "ancre-temporelle" | "metamorphose" | "marchand-ames"
        | "paradoxe" | "benediction" | "schrodinger" | "juge" | "genese"
        | "fardeau" | "oracle-inverse" | "telepathie" }
  // ── V3: telepathie reveals all 3 like oracle ──
  ;

/* ──────────── Round / battle state ──────────── */

export type RankedPhase =
  | "splash" | "drawing" | "picking" | "locking"
  | "reveal-intro" | "reveal" | "inter-round" | "match-end";

export interface RankedRoundState {
  no: number;
  mana: number;
  picks: [Move | null, Move | null, Move | null];
  cardPlayed: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  oracleRevealed: [Move, Move, Move] | null;
}

export interface RankedBattleState {
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
  usedOneShotCards: CardId[];
  /** Passive cards equipped in the deck — always active all match, never drawn
   *  or played from hand. Derived from the deck at {@link makeBattle}. */
  passives: CardId[];
  /** Notional opponent hand size shown to the player as 3 face-down minicards
   *  above the OpponentRow. The real CPU draws from BASE_CPU_HAND_POOL minus
   *  burned one-shots — this is purely a visual counter that decreases when
   *  player Heist lands and mirrors player draw rules per round outcome. */
  oppHandSize: number;
  roundWinsA: number;
  roundWinsB: number;
  roundsPlayed: number;
  bonusHistory: RoundBonusBreakdown[];
}

export interface RoundBonusBreakdown {
  comboBonusA: number;
  comboBonusB: number;
  favouredBonusA: number;
  favouredBonusB: number;
  surgeBonusA: number;
  surgeBonusB: number;
  surgePenaltyA: number;
  surgePenaltyB: number;
  aegisSavedA: boolean;
  aegisSavedB: boolean;
  tideBonusA: number;
  tideBonusB: number;
  cursePenaltyA: number;
  cursePenaltyB: number;
  /** Sangsue (Leech): points the side LOSES because the opponent won a leeched
   *  lane. leechPenaltyA = points A loses to B's leech, and vice-versa. */
  leechPenaltyA: number;
  leechPenaltyB: number;
  /** Bénédiction (Blessing): +1 per lane won by either side, applied to both
   *  sides when EITHER plays the card. */
  benedictionBonusA: number;
  benedictionBonusB: number;
  /** Bouclier de Gaïa: cosmetic flag — set when the passive triggered this round. */
  gaiaSavedA: boolean;
  gaiaSavedB: boolean;
}

export interface CpuRoundDecision {
  plays: LanePlay[];
  card: PlayedCard | null;
}
