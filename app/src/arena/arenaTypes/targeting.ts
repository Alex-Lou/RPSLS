import type { Move } from "../../engine/game";
import type { CardId } from "../../ranked/rankedTypes";
import type { Side } from "./hero";
import type { LaneIndex } from "./creatures";
import type { TurnIntent } from "./board";

/* ───────────────────────── Targeting (UI-level) ───────────────────────── */

/** Spell target shape needed by a given card — drives the targeting UI.
 *  `lane`     = need a board lane (the next lane tap commits)
 *  `self`     = the spell hits my hero (auto-target, no further input)
 *  `hero`     = the spell hits the opp hero (auto-target)
 *  `global`   = board-wide / no target */
export type SpellTargetKind = "lane" | "self" | "hero" | "global";

/** Per-card target metadata. Used by the targeting machinery to decide
 *  whether tapping a card opens a lane picker or commits immediately.
 *  Typed as `Partial<Record<CardId, …>>` — cards without an entry default
 *  to "global" on lookup (see ArenaPlanPhase.CARD_TARGET_KIND fallback). */
export const CARD_TARGET_KIND: Partial<Record<CardId, SpellTargetKind>> = {
  aegis:        "lane",
  precision:    "lane",
  anchor:       "lane",
  "second-wind": "self",
  prescience:   "self",
  surge:        "lane",
  curse:        "lane",
  mirror:       "lane",
  riposte:      "lane",
  augur:        "global",
  heist:        "self",
  razzia:       "global",
  surcharge:    "lane",
  toxine:       "lane",
  rappel:       "lane",
  "double-mot": "lane",
  echo:         "global",
  chronomancien: "self",
  tide:         "global",
  oracle:       "self",
  vortex:       "global",
  supernova:    "hero",
  // Phase 2 spells
  gaia:         "self",
  sablier:      "self",
  offre:        "self",
  rempart:      "self",
  benediction:  "self",
  "oracle-inverse": "global",
  cascade:      "self",
  echappee:     "lane",
  mascarade:    "lane",
  sangsue:      "lane",
  "trou-noir":  "lane",
  "marchand-ames": "self",
  paradoxe:     "global",
  juge:         "global",
  genese:       "global",
  // ── Voie Montagne (2026-06-22) ──
  eboulement:       "lane",
  "strate-vive":    "lane",
  "gardien-pierre": "lane",
  contrefort:       "self",
  "veine-gaia":     "self",
  // ── Voie Mirage (2026-06-22) ──
  "mascarade-enchainee": "lane",
  "fuite-masquee":       "lane",
  "reflet-echo":         "self",
  // ── Voie Tranchant (2026-06-22) ──
  "coup-de-taille": "lane",
  acuite:           "lane",
  frenesie:         "self",
  // ── Voie Forêt (2026-06-23) ──
  ramure:            "self",
  photosynthese:     "lane",
  ronces:            "lane",
  // ── Voie Cosmos (2026-06-23) ──
  "dilatation-temporelle": "self",
  "loi-de-causalite":      "lane",
  "convergence-cosmique":  "hero",
  // ── Dégâts signature par Voie (2026-06-23) — toutes ciblent le héros adverse ──
  "eboulis-final":         "hero",
  "drain-vital":           "hero",
  "coup-dans-lombre":      "hero",
  "intrication-quantique": "hero",
  "taillade-mortelle":     "hero",
  // ── Nouvelles cartes Pro (2026-06-12) ──
  "jet-caillou":   "lane",
  seve:            "lane",
  "coup-oeil":     "self",
  permutation:     "lane",
  "toile-gluante": "lane",
  reverberation:   "self",
  gravite:         "global",
  doppelganger:    "self",
  purge:           "global",
  "roue-destin":   "self",
  phenix:          "self",
  singularite:     "hero",
  // ── ⚗️ Cartes de fusion (Forge 2026-06-13) ──
  "frappe-parfaite": "lane",
  bastion:           "lane",
  avalanche:         "global",
  "source-vitale":   "lane",
  omniscience:       "global",
  cocon:             "lane",
  apocalypse:        "global",
  imposteur:         "global",
};

/** Active targeting state shared across the board + plan phase so that
 *  tapping a lane on the board can commit the same spell/summon the
 *  player started picking in the hand. Held in ArenaGame, passed down. */
export type ArenaTargeting =
  | { kind: "summon"; move: Move }
  | { kind: "spell"; id: CardId; targetKind: SpellTargetKind }
  | null;

