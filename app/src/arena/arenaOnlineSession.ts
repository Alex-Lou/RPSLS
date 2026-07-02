/**
 * arenaOnlineSession — machine à états CLIENT d'un match Constellation Pro online,
 * au-dessus du relais aveugle (ccg_engine).
 *
 * DÉCOUPLÉE de React ET de OnlineClient : on lui injecte un `send(msg)` et on lui
 * pousse les `ServerMessage` entrants via `handle(msg)`. Elle expose une API
 * promise-based que la couche UI (ArenaGame en mode online) consomme, tour par
 * tour. Ce découplage la rend testable headless et évite d'alourdir ArenaGame.
 *
 * Modèle lockstep (cf. arena-lockstep-check) :
 *   join → matchFound(shared_seed, you_are) → prep(ready + coin serveur) →
 *   [round 0 = MULLIGAN relayé] → rounds 1..N (intents sérialisés) → result.
 *
 * Le MULLIGAN passe par le MÊME canal `ccg_turn` (round_no=0) que les tours : le
 * relais étant opaque (JSON quelconque), zéro changement serveur. `exchange`
 * corréle par `round_no` et bufferise (le relais adverse peut arriver avant ou
 * après notre envoi). Le lockstep est strictement alterné → au plus un round en vol.
 */
import type { ClientMessage, ServerMessage, PlayerSlot } from "../online/online";

export interface ArenaMatchInfo {
  sharedSeed: number;
  youAre: PlayerSlot;
  opponentName: string;
  winTo: number;
}

export interface ArenaSessionCallbacks {
  onQueued?: (position: number) => void;
  onReadyState?: (youReady: boolean, oppReady: boolean) => void;
  onMatchEnd?: (winner: PlayerSlot | null, forfeit: boolean) => void;
  onOpponentLeft?: () => void;
  onRematchOffered?: () => void;
  onRematchDeclined?: () => void;
  onError?: (code: string, message: string) => void;
}

type Resolver<T> = (v: T) => void;

export class ArenaOnlineSession {
  private send: (msg: ClientMessage) => void;
  private winTo: number;
  private rulesetHash: string;
  private cb: ArenaSessionCallbacks;

  private matchResolver: Resolver<ArenaMatchInfo> | null = null;
  private coinResolver: Resolver<PlayerSlot> | null = null;
  /** Relais adverses reçus mais pas encore attendus, par round_no. */
  private inbox = new Map<number, unknown>();
  /** Attente en cours d'un round donné (au plus une à la fois en lockstep). */
  private pending: { round: number; resolve: Resolver<unknown> } | null = null;
  private ended = false;

  constructor(
    send: (msg: ClientMessage) => void,
    opts: { winTo: number; rulesetHash: string },
    cb: ArenaSessionCallbacks = {},
  ) {
    this.send = send;
    this.winTo = opts.winTo;
    this.rulesetHash = opts.rulesetHash;
    this.cb = cb;
  }

  /* ── Sortants ── */

  /** Entre dans la file Pro (variant "arena" → jamais croisé avec la Classée ;
   *  ruleset_hash → apparié uniquement à un client de MÊME version). */
  join(): void {
    this.send({ type: "join_ccg_queue", win_to: this.winTo, variant: "arena", ruleset_hash: this.rulesetHash });
  }

  /** Attend l'appariement. Résout avec la graine partagée + le camp assigné. */
  waitMatchFound(): Promise<ArenaMatchInfo> {
    return new Promise((resolve) => { this.matchResolver = resolve; });
  }

  /** Signale « prêt » (prep) — le serveur lance la pièce quand les deux le sont. */
  markReady(): void {
    this.send({ type: "prep_ready" });
  }

  /** Attend le résultat de la pièce serveur (qui commence / override de pad). */
  waitCoinFlip(): Promise<PlayerSlot> {
    return new Promise((resolve) => { this.coinResolver = resolve; });
  }

  /**
   * Échange lockstep d'un round : envoie MON payload et résout avec celui de
   * l'adversaire pour le MÊME round. round 0 = mulligan, round ≥ 1 = intent.
   * Le payload est OPAQUE (le relais ne le lit pas) — l'appelant sérialise/parse.
   */
  exchange(round: number, payload: unknown): Promise<unknown> {
    this.send({ type: "ccg_turn", round_no: round, intent: payload as never });
    const buffered = this.inbox.get(round);
    if (buffered !== undefined) {
      this.inbox.delete(round);
      return Promise.resolve(buffered);
    }
    return new Promise((resolve) => { this.pending = { round, resolve }; });
  }

  /** Déclare l'issue (résolution locale déterministe) → le serveur clôt + diffuse. */
  declareResult(winner: PlayerSlot | null): void {
    this.send({ type: "ccg_result", winner });
  }

  requestRematch(): void { this.send({ type: "request_rematch" }); }
  respondRematch(accept: boolean): void { this.send({ type: "respond_rematch", accept }); }
  leave(): void { this.send({ type: "leave_match" }); }

  /* ── Entrant ── */

  /** Pousse un message serveur dans la session. Ne consomme QUE les messages du
   *  protocole CCG/prep ; les autres sont ignorés (la session est ciblée Pro). */
  handle(msg: ServerMessage): void {
    switch (msg.type) {
      case "queued":
        this.cb.onQueued?.(msg.position);
        break;
      case "ccg_match_found":
        this.matchResolver?.({
          sharedSeed: msg.shared_seed,
          youAre: msg.you_are,
          opponentName: msg.opponent.nickname,
          winTo: msg.win_to,
        });
        this.matchResolver = null;
        break;
      case "prep_ready_state":
        this.cb.onReadyState?.(msg.you_ready, msg.opp_ready);
        break;
      case "start_coin_flip":
        this.coinResolver?.(msg.winner);
        this.coinResolver = null;
        break;
      case "ccg_turn_relay":
        this.deliverRelay(msg.round_no, msg.intent);
        break;
      case "ccg_match_end":
        this.ended = true;
        this.cb.onMatchEnd?.(msg.winner, msg.forfeit);
        break;
      case "opponent_left":
        this.cb.onOpponentLeft?.();
        break;
      case "rematch_offered":
        this.cb.onRematchOffered?.();
        break;
      case "rematch_declined":
        this.cb.onRematchDeclined?.();
        break;
      case "error":
        this.cb.onError?.(msg.code, msg.message);
        break;
      default:
        break;
    }
  }

  /** Route un relais adverse : réveille l'attente du round si elle existe, sinon
   *  bufferise (il est arrivé avant notre propre envoi de ce round). */
  private deliverRelay(round: number, intent: unknown): void {
    if (this.pending && this.pending.round === round) {
      const { resolve } = this.pending;
      this.pending = null;
      resolve(intent);
      return;
    }
    this.inbox.set(round, intent);
  }

  get isEnded(): boolean { return this.ended; }
}
