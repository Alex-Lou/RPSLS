//! TypeScript mirror of `crates/rpsls-server/src/protocol.rs`.
//! Keep both in sync.
//! Types du fil (wire types) — extraits d'online.ts, réexportés par lui.

import type { Move, Outcome } from "../engine/game";
import type { MatchRecord } from "../types";

/* ──────────── Wire types ──────────── */

export type PlayerSlot = "a" | "b";

export interface OpponentInfo {
  nickname: string;
}

/* ──────────── Constellation Lanes (Phase 1+) ──────────── */

/** One placement on one lane. Phase 1 only reads `mv`; `mana`/`modifier`
 *  are placeholders that the protocol already accepts so phase 2/5 won't
 *  require a wire bump. */
export interface LanePlay {
  mv: Move;
  mana?: number;
  modifier?: string | null;
}

export type LaneWinner = "a" | "b" | "draw";

export interface LaneResult {
  a_play: LanePlay;
  b_play: LanePlay;
  outcome: Outcome;
  winner: LaneWinner;
  points: number;
}

/* ──────────── Constellation Classée (CCG) — relais aveugle ──────────── */

/** Intention de tour (Constellation Classée) relayée VERBATIM par le serveur
 *  aveugle. Les formes précises de `card`/`plays` appartiennent à la couche
 *  ranked (rankedTypes) ; sur le fil, ça doit juste faire l'aller-retour, donc
 *  `card` reste opaque ici. Les deux clients résolvent localement avec la même
 *  `shared_seed` (cf. engine/rng). */
export interface CcgTurnIntent {
  /** Les 3 coups committés (gauche→droite). */
  plays: Move[];
  /** La carte jouée ce tour (PlayedCard, ranked) ou null — opaque ici. */
  card: unknown | null;
  /** Compteurs visibles nécessaires au Juge (non-leaky). */
  handSize: number;
  deckSize: number;
}

/** Subset of player state synced to the server for persistence. */
export interface PlayerProgress {
  xp: number;
  rankLp: number;
  eclats: number;
  dust: number;
  /** Premium currency balance (✦). Synced so unspent stars survive a reinstall
   *  — not just the owned sets. Optional for back-compat with older saves. */
  stars?: number;
  wins: number;
  losses: number;
  draws: number;
  cardCollection: string[];
  cardMastery: Record<string, number>;
  codexClaimed: number[];
  /** One-time quest claims (union-merged) so rewards can't be re-claimed after
   *  a reinstall. Optional for back-compat. */
  claimedQuests?: string[];
  rankedDeck: string[];
  /** Arena (Constellation Pro) deck — 8 cartes, séparé du Classé. */
  arenaDeck?: string[];
  /** Purchased premium sets — synced (union) so paid sets survive a reinstall. */
  ownedPremiumSets?: string[];
  seasonNumber: number;
  seasonStartedAt: number;
  winStreak: number;
  /** Classé (classic 1v1) own ladder + record — cloud-saved like the rest of
   *  the progression so it survives reinstall and follows the player across
   *  devices. Optional for back-compat with a server build that predates them
   *  (it simply omits the fields → client falls back to local). */
  classeLp?: number;
  classeWins?: number;
  classeLosses?: number;
  classeDraws?: number;
  /** Constellation Pro (mini-CCG arena) record — optional for
   *  back-compat with older server builds that don't know about Arena yet. */
  arenaWins?: number;
  arenaLosses?: number;
  arenaDraws?: number;
  updatedAt: number;
  // Cosmetic preferences (small) — synced so a reinstall restores the chosen
  // look. Optional for back-compat with older saves that lack them.
  themeId?: string;
  backgroundId?: string;
  padId?: string;
  avatar?: string;
  nickname?: string;
  // Gameplay / accessibility prefs — restored on a fresh install (adopted under
  // the same "vierge" gate as cosmetics). Optional for back-compat.
  difficulty?: string;
  fontScale?: number;
  padChosen?: boolean;
  /** Historique récent (capé) — synchronisé pour que le journal des matchs +
   *  les VOIES jouées survivent à un réinstall (Alex 2026-06-13). Optionnel
   *  (back-compat avec un serveur qui ne renvoie pas encore le champ). */
  history?: MatchRecord[];
  /** Défis du jour réclamés aujourd'hui (scopé au jour) — synchronisé pour que
   *  l'état "réclamé" survive à un réinstall (sinon les défis repartent "à
   *  réclamer" alors que la récompense XP, elle, a persisté = re-réclamation).
   *  Réparé 2026-06-14. */
  dailyClaims?: { date: string; ids: string[] };
  /** Jours (YYYY-MM-DD) dont le set de défis est complété — union. */
  completedDailies?: string[];
  /** Tally pick/win par coup — progression quête pentagramme (gagner 1× avec
   *  chaque coup). Restauré au merge (max par coup). */
  byMove?: Record<string, { picked: number; won: number }>;
  /** Voie / affinité Constellation Pro choisie. */
  arenaAffinity?: string;
  /** Compteur d'abandons (fenêtre glissante 24h) — synchronisé pour qu'un
   *  quitteur ne réinitialise pas sa pénalité de forfait en réinstallant. */
  abandons?: { count: number; lastAt: number };
}

