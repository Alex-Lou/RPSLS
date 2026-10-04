/**
 * playerStateMerge.ts — réconciliation PURE état local ↔ état serveur.
 *
 * Extrait verbatim de playerSync.ts (qui le réexporte) : fusion max/union
 * (`mergeServerState`), adoption du compte au login (`adoptServerState`) et
 * choix de stratégie (`applyAuthState`). Aucun accès au store ici.
 */

import type { BackgroundId, ByMoveStat, Difficulty, PadId, Player, ThemeId } from "../types";
import type { Move } from "../engine/game";
import { PAD_META } from "../types";
import { todayDateKey } from "../engine/daily";
import type { PlayerProgress } from "./onlineProtocol";
import { emptyByMove } from "../store/storeDefaults";
import { THEMES } from "../theme/theme";
import { BACKGROUNDS_BY_ID } from "../theme/themes";
import { isAvatarImage } from "../theme/avatar";

/** Champs d'éco tels que le serveur les détient (portefeuille). */
function ecoFromServer(server: PlayerProgress): Partial<Player> {
  return {
    eclats: server.eclats,
    dust: server.dust,
    stars: server.stars ?? 0,
    cardCollection: server.cardCollection ?? [],
    ownedPremiumSets: server.ownedPremiumSets ?? [],
    codexClaimed: server.codexClaimed ?? [],
    season: { number: server.seasonNumber || 1, startedAt: server.seasonStartedAt || Date.now() },
  };
}

/** Merge server state INTO local, taking the higher/newer value for each field.
 *  Returns the merged player patch to apply to the store. */