/** For lane-targeted spells, WHICH side + WHICH slot kind they need so the
 *  board can highlight ONLY the valid slots (instead of "all empty mine"
 *  for everything). Drives the per-lane "✦ Cible ta créature" / "✦ Cible
 *  cette créature" / "✦ Invoquer ici" labels.
 *
 *  - "my-creature"             → highlight MY lanes that have a creature
 *  - "opp-creature"            → highlight OPP lanes that have a creature
 *  - "my-empty-opp-occupied"   → highlight MY lanes that are empty AND opp has a creature
 *  - "my-empty"                → highlight MY empty lanes (used by summons) */
export type LaneTargetSide = "my-creature" | "opp-creature" | "my-empty-opp-occupied" | "my-empty" | "both-occupied";

export const LANE_SPELL_TARGET_SIDE: Partial<Record<CardId, LaneTargetSide>> = {
  aegis:      "my-creature",
  precision:  "my-creature",
  anchor:     "my-creature",
  surge:      "my-creature",
  riposte:    "my-creature",
  echappee:   "my-creature",
  mascarade:  "my-creature",
  curse:      "opp-creature",
  sangsue:    "opp-creature",
  "trou-noir": "opp-creature",
  mirror:     "my-empty-opp-occupied",
  // ── Voie Montagne (2026-06-22) ──
  eboulement:       "opp-creature",
  "strate-vive":    "my-creature",
  "gardien-pierre": "my-creature",
  // ── Voie Mirage (2026-06-22) ──
  "mascarade-enchainee": "my-creature",
  "fuite-masquee":       "my-creature",
  // ── Voie Tranchant (2026-06-22) ──
  "coup-de-taille": "my-creature",
  acuite:           "my-creature",
  // ── Voie Forêt (2026-06-23) ──
  photosynthese:    "my-creature",
  ronces:           "my-creature",
  // ── Voie Cosmos (2026-06-23) ──
  "loi-de-causalite": "opp-creature",
  // ── Nouvelles cartes Pro (2026-06-12) ──
  "jet-caillou":   "opp-creature",
  seve:            "my-creature",
  "toile-gluante": "opp-creature",
  // ── 6 arts orphelins (2026-06-13) ──
  surcharge:       "my-creature",
  "double-mot":    "my-creature",
  rappel:          "opp-creature",
  toxine:          "opp-creature",
  permutation:     "both-occupied", // lane où MOI ET l'adversaire avons une créature
  // ── ⚗️ Cartes de fusion ──
  "frappe-parfaite": "my-creature",
  bastion:           "my-creature",
  "source-vitale":   "my-creature",
  cocon:             "opp-creature",
};

/** Restriction de MOVE pour les cartes lane-target « mono-symbole » (ex. Strate
 *  Vive ne cible QUE les Pierres). L'EFFET fizzle déjà si le move ne correspond pas
 *  (applyStrateVive / applyGardienPierre / … font `if (me.move !== "rock") return`) ;
 *  cette table aligne l'INDICATEUR de ciblage dessus → il n'allume QUE les cases du
 *  bon symbole, jamais les autres créatures (Alex 2026-06-25 « indicateurs justes »).
 *  Rempli par VOIE au fil des passes — MONTAGNE d'abord, les autres ensuite une par une. */
export const LANE_TARGET_MOVE: Partial<Record<CardId, Move>> = {
  // ── Voie Montagne — Pierre-only ──
  "strate-vive":    "rock",
  "gardien-pierre": "rock",
};

/** Libellé court FR d'un symbole, pour les labels de ciblage (« Cible ta Pierre »). */
const MOVE_LABEL_FR: Record<Move, string> = {
  rock: "Pierre", paper: "Feuille", scissors: "Ciseau", lizard: "Lézard", spock: "Spock",
};

/** Mana GAGNÉ IMMÉDIATEMENT ce tour par une carte « tempo » (façon Pièce de
 *  Hearthstone) — Alex 2026-06-13. Disponible pour la PLANIFICATION du même
 *  tour (sinon Sablier ne servait à rien : son +2 atterrissait à la résolution
 *  PUIS était écrasé par le refill du tour suivant). */
export const MANA_GRANTS: Partial<Record<CardId, number>> = {
  sablier: 2,
  offre: 2, // (+ monte aussi maxMana de façon permanente, géré à la résolution)
  "dilatation-temporelle": 1, // (+ monte maxMana de +1, permanent, géré à la résolution)
};

/** Total de mana « tempo » offert par les cartes déjà planifiées dans l'intent
 *  → s'ajoute au budget de mana du tour. */
export function intentManaGrant(intent: TurnIntent): number {
  return intent.spells.reduce((sum, s) => sum + (MANA_GRANTS[s.id] ?? 0), 0);
}

