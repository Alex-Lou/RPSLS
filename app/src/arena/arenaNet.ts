/**
 * arenaNet — contrat RÉSEAU du Constellation Pro online (Phase 1).
 *
 * Le relais serveur est AVEUGLE : il transporte du JSON opaque, aucune logique
 * de jeu. Toute la confiance vit donc côté clients → deux garde-fous ici.
 *
 *  1) parseTurnIntent — VALIDATION STRICTE d'un intent reçu du réseau. On ne
 *     fait JAMAIS confiance à l'adversaire (anti-triche / anti-malformé) : un
 *     intent invalide retourne null, que l'appelant traite comme « aucun coup »
 *     (pass) — jamais un crash ni un board pourri. Un client légitime (même
 *     ruleset) ne produit que des intents valides ; un null = tampering/corruption.
 *
 *  2) arenaRulesetHash — empreinte DÉTERMINISTE des règles (version moteur +
 *     BALANCE + cartes + stats de créatures). Échangée au handshake ; si les
 *     deux clients n'ont pas le même hash (APK de versions différentes), on
 *     REFUSE le match → pas de desync silencieux dû à un skew de version.
 *
 * TurnIntent est déjà une donnée pure JSON-sérialisable → serializeIntent est un
 * passe-plat explicite (contrat de fil net + strip des champs parasites) ; la
 * vraie valeur est dans la validation au retour.
 */
import type { Move } from "../engine/game";
import { MOVES } from "../engine/game";
import type { CardId } from "../ranked/rankedTypes";
import { CARDS } from "../ranked/cards";
import { BALANCE } from "./arenaBalance";
import { CREATURE_STATS, LANE_COUNT, type BoardState, type LaneIndex, type PlannedSummon, type PlayedSpell, type TurnIntent } from "./arenaTypes";

/** Version du MOTEUR de résolution Pro. À INCRÉMENTER à chaque changement de
 *  LOGIQUE de résolution non capté par la donnée hashée (BALANCE/cartes/stats) :
 *  nouvel effet de sort, changement d'ordre de résolution, fix de règle… Deux
 *  clients de versions différentes auront des hash différents → match refusé,
 *  plutôt qu'un desync silencieux. */
export const ARENA_ENGINE_VERSION = 1;

/** Bornes de fil (anti-DoS) : un intent surdimensionné est rejeté AVANT toute
 *  logique. Les vrais caps de RÈGLE (sorts/tour) sont ré-appliqués par le
 *  résolveur (truncateIntentByCaps) — ici on ne fait que borner la taille brute. */
const MAX_WIRE_SPELLS = 64;

const SPELL_KINDS = new Set(["lane", "self", "hero", "global"]);
const MOVE_SET = new Set<string>(MOVES);

/* ───────────────────────── Sérialisation ───────────────────────── */

/** Forme « fil » d'un intent — identique à TurnIntent (donnée pure) mais on
 *  reconstruit un objet propre pour ne transmettre QUE le contrat (pas de champ
 *  parasite attaché par un caller). */
export interface WireTurnIntent {
  spells: PlayedSpell[];
  summons: PlannedSummon[];
}

/** TurnIntent → objet de fil propre (à passer tel quel au relais serveur). */
export function serializeIntent(intent: TurnIntent): WireTurnIntent {
  return {
    spells: intent.spells.map((s) =>
      s.kind === "lane" ? { id: s.id, kind: "lane", lane: s.lane } : { id: s.id, kind: s.kind },
    ),
    summons: intent.summons.map((s) => ({ lane: s.lane, move: s.move })),
  };
}

