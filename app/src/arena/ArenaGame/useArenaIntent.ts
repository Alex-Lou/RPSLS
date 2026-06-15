import { useState } from "react";
import { hapticTap } from "../../haptic";
import type { CardId } from "../../ranked/rankedTypes";
import { alog } from "../arenaLog";
import { isFinisherCard } from "../arenaFinishers";
import { arenaSpellCost } from "../arenaSpellHelpers";
import {
  MAX_SPELLS_PER_TURN,
  UTILITY_SPELLS_PER_TURN,
  type BoardState,
  type LaneIndex,
  type PlayedSpell,
  type PlannedSummon,
  type TurnIntent,
} from "../arenaTypes";

/** Étiquettes d'effets BINAIRES (on/off, non cumulables) par carte — sert au
 *  garde anti-redondance d'addSpell (Alex 2026-06-13). Une carte qui re-pose
 *  un tag déjà couvert par une autre carte planifiée sur la même lane est
 *  refusée (ex. Bastion ⊃ bouclier+ancre → bloque Aegis & Anchor). Les buffs
 *  ADDITIFS (Précision/Surge +ATK) ne sont PAS listés ici : ils s'empilent. */
const BINARY_EFFECT_TAGS: Partial<Record<CardId, string[]>> = {
  aegis:           ["shield"],
  anchor:          ["anchor"],
  riposte:         ["riposte"],
  bastion:         ["shield", "anchor"], // fusion Aegis+Anchor
  "toile-gluante": ["noattack"],
  cocon:           ["noattack"],         // fusion Toile+Curse (le -ATK de Curse, lui, s'empile)
};

/**
 * useArenaIntent — état du TurnIntent du joueur (sorts planifiés + invocations)
 * et ses builders. Extrait d'ArenaGame pour alléger l'orchestrateur ; identique
 * sémantiquement à un useState inline (le hook re-tourne à chaque render,
 * capturant le `board` courant). La RÉSOLUTION de combat reste dans ArenaGame.
 */
