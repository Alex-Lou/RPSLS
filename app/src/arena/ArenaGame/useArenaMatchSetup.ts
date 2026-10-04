/**
 * useArenaMatchSetup — mise en place d'une partie Arena (extrait d'ArenaGame,
 * cap <400 lignes/fichier) : deck/Voie du joueur, Voie + persona CPU, paire de
 * PRNG seedés, reset du log, board CANONIQUE initial et états du mulligan T1.
 * Hooks appelés dans le MÊME ordre qu'avant (en tête d'ArenaGame).
 */

import { useRef, useState } from "react";
import { useStore } from "../../store/store";
import { CARDS } from "../../ranked/cards";
import { useT } from "../../i18n";
import type { CardId } from "../../ranked/rankedTypes";
import type { Move } from "../../engine/game";
import { arenaLogReset } from "../arenaLog";
import { makeInitialBoard } from "../arenaRules";
import { CPU_PERSONAS, type BoardState, type Side } from "../arenaTypes";
import { makeRngPair, randomSeed, type RngPair } from "../../engine/rng";
import type { ArenaOnlineDriver } from "../arenaOnlineDriver";
import { buildCpuDeckMirroring, buildPlayerDeck, resolveArenaDeckSource } from "../arenaDecks";
import { useMatchSurface } from "../../fx/menuFx";
import { makeTutorialBoard, tutorialRngPair } from "../tutorial/tutorialScript";
import { useLazyRef } from "./arenaGameUtils";

