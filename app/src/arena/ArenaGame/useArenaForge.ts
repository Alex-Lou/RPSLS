import { useState, type Dispatch, type SetStateAction } from "react";
import { hapticTap, hapticAlert } from "../../haptic";
import { CARDS } from "../../ranked/cards";
import type { CardId } from "../../ranked/rankedTypes";
import { findFusionResult } from "../arenaFusionCards";
import { alog } from "../arenaLog";
import {
  FORGE_RECOVER_COST,
  type ArenaTargeting,
  type BoardState,
  type TurnIntent,
} from "../arenaTypes";

/**
 * useArenaForge — ⚗️ FORGE (2026-06-13) : dépôt gratuit / fusion / reprise, au
 * TAP de la case Forge. Aucun tour perdu, aucun mana au dépôt : le coût se paie
 * au cast de la carte fusionnée. Extrait d'ArenaGame ; n'est PAS dans le chemin
 * de timing de la résolution de combat (qui reste dans l'orchestrateur).
 */
export function useArenaForge({
  board, setBoard, setIntent, targeting, setTargeting, resolving, cardFr,
}: {
  board: BoardState;
  setBoard: Dispatch<SetStateAction<BoardState>>;
  setIntent: Dispatch<SetStateAction<TurnIntent>>;
  targeting: ArenaTargeting;
  setTargeting: (t: ArenaTargeting) => void;
  resolving: boolean;
  cardFr: (id: CardId) => string;
}) {
  const [forgeFlash, setForgeFlash] = useState<number | null>(null);
  // Bump quand on RÉCUPÈRE la carte fusionnée → poussière d'or de rappel (anim
  // demandée par Alex 2026-06-13 « petite anim de particules au clic Récupérer »).
  const [forgeRecover, setForgeRecover] = useState<number | null>(null);

  // Helper PARTAGÉ (DRY) : dépose `id` sur la forge si vide, OU fusionne avec
  // la carte présente si une recette existe. Retire la carte de la MAIN.
  // Utilisé par le tap forge (carte armée) ET par le bouton ⚗ de la fiche
  // (carte explicite). Une seule source de vérité pour la mécanique.
  function depositOrFuse(id: CardId) {
    const forge = board.forgeA ?? null;
    if (!forge) {
      setBoard((cur) => {
        const i = cur.a.hand.indexOf(id);
        if (i < 0) return cur;
        const hand = [...cur.a.hand.slice(0, i), ...cur.a.hand.slice(i + 1)];
        alog("hand", `a FORGE dépôt : ${id}`);
        return { ...cur, a: { ...cur.a, hand }, forgeA: id };
      });
      hapticTap();
      return;
    }
    const result = findFusionResult(id, forge);
    if (result) {
      // La carte fusionnée RESTE sur la forge (Alex 2026-06-13) — le joueur la
      // RÉCUPÈRE au tap (« ✨ Récupérer »). S'il la laisse, elle reste exposée
      // → une carte « Pillage » adverse peut la voler. Risque/récompense.
      setBoard((cur) => {
        const i = cur.a.hand.indexOf(id);
        if (i < 0) return cur;
        const hand = [...cur.a.hand.slice(0, i), ...cur.a.hand.slice(i + 1)];
        alog("hand", `a FUSION ⚗️ : ${forge} + ${id} = ${result} (reste sur la forge → à récupérer)`);
        return { ...cur, a: { ...cur.a, hand }, forgeA: result };
      });
      setForgeFlash(Date.now());
      hapticTap();
      return;
    }
    alog("hand", `🚫 « ${cardFr(id)} » ne fusionne pas avec « ${cardFr(forge)} » — voir Règles ⚗️.`);
  }

  // Tap sur la forge : dépôt/fusion de la carte ARMÉE, sinon RÉCUP (coûte mana).
  function handleForgeTap() {
    if (resolving) return;
    if (targeting?.kind === "spell") {
      depositOrFuse(targeting.id);
      setTargeting(null);
      return;
    }
    const forge = board.forgeA ?? null;
    if (forge) {
      // RÉCUP : SEULE une carte FUSIONNÉE (le payoff, kind:"fusion") coûte
      // FORGE_RECOVER_COST mana (Alex 2026-06-13, option B « plus legit ») →
      // EMPÊCHEMENT (mana serré → fusion coincée sur la forge) + fenêtre de VOL
      // Razzia sur la vraie récompense. Reprendre un simple DÉPÔT (setup,
      // misclic) reste GRATUIT → la forge reste agréable à manipuler.
      const isFused = CARDS[forge]?.kind === "fusion";
      const cost = isFused ? FORGE_RECOVER_COST : 0;
      if (board.a.mana < cost) {
        alog("hand", `🚫 Récupérer « ${cardFr(forge)} » coûte ${cost} mana — pas assez. La fusion reste exposée (Razzia adverse peut la voler).`);
        hapticAlert();
        return;
      }
      setBoard((cur) => ({ ...cur, a: { ...cur.a, hand: [...cur.a.hand, forge], mana: cur.a.mana - cost }, forgeA: null }));
      alog("hand", `a FORGE récup : ${forge}${cost ? ` (−${cost} mana)` : " (gratuit)"}`);
      // Poussière d'or de rappel SEULEMENT pour la vraie carte FUSIONNÉE
      // (« ✨ Récupérer ») — une simple reprise de dépôt (setup/misclic) reste
      // silencieuse pour ne pas saturer le pad d'effets.
      if (isFused) setForgeRecover(Date.now());
      hapticTap();
    }
  }

  // Dépôt/fusion FIABLE d'une carte EXPLICITE (bouton ⚗ de la fiche) — marche
  // pour TOUT ciblage (les utilitaires qui s'auto-jouaient au tap passent
  // désormais par ici). Nettoie aussi un éventuel sort utilitaire déjà
  // planifié avec cette carte (anti double-dépense).
  function handleForgeDeposit(id: CardId) {
    if (resolving) return;
    setIntent((cur) => {
      const i = cur.spells.findIndex((s) => s.id === id && s.kind !== "lane");
      return i < 0 ? cur : { ...cur, spells: [...cur.spells.slice(0, i), ...cur.spells.slice(i + 1)] };
    });
    depositOrFuse(id);
    if (targeting?.kind === "spell" && targeting.id === id) setTargeting(null);
  }

  return { forgeFlash, forgeRecover, handleForgeTap, handleForgeDeposit };
}
