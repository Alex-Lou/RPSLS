/**
 * Ciblage des sorts par le CPU (arenaAI) — cartes de base / Pro. Les cartes de
 * Voie (Montagne, Mirage, Tranchant, Forêt, Cosmos, signatures, Finishers) sont
 * déléguées à buildVoieSpellTarget (arenaAISpellTargetVoie). Aucun appel RNG.
 */
import { CREATURE_STATS, MANA_CAP } from "./arenaTypes";
import type { BoardState, PlayedSpell, Side, LaneIndex } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";
import { sideCreature, targetMyBestCreature, targetOppBestCreature, targetEmptyMyLaneOppOccupied } from "./arenaAIHelpers";
import { buildVoieSpellTarget } from "./arenaAISpellTargetVoie";

/** Build a PlayedSpell with a sensible target chosen for the CPU. Returns null
 *  if no valid target exists (e.g. Mirror with no opp creature). */
export function buildSpellTarget(
  id: CardId,
  board: BoardState,
  side: Side,
): PlayedSpell | null {
  const oppSide: Side = side === "a" ? "b" : "a";
  switch (id) {
    case "aegis":     return targetMyBestCreature(board, side, "lane", id) ?? { id, kind: "self" };
    case "anchor":    return targetMyBestCreature(board, side, "lane", id);
    case "riposte":   return targetMyBestCreature(board, side, "lane", id);
    case "precision": return targetMyBestCreature(board, side, "lane", id);
    case "surge":     return targetMyBestCreature(board, side, "lane", id);
    case "curse":     return targetOppBestCreature(board, oppSide, id);
    case "supernova":
      // TOUJOURS le héros (Alex 2026-06-11) : la carte dit "6 dégâts au héros
      // adverse", et le joueur ne peut la cast que sur le héros. L'IA visait
      // une créature si hero > 6 HP → incohérent + "la supernova ne m'a pas
      // touché". Parité player/CPU = hero only.
      return { id, kind: "hero" };
    case "heist":     return { id, kind: "self" };
    case "tide":      return { id, kind: "global" };
    case "prescience": return { id, kind: "self" };
    case "oracle":    return { id, kind: "self" };
    case "augur":     return { id, kind: "global" };
    case "second-wind": return { id, kind: "self" };
    case "mirror":    return targetEmptyMyLaneOppOccupied(board, side, id);
    case "vortex":    return { id, kind: "global" };
    // ── Phase-2 — sans ces cases le CPU piochait ces cartes (deck mirroring)
    //    mais ne les castait JAMAIS : cartes mortes en main, tours passifs. ──
    case "gaia": {
      // Heal 6 — ne pas gaspiller à pleine vie.
      const me = side === "a" ? board.a : board.b;
      return me.hp <= me.maxHp - 4 ? { id, kind: "self" } : null;
    }
    case "sablier":   return { id, kind: "self" };
    case "offre": {
      // +2 mana max permanent — inutile une fois le plafond atteint.
      const me = side === "a" ? board.a : board.b;
      return me.maxMana < MANA_CAP ? { id, kind: "self" } : null;
    }
    case "rempart":
    case "benediction": {
      // Buffs board-wide : utile seulement avec ≥1 créature buffable
      // (Spock Détaché est ignoré par l'effet).
      const hasBuffable = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.move !== "spock";
      });
      return hasBuffable ? { id, kind: "self" } : null;
    }
    case "cascade":   return { id, kind: "self" };
    case "marchand-ames": {
      // Paye 2 HP → pioche 3 : interdit en zone létale.
      const me = side === "a" ? board.a : board.b;
      return me.hp > 5 ? { id, kind: "self" } : null;
    }
    case "mascarade":
      // Refonte déguisement (Alex 2026-06-11) : cible une de mes créatures
      // (elle se transforme pour counter l'adversaire en face).
      return targetMyBestCreature(board, side, "lane", id);
    case "sangsue": {
      // Heal = ATK de ma créature — gaspillé à pleine vie ou board vide.
      const me = side === "a" ? board.a : board.b;
      return me.hp < me.maxHp ? targetMyBestCreature(board, side, "lane", id) : null;
    }
    case "trou-noir": return targetOppBestCreature(board, oppSide, id);
    case "paradoxe": {
      // 5 dmg aux DEUX héros — uniquement en finisher létal sans suicide.
      const me = side === "a" ? board.a : board.b;
      const opp = oppSide === "a" ? board.a : board.b;
      return opp.hp <= 5 && me.hp > 5 ? { id, kind: "global" } : null;
    }
    // ── Nouvelles cartes Pro (2026-06-12) ──
    case "jet-caillou":   return targetOppBestCreature(board, oppSide, id);
    case "toile-gluante": return targetOppBestCreature(board, oppSide, id);
    case "seve": {
      // Soin créature : utile seulement si une de mes créatures est blessée.
      const hurt = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.hp < CREATURE_STATS[c.move].hp;
      });
      return hurt ? targetMyBestCreature(board, side, "lane", id) : null;
    }
    case "coup-oeil": return { id, kind: "self" };
    case "gravite": {
      // Dégât de zone : utile seulement s'il y a ≥1 créature adverse.
      const hasOpp = ([0, 1, 2] as LaneIndex[]).some((l) => !!sideCreature(board, oppSide, l));
      return hasOpp ? { id, kind: "global" } : null;
    }
    case "purge": {
      // Dissipe : utile s'il y a ≥1 créature adverse buffée/protégée.
      const worth = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, oppSide, l);
        return !!c && (c.atkBuff > 0 || c.divineShield || c.anchored || c.ripostePrimed);
      });
      return worth ? { id, kind: "global" } : null;
    }
    case "doppelganger": {
      // Copie : besoin d'≥1 créature ET d'une lane vide à moi.
      const hasCreature = ([0, 1, 2] as LaneIndex[]).some((l) => !!sideCreature(board, side, l));
      const hasEmpty = ([0, 1, 2] as LaneIndex[]).some((l) => !sideCreature(board, side, l));
      return hasCreature && hasEmpty ? { id, kind: "self" } : null;
    }
    case "phenix": {
      // Phénix : utile seulement si j'ai des créatures à protéger.
      const hasCreature = ([0, 1, 2] as LaneIndex[]).some((l) => !!sideCreature(board, side, l));
      return hasCreature ? { id, kind: "self" } : null;
    }
    case "roue-destin": return { id, kind: "self" };
    case "singularite": {
      // Burst héros qui scale avec le board : ne tente que s'il reste ≥1 créature.
      const anyCreature = ([0, 1, 2] as LaneIndex[]).some(
        (l) => !!sideCreature(board, side, l) || !!sideCreature(board, oppSide, l),
      );
      return anyCreature ? { id, kind: "hero" } : null;
    }
    // ── Cartes de Voie (Montagne, Mirage, Tranchant, Forêt, Cosmos,
    //    signatures, Finishers) → arenaAISpellTargetVoie. ──
    default:          return buildVoieSpellTarget(id, board, side);
  }
}
