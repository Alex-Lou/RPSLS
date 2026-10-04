/**
 * arenaVoieText — paramètres CHIFFRÉS des textes de Voie (bonus, fiches, règles).
 *
 * Les nombres affichés (« Provocation {n} charges », « +{n} ATK »…) sont lus dans
 * BALANCE (arenaBalance) + CREATURE_STATS au moment du rendu, jamais recopiés en
 * dur dans les traductions → un réglage chiffré ne peut plus faire dériver le
 * texte (bug 2026-10 : « Provocation 2 charges » affiché alors que la Voie en
 * donnait 3). Lecture INLINE de BALANCE (frontière de module, cf. arenaBalance).
 */
import type { Move } from "../engine/game";
import { BALANCE } from "./arenaBalance";
import { CREATURE_STATS } from "./arenaTypes";

export type VoieTextParams = Record<string, string | number>;

/** Params communs à TOUS les textes `arena.voie.<move>.*` de la Voie `m`. */
export function voieTextParams(m: Move): VoieTextParams {
  const cap = BALANCE.engine.cap;
  switch (m) {
    case "rock":
      return {
        cap,
        charges: BALANCE.montagne.voieProvocationCharges,
        hp: CREATURE_STATS.rock.hp,
        strateAtk: BALANCE.montagne.strateAtk,
        strateHp: BALANCE.montagne.strateHp,
        forteresseAtk: BALANCE.montagne.forteresseAtk,
      };
    case "paper": {
      // Verger : 1 PV/tour plancher, min(seveHealVerger, Sève+1) si nourri (cf. seveHealAmount).
      const v = BALANCE.foret.seveHealVerger;
      return { cap, hp: CREATURE_STATS.paper.hp, verger: v > 1 ? `1-${v}` : "1" };
    }
    case "scissors":
      return {
        cap,
        bonusHp: BALANCE.tranchant.voieScissorsHp,
        hp: CREATURE_STATS.scissors.hp + BALANCE.tranchant.voieScissorsHp,
        baseHp: CREATURE_STATS.scissors.hp,
        atk: CREATURE_STATS.scissors.atk,
      };
    case "lizard":
      return {
        cap,
        bonusAtk: BALANCE.engine.voieAtkBonus,
        atk: CREATURE_STATS.lizard.atk + BALANCE.engine.voieAtkBonus,
        baseAtk: CREATURE_STATS.lizard.atk,
        dodge: BALANCE.mirage.voieLizardDodge,
        dodgeCap: BALANCE.mirage.dodgeCumulativeCap,
      };
    case "spock":
      return {
        cap,
        bonusAtk: BALANCE.engine.voieAtkBonus,
        atk: CREATURE_STATS.spock.atk + BALANCE.engine.voieAtkBonus,
        baseAtk: CREATURE_STATS.spock.atk,
        hp: CREATURE_STATS.spock.hp,
        calcul: BALANCE.cosmos.calculDiscount,
        tempo: BALANCE.cosmos.tempoDiscount,
        entropy: BALANCE.cosmos.entropyHealReduction, // ENTROPIE : −PV par soin adverse (plancher 1)
      };
  }
}

/** Params des règles « Pourquoi ma Pierre ne protège pas » (ArenaHowItWorks). */
export function provocationRuleParams(): VoieTextParams {
  const n = BALANCE.montagne.voieProvocationCharges;
  return { charges: n, extra: Math.max(0, n - 1) };
}
