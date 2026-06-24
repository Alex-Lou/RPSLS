/**
 * arenaPlanDrag — hit-test du DRAG/DROP de la phase de plan (logique pure,
 * séparée de la vue ArenaPlanPhase, Alex 2026-06-22 « au fil de l'eau »).
 *
 * Trouve l'ArenaLaneSlot sous un point écran et commit le `targeting` actif sur
 * ce slot si valide. Utilisé par le drag du picker RPSLS ET des cartes en main.
 * Retourne true si quelque chose a été commit (le drag est « consommé »), false
 * sinon → l'appelant laisse le targeting actif pour le tap-fallback. Corps
 * VERBATIM de l'ancien closure ; les dépendances closurées sont passées en `deps`.
 */

import { hapticTap } from "../../haptic";
import { LANE_SPELL_TARGET_SIDE } from "../arenaTypes";
import type {
  ArenaTargeting,
  BoardState,
  LaneIndex,
  PlayedSpell,
  PlannedSummon,
} from "../arenaTypes";

export interface PlanDragDeps {
  board: BoardState;
  onAddSummon: (summon: PlannedSummon) => void;
  onAddSpell: (spell: PlayedSpell) => void;
  setTargeting: (t: ArenaTargeting) => void;
  onForgeTap?: () => void;
}

export function commitDragDrop(
  point: { x: number; y: number },
  current: ArenaTargeting,
  deps: PlanDragDeps,
): boolean {
  const { board, onAddSummon, onAddSpell, setTargeting, onForgeTap } = deps;
  if (!current) return false;
  if (typeof document === "undefined") return false;
  const els = document.elementsFromPoint(point.x, point.y);
  for (const el of els) {
    const slot = (el as HTMLElement).closest?.("[data-arena-lane]");
    if (!slot) continue;
    const laneStr = (slot as HTMLElement).dataset?.arenaLane;
    const sideStr = (slot as HTMLElement).dataset?.arenaSide;
    if (laneStr == null || sideStr == null) continue;
    const lane = parseInt(laneStr, 10) as LaneIndex;
    const side = sideStr as "a" | "b";
    // Summon: only on MY (a) empty lanes.
    if (current.kind === "summon") {
      if (side !== "a") return false;
      const mine = board.lanes[lane].a;
      if (mine) return false;
      hapticTap();
      onAddSummon({ lane, move: current.move });
      setTargeting(null);
      return true;
    }
    // Spell lane-target: respect LANE_SPELL_TARGET_SIDE.
    if (current.kind === "spell" && current.targetKind === "lane") {
      const want = LANE_SPELL_TARGET_SIDE[current.id] ?? "my-creature";
      const mine = board.lanes[lane].a;
      const opp = board.lanes[lane].b;
      const ok =
        (want === "my-creature" && side === "a" && !!mine) ||
        (want === "opp-creature" && side === "b" && !!opp) ||
        (want === "my-empty-opp-occupied" && side === "a" && !mine && !!opp) ||
        (want === "my-empty" && side === "a" && !mine);
      if (!ok) return false;
      hapticTap();
      onAddSpell({ id: current.id, kind: "lane", lane });
      setTargeting(null);
      return true;
    }
  }
  // FORGE — drop d'une CARTE (spell) près de TA forge = dépôt / fusion.
  // (Alex 2026-06-13 : « le drag jusqu'à la case de fusion ne marche pas ».)
  // Avant : la forge n'était PAS une cible de drop → le geste échouait
  // toujours. On teste la proximité de la boîte forge (pad généreux ~26px)
  // pour une cible facile à viser même petite. handleForgeTap lit le
  // targeting courant (= la carte glissée) → dépôt si vide, fusion si
  // partenaire, sinon log « ne fusionne pas ». Les invocations (kind summon)
  // ne vont jamais sur la forge.
  if (current.kind === "spell" && onForgeTap && typeof document !== "undefined") {
    const forgeEl = document.querySelector("[data-arena-forge='you']");
    if (forgeEl) {
      const r = forgeEl.getBoundingClientRect();
      const pad = 26;
      const near =
        point.x >= r.left - pad && point.x <= r.right + pad &&
        point.y >= r.top - pad && point.y <= r.bottom + pad;
      if (near) {
        hapticTap();
        onForgeTap();      // lit targeting = la carte glissée
        setTargeting(null);
        return true;
      }
    }
  }
  return false;
}
