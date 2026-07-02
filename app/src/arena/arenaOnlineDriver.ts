/**
 * arenaOnlineDriver — adaptateur entre la session lockstep (arenaOnlineSession)
 * et ArenaGame, pour le mode Pro online.
 *
 * ArenaGame ne dépend QUE de cette petite interface (DIP) : en vs-CPU la prop
 * `online` est absente ; en online, l'orchestrateur lui injecte un driver. Le
 * driver traduit les besoins d'ArenaGame (échanger un intent de tour, un
 * mulligan, déclarer l'issue) en appels `session.exchange` avec (dé)sérialisation
 * via arenaNet — la validation stricte (anti-triche) vit là.
 *
 * Rounds réservés sur le canal opaque `ccg_turn` :
 *   0 = SETUP (deck + Voie) — échangé par l'ORCHESTRATEUR avant de créer le driver,
 *   1 = MULLIGAN,
 *   turn N (≥1) = round N+1.
 */
import type { Move } from "../engine/game";
import type { RngPair } from "../engine/rng";
import type { CardId } from "../ranked/rankedTypes";
import type { Side, TurnIntent } from "./arenaTypes";
import { serializeIntent, parseTurnIntent } from "./arenaNet";
import type { ArenaOnlineSession } from "./arenaOnlineSession";
import type { PlayerSlot } from "../online/online";

/** Ce dont ArenaGame a besoin du réseau, et RIEN d'autre (SRP + DIP). */
export interface ArenaOnlineDriver {
  readonly mySide: Side;
  readonly rngPair: RngPair;
  readonly oppName: string;
  readonly oppDeck: CardId[];
  readonly oppAffinity: Move;
  /** Envoie MON intent du tour `turn` (≥1) et résout avec celui de l'adversaire.
   *  Un intent adverse invalide (triche/corruption) est traité comme « il passe »
   *  (intent vide) — jamais un crash (cf. parseTurnIntent). */
  exchangeIntent(turn: number, myIntent: TurnIntent): Promise<TurnIntent>;
  /** Mulligan relayé : envoie MES indices, résout ceux de l'adversaire. */
  exchangeMulligan(myIndices: number[]): Promise<number[]>;
  /** Déclare l'issue (perspective locale) → le serveur clôt + diffuse. */
  reportResult(outcome: "win" | "loss" | "draw"): void;
}

/** Données résolues par l'orchestrateur (post handshake + échange de deck). */
export interface ArenaOnlineSetup {
  mySide: Side;
  rngPair: RngPair;
  oppName: string;
  oppDeck: CardId[];
  oppAffinity: Move;
}

const EMPTY_INTENT: TurnIntent = { spells: [], summons: [] };
const ROUND_MULLIGAN = 1;

export function makeArenaOnlineDriver(session: ArenaOnlineSession, setup: ArenaOnlineSetup): ArenaOnlineDriver {
  const oppSide: Side = setup.mySide === "a" ? "b" : "a";
  return {
    mySide: setup.mySide,
    rngPair: setup.rngPair,
    oppName: setup.oppName,
    oppDeck: setup.oppDeck,
    oppAffinity: setup.oppAffinity,
    async exchangeIntent(turn, myIntent) {
      const oppWire = await session.exchange(turn + 1, serializeIntent(myIntent));
      return parseTurnIntent(oppWire) ?? EMPTY_INTENT;
    },
    async exchangeMulligan(myIndices) {
      const oppWire = await session.exchange(ROUND_MULLIGAN, { mulligan: myIndices });
      const raw = (oppWire as { mulligan?: unknown } | null)?.mulligan;
      // Bornes défensives : indices entiers plausibles (mulliganSwap re-filtre
      // ensuite contre la vraie taille de main → jamais d'index hors main).
      return Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 32) : [];
    },
    reportResult(outcome) {
      const winner: PlayerSlot | null =
        outcome === "win" ? setup.mySide : outcome === "loss" ? oppSide : null;
      session.declareResult(winner);
    },
  };
}