export function useArenaMatchSetup(
  online: ArenaOnlineDriver | undefined,
  tutorial: { onPlayReal: () => void; onReplay: () => void } | undefined,
) {
  useMatchSurface();
  const player = useStore((s) => s.player);
  const difficulty = player.difficulty ?? "normal";
  const recordArenaMatch = useStore((s) => s.recordArenaMatch);

  // Player deck — filter out cards we haven't adapted to Arena yet so the
  // hand never contains a no-op card. Falls back to a curated default if
  // the saved deck has too few supported cards. Saved deck is `string[]` in
  // the store; we re-narrow to CardId by filtering against the registry.
  const playerDeck = useLazyRef<CardId[]>(() => buildPlayerDeck(
    // Source résolue PAR VOIE (Alex 2026-06-22) : deck CUSTOM édité de la Voie >
    // deck SIGNATURE curé > deck arène libre (fallback rankedDeck, migration douce).
    resolveArenaDeckSource(
      player.arenaAffinity, player.arenaDeckByVoie, player.arenaDeck ?? player.rankedDeck,
    ).filter(
      (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
    ),
    player.arenaAffinity, // orienté Voie (Phase B) : priorise tes signatures, exclut les autres Voies
  ));
  // Constellation Pro v2 Couche 1 — Affinité du joueur passée au moteur.
  // Le CPU prend une Affinité ALÉATOIRE à chaque match (Constellation 3⭐
  // s'allume aussi côté opp) — pas d'adaptive selon le joueur pour garder une
  // part d'imprévisibilité, MAIS jamais la même Voie que le joueur (Alex
  // 2026-06-16 anti-miroir : éviter le plateau « dupliqué » 3 pierres vs
  // 3 pierres). Re-tiré à chaque remount (rematch via ArenaPage) ; le
  // soft-reset local réutilise la valeur, déjà ≠ joueur.
  const playerAffinity = useRef(player.arenaAffinity);
  const cpuAffinity = useLazyRef<Move>(
    () => {
      const pool = (["rock", "paper", "scissors", "lizard", "spock"] as const).filter(
        (m) => m !== player.arenaAffinity,
      );
      return pool[Math.floor(Math.random() * pool.length)];
    },
  );
  // Persona CPU random au match start (Alex 2026-06-11). Reste constante tout
  // le match pour que le feeling de l'opp soit cohérent.
  const cpuPersona = useLazyRef(() => CPU_PERSONAS[Math.floor(Math.random() * CPU_PERSONAS.length)]);
  // Phase 0 lockstep (Pro online, 2026-07) — paire de PRNG seedés, UN PAR CAMP
  // (a=joueur, b=CPU), consommée par TOUTE la résolution (init deck, sorts à
  // hasard, pioches). vs-CPU : graine aléatoire par match → même feeling
  // qu'avant, mais partie REPRODUCTIBLE (replay/debug). Online : la graine
  // viendra du shared_seed serveur → les 2 clients rejouent la même partie.
  // Re-tirée au soft-reset rematch (chaque match = sa graine).
  // Online : graine PARTAGÉE du serveur (les 2 clients rejouent la même partie).
  // Local : graine aléatoire par match (feeling inchangé, partie reproductible).
  const rngPair = useLazyRef<RngPair>(() => online?.rngPair ?? (tutorial ? tutorialRngPair() : makeRngPair(randomSeed())));

  // Wipe the log buffer at match start so each match has a clean diagnostic
  // history (Alex flag : "tu pers tout finalement"). Called once at mount.
  const logResetRef = useRef(false);
  if (!logResetRef.current) {
    arenaLogReset();
    logResetRef.current = true;
  }

  const t = useT();
  // Nom "vulgarisé" d'une carte pour les logs (Alex 2026-06-12 : "détails
  // vulgarisés pour dire pourquoi xxx ne peut pas faire yyy"). Retombe sur
  // l'id si la clé i18n manque.
  const cardFr = (id: CardId) => t(CARDS[id]?.nameKey ?? "") || id;

  // Camp CANONIQUE du joueur local. Local vs-CPU : "a" (l'adversaire CPU = "b").
  // Online : `online.mySide` (le serveur assigne A/B). Le board reste CANONIQUE
  // (a=A, b=B) — `mySide` ne pilote QUE la PERSPECTIVE (rendu/intent/télémétrie/
  // victoire), jamais l'état résolu : les deux clients calculent le MÊME board
  // (le résolveur départage a-avant-b).
  const mySide: Side = online?.mySide ?? "a";
  const oppSide: Side = mySide === "a" ? "b" : "a";

  const [board, setBoard] = useState<BoardState>(() => {
    if (tutorial) return makeTutorialBoard(rngPair.current);
    // Deck/Voie de l'ADVERSAIRE : online = les VRAIS (échangés au handshake) ;
    // local = deck CPU miroir + Voie aléatoire. On place MON deck sur mySide et
    // celui de l'adversaire sur oppSide → board CANONIQUE identique des 2 côtés.
    const myDeck = playerDeck.current;
    const myAff = playerAffinity.current;
    const oppDeckResolved = online?.oppDeck ?? buildCpuDeckMirroring(myDeck, cpuAffinity.current);
    const oppAff = online?.oppAffinity ?? cpuAffinity.current;
    const deckA = mySide === "a" ? myDeck : oppDeckResolved;
    const deckB = mySide === "a" ? oppDeckResolved : myDeck;
    const affA = mySide === "a" ? myAff : oppAff;
    const affB = mySide === "a" ? oppAff : myAff;
    // Persona = tempérament de l'IA (cosmétique) — inutile en online (adversaire humain).
    const personaB = online ? undefined : cpuPersona.current;
    return makeInitialBoard(deckA, deckB, affA, affB, personaB, rngPair.current);
  });

  // ── MULLIGAN T1 (Alex 2026-06-13 économie expert) ──
  // Une fois par match : remplace jusqu'à 2 cartes de la main de départ.
  // Le CPU mulligan EN MÊME TEMPS (heuristique : il rend ses cartes chères
  // surnuméraires) pour l'équité. "Garder tout" laisse aussi le CPU décider.
  // Online v1 : PAS de mulligan (le mulligan par-tap ne se relaie pas à
  // l'identique ; les mains de départ sont déjà déterministes et identiques des
  // deux côtés). À câbler en relayé plus tard. Local : mulligan T1 normal.
  const [mulliganOpen, setMulliganOpen] = useState(!online && !tutorial);
  // Échanges restants (départ 2). Modèle IMMÉDIAT : chaque rejet remplace EN
  // PLACE (cf. ArenaMulligan) → plus de sélection multi-index.
  const [mulliganSwapsLeft, setMulliganSwapsLeft] = useState(2);
  return {
    player, difficulty, recordArenaMatch, playerDeck, playerAffinity, cpuAffinity, cpuPersona, rngPair,
    t, cardFr, mySide, oppSide, board, setBoard,
    mulliganOpen, setMulliganOpen, mulliganSwapsLeft, setMulliganSwapsLeft,
  };
}