/* Client → Server */
export type ClientMessage =
  | { type: "hello"; nickname: string; player_id?: string; claim_token?: string }
  // Account auth (§9-A). signup links the current guest session's progression
  // to a new account + grants the welcome bonus; login adopts the account's
  // identity + progression. Both reply auth_ok / auth_error.
  | { type: "signup"; email: string; password: string }
  | { type: "login"; email: string; password: string }
  // Sign in with Google — `id_token` is a Google-issued OIDC ID token obtained
  // on-device; the server verifies it (RS256/JWKS) and replies auth_ok/error.
  | { type: "google_login"; id_token: string }
  | { type: "create_lobby"; best_of: number }
  | { type: "join_lobby"; code: string }
  | { type: "join_queue"; best_of: number }
  | { type: "join_lanes_queue"; win_to: number }
  | { type: "cancel" }
  | { type: "play_move"; mv: Move }
  | { type: "play_lanes"; plays: LanePlay[] }
  | { type: "leave_match" }
  | { type: "chat"; emoji: string }
  | { type: "ping" }
  | { type: "request_rematch" }
  | { type: "respond_rematch"; accept: boolean }
  | { type: "sync_state"; state: PlayerProgress }
  // Lanes pre-match: this client confirms it's ready for the coin flip.
  // The server only triggers the flip once BOTH sides have sent this.
  | { type: "prep_ready" }
  // Constellation Classée (CCG) — relais aveugle (mirror protocol.rs).
  | { type: "join_ccg_queue"; win_to: number; variant: string; ruleset_hash: string }
  // `intent` = payload OPAQUE (le serveur ne le lit pas) ; `state_hash` = empreinte
  // de l'état vu par ce client (anti-triche Phase 4, comparée par le serveur).
  | { type: "ccg_turn"; round_no: number; intent: unknown; state_hash: string }
  | { type: "ccg_result"; winner: PlayerSlot | null; state_hash: string }
  // Économie serveur-autoritaire (mirror protocol.rs, module `wallet`).
  | WalletRequest;

/** Opérations de portefeuille (le serveur valide, débite, crédite). */
export type WalletRequest =
  | { type: "wallet_init" }
  | { type: "open_pack" }
  | { type: "craft_card"; card_id: string }
  | { type: "buy_premium_set"; set_id: string }
  | { type: "claim_codex"; threshold: number }
  | { type: "claim_cpu_rewards"; rewards: CpuRewardClaim[] }
  | { type: "claim_unlocks"; card_ids: string[] }
  | { type: "claim_season" }
  // Niveau ACTUEL (calculé depuis l'XP) : le serveur paie les niveaux pas
  // encore payés, au plus 5 par jour UTC.
  | { type: "claim_level"; level: number }
  | { type: "claim_dailies"; claims: { date: string; id: string }[] };

/** Gain d'un match vs CPU réclamé. `id` : anti-rejeu serveur ; `best_of` :
 *  bestOf (classique) ou winTo (Constellation) → multiplicateur de longueur ;
 *  `sweep` : victoire sans manche concédée (déblocage « vortex »). */
export interface CpuRewardClaim {
  mode: string;
  outcome: string;
  id?: string;
  best_of?: number;
  sweep?: boolean;
}