export function useArenaIntent(board: BoardState, cardFr: (id: CardId) => string) {
  const [intent, setIntent] = useState<TurnIntent>({ spells: [], summons: [] });

  function addSpell(spell: PlayedSpell) {
    // Alex feedback F : limite MAX_SPELLS_PER_TURN sorts par tour pour
    // éviter les tours dump-tout. Si déjà au max, fizzle (haptic neutral).
    // Alex feedback : "pas permettre l'usage de la même carte deux fois
    // sur le même lane" → reject si même id ET même lane déjà dans intent.
    // Pour spells non-lane (self / hero / global), simple check sur id.
    hapticTap();
    setIntent((cur) => {
      // Cap MAX_SPELLS_PER_TURN sur les sorts LANE. Cap utility (hero/self/
      // global) RELEVÉ 1 → 2 (Alex 2026-06-11, watch live) : l'ancien cap 1
      // bloquait Supernova + Second Souffle le même tour (combo légitime, pas
      // du spam) sans aucun feedback en jeu. Le mana + le cap lane limitent
      // déjà le spam. 2 utilities/tour autorisés.
      const UTILITY_CAP = UTILITY_SPELLS_PER_TURN; // source unique partagée engine/UI
      const laneCount = cur.spells.filter((s) => s.kind === "lane").length;
      const utilityCount = cur.spells.filter((s) => s.kind !== "lane").length;
      // Logs de blocage (Alex 2026-06-11) : pour diagnostiquer "carte bloquée"
      // pendant une manche — on dit POURQUOI le cast est refusé.
      if (spell.kind === "lane" && laneCount >= MAX_SPELLS_PER_TURN) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : déjà ${laneCount} sorts posés sur le terrain ce tour (max ${MAX_SPELLS_PER_TURN}). Retire un sort de lane pour le jouer.`);
        return cur;
      }
      if (spell.kind !== "lane" && utilityCount >= UTILITY_CAP) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : déjà ${utilityCount} sorts sur toi/ton héros ce tour (max ${UTILITY_CAP}). Retire l'un d'eux pour le jouer.`);
        return cur;
      }
      // Alex feedback 2026-06-09 (round 4) : 1 carte en main = 1 cast max.
      // Avant le check duplicate refusait seulement (même id + même lane),
      // donc une seule copie en main pouvait être cast 2× sur 2 lanes
      // différentes (effet appliqué 2× mais 1 seule copie consommée par
      // removeSpentCards) — bug double-effect. Fix : compter les usages
      // de spell.id dans cur.spells et refuser si dépasse le nombre de
      // copies en main.
      const usageCount = cur.spells.filter((s) => s.id === spell.id).length;
      const handCount = board.a.hand.filter((id) => id === spell.id).length;
      if (usageCount >= handCount) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : plus de copie dispo (1 carte = 1 usage ; ${usageCount} déjà planifié(s), ${handCount} en main).`);
        return cur;
      }
      // Check "duplicate même cible" LEVÉ (Alex 2026-06-13 CCG expert, "pas
      // de limites quand pas nécessaires") : 2 copies de Précision sur la
      // MÊME créature (+4 ATK) est un play CCG légitime. L'abus réel (caster
      // 2× une copie UNIQUE) est déjà bloqué par usageCount/handCount
      // ci-dessus. Un recast idempotent (2e Aegis sur créature déjà
      // bouclier) gâche le mana du joueur — son choix, pas celui du moteur.
      // Alex feedback 2026-06-11 : la mutual exclusion Aegis/Anchor même lane
      // est LEVÉE — empiler les deux défenses sur la même créature est
      // explicitement autorisé. Le check duplicate (même id + même lane)
      // au-dessus suffit pour bloquer le double cast d'une même carte.
      // Finisher = lock 1×/match (cf hero.finisherUsed). Une fois cast il
      // peut être ré-injecté en main (Juge reshuffle, Genèse, etc.) — le
      // garde ici empêche de le rejouer.
      if (isFinisherCard(spell.id) && board.a.finisherUsed) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : ton Finisher a déjà été lancé ce match (1 seul par partie).`);
        return cur;
      }
      // REDONDANCE d'effet binaire sur une même lane (Alex 2026-06-13 : "si
      // déjà Bastion, pas pouvoir ajouter Aegis/Anchor — sinon cheaté"). Les
      // effets BINAIRES (bouclier / ancre / ne-peut-pas-attaquer) ne se
      // cumulent pas : une carte qui re-applique un effet déjà couvert par une
      // autre planifiée sur la MÊME lane est refusée. (Les buffs ADDITIFS
      // comme Précision/Surge ne sont PAS concernés — ils s'empilent.)
      if (spell.kind === "lane") {
        const newTags = BINARY_EFFECT_TAGS[spell.id] ?? [];
        if (newTags.length > 0) {
          const conflict = cur.spells.find(
            (s) => s.kind === "lane" && s.lane === spell.lane &&
              (BINARY_EFFECT_TAGS[s.id] ?? []).some((tg) => newTags.includes(tg)),
          );
          if (conflict) {
            alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : « ${cardFr(conflict.id)} » couvre déjà cet effet sur cette lane (redondant).`);
            return cur;
          }
        }
      }
      return { ...cur, spells: [...cur.spells, spell] };
    });
  }

  function removeSpell(idx: number) {
    setIntent((cur) => ({
      ...cur,
      spells: cur.spells.filter((_, i) => i !== idx),
    }));
  }

  function addSummon(summon: PlannedSummon) {
    // Replace any existing summon on the same lane (one summon per lane per
    // turn, by design — see arenaRules.applySummons).
    hapticTap();
    setIntent((cur) => ({
      ...cur,
      summons: [...cur.summons.filter((s) => s.lane !== summon.lane), summon],
    }));
  }

  function removeSummon(lane: LaneIndex) {
    setIntent((cur) => ({ ...cur, summons: cur.summons.filter((s) => s.lane !== lane) }));
  }

  /** Total mana cost of the player's pending intent — used by the plan UI
   *  to grey out cards that would overflow. Coût via arenaSpellCost pour que
   *  le discount du Finisher CALCUL (−1m) soit réellement DÉPENSABLE — avant,
   *  l'UI bloquait au coût plein et le Finisher Spock ne servait à rien. */
  function intentCost(i: TurnIntent): number {
    let total = i.summons.length * 1; // 1m per summon
    for (const s of i.spells) total += arenaSpellCost(board.a, s.id);
    return total;
  }

  return { intent, setIntent, addSpell, removeSpell, addSummon, removeSummon, intentCost };
}