/** Returns whether `lane` on `side` is a valid drop target for the active
 *  ArenaTargeting. Used by ArenaLaneSlot's clickable + label so each card
 *  highlights ONLY the slots it can actually target. */
export function isValidLaneTarget(
  targeting: ArenaTargeting,
  side: Side,
  lane: LaneIndex,
  lanes: { a: { move: Move } | null; b: { move: Move } | null }[],
  playerSide: Side,
): boolean {
  if (!targeting) return false;
  const isPlayerRow = side === playerSide;
  // For SUMMONS: any of my lanes is a valid target. If the lane is already
  // occupied by one of my creatures, the summon REPLACES it (applySummons
  // engine does the replace by design — old creature dies silently). Alex
  // flag #4 : si toutes mes lanes sont pleines et plus de cartes, sans
  // replace c'est le stalemate. Replace débloque toujours.
  if (targeting.kind === "summon") {
    return isPlayerRow;
  }
  const mine = lanes[lane][playerSide];
  const opp  = lanes[lane][playerSide === "a" ? "b" : "a"];
  if (targeting.kind === "spell" && targeting.targetKind === "lane") {
    const tgtSide = LANE_SPELL_TARGET_SIDE[targeting.id] ?? "my-creature";
    // Restriction de MOVE (ex. Strate Vive = Pierre-only) : l'indicateur n'allume
    // que la créature du bon symbole, pour COLLER à l'effet (qui fizzle sinon).
    const reqMove = LANE_TARGET_MOVE[targeting.id];
    const moveOk = (c: { move: Move } | null): boolean => !reqMove || (!!c && c.move === reqMove);
    if (tgtSide === "my-creature") return isPlayerRow && !!mine && moveOk(mine);
    if (tgtSide === "opp-creature") return !isPlayerRow && !!opp && moveOk(opp);
    if (tgtSide === "my-empty-opp-occupied") return isPlayerRow && !mine && !!opp;
    if (tgtSide === "my-empty") return isPlayerRow && !mine;
    if (tgtSide === "both-occupied") return isPlayerRow && !!mine && !!opp;
  }
  return false;
}

/** Human-readable label shown ON the valid slot (instead of generic "play here"). */
export function targetLabelFor(targeting: ArenaTargeting, slotHasCreature = false): string {
  if (!targeting) return "";
  if (targeting.kind === "summon") {
    return slotHasCreature ? "↻ Remplacer" : "✦ Invoquer ici";
  }
  if (targeting.kind === "spell" && targeting.targetKind === "lane") {
    const tgtSide = LANE_SPELL_TARGET_SIDE[targeting.id] ?? "my-creature";
    const reqMove = LANE_TARGET_MOVE[targeting.id];
    if (tgtSide === "my-creature") return reqMove ? `✦ Cible ta ${MOVE_LABEL_FR[reqMove]}` : "✦ Cible ta créature";
    if (tgtSide === "opp-creature") return reqMove ? `✦ Cible cette ${MOVE_LABEL_FR[reqMove]}` : "✦ Cible cette créature";
    if (tgtSide === "my-empty-opp-occupied") return "✦ Mirror ici";
    if (tgtSide === "my-empty") return "✦ Ici";
    if (tgtSide === "both-occupied") return "✦ Échanger";
  }
  return "✦";
}

/** Clé i18n de la description ARENA d'une carte. Les textes `ranked.cards.
 *  <id>.desc` décrivent les effets du mode CLASSÉ ; en Arena les mêmes cartes
 *  ont des effets DIFFÉRENTS (arenaCardEffects) — afficher le texte Classé
 *  induisait le joueur en erreur (ex. Trou Noir : "annule la carte adverse"
 *  vs effet Arena réel "détruit une créature"). FR+EN fournis dans les
 *  locales ; les autres langues retombent sur EN (fallback i18n standard). */
export function arenaCardDescKey(id: CardId): string {
  return `arena.cards.${id}.desc`;
}

/* ───────────────────────── RPSLS counter table ───────────────────────── */

/** Returns true when `attacker` "counters" `defender" per RPSLS rules
 *  (deal +1 ATK bonus this exchange). Bidirectional table for clarity. */
export function moveCountersMove(attacker: Move, defender: Move): boolean {
  switch (attacker) {
    case "rock":     return defender === "scissors" || defender === "lizard";
    case "paper":    return defender === "rock"     || defender === "spock";
    case "scissors": return defender === "paper"    || defender === "lizard";
    case "lizard":   return defender === "paper"    || defender === "spock";
    case "spock":    return defender === "scissors" || defender === "rock";
  }
}