export function mergeServerState(
  local: Player,
  server: PlayerProgress,
): Partial<Player> {
  const patch: Partial<Player> = {};

  // Currencies + XP — take the max
  if (server.xp > (local.xp ?? 0)) patch.xp = server.xp;
  if (server.rankLp > (local.rankLp ?? 0)) patch.rankLp = server.rankLp;
  if (server.eclats > (local.eclats ?? 0)) patch.eclats = server.eclats;
  if (server.dust > (local.dust ?? 0)) patch.dust = server.dust;
  // Premium currency — take max (never lose paid ✦; same model as eclats/dust).
  if (server.stars != null && server.stars > (local.stars ?? 0)) patch.stars = server.stars;

  // Stats — take max per field
  const localStats = local.stats ?? { wins: 0, losses: 0, draws: 0, byMove: emptyByMove() };
  // byMove (progression quête pentagramme) — restauré du serveur, max par coup
  // et par compteur. Était perdu à chaque install propre → quête à refaire.
  const mergedByMove: Record<string, ByMoveStat> = { ...(localStats.byMove ?? {}) };
  let byMoveChanged = false;
  for (const [mv, s] of Object.entries(server.byMove ?? {})) {
    const cur = mergedByMove[mv] ?? { picked: 0, won: 0 };
    const picked = Math.max(cur.picked, s.picked ?? 0);
    const won = Math.max(cur.won, s.won ?? 0);
    if (picked !== cur.picked || won !== cur.won) {
      mergedByMove[mv] = { picked, won };
      byMoveChanged = true;
    }
  }
  if (server.wins > localStats.wins || server.losses > localStats.losses || server.draws > localStats.draws || byMoveChanged) {
    patch.stats = {
      ...localStats,
      wins: Math.max(localStats.wins, server.wins),
      losses: Math.max(localStats.losses, server.losses),
      draws: Math.max(localStats.draws, server.draws),
      byMove: mergedByMove as Record<Move, ByMoveStat>,
    };
  }

  // Card collection — union of both sets
  const localCards = new Set(local.cardCollection ?? []);
  const serverCards = server.cardCollection ?? [];
  let hasNewCards = false;
  for (const c of serverCards) {
    if (!localCards.has(c)) {
      localCards.add(c);
      hasNewCards = true;
    }
  }
  if (hasNewCards) patch.cardCollection = Array.from(localCards);

  // Card mastery — take max per card
  const localMastery = { ...(local.cardMastery ?? {}) };
  const serverMastery = server.cardMastery ?? {};
  let masteryChanged = false;
  for (const [card, xp] of Object.entries(serverMastery)) {
    if (xp > (localMastery[card] ?? 0)) {
      localMastery[card] = xp;
      masteryChanged = true;
    }
  }
  if (masteryChanged) patch.cardMastery = localMastery;

  // Codex claimed — union
  const localCodex = new Set(local.codexClaimed ?? []);
  const serverCodex = server.codexClaimed ?? [];
  let codexChanged = false;
  for (const t of serverCodex) {
    if (!localCodex.has(t)) {
      localCodex.add(t);
      codexChanged = true;
    }
  }
  if (codexChanged) patch.codexClaimed = Array.from(localCodex);

  // Claimed quests — union (a one-time reward stays claimed across devices, and
  // can't be re-collected after a reinstall).
  const localQuests = new Set(local.claimedQuests ?? []);
  const serverQuests = server.claimedQuests ?? [];
  let questsChanged = false;
  for (const q of serverQuests) {
    if (!localQuests.has(q)) { localQuests.add(q); questsChanged = true; }
  }
  if (questsChanged) patch.claimedQuests = Array.from(localQuests);

  // Défis du jour réclamés — restaure l'état "réclamé" d'AUJOURD'HUI (scopé au
  // jour). Sans ça, après un réinstall les défis repartaient "à réclamer" alors
  // que la récompense XP avait persisté = re-réclamation (farm). Restore-only :
  // serveur=aujourd'hui & local≠aujourd'hui → adopte ; les deux aujourd'hui →
  // union des ids ; serveur périmé (autre jour) → ignore (défis du jour neufs).
  const today = todayDateKey();
  const srvDaily = server.dailyClaims;
  if (srvDaily && srvDaily.date === today) {
    const locDaily = local.dailyClaims;
    if (!locDaily || locDaily.date !== today) {
      patch.dailyClaims = { date: today, ids: [...(srvDaily.ids ?? [])] };
    } else {
      const union = new Set([...(locDaily.ids ?? []), ...(srvDaily.ids ?? [])]);
      if (union.size > (locDaily.ids ?? []).length) {
        patch.dailyClaims = { date: today, ids: Array.from(union) };
      }
    }
  }

  // Jours complétés — union (monotone, jamais perdu).
  const localCompleted = new Set(local.completedDailies ?? []);
  let completedChanged = false;
  for (const d of server.completedDailies ?? []) {
    if (!localCompleted.has(d)) { localCompleted.add(d); completedChanged = true; }
  }
  if (completedChanged) patch.completedDailies = Array.from(localCompleted);

  // Voie Constellation Pro — adopte celle du serveur si le local n'en a pas.
  if (server.arenaAffinity && !local.arenaAffinity) {
    patch.arenaAffinity = server.arenaAffinity as Move;
  }

  // Abandons (pénalité forfait, fenêtre glissante 24h) — max(count) + max(lastAt).
  // Restaure le compteur après un réinstall (anti-reset) SANS jamais sur-pénaliser :
  // le count retenu ne dépasse aucune source, et un lastAt vieux de >24h vieillit
  // à 0 à la lecture (activeAbandonCount). Cf. match/forfeit.ts.
  const srvAb = server.abandons;
  if (srvAb) {
    const count = Math.max(local.abandons?.count ?? 0, srvAb.count ?? 0);
    const lastAt = Math.max(local.abandons?.lastAt ?? 0, srvAb.lastAt ?? 0);
    if (count !== (local.abandons?.count ?? 0) || lastAt !== (local.abandons?.lastAt ?? 0)) {
      patch.abandons = { count, lastAt };
    }
  }

  // Decks (Classé + Pro) — restaurés du cloud quand le profil LOCAL est FRAIS
  // (`!local.syncedAt` = jamais sync sur cette install = neuve/wipée) OU vide.
  // 🔴 BUG Alex 2026-06-13 (« je vois mon ancien deck, pas le nouveau ») : avant,
  // on ne restaurait QUE si le deck local était VIDE — or après un wipe
  // localStorage (chaque réinstall d'APK), le deck local est le DÉFAUT (10
  // cartes, NON vide) → le deck sauvegardé au cloud n'était JAMAIS restauré, le
  // joueur retombait sur le deck par défaut. La porte « fraîche » corrige ça.
  // Dès qu'un deck est édité localement (syncedAt posé au 1er push), le LOCAL
  // gagne et est poussé — on n'écrase jamais un choix actif.
  const freshInstall = !local.syncedAt;
  if (server.rankedDeck?.length > 0 && (freshInstall || !local.rankedDeck || local.rankedDeck.length === 0)) {
    patch.rankedDeck = server.rankedDeck;
  }
  if (server.arenaDeck && server.arenaDeck.length > 0 && (freshInstall || !local.arenaDeck || local.arenaDeck.length === 0)) {
    patch.arenaDeck = server.arenaDeck;
  }

  // Owned premium sets — UNION (paid content only ever grows; never lost on a
  // reinstall or a device with a stale copy). Same durability model as cards.
  const localSets = new Set(local.ownedPremiumSets ?? []);
  const serverSets = server.ownedPremiumSets ?? [];
  let setsChanged = false;
  for (const s of serverSets) {
    if (!localSets.has(s)) { localSets.add(s); setsChanged = true; }
  }
  if (setsChanged) patch.ownedPremiumSets = Array.from(localSets);

  // Season — take higher number
  const localSeason = local.season ?? { number: 1, startedAt: Date.now() };
  if (server.seasonNumber > localSeason.number) {
    patch.season = { number: server.seasonNumber, startedAt: server.seasonStartedAt };
  }

  // Win streak — take max
  if (server.winStreak > (local.winStreak ?? 0)) {
    patch.winStreak = server.winStreak;
  }

  // Classé own ladder — take max (same model as rankLp: the saved cloud value
  // seeds a fresh/wiped install and never silently loses rank). Optional on the
  // wire, so guard against an older server build that omits it.
  if (server.classeLp != null && server.classeLp > (local.classeLp ?? 1000)) {
    patch.classeLp = server.classeLp;
  }
  // Classé record — W/L/D are monotonic, so max-per-field is correct (same as
  // the global stats merge above).
  const localCs = local.classeStats ?? { wins: 0, losses: 0, draws: 0 };
  const sW = server.classeWins ?? 0, sL = server.classeLosses ?? 0, sD = server.classeDraws ?? 0;
  if (sW > localCs.wins || sL > localCs.losses || sD > localCs.draws) {
    patch.classeStats = {
      wins: Math.max(localCs.wins, sW),
      losses: Math.max(localCs.losses, sL),
      draws: Math.max(localCs.draws, sD),
    };
  }

  // Arena (Constellation Pro) record — same monotonic max-per-field merge.
  const localAs = local.arenaStats ?? { wins: 0, losses: 0, draws: 0 };
  const aW = server.arenaWins ?? 0, aL = server.arenaLosses ?? 0, aD = server.arenaDraws ?? 0;
  if (aW > localAs.wins || aL > localAs.losses || aD > localAs.draws) {
    patch.arenaStats = {
      wins: Math.max(localAs.wins, aW),
      losses: Math.max(localAs.losses, aL),
      draws: Math.max(localAs.draws, aD),
    };
  }

  // Cosmetics — the LOCAL choice is the stable source of truth on every boot.
  // The server copy is a BACKUP that only seeds a fresh/wiped install — it must
  // NEVER override a look the player already has locally, otherwise the theme
  // visibly flickers at launch (local hydrate → server overwrite a few seconds
  // later when bootSync lands). Previously this adopted the server look whenever
  // server.updatedAt > local.syncedAt, which fired on essentially every boot.
  //
  // Rule: adopt the server look ONLY when the local profile is "vierge" — i.e.
  // the player has no explicit background chosen (default / unset). That's the
  // reinstall-recovery case. Once a background is chosen locally, the entire
  // local look wins and is pushed up; the player keeps that choice every launch
  // until THEY change it. (Avatar/nickname follow the same vierge gate.)
  const localHasChosen =
    !!local.backgroundId && local.backgroundId !== "default";
  if (!localHasChosen && (server.updatedAt ?? 0) > 0) {
    if (server.themeId && server.themeId in THEMES) patch.themeId = server.themeId as ThemeId;
    if (server.backgroundId && server.backgroundId in BACKGROUNDS_BY_ID) patch.backgroundId = server.backgroundId as BackgroundId;
    if (server.padId && server.padId in PAD_META) patch.padId = server.padId as PadId;
    if (server.avatar && isAvatarImage(server.avatar)) patch.avatar = server.avatar;
    if (server.nickname && server.nickname.trim().length > 0) patch.nickname = server.nickname.slice(0, 24);
    // Gameplay / accessibility prefs — same reinstall-recovery gate. Only adopt
    // values that are actually set & valid (server sends "" / 0 when unset).
    if (server.difficulty && ["easy", "normal", "hard"].includes(server.difficulty)) {
      patch.difficulty = server.difficulty as Difficulty;
    }
    if (server.fontScale && server.fontScale >= 1) patch.fontScale = server.fontScale;
    if (server.padChosen) patch.padChosen = true;
  }

  // Économie serveur-autoritaire (§9-B) : portefeuille actif → le serveur GAGNE
  // sur l'éco, valeur exacte (fini le max/union, qui rendait toute triche
  // locale permanente). `state_loaded` porte le portefeuille (cf. wallet.ts).
  if (local.walletActive) Object.assign(patch, ecoFromServer(server));

  return patch;
}

