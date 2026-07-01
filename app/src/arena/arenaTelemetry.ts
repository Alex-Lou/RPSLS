/**
 * arenaTelemetry — enregistre chaque partie Arena Pro JOUÉE jusqu'au bout vers le
 * RPSLSWatcher (POST /api/matches). Fire-and-forget, fail-soft, `keepalive` (le
 * POST survit à la navigation hors de l'écran de fin). INERTE si VITE_WATCHER_URL
 * ou VITE_WATCHER_INGEST_KEY ne sont pas définis → le jeu marche exactement pareil
 * sans config. La clé vit dans app/.env (gitignoré), jamais dans le repo.
 *
 * Contrat MatchRecord = celui du repo RPSLSWatcher (src/data/types.ts). Dupliqué
 * ici volontairement : ce sont deux repos séparés, le contrat est leur frontière.
 */
import type { Move } from "../engine/game";
import type { TurnIntent } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";
import { CARDS } from "../ranked/cards";
import type { FpsSummary } from "../graphics/fpsSampler";

export interface WatcherMatchRecord {
  v: 1 | 2; // 2 = inclut turnLog (déroulé tour par tour)
  id: string;
  ts: number;
  mode: "pro" | "ranked";
  playerVoie: Move;
  oppVoie: Move | null;
  oppKind: "cpu" | "human";
  result: "win" | "loss" | "draw";
  turns: number;
  finalHpSelf: number;
  finalHpOpp: number;
  finisherFired: boolean;
  oppFinisherFired: boolean;
  hpTrajectorySelf: number[];
  hpTrajectoryOpp: number[];
  endReason: "ko" | "hardcap" | "suddendeath";
  appVersion?: string;
  turnLog?: ArenaTurnEvent[]; // [v:2] déroulé tour par tour — absent si non configuré
  fps?: FpsSummary;           // profil FPS de la partie (rAF) — absent si non mesuré
}

/* ───────────────────── Turn-log v:2 (Tier A+B) — MÊME contrat que le Watcher
 * (src/data/types.ts). Dupliqué volontairement : deux repos, le contrat = leur
 * frontière. Observationnel pur, jamais d'effet gameplay. ──────────────────── */

export type LaneResult =
  | "counterWinSelf"
  | "counterWinOpp"
  | "mirror"
  | "emptySelf"
  | "emptyOpp"
  | "none";

export interface LaneOutcome {
  lane: number;
  selfMove: Move | null;
  oppMove: Move | null;
  result: LaneResult;
  killSelf: boolean;
  killOpp: boolean;
  saved: boolean;
  splashToOpp: number;
  splashToSelf: number;
  directToOpp: number;
  directToSelf: number;
}

export interface TurnPlay {
  kind: "summon" | "spell";
  card: string;
  lane?: number;
  move?: Move;
  affinity: boolean;
  manaCost: number;
}

/** Carte RÉELLE dépensée ce tour (id + nom lisible + rareté + flag fusion) —
 *  alimente le tracker de cartes du Watcher (stats par carte, base vs fusion). */
export interface CardPlay {
  id: string;
  name: string;
  kind: string; // creature | spell | fusion | active | passive…
  rarity: string;
  fusion: boolean;
  voie?: Move;
}

export interface ArenaTurnEvent {
  turn: number;
  manaMax: number;
  manaSpent: number;
  handStart: number;
  drawn: number;
  deckLeft: number;
  plays: TurnPlay[];
  playsOpp: TurnPlay[];
  cards?: CardPlay[]; // vraies cartes dépensées (moi) — id/nom/rareté/fusion
  cardsOpp?: CardPlay[];
  engine: number;
  engineOpp: number;
  engineRose: boolean;
  finisherUnlocked: boolean;
  hpSelf: number;
  hpOpp: number;
  dHpSelf: number;
  dHpOpp: number;
  deadTurn: boolean;
  lanes?: LaneOutcome[];
}

const WATCHER_URL = (import.meta.env.VITE_WATCHER_URL as string | undefined)?.replace(/\/+$/, "");
const INGEST_KEY = import.meta.env.VITE_WATCHER_INGEST_KEY as string | undefined;
const APP_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined;

/** True si le Watcher est configuré (url + clé). */
export function watcherEnabled(): boolean {
  return !!WATCHER_URL && !!INGEST_KEY;
}

/** UUID (crypto si dispo, sinon repli). Sert d'id d'idempotence à l'ingest. */
export function watcherUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* repli ci-dessous */
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export { APP_VERSION as watcherAppVersion };

