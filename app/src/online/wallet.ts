/**
 * wallet.ts — économie SERVEUR-AUTORITAIRE côté client (HANDOFF §9-B, lot 2).
 *
 * Le serveur détient le portefeuille (éclats, poussière, étoiles, collection,
 * sets premium, codex, saison). Ici :
 *  - `walletCall` : ouvre une connexion ponctuelle (hello → state_loaded),
 *    initialise le portefeuille, rejoue les réclamations en attente, puis
 *    exécute l'opération demandée (pack, craft, achat, codex) ;
 *  - `applyWallet` : chaque réponse serveur REMPLACE les champs d'éco locaux
 *    (le serveur gagne toujours) ;
 *  - file `pendingEco` : gains de matchs vs CPU et cartes de déblocage, gagnés
 *    hors ligne, réclamés au prochain passage (barème + plafond serveur).
 *
 * Hors ligne : la boutique répond « connexion requise » (choix Alex) ; le jeu
 * continue, les gains attendent dans la file.
 */

import { addGlobalListener, type ServerMessage, type Wallet, type WalletRequest } from "./online";
import { helloFrame, resolveWsUrl } from "./transientSession";
import { buildProgressFromPlayer } from "./playerSync";
import { saveAnchor } from "./playerAnchor";
import { useStore } from "../store/store";
import { SEASON_DURATION_MS, seasonRewardForLp, softResetLp } from "../engine/economy";
import type { PendingEco } from "../types";

type WalletUpdate = Extract<ServerMessage, { type: "wallet_update" }>;

/** Résultat d'une opération : la réponse serveur, ou un code d'erreur stable
 *  (`insufficient_funds`, `already_owned`, `offline`, `timeout`…). */
export type WalletResult = { ok: true; update: WalletUpdate } | { ok: false; code: string };

const SESSION_TIMEOUT_MS = 20_000;
/** Avant la toute première init : laisse le `sync_state` envoyé juste avant
 *  atteindre Redis (la migration serveur reprend cette ligne). */
const FIRST_INIT_DELAY_MS = 1_000;
/** = plafond serveur par message `claim_cpu_rewards`. Au-delà, les plus
 *  anciens tombent (de toute façon bien au-dessus du plafond quotidien). */
const MAX_PENDING_CPU = 50;

/** Nom de l'opération dans les réponses serveur (`WalletOp::name`). */
const OP_NAME: Record<WalletRequest["type"], string> = {
  wallet_init: "init",
  open_pack: "open_pack",
  craft_card: "craft",
  buy_premium_set: "buy_premium_set",
  claim_codex: "claim_codex",
  claim_cpu_rewards: "claim_cpu_rewards",
  claim_unlocks: "claim_unlocks",
  claim_season: "claim_season",
};

/* ───────────────────────── État local ───────────────────────── */

/** Remplace les champs d'éco locaux par le portefeuille serveur. */
export function applyWallet(w: Wallet): void {
  useStore.getState().applyServerSync({
    eclats: w.eclats,
    dust: w.dust,
    stars: w.stars,
    cardCollection: w.cardCollection,
    ownedPremiumSets: w.ownedPremiumSets,
    codexClaimed: w.codexClaimed,
    season: { number: w.seasonNumber, startedAt: w.seasonStartedAt },
    walletActive: true,
  });
}

/** File d'attente persistée (localStorage) : relue défensivement, une forme
 *  altérée ne doit jamais faire planter l'app (le serveur revalide tout). */
function pending(): PendingEco {
  const p = useStore.getState().player.pendingEco;
  return {
    cpu: Array.isArray(p?.cpu) ? p.cpu.filter((c) => c && typeof c.mode === "string" && typeof c.id === "string") : [],
    unlocks: Array.isArray(p?.unlocks) ? p.unlocks.filter((u) => typeof u === "string") : [],
  };
}

function setPending(p: PendingEco): void {
  useStore.getState().applyServerSync({ pendingEco: p });
}

/** Met en file le gain d'un match vs CPU (portefeuille actif seulement : avant
 *  l'activation, le gain local part dans la ligne player que la migration
 *  reprend — le réclamer aussi le compterait deux fois). */