/* ───────────────────────── Validation (réception) ───────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asLane(v: unknown): LaneIndex | null {
  return v === 0 || v === 1 || v === 2 ? (v as LaneIndex) : null;
}

function parseSpell(raw: unknown): PlayedSpell | null {
  if (!isRecord(raw)) return null;
  const { id, kind, lane } = raw;
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(CARDS, id)) return null;
  if (typeof kind !== "string" || !SPELL_KINDS.has(kind)) return null;
  if (kind === "lane") {
    const l = asLane(lane);
    if (l === null) return null;
    return { id: id as CardId, kind: "lane", lane: l };
  }
  return { id: id as CardId, kind: kind as "self" | "hero" | "global" };
}

function parseSummon(raw: unknown): PlannedSummon | null {
  if (!isRecord(raw)) return null;
  const l = asLane(raw.lane);
  if (l === null) return null;
  if (typeof raw.move !== "string" || !MOVE_SET.has(raw.move)) return null;
  return { lane: l, move: raw.move as Move };
}

/**
 * Valide STRICTEMENT un intent reçu du réseau. Retourne un TurnIstent propre, ou
 * null si quoi que ce soit est invalide (id de carte inconnu, kind/lane/move hors
 * domaine, tailles hors bornes, forme non-objet). L'appelant traite null comme
 * un intent VIDE (le joueur n'a rien joué ce tour) — jamais un crash. Le rejet
 * est TOTAL (pas de filtrage partiel) : un seul champ pourri = intent entier
 * suspect (même ruleset ⇒ un client honnête n'envoie jamais d'invalide).
 */
export function parseTurnIntent(raw: unknown): TurnIntent | null {
  if (!isRecord(raw)) return null;
  const { spells, summons } = raw;
  if (!Array.isArray(spells) || !Array.isArray(summons)) return null;
  if (spells.length > MAX_WIRE_SPELLS || summons.length > LANE_COUNT) return null;

  const outSpells: PlayedSpell[] = [];
  for (const s of spells) {
    const p = parseSpell(s);
    if (!p) return null;
    outSpells.push(p);
  }
  const outSummons: PlannedSummon[] = [];
  for (const s of summons) {
    const p = parseSummon(s);
    if (!p) return null;
    outSummons.push(p);
  }
  return { spells: outSpells, summons: outSummons };
}

/* ───────────────────────── Hash de ruleset ───────────────────────── */

/** Sérialisation STABLE (clés triées récursivement) → même chaîne quel que soit
 *  l'ordre d'insertion des clés, sur les deux clients. Base du hash déterministe. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify((v as Record<string, unknown>)[k])).join(",") + "}";
}

/** FNV-1a 32-bit → chaîne hex. Non-crypto (garde-fou anti-skew de version, pas
 *  de la sécurité) : rapide et déterministe, suffit à détecter tout écart de règles. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Empreinte déterministe des RÈGLES de résolution Pro. Couvre : la version
 * moteur (logique), BALANCE (tuning), le coût de chaque carte (trié par id) et
 * les stats de créatures. Deux clients avec exactement les mêmes règles
 * produisent le MÊME hash ; toute divergence (APK plus vieux, tuning différent)
 * donne un hash différent → le handshake refuse le match. Recalculé à froid.
 */
export function arenaRulesetHash(): string {
  const cards = Object.keys(CARDS)
    .sort()
    .map((id) => [id, CARDS[id as CardId].cost] as const);
  const payload = stableStringify({
    v: ARENA_ENGINE_VERSION,
    balance: BALANCE,
    cards,
    creatures: CREATURE_STATS,
  });
  return `${ARENA_ENGINE_VERSION}-${fnv1a(payload)}`;
}

/* ───────────────────────── Hash d'état (anti-triche Phase 4) ───────────────────────── */

/**
 * Empreinte déterministe de l'ÉTAT DU BOARD, pour le contrôle d'intégrité
 * lockstep (Phase 4 anti-triche). En lockstep les deux clients calculent un
 * board IDENTIQUE à chaque tour → même hash. Chacun envoie ce hash au serveur
 * (relais aveugle) qui COMPARE les deux sans comprendre le jeu ; toute
 * divergence (bug OU client qui triche son état local) → le match est DROP,
 * aucun résultat crédité. `stableStringify` neutralise l'ordre des clés.
 */
export function hashBoard(board: BoardState): string {
  return fnv1a(stableStringify(board));
}
