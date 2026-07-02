import { CARDS } from "../../ranked/cards";
import type { CardId } from "../../ranked/rankedTypes";
import { alog } from "../arenaLog";
import { truncateIntentByCaps } from "../arenaRules";
import { removeSpentCardsDetailed } from "../arenaDecks";
import type { BoardState, Side, TurnIntent } from "../arenaTypes";

/**
 * prepareResolveStart — pré-calcul PUR exécuté avant runResolverFlow.
 *
 * Tronque les intents aux caps, retire les cartes dépensées de la main, exile
 * les légendaires jouées (1 usage/partie) et défausse le reste, puis construit
 * le startBoard. Aucun état / setter / timing — extrait de
 * ArenaGame.handleLockTurn pour tenir l'orchestrateur sous le plafond. Le FLUX
 * de résolution (runResolverFlow + FX) reste dans l'orchestrateur.
 *
 * Pre-clean hands so spell cards leave hand BEFORE the spells step shows.
 * Les cartes jouées vont à la DÉFAUSSE (Alex 2026-06-11) → drawCards les
 * reshuffle quand le deck se vide → le deck cycle, plus de pénurie sèche.
 * Tronquer AUX CAPS avant de retirer les cartes (Alex 2026-06-12 :
 * "applications noyées / mélangées"). Bug racine : on retirait de la main
 * TOUTES les cartes de l'intent, mais la résolution tronquait au cap →
 * une carte au-delà du cap quittait la main SANS effet = carte brûlée
 * (vu en live : consumed=[oracle,second-wind] mais "truncated to 1").
 * En tronquant AVANT, on retire EXACTEMENT ce qui sera appliqué :
 * consommé == appliqué, invariant garanti. (cpuIntent est déjà tronqué
 * par l'IA ; re-tronquer est idempotent.)
 */
// `intent`/`cpuIntent` sont en PERSPECTIVE (moi / adversaire). `mySide` (défaut
// "a") replace chaque intent sur le BON camp canonique : mon intent retire mes
// cartes de board[mySide], l'adversaire de board[oppSide]. Défaut "a" → moi=a,
// opp=b = comportement inchangé ; en online camp B, moi=b. Le startBoard reste
// CANONIQUE (les deux clients calculent le même). `spentA`/`spentB` = dépensé
// par MOI / l'ADVERSAIRE (perspective, pour la télémétrie locale).
export function prepareResolveStart(board: BoardState, intent: TurnIntent, cpuIntent: TurnIntent, mySide: Side = "a"): {
  startBoard: BoardState;
  safeIntent: TurnIntent;
  safeCpuIntent: TurnIntent;
  spentA: CardId[]; // vraies cartes dépensées ce tour (télémétrie Watcher, observationnel)
  spentB: CardId[];
} {
  const oppSide: Side = mySide === "a" ? "b" : "a";
  const safeIntent = truncateIntentByCaps(intent);
  const safeCpuIntent = truncateIntentByCaps(cpuIntent);
  const aSpent = removeSpentCardsDetailed(board[mySide].hand, safeIntent);
  const bSpent = removeSpentCardsDetailed(board[oppSide].hand, safeCpuIntent);
  // ÉCONOMIE expert (Alex 2026-06-13) : les LÉGENDAIRES jouées sont EXILÉES
  // (jamais reshufflées → 1 usage/partie, elles redeviennent des MOMENTS).
  // Idem les cartes de FUSION (Alex 2026-06-16) : forgées en partie, jouées
  // une fois puis exilées — il faut re-forger la recette pour les rejouer.
  // Sinon elles recyclaient via la défausse et réapparaissaient chaque tour
  // (kind:"fusion" est déjà exclu des decks/draft, cf. isDeckable).
  // Le reste recycle via la défausse comme avant. L'exil sanctionne le CAST
  // — une légendaire défaussée sans être jouée (Juge) recycle normalement.
  const isOneShot = (c: CardId) => CARDS[c]?.rarity === "legendary" || CARDS[c]?.kind === "fusion";
  const splitSpent = (spent: CardId[]) => ({
    toDiscard: spent.filter((c) => !isOneShot(c)),
    toExile: spent.filter((c) => isOneShot(c)),
  });
  const aSplit = splitSpent(aSpent.spent);
  const bSplit = splitSpent(bSpent.spent);
  if (aSplit.toExile.length > 0) alog("hand", `a EXIL [${aSplit.toExile.join(",")}] (légendaire/fusion, 1 usage par partie)`);
  if (bSplit.toExile.length > 0) alog("hand", `b EXIL [${bSplit.toExile.join(",")}] (légendaire/fusion, 1 usage par partie)`);
  const startBoard: BoardState = {
    ...board,
    [mySide]: { ...board[mySide], hand: aSpent.hand, discard: [...board[mySide].discard, ...aSplit.toDiscard], exiled: [...board[mySide].exiled, ...aSplit.toExile] },
    [oppSide]: { ...board[oppSide], hand: bSpent.hand, discard: [...board[oppSide].discard, ...bSplit.toDiscard], exiled: [...board[oppSide].exiled, ...bSplit.toExile] },
  };
  return { startBoard, safeIntent, safeCpuIntent, spentA: aSpent.spent, spentB: bSpent.spent };
}