/** POST une partie au Watcher. Ne lève jamais, ne bloque jamais le jeu. */
export function recordWatcherMatch(rec: WatcherMatchRecord): void {
  if (!WATCHER_URL || !INGEST_KEY) return; // non configuré → inerte
  try {
    void fetch(`${WATCHER_URL}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ingest-Key": INGEST_KEY },
      body: JSON.stringify(rec),
      keepalive: true, // survit à la fermeture/navigation de l'écran de fin
    }).catch(() => {
      /* réseau coupé / backend down → on ignore */
    });
  } catch {
    /* fail-soft total */
  }
}

/* ───────────────────────── Enregistreur de déroulé (v:2) ─────────────────────
 * Accumule UN ArenaTurnEvent par tour résolu, à partir de 3 moments observés par
 * ArenaGame : begin() au lock (état AVANT), lane() par lane en combat (Tier B),
 * end() au settle (état APRÈS). Le tout en mémoire, fail-soft, JAMAIS d'effet
 * gameplay. Inerte si le Watcher n'est pas configuré (enabled=false → no-op).
 * ──────────────────────────────────────────────────────────────────────────── */

export interface BeginTurnInput {
  turn: number;
  manaMax: number;
  manaSpent: number;
  handStart: number;
  deckLeft: number;
  plays: TurnPlay[];
  playsOpp: TurnPlay[];
  cards: CardPlay[];
  cardsOpp: CardPlay[];
  hpSelf: number;
  hpOpp: number;
  engine: number;
  engineOpp: number;
}

export interface EndTurnInput {
  hpSelf: number;
  hpOpp: number;
  engine: number;
  engineOpp: number;
  finisherUnlocked: boolean;
}

export interface TurnRecorder {
  begin(input: BeginTurnInput): void;
  lane(outcome: LaneOutcome): void;
  end(input: EndTurnInput): void;
  log(): ArenaTurnEvent[];
}

/** Construit les TurnPlay d'un camp depuis son intent (observationnel). Défensif :
 *  des tableaux manquants ne doivent JAMAIS lever (sinon la capture du tour saute). */
export function buildTurnPlays(intent: TurnIntent | null | undefined, affinity: Move | undefined): TurnPlay[] {
  const summons: TurnPlay[] = (intent?.summons ?? []).map((s) => ({
    kind: "summon",
    card: s.move,
    lane: s.lane,
    move: s.move,
    affinity: s.move === affinity,
    manaCost: 1,
  }));
  const spells: TurnPlay[] = (intent?.spells ?? []).map((s) => ({
    kind: "spell",
    card: s.id,
    affinity: false,
    manaCost: 0,
  }));
  return [...summons, ...spells];
}

/** Construit le ledger des cartes RÉELLES dépensées (depuis removeSpentCardsDetailed),
 *  avec nom lisible résolu côté jeu (nameOf = cardFr). Défensif. */
export function buildCardLedger(spent: CardId[] | null | undefined, nameOf: (id: CardId) => string): CardPlay[] {
  return (spent ?? []).map((id) => {
    const c = CARDS[id];
    return {
      id,
      name: nameOf(id),
      kind: c?.kind ?? "active",
      rarity: c?.rarity ?? "common",
      fusion: c?.kind === "fusion",
      ...(c?.voie ? { voie: c.voie } : {}),
    };
  });
}

const NOOP_RECORDER: TurnRecorder = { begin() {}, lane() {}, end() {}, log: () => [] };

/** Crée un enregistreur de déroulé. `enabled=false` → no-op total (zéro overhead). */
export function createTurnRecorder(enabled: boolean): TurnRecorder {
  if (!enabled) return NOOP_RECORDER;
  const events: ArenaTurnEvent[] = [];
  let pending: { begin: BeginTurnInput; drawn: number; lanes: LaneOutcome[] } | null = null;
  let prevDeckLeft: number | null = null;
  // PV de référence pour le delta = état de fin du tour PRÉCÉDENT (chaîné settle→
  // settle) → pas de trou « tour-courant vs avant l'avance » (fatigue/refresh).
  let lastSelf: number | null = null;
  let lastOpp: number | null = null;
  return {
    begin(input) {
      try {
        // turn 1 = nouvelle partie → on repart de zéro (couvre les rematch).
        if (input.turn <= 1) {
          events.length = 0;
          prevDeckLeft = null;
          lastSelf = null;
          lastOpp = null;
        }
        const drawn = prevDeckLeft == null ? input.handStart : Math.max(0, prevDeckLeft - input.deckLeft);
        prevDeckLeft = input.deckLeft;
        pending = { begin: input, drawn, lanes: [] };
      } catch {
        /* fail-soft */
      }
    },
    lane(outcome) {
      if (pending) pending.lanes.push(outcome);
    },
    end(input) {
      try {
        if (!pending) return;
        const b = pending.begin;
        // Delta chaîné : référence = fin du tour précédent (ou l'état de départ
        // du 1er tour). hpSelf/hpOpp de l'event = état APRÈS ce tour.
        const baseSelf = lastSelf ?? b.hpSelf;
        const baseOpp = lastOpp ?? b.hpOpp;
        const dHpSelf = input.hpSelf - baseSelf;
        const dHpOpp = input.hpOpp - baseOpp;
        lastSelf = input.hpSelf;
        lastOpp = input.hpOpp;
        const engineRose = input.engine > b.engine;
        const kills = pending.lanes.some((l) => l.killSelf || l.killOpp);
        events.push({
          turn: b.turn,
          manaMax: b.manaMax,
          manaSpent: b.manaSpent,
          handStart: b.handStart,
          drawn: pending.drawn,
          deckLeft: b.deckLeft,
          plays: b.plays,
          playsOpp: b.playsOpp,
          ...(b.cards && b.cards.length ? { cards: b.cards } : {}),
          ...(b.cardsOpp && b.cardsOpp.length ? { cardsOpp: b.cardsOpp } : {}),
          engine: input.engine,
          engineOpp: input.engineOpp,
          engineRose,
          finisherUnlocked: input.finisherUnlocked,
          hpSelf: input.hpSelf,
          hpOpp: input.hpOpp,
          dHpSelf,
          dHpOpp,
          deadTurn: dHpSelf === 0 && dHpOpp === 0 && !engineRose && !kills,
          ...(pending.lanes.length ? { lanes: pending.lanes } : {}),
        });
        pending = null;
      } catch {
        /* fail-soft */
      }
    },
    log: () => events,
  };
}
