import type { Move } from "../../engine/game";
import type { CardId } from "../../ranked/rankedTypes";
import type { Side } from "./hero";
import type { LaneIndex } from "./creatures";
import type { TurnIntent } from "./board";
import { tNow } from "../../i18n/core";

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
  barricade:        "self",
  "veine-minerale": "self",
  grondement:       "self",
  ecrasement:       "hero",
  "veine-gaia":     "self",
  // ── Voie Mirage (2026-06-22) ──
  "mascarade-enchainee": "lane",
  "fuite-masquee":       "lane",
  "reflet-echo":         "self",
  // ── Voie Mirage — nouvelles cartes (2026-06-28) ──
  derobade:           "lane",
  "frappe-spectrale": "lane",
  "faux-semblant":    "lane",
  "sillage-spectral": "self",
  "nuee-spectrale":   "self",
  eclipse:            "lane",
  // ── Voie Tranchant (2026-06-22) ──
  "coup-de-taille": "lane",
  acuite:           "lane",
  frenesie:         "self",
  estafilade:       "lane",
  saignee:          "self",
  "fureur-emoussee": "self",
  estocade:         "self",
  // ── Voie Forêt (2026-06-23) ──
  ramure:            "self",
  photosynthese:     "lane",
  ronces:            "lane",
  greffe:            "self",
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
  citadelle:         "self",
  cataclysme:        "hero",
  "source-vitale":   "lane",
  "bosquet-epineux": "lane",
  effacement:        "lane",
  omniscience:       "global",
  cocon:             "lane",
  apocalypse:        "global",
  imposteur:         "global",
  // ── Fusions Mirage (2026-06-28) ──
  "galerie-des-glaces":   "global",
  "mascarade-souveraine": "lane",
  "apotheose-spectrale":  "global",
  // ── Finishers (Lot D) — explicites (avant : absents → repli "global" au lookup ;
  //    même valeur → comportement de jeu inchangé, auto-cast sans cible) ──
  "finisher-forteresse":   "global",
  "finisher-verger":       "global",
  "finisher-lame":         "global",
  "finisher-metamorphose": "global",
  "finisher-calcul":       "global",
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
  sangsue:    "my-creature", // lit l'ATK de TA créature (applySangsue)
  "trou-noir": "opp-creature",
  mirror:     "my-empty-opp-occupied",
  // ── Voie Montagne (2026-06-22) ──
  eboulement:       "opp-creature",
  "strate-vive":    "my-creature",
  "gardien-pierre": "my-creature",
  // ── Voie Mirage (2026-06-22) ──
  "mascarade-enchainee": "my-creature",
  "fuite-masquee":       "my-creature",
  // ── Voie Mirage — nouvelles cartes (2026-06-28) ──
  derobade:           "my-creature", // cible TON Lézard à déplacer
  "frappe-spectrale": "my-creature", // cible TON Lézard qui dépense l'esquive
  eclipse:            "my-creature", // cible TON Lézard à faire disparaître
  "faux-semblant":    "opp-creature", // cible la créature adverse à déguiser
  // ── Voie Tranchant (2026-06-22) ──
  "coup-de-taille": "my-creature",
  acuite:           "my-creature",
  estafilade:       "my-creature", // cible TON Ciseau qui fend vers le héros
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
  "bosquet-epineux": "my-creature",
  effacement:        "opp-creature",
  cocon:             "opp-creature",
  // ── Fusions Mirage (2026-06-28) ──
  "mascarade-souveraine": "both-occupied",
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
  // ── Voie Mirage — Lézard-only (Alex 2026-06-28 : ne plus gâcher la carte sur
  //    un autre symbole ; l'effet fizzlait déjà, l'indicateur s'aligne enfin) ──
  "mascarade-enchainee": "lizard",
  "fuite-masquee":       "lizard",
  // ── nouvelles cartes (2026-06-28) — ciblent TON Lézard (Faux-Semblant cible
  //    l'adverse, donc PAS ici) ──
  derobade:           "lizard",
  "frappe-spectrale": "lizard",
  eclipse:            "lizard",
  // ── Voie Tranchant — Ciseau-only (l'effet fizzle sur un autre symbole) ──
  estafilade:       "scissors",
  "coup-de-taille": "scissors",
  acuite:           "scissors",
  // ── Voie Forêt — Bosquet Épineux cible « ta Feuille » (texte de carte) ──
  "bosquet-epineux": "paper",
};

/** Clé i18n du libellé court d'un symbole, pour les labels de ciblage (« Cible ta Pierre »). */
const MOVE_LABEL_KEY: Record<Move, string> = {
  rock: "arena.target.move.rock", paper: "arena.target.move.paper", scissors: "arena.target.move.scissors",
  lizard: "arena.target.move.lizard", spock: "arena.target.move.spock",
};

/** Mana GAGNÉ IMMÉDIATEMENT ce tour par une carte « tempo » (façon Pièce de
 *  Hearthstone) — Alex 2026-06-13. Disponible pour la PLANIFICATION du même
 *  tour (sinon Sablier ne servait à rien : son +2 atterrissait à la résolution
 *  PUIS était écrasé par le refill du tour suivant). */
