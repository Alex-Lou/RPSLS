/**
 * Utilitaires d'ArenaGame (extraits pour le cap <400 lignes/fichier) :
 * useLazyRef, durée du splash « match trouvé », heuristique mulligan CPU,
 * routage d'un tap de lane du board vers le ciblage actif.
 */

import { type MutableRefObject, useRef } from "react";
import { CARDS } from "../../ranked/cards";
import type { Dispatch, SetStateAction } from "react";
import { hapticTap } from "../../haptic";
import type { ArenaTargeting, HeroState, LaneIndex, PlayedSpell, TurnIntent } from "../arenaTypes";

/** useRef dont la valeur initiale n'est calculée QU'AU PREMIER rendu. Avec
 *  `useRef(expr)`, `expr` est réévaluée à chaque rendu puis jetée : ArenaGame
 *  se re-rend des dizaines de fois par tour (deck reconstruit, graines
 *  retirées… pour rien). */
const UNSET = Symbol("unset");
export function useLazyRef<T>(init: () => T): MutableRefObject<T> {
  const r = useRef<T | typeof UNSET>(UNSET);
  if (r.current === UNSET) r.current = init();
  return r as MutableRefObject<T>;
}

// Alex feedback 2026-06-09 point #7 : décompte+GO trop rapide. Bumpé de
// 1800 → 2600ms pour laisser le "GO!" durer un peu et faire monter le
// suspense (anim splash interne dure ~1.35s + 0.45s = ~1.8s, on garde
// 800ms de plus sur "GO!" final).
export const MATCH_FOUND_SPLASH_MS = 2_600;

/** Mulligan CPU (heuristique) — indices des cartes chères surnuméraires à rendre. */
export function cpuMulliganIndices(h: HeroState): number[] {
  // Garde 1 carte chère max en ouverture ; rend les suivantes (≤2).
  const idx: number[] = [];
  let expensive = 0;
  h.hand.forEach((c, i) => {
    if ((CARDS[c]?.cost ?? 0) >= 3) {
      expensive += 1;
      if (expensive > 1 && idx.length < 2) idx.push(i);
    }
  });
  return idx;
}

/** Corps de ArenaGame.handleBoardLaneTap — route un tap de lane du board vers
 *  le ciblage actif (invocation, ou sort de lane via addSpell). */
export function routeBoardLaneTap(
  lane: LaneIndex,
  targeting: ArenaTargeting,
  setIntent: Dispatch<SetStateAction<TurnIntent>>,
  setTargeting: Dispatch<SetStateAction<ArenaTargeting>>,
  addSpell: (spell: PlayedSpell) => void,
): void {
  if (!targeting) return;
  if (targeting.kind === "summon") {
    hapticTap();
    setIntent((cur) => ({
      ...cur,
      summons: [...cur.summons.filter((s) => s.lane !== lane), { lane, move: targeting.move }],
    }));
    setTargeting(null);
    return;
  }
  if (targeting.kind === "spell" && targeting.targetKind === "lane") {
    // Route through addSpell so the board lane-tap gets the SAME guards as
    // the hand flow: MAX_SPELLS cap, 1-card=1-cast (usageCount vs handCount),
    // aegis/anchor mutual exclusion, and the aegis 1×/match lock. Tapping a
    // lane used to setIntent directly, bypassing ALL of them — that's why the
    // same card (Aegis, Anchor) could be assigned twice (Alex). addSpell does
    // its own hapticTap and silently no-ops a rejected cast (card stays).
    addSpell({ id: targeting.id, kind: "lane", lane });
    setTargeting(null);
    return;
  }
}