/** ADOPT the account's saved state wholesale (replacement), used on LOGIN.
 *
 *  Unlike `mergeServerState` (max/union), this OVERWRITES every progression-
 *  bearing field with the account's value — even when it's lower than the local
 *  guest's. That's the point: logging into an account is switching to a DISTINCT
 *  identity, so the guest's currencies / cards / premium sets must NOT bleed in
 *  (and then get pushed back to the server under the account's id). Without this
 *  replacement, a guest with forged or just-higher balances would launder them
 *  into any account they log into. Decks/cosmetics are adopted only when the
 *  account actually has them set (a brand-new account keeps this device's
 *  sensible defaults rather than an empty deck that can't start a match). */
function adoptServerState(server: PlayerProgress): Partial<Player> {
  const patch: Partial<Player> = {
    xp: server.xp,
    rankLp: server.rankLp,
    eclats: server.eclats,
    dust: server.dust,
    stars: server.stars ?? 0,
    // Adopte les W/L/D + le byMove DU COMPTE. byMove est désormais synchronisé
    // (réparé 2026-06-14), donc on adopte la progression pentagramme du compte
    // (overlay sur emptyByMove pour garantir les 5 coups). On n'hérite PAS du
    // byMove invité → pas de blanchiment de la quête pentagramme vers le compte.
    stats: {
      wins: server.wins,
      losses: server.losses,
      draws: server.draws,
      byMove: { ...emptyByMove(), ...(server.byMove ?? {}) } as Record<Move, ByMoveStat>,
    },
    cardCollection: server.cardCollection ?? [],
    cardMastery: server.cardMastery ?? {},
    codexClaimed: server.codexClaimed ?? [],
    claimedQuests: server.claimedQuests ?? [],
    ownedPremiumSets: server.ownedPremiumSets ?? [],
    season: {
      number: server.seasonNumber || 1,
      startedAt: server.seasonStartedAt || Date.now(),
    },
    winStreak: server.winStreak ?? 0,
    classeLp: server.classeLp ?? 1000,
    classeStats: {
      wins: server.classeWins ?? 0,
      losses: server.classeLosses ?? 0,
      draws: server.classeDraws ?? 0,
    },
    arenaStats: {
      wins: server.arenaWins ?? 0,
      losses: server.arenaLosses ?? 0,
      draws: server.arenaDraws ?? 0,
    },
    // Mark this install as synced to the account so the fresh-install restore
    // gates in mergeServerState don't re-fire on the next boot.
    syncedAt: server.updatedAt || Date.now(),
    // Autre identité → autre portefeuille : la prochaine session serveur
    // (re)confirme le sien ; les réclamations de l'invité ne passent pas au compte.
    walletActive: false,
    pendingEco: { cpu: [], unlocks: [] },
  };
  // Loadout + look: adopt only when the account has a real value.
  if (server.rankedDeck && server.rankedDeck.length > 0) patch.rankedDeck = server.rankedDeck;
  if (server.arenaDeck && server.arenaDeck.length > 0) patch.arenaDeck = server.arenaDeck;
  if (server.themeId && server.themeId in THEMES) patch.themeId = server.themeId as ThemeId;
  if (server.backgroundId && server.backgroundId in BACKGROUNDS_BY_ID) {
    patch.backgroundId = server.backgroundId as BackgroundId;
  }
  if (server.padId && server.padId in PAD_META) patch.padId = server.padId as PadId;
  if (server.avatar && isAvatarImage(server.avatar)) patch.avatar = server.avatar;
  if (server.nickname && server.nickname.trim().length > 0) patch.nickname = server.nickname.slice(0, 24);
  if (server.difficulty && ["easy", "normal", "hard"].includes(server.difficulty)) {
    patch.difficulty = server.difficulty as Difficulty;
  }
  if (server.fontScale && server.fontScale >= 1) patch.fontScale = server.fontScale;
  if (server.padChosen) patch.padChosen = true;
  // Défis du jour / Voie du COMPTE (réparé 2026-06-14) — adoptés comme le reste.
  patch.completedDailies = server.completedDailies ?? [];
  const todayAdopt = todayDateKey();
  if (server.dailyClaims && server.dailyClaims.date === todayAdopt) {
    patch.dailyClaims = { date: todayAdopt, ids: [...(server.dailyClaims.ids ?? [])] };
  }
  if (server.arenaAffinity) patch.arenaAffinity = server.arenaAffinity as Move;
  if (server.abandons) {
    patch.abandons = { count: server.abandons.count ?? 0, lastAt: server.abandons.lastAt ?? 0 };
  }
  return patch;
}

/** Build the patch to apply on a successful auth, by STRATEGY:
 *
 *  - "merge": union/max — never lose anything local. Used when the guest BECOMES
 *    the account (e-mail signup; Google first-link, where the server binds the
 *    guest's own pid so the merge preserves unsynced local progress).
 *  - "adopt": replace progression with the account's. Used for an e-mail LOGIN —
 *    switching to a DISTINCT identity, so the guest's balances can't launder into
 *    the account (and get pushed back under the account's id).  */
export function applyAuthState(
  local: Player,
  server: PlayerProgress,
  strategy: "merge" | "adopt",
): Partial<Player> {
  return strategy === "adopt"
    ? adoptServerState(server)
    : mergeServerState(local, server);
}
