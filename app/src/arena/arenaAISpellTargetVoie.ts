/**
 * Ciblage des sorts de Voie par le CPU (arenaAI) : Montagne, Mirage, Tranchant,
 * Forêt, Cosmos, dégâts signature et Finishers. Appelé par buildSpellTarget
 * (arenaAISpellTarget) pour toute carte hors cartes de base. Aucun appel RNG.
 */
import { CREATURE_STATS, MANA_CAP } from "./arenaTypes";
import type { BoardState, PlayedSpell, Side, LaneIndex } from "./arenaTypes";
import { creatureEffectiveAtk } from "./arenaRules";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";
import { sideCreature, targetMyBestCreature, targetOppBestCreature } from "./arenaAIHelpers";

export function buildVoieSpellTarget(
  id: CardId,
  board: BoardState,
  side: Side,
): PlayedSpell | null {
  const oppSide: Side = side === "a" ? "b" : "a";
  switch (id) {
    // ── Voie Montagne (2026-06-22) ──
    case "eboulement":   return targetOppBestCreature(board, oppSide, id);
    case "strate-vive":
    case "gardien-pierre": {
      // rock-only : cible la meilleure de MES Pierres (sinon fizzle → ne joue pas).
      let bestLane: LaneIndex | null = null;
      let best = -1;
      for (let i = 0; i < 3; i++) {
        const c = sideCreature(board, side, i as LaneIndex);
        if (c && c.move === "rock") {
          const s = CREATURE_STATS.rock.atk + c.hp + c.voieAtkBonus;
          if (s > best) { best = s; bestLane = i as LaneIndex; }
        }
      }
      return bestLane === null ? null : { id, kind: "lane", lane: bestLane };
    }
    case "contrefort": {
      // +PV/bouclier board-wide : utile avec ≥1 créature non-Spock.
      const hasBuffable = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.move !== "spock";
      });
      return hasBuffable ? { id, kind: "self" } : null;
    }
    case "barricade": {
      // Anti-aggro : +PV camp + recharge Provoc des Pierres. Utile avec ≥1 créature
      // non-Spock (idéalement une Pierre, mais le +PV sert tout le board).
      const hasBuffable = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.move !== "spock";
      });
      return hasBuffable ? { id, kind: "self" } : null;
    }
    case "veine-minerale":
    case "greffe":
      // Pioche : toujours bon (le moteur cape la main). Self.
      return { id, kind: "self" };
    case "grondement": {
      // Aura chip récurrent : utile si j'ai ≥1 Pierre et pas déjà active.
      const me = side === "a" ? board.a : board.b;
      const hasRock = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "rock");
      return !me.tremorActive && hasRock ? { id, kind: "self" } : null;
    }
    case "veine-gaia": {
      // Soin = 2×Pierres : ne tente que blessé ET avec ≥1 Pierre.
      const me = side === "a" ? board.a : board.b;
      const rocks = ([0, 1, 2] as LaneIndex[]).filter(
        (l) => sideCreature(board, side, l)?.move === "rock",
      ).length;
      return me.hp < me.maxHp && rocks > 0 ? { id, kind: "self" } : null;
    }
    // ── Voie Mirage (2026-06-22) ──
    case "reflet-echo": return { id, kind: "self" };
    case "mascarade-enchainee":
    case "fuite-masquee": {
      // lizard-only : cible le meilleur de MES Lézards (sinon ne joue pas).
      let bestLane: LaneIndex | null = null;
      let best = -1;
      for (let i = 0; i < 3; i++) {
        const c = sideCreature(board, side, i as LaneIndex);
        if (c && c.move === "lizard" && c.dodgeCharges < 3) {
          const s = c.hp + c.dodgeCharges;
          if (s > best) { best = s; bestLane = i as LaneIndex; }
        }
      }
      return bestLane === null ? null : { id, kind: "lane", lane: bestLane };
    }
    // ── Voie Mirage — nouvelles cartes (2026-06-29) : sans ces cases le CPU
    //    Mirage ne les jouait JAMAIS (default → null), constaté au Watcher. ──
    case "derobade": {
      // Repositionne un Lézard vers une lane vide : utile avec un Lézard ET ≥1 lane vide.
      const hasEmpty = ([0, 1, 2] as LaneIndex[]).some((l) => !sideCreature(board, side, l));
      if (!hasEmpty) return null;
      for (let i = 0; i < 3; i++) {
        if (sideCreature(board, side, i as LaneIndex)?.move === "lizard") return { id, kind: "lane", lane: i as LaneIndex };
      }
      return null;
    }
    case "frappe-spectrale": {
      // Dépense 1 Esquive → ATK imblocable : cible le Lézard à charge le plus fort.
      let bestLane: LaneIndex | null = null;
      let best = -1;
      for (let i = 0; i < 3; i++) {
        const c = sideCreature(board, side, i as LaneIndex);
        if (c && c.move === "lizard" && c.dodgeCharges > 0) {
          const s = CREATURE_STATS.lizard.atk + c.voieAtkBonus;
          if (s > best) { best = s; bestLane = i as LaneIndex; }
        }
      }
      return bestLane === null ? null : { id, kind: "lane", lane: bestLane };
    }
    case "faux-semblant": {
      // Déguise une créature adverse FACE à mon Lézard → kill garanti (skip Ancre/Logique).
      for (let i = 0; i < 3; i++) {
        const me = sideCreature(board, side, i as LaneIndex);
        const opp = sideCreature(board, oppSide, i as LaneIndex);
        if (me?.move === "lizard" && opp && !opp.anchored && !opp.spellImmune) return { id, kind: "lane", lane: i as LaneIndex };
      }
      return null;
    }
    case "eclipse": {
      // Met un Lézard en phase (sauvetage) : utile s'il fait face à une créature adverse.
      for (let i = 0; i < 3; i++) {
        if (sideCreature(board, side, i as LaneIndex)?.move === "lizard" && sideCreature(board, oppSide, i as LaneIndex)) return { id, kind: "lane", lane: i as LaneIndex };
      }
      return null;
    }
    case "sillage-spectral": {
      // Aura tempo (esquive → pioche) : pose-la si j'ai ≥1 Lézard et pas déjà active.
      const me = side === "a" ? board.a : board.b;
      const hasLizard = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "lizard");
      return !me.sillageActive && hasLizard ? { id, kind: "self" } : null;
    }
    case "nuee-spectrale": {
      // Closer imblocable : utile seulement avec ≥1 Lézard (sinon 0 dégât).
      const hasLizard = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "lizard");
      return hasLizard ? { id, kind: "self" } : null;
    }
    // ── Voie Tranchant (2026-06-22) ──
    case "coup-de-taille":
    case "acuite": {
      // scissors-only : cible le meilleur de MES Ciseaux (sinon ne joue pas).
      let bestLane: LaneIndex | null = null;
      let best = -1;
      for (let i = 0; i < 3; i++) {
        const c = sideCreature(board, side, i as LaneIndex);
        if (c && c.move === "scissors") {
          const s = CREATURE_STATS.scissors.atk + c.hp + c.voieAtkBonus;
          if (s > best) { best = s; bestLane = i as LaneIndex; }
        }
      }
      return bestLane === null ? null : { id, kind: "lane", lane: bestLane };
    }
    case "frenesie": {
      // Buff board scissors : utile avec ≥1 Ciseau.
      const hasScissors = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "scissors");
      return hasScissors ? { id, kind: "self" } : null;
    }
    case "estafilade": {
      // Reach : mon Ciseau frappe le héros direct → cible le Ciseau au plus gros ATK.
      let bestLane: LaneIndex | null = null;
      let best = -1;
      for (let i = 0; i < 3; i++) {
        const c = sideCreature(board, side, i as LaneIndex);
        if (c && c.move === "scissors") {
          const s = CREATURE_STATS.scissors.atk + c.atkBuff + c.voieAtkBonus;
          if (s > best) { best = s; bestLane = i as LaneIndex; }
        }
      }
      return bestLane === null ? null : { id, kind: "lane", lane: bestLane };
    }
    case "saignee":
      // Pioche : toujours bon (le moteur cape la main). Self.
      return { id, kind: "self" };
    case "fureur-emoussee": {
      // Payoff Émoussé : utile seulement si j'ai ≥1 Ciseau émoussé.
      const hasBlunted = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.move === "scissors" && c.combatBlunted;
      });
      return hasBlunted ? { id, kind: "self" } : null;
    }
    // ── Voie Forêt (2026-06-23) ──
    case "ramure": {
      // Bouclier board-wide : utile avec ≥1 créature non-Spock (Détaché ignoré).
      const hasBuffable = ([0, 1, 2] as LaneIndex[]).some((l) => {
        const c = sideCreature(board, side, l);
        return !!c && c.move !== "spock";
      });
      return hasBuffable ? { id, kind: "self" } : null;
    }
    case "photosynthese":
      // Soin + ATK perm : cible ma meilleure créature (fizzle → ne joue pas).
      return targetMyBestCreature(board, side, "lane", id);
    case "ronces":
      // Riposte + bouclier : protège ma meilleure créature (fizzle → ne joue pas).
      return targetMyBestCreature(board, side, "lane", id);
    // ── Voie Cosmos (2026-06-23) ──
    case "dilatation-temporelle": {
      // +1 mana max permanent — inutile une fois le plafond atteint.
      const me = side === "a" ? board.a : board.b;
      return me.maxMana < MANA_CAP ? { id, kind: "self" } : null;
    }
    case "loi-de-causalite": return targetOppBestCreature(board, oppSide, id);
    case "convergence-cosmique":
      // Dégât héros = mon mana max : toujours bon (direct, inconditionnel).
      return { id, kind: "hero" };
    // ── Dégâts signature par Voie (2026-06-23) — toutes frappent le héros ──
    case "drain-vital":
    case "taillade-mortelle":
      // Burst / drain inconditionnel : toujours bon.
      return { id, kind: "hero" };
    case "eboulis-final": {
      // Dégât = Pierres + Strates : ne tente que si j'ai ≥1 Pierre.
      const hasRock = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "rock");
      return hasRock ? { id, kind: "hero" } : null;
    }
    case "ecrasement": {
      // Perce-mur : dégât = Pierres×2 + coupe le soin adverse. Tente si ≥1 Pierre.
      const hasRock = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "rock");
      return hasRock ? { id, kind: "hero" } : null;
    }
    case "coup-dans-lombre": {
      // Dégât = charges d'Esquive : ne tente que si j'en ai ≥1.
      const charges = ([0, 1, 2] as LaneIndex[]).reduce<number>((s, l) => {
        const c = sideCreature(board, side, l);
        return s + (c && c.move === "lizard" ? c.dodgeCharges : 0);
      }, 0);
      return charges > 0 ? { id, kind: "hero" } : null;
    }
    case "intrication-quantique": {
      // Dégât = mes Spock : ne tente que si j'en ai ≥1.
      const hasSpock = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === "spock");
      return hasSpock ? { id, kind: "hero" } : null;
    }
    // ── Cosmos / Tranchant — audit 2026-10 (cartes signature jamais castées) ──
    case "chronomancien": return { id, kind: "self" };
    case "surcharge":
    case "double-mot": {
      // Buff ATK (Spock Détaché ignoré) : mon meilleur Ciseau, sinon ma meilleure créature.
      let bestLane: LaneIndex | null = null;
      let best = -1;
      for (let i = 0; i < 3; i++) {
        const c = sideCreature(board, side, i as LaneIndex);
        if (!c || c.move === "spock" || c.cannotAttack) continue;
        const s = (c.move === "scissors" ? 100 : 0) + creatureEffectiveAtk(c) * 2 + c.hp;
        if (s > best) { best = s; bestLane = i as LaneIndex; }
      }
      return bestLane === null ? null : { id, kind: "lane", lane: bestLane };
    }
    // ── Finishers (Lot D) — joués en "global" comme côté joueur (CARD_TARGET_KIND
    //    par défaut). 1×/match : on ne tente pas si déjà utilisé. ──
    case "finisher-forteresse":
    case "finisher-lame":
    case "finisher-metamorphose": {
      const me = side === "a" ? board.a : board.b;
      if (me.finisherUsed) return null;
      // Effet sur MES créatures du symbole : ≥1 requis sinon gâché.
      const need: Move = id === "finisher-forteresse" ? "rock" : id === "finisher-lame" ? "scissors" : "lizard";
      const has = ([0, 1, 2] as LaneIndex[]).some((l) => sideCreature(board, side, l)?.move === need);
      return has ? { id, kind: "global" } : null;
    }
    case "finisher-verger":
    case "finisher-calcul": {
      const me = side === "a" ? board.a : board.b;
      return me.finisherUsed ? null : { id, kind: "global" };
    }
    default:          return null;
  }
}