export function enqueueCpuReward(mode: string, outcome: "win" | "loss" | "draw"): void {
  if (!useStore.getState().player.walletActive) return;
  const p = pending();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setPending({ ...p, cpu: [...p.cpu, { id, mode, outcome }].slice(-MAX_PENDING_CPU) });
  scheduleFlush();
}

/** Met en file des cartes de déblocage (cf. enqueueCpuReward pour la garde). */
export function enqueueUnlocks(ids: string[]): void {
  if (!useStore.getState().player.walletActive || ids.length === 0) return;
  const p = pending();
  setPending({ ...p, unlocks: Array.from(new Set([...p.unlocks, ...ids])) });
  scheduleFlush();
}

/* ───────────────────────── Session serveur ───────────────────────── */

let chain: Promise<unknown> = Promise.resolve();

/** Sérialise les sessions : les réponses s'appliquent dans l'ordre. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

/** Ouvre une session, envoie `ops` une par une (chacune attend sa réponse).
 *  Renvoie les résultats reçus dans l'ordre — éventuellement PARTIELS si la
 *  connexion coupe en route, avec alors `error` (`offline`, `timeout`, `auth`) :
 *  les réponses déjà reçues ont été appliquées, il faut en tenir compte. */
function session(ops: WalletRequest[], firstInit: boolean): Promise<{ results: WalletResult[]; error?: string }> {
  return new Promise((resolve) => {
    const player = useStore.getState().player;
    const url = resolveWsUrl();
    if (!player.id || !url) return resolve({ results: [], error: "offline" });
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { return resolve({ results: [], error: "offline" }); }

    const results: WalletResult[] = [];
    let i = 0;
    let done = false;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* */ }
      resolve({ results, error });
    };
    const timer = setTimeout(() => finish("timeout"), SESSION_TIMEOUT_MS);
    const sendNext = () => {
      if (i >= ops.length) return finish();
      try { ws.send(JSON.stringify(ops[i])); } catch { finish("offline"); }
    };

    ws.onopen = () => {
      try { ws.send(JSON.stringify(helloFrame(player))); } catch { finish("offline"); }
    };
    ws.onerror = () => finish("offline");
    ws.onclose = () => finish("offline");
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(ev.data as string) as ServerMessage; } catch { return; }
      if (msg.type === "state_loaded") {
        // Joueur tout neuf : le serveur vient de créer son jeton d'identité
        // (TOFU). Le garder, sinon toute connexion suivante serait refusée.
        if (msg.claim_token && !useStore.getState().player.claimToken) {
          useStore.getState().applyServerSync({ claimToken: msg.claim_token });
          void saveAnchor(player.id, msg.claim_token).catch(() => undefined);
        }
        if (!firstInit) return sendNext();
        // Première activation : la migration serveur reprend la ligne player →
        // on y pousse d'abord l'état local le plus récent.
        try {
          ws.send(JSON.stringify({ type: "sync_state", state: buildProgressFromPlayer(useStore.getState().player) }));
        } catch { return finish("offline"); }
        setTimeout(sendNext, FIRST_INIT_DELAY_MS);
        return;
      }
      if (msg.type === "error") return finish("auth");
      const expected = ops[i] && OP_NAME[ops[i].type];
      if (msg.type === "wallet_update" && msg.op === expected) {
        applyWallet(msg.wallet);
        results.push({ ok: true, update: msg });
      } else if (msg.type === "wallet_error" && msg.op === expected) {
        results.push({ ok: false, code: msg.code });
      } else {
        return;
      }
      i += 1;
      sendNext();
    };
  });
}

/** Saison terminée selon le portefeuille (horloge du téléphone : le serveur
 *  revalide avec la sienne). */
function seasonDue(): boolean {
  const s = useStore.getState().player.season;
  return !!s && Date.now() >= s.startedAt + SEASON_DURATION_MS;
}

/** Une session complète : init, réclamations en attente, saison, puis `op`.
 *  Renvoie le résultat de `op` (ou de l'init si `op` est absent). */