// Crédité D'AVANCE par le moteur (creditManaGrants, AVANT invocations et sorts)
// → budget UI = réalité moteur ; les handlers ne re-donnent plus ce mana.
export const MANA_GRANTS: Partial<Record<CardId, number>> = {
  sablier: 2,
  chronomancien: 3,
  offre: 2, // (+ monte aussi maxMana de façon permanente, géré à la résolution)
  "dilatation-temporelle": 1, // (+ monte maxMana de +1, permanent, géré à la résolution)
};

/** Total de mana « tempo » offert par les cartes déjà planifiées dans l'intent
 *  → s'ajoute au budget de mana du tour. */
export function intentManaGrant(intent: TurnIntent): number {
  return intent.spells.reduce((sum, s) => sum + (MANA_GRANTS[s.id] ?? 0), 0);
}

/** Buffs alliés IGNORÉS par Spock (Détaché) — miroir EXACT des handlers qui
 *  testent `move === "spock"` (applyAegis/Anchor/Riposte/Precision/Surge/
 *  Surcharge/DoubleMot, applyFrappeParfaite/Bastion). Ciblage : pas d'indicateur
 *  sur un Spock allié pour ces cartes (l'effet y fizzlerait). */
const SPOCK_DETACHED_BUFFS: ReadonlySet<CardId> = new Set<CardId>([
  "aegis", "anchor", "riposte", "precision", "surge", "surcharge", "double-mot",
  "frappe-parfaite", "bastion",
]);

/** Sorts ennemis ciblés qui FIZZLENT TOTALEMENT sur une cible à Logique
 *  (spellImmune, Spock) — miroir des handlers. PAS Éboulement (la cible immunisée
 *  est sautée mais les voisines prennent 1) ni Effacement (le reste du board est
 *  figé quand même) ni Miroir (copie, n'affecte pas la cible). */
const LOGIQUE_BLOCKED_SPELLS: ReadonlySet<CardId> = new Set<CardId>([
  "curse", "jet-caillou", "toile-gluante", "loi-de-causalite", "cocon",
  "faux-semblant", "trou-noir", "toxine", "rappel", "permutation",
  "mascarade-souveraine",
]);

/** Logique (immunité aux sorts) d'une créature telle que vue par le ciblage.
 *  `spellImmune` si fourni, sinon dérivé du symbole (Logique = inné à Spock). */
function hasLogique(c: { move: Move; spellImmune?: boolean }): boolean {
  return c.spellImmune ?? c.move === "spock";
}

/** Returns whether `lane` on `side` is a valid drop target for the active
 *  ArenaTargeting. Used by ArenaLaneSlot's clickable + label so each card
 *  highlights ONLY the slots it can actually target. */
export function isValidLaneTarget(
  targeting: ArenaTargeting,
  side: Side,
  lane: LaneIndex,
  lanes: { a: { move: Move; spellImmune?: boolean } | null; b: { move: Move; spellImmune?: boolean } | null }[],
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
    // Cibles où l'effet fizzlerait (règle moteur) : buff allié sur un Spock
    // Détaché, sort ennemi sur une créature à Logique → pas d'indicateur.
    const mineOk = !!mine && !(SPOCK_DETACHED_BUFFS.has(targeting.id) && mine.move === "spock");
    const oppOk = !!opp && !(LOGIQUE_BLOCKED_SPELLS.has(targeting.id) && hasLogique(opp));
    if (tgtSide === "my-creature") return isPlayerRow && mineOk && moveOk(mine);
    if (tgtSide === "opp-creature") return !isPlayerRow && oppOk && moveOk(opp);
    if (tgtSide === "my-empty-opp-occupied") return isPlayerRow && !mine && !!opp;
    if (tgtSide === "my-empty") return isPlayerRow && !mine;
    if (tgtSide === "both-occupied") return isPlayerRow && mineOk && oppOk;
  }
  return false;
}

/** Human-readable label shown ON the valid slot (instead of generic "play here"). */
export function targetLabelFor(targeting: ArenaTargeting, slotHasCreature = false): string {
  if (!targeting) return "";
  if (targeting.kind === "summon") {
    return slotHasCreature ? tNow("arena.target.replace") : tNow("arena.target.summonHere");
  }
  if (targeting.kind === "spell" && targeting.targetKind === "lane") {
    const tgtSide = LANE_SPELL_TARGET_SIDE[targeting.id] ?? "my-creature";
    const reqMove = LANE_TARGET_MOVE[targeting.id];
    if (tgtSide === "my-creature") return reqMove ? tNow("arena.target.myMove", { move: tNow(MOVE_LABEL_KEY[reqMove]) }) : tNow("arena.target.myCreature");
    if (tgtSide === "opp-creature") return reqMove ? tNow("arena.target.oppMove", { move: tNow(MOVE_LABEL_KEY[reqMove]) }) : tNow("arena.target.oppCreature");
    if (tgtSide === "my-empty-opp-occupied") return tNow("arena.target.mirrorHere");
    if (tgtSide === "my-empty") return tNow("arena.target.here");
    if (tgtSide === "both-occupied") return tNow("arena.target.swap");
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
