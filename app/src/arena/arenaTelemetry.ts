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

export interface WatcherMatchRecord {
  v: 1;
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