function run(op?: WalletRequest): Promise<WalletResult> {
  return serial(async () => {
    const player = useStore.getState().player;
    const firstInit = !player.walletActive;
    const queued = pending();
    const ops: WalletRequest[] = [{ type: "wallet_init" }];
    if (!firstInit) {
      if (queued.cpu.length) {
        ops.push({ type: "claim_cpu_rewards", rewards: queued.cpu.map((c) => ({ mode: c.mode, outcome: c.outcome })) });
      }
      if (queued.unlocks.length) ops.push({ type: "claim_unlocks", card_ids: queued.unlocks });
      if (seasonDue()) ops.push({ type: "claim_season" });
    }
    const opIndex = op ? ops.push(op) - 1 : 0;
    const lpBefore = player.rankLp;

    const { results, error } = await session(ops, firstInit);

    // Toute réclamation qui a reçu une réponse (acceptée OU refusée) sort de la
    // file ; celles restées sans réponse (coupure) sont rejouées plus tard.
    const answered = (type: WalletRequest["type"]) => {
      const k = ops.findIndex((o) => o.type === type);
      return k >= 0 && k < results.length ? results[k] : undefined;
    };
    if (!firstInit) {
      const cur = pending();
      const sentCpu = new Set(queued.cpu.map((c) => c.id));
      setPending({
        cpu: answered("claim_cpu_rewards") ? cur.cpu.filter((c) => !sentCpu.has(c.id)) : cur.cpu,
        unlocks: answered("claim_unlocks") ? cur.unlocks.filter((u) => !queued.unlocks.includes(u)) : cur.unlocks,
      });
      const season = answered("claim_season");
      if (season?.ok) applySeasonRollover(lpBefore, season.update);
    }
    return results[opIndex] ?? { ok: false, code: error ?? "timeout" };
  });
}

/** Saison validée par le serveur : soft reset du LP local + écran de fin de
 *  saison (App.tsx lit `seasonRollover`). */
function applySeasonRollover(lpBefore: number, u: WalletUpdate): void {
  const lpAfter = softResetLp(lpBefore);
  const tier = seasonRewardForLp(lpBefore);
  const store = useStore.getState();
  store.applyServerSync({ rankLp: lpAfter });
  store.setSeasonRollover({
    fromSeason: u.wallet.seasonNumber - 1,
    reward: { ...tier, eclats: u.eclats ?? tier.eclats, dust: u.dust ?? tier.dust },
    lpBefore,
    lpAfter,
  });
}

/* ───────────────────────── API publique ───────────────────────── */

export const walletOpenPack = () => run({ type: "open_pack" });
export const walletCraft = (cardId: string) => run({ type: "craft_card", card_id: cardId });
export const walletBuyPremiumSet = (setId: string) => run({ type: "buy_premium_set", set_id: setId });
export const walletClaimCodex = (threshold: number) => run({ type: "claim_codex", threshold });

/** Synchronise le portefeuille (init + réclamations en attente). Silencieux. */
export function flushWallet(): Promise<WalletResult> {
  return run();
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Regroupe les réclamations d'une fin de match en un seul passage serveur. */
function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWallet();
  }, 1_500);
}

/** Gains de matchs EN LIGNE crédités par le serveur : ils arrivent sur la
 *  socket du match (`op: "match_reward"`). À appeler une fois au démarrage. */
export function startWalletListener(): void {
  addGlobalListener((msg) => {
    if (msg.type === "wallet_update" && msg.op === "match_reward") applyWallet(msg.wallet);
  });
}

/** Clé i18n du message d'erreur (codes stables du serveur + erreurs réseau). */
export function walletErrorKey(code: string): string {
  switch (code) {
    case "offline":
    case "timeout":
      return "wallet.err.offline";
    case "insufficient_funds":
      return "wallet.err.funds";
    case "already_owned":
      return "wallet.err.owned";
    case "already_claimed":
      return "wallet.err.claimed";
    case "not_eligible":
      return "wallet.err.notEligible";
    case "auth":
    case "auth_needed":
      return "wallet.err.auth";
    default:
      return "wallet.err.generic";
  }
}