/** Portefeuille tel que renvoyé par le serveur (`wallet:{pid}`). */
export interface Wallet {
  eclats: number;
  dust: number;
  stars: number;
  cardCollection: string[];
  ownedPremiumSets: string[];
  codexClaimed: number[];
  cpuDay: number;
  cpuEclatsToday: number;
  seasonNumber: number;
  seasonStartedAt: number;
  /** Dernier niveau payé (null = base posée à la prochaine réclamation). */
  levelRewarded?: number | null;
  /** Victoires Constellation/Arena comptées par le serveur (déblocages). */
  constellWins?: number;
  constellSweeps?: number;
}

/* Server → Client */
export type ServerMessage =
  | { type: "welcome"; session_id: string }
  | { type: "lobby_created"; code: string; best_of: number }
  | { type: "queued"; position: number }
  | {
      type: "match_found";
      match_id: string;
      opponent: OpponentInfo;
      best_of: number;
      you_are: PlayerSlot;
    }
  | { type: "round_start"; round_no: number; deadline_ms: number }
  | {
      type: "round_result";
      round_no: number;
      a_move: Move;
      b_move: Move;
      outcome: Outcome;
      score_a: number;
      score_b: number;
    }
  | {
      type: "match_end";
      winner: PlayerSlot | null;
      score_a: number;
      score_b: number;
      forfeit: boolean;
    }
  | { type: "opponent_left" }
  | { type: "chat"; from: PlayerSlot; emoji: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong" }
  | { type: "rematch_offered" }
  | { type: "rematch_declined" }
  | { type: "state_loaded"; state: PlayerProgress; claim_token?: string }
  // Auth (signup/login) result. On auth_ok the client adopts player_id +
  // claim_token and merges `state`. auth_error.code is generic (never leaks
  // whether an e-mail exists).
  | { type: "auth_ok"; player_id: string; claim_token?: string; state: PlayerProgress; email?: string }
  | { type: "auth_error"; code: string }
  /* Lanes variants */
  | {
      type: "lanes_match_found";
      match_id: string;
      opponent: OpponentInfo;
      you_are: PlayerSlot;
      lanes: number;
      win_to: number;
    }
  | { type: "lanes_round_start"; round_no: number; deadline_ms: number }
  | {
      type: "lanes_round_result";
      round_no: number;
      a_plays: LanePlay[];
      b_plays: LanePlay[];
      lane_results: LaneResult[];
      a_points: number;
      b_points: number;
      round_wins_a: number;
      round_wins_b: number;
    }
  | {
      type: "lanes_match_end";
      winner: PlayerSlot | null;
      round_wins_a: number;
      round_wins_b: number;
      forfeit: boolean;
    }
  // Lanes pre-match: server's per-perspective readiness tally. `you_ready`
  // is THIS client's slot; `opp_ready` is the other slot. Sent at prep entry
  // (both false) and on every `prep_ready` arrival.
  | { type: "prep_ready_state"; you_ready: boolean; opp_ready: boolean }
  // Lanes pre-match: both sides confirmed, server has rolled the coin —
  // `winner` is the slot whose arena dresses the duel. Client uses it to
  // play the coin animation locally with the authoritative result.
  | { type: "start_coin_flip"; winner: PlayerSlot }
  // Constellation Classée (CCG) — relais aveugle (mirror protocol.rs).
  | { type: "ccg_match_found"; match_id: string; opponent: OpponentInfo; you_are: PlayerSlot; win_to: number; shared_seed: number }
  | { type: "ccg_turn_relay"; from: PlayerSlot; round_no: number; intent: unknown }
  // `desync` = match ANNULÉ par le serveur (hash d'état ou résultats divergents →
  // triche/bug détecté) : aucun résultat crédité (anti-triche Phase 4).
  | { type: "ccg_match_end"; winner: PlayerSlot | null; forfeit: boolean; desync: boolean }
  // Portefeuille à jour après une opération (`op` = son nom côté serveur, ou
  // "match_reward" pour un gain de match en ligne crédité par le serveur).
  | {
      type: "wallet_update";
      op: string;
      wallet: Wallet;
      pack?: { cards: string[]; isNew: boolean[]; dustGained: number };
      eclats?: number;
      dust?: number;
      stars?: number;
      cards?: string[];
    }
  // Opération refusée, rien n'a changé (code stable, cf. protocol.rs).
  | { type: "wallet_error"; op: string; code: string };
