/**
 * arenaFinishers — Lot D Constellation Pro.
 *
 * 5 Finishers, 1 par Voie d'Affinité. Injectés dans la main du hero à 3⭐
 * (cf arenaRules.applySummons), cast 1× par match (cost 4 mana, cf cards.ts).
 *
 * Effets :
 * - 🪨 FORTERESSE  : tes Pierres existantes prennent 🛡 + ATK base 3 perm
 * - 📄 VERGER       : Fanaison off + heal hero 1/tour plancher (2 si counter Feuille), persistent
 * - ✂️ LAME         : ton Tranchant pierce TOUT (Aegis, Provoc, anti-taunt)
 * - 🦎 MÉTAMORPHOSE : Esquive infinie (dodge refresh chaque tour)
 * - 🖖 CALCUL       : tous tes sorts coûtent −1m (min 0)
 *
 * KISS : 1 fonction `applyFinisher()` qui dispatch sur l'id. Pas de classe,
 * pas d'effets découpés en N fichiers, juste un module focalisé sur le Lot D.
 * Les effets posent des flags sur HeroState et/ou mutent les créatures
 * directement ; les vérifs runtime restent dans arenaRules.
 */

import { alog } from "./arenaLog";
import { VOIE_DEF } from "./arenaVoies";
import { BALANCE } from "./arenaBalance";
import { CARDS } from "../ranked/cards";
import type { BoardState, LaneState, Side } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";

/** Map Affinité → CardId du Finisher correspondant. Used by applySummons
 *  pour savoir quelle carte injecter dans la main à 3⭐, et par l'AI/UI
 *  pour lookup le finisher associé. */
// Dérivé de VOIE_DEF (source unique, Phase A) — valeurs identiques à avant.
export const AFFINITY_TO_FINISHER: Record<Move, CardId> = {
  rock: VOIE_DEF.rock.finisher,
  paper: VOIE_DEF.paper.finisher,
  scissors: VOIE_DEF.scissors.finisher,
  lizard: VOIE_DEF.lizard.finisher,
  spock: VOIE_DEF.spock.finisher,
};

/** Reverse lookup utile pour AI/UI : depuis le CardId, retrouver l'Affinité.
 *  Si l'id n'est pas un Finisher, retourne undefined. */
export function finisherToAffinity(id: CardId): Move | undefined {
  for (const move of Object.keys(AFFINITY_TO_FINISHER) as Move[]) {
    if (AFFINITY_TO_FINISHER[move] === id) return move;
  }
  return undefined;
}

/** True si la CardId est un Finisher Pro (utile pour gating UI / arenaSupported). */
export function isFinisherCard(id: CardId): boolean {
  return id.startsWith("finisher-");
}

/** Un sort « DOMINANT » = Légendaire OU Finisher : c'est un climax, il mérite un
 *  MOMENT (anim solo + ralentie, pause de flux allongée). Cf. ArenaSpellFX
 *  (spotlight), arenaResolverFlow (pause), ArenaGame (hold). */
export function isDominantSpell(id: CardId): boolean {
  return isFinisherCard(id) || CARDS[id]?.rarity === "legendary";
}

/** True si l'un des sorts joués ce tour est dominant (→ ralentir / isoler). */
export function hasDominantSpell(ids: CardId[]): boolean {
  return ids.some(isDominantSpell);
}

/** Helper : mute une lane spécifique de `side` avec une transformation creature. */
function mutateLaneCreature(
  board: BoardState,
  side: Side,
  laneIdx: number,
  fn: (c: NonNullable<LaneState["a"]>) => NonNullable<LaneState["a"]>,
): BoardState {
  const lane = board.lanes[laneIdx];
  const cur = lane[side];
  if (!cur) return board;
  const next = fn(cur);
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  lanes[laneIdx] = { ...lane, [side]: next };
  return { ...board, lanes };
}

/** Effet FORTERESSE — tes Pierres existantes prennent 🛡 (divineShield) + ATK
 *  perm +2 (base 1 + 2 = 3). N'affecte pas les Pierres futures (design : c'est
 *  un sort "snap des Pierres présentes" — incitation à poser 3 Pierres avant
 *  de cast).
 *
 *  ⚠️ Le "+2 perm" passe par voieAtkBonus (PAS atkBuff) : atkBuff est un buff
 *  PAR TOUR remis à 0 par endOfTurnReset — l'ancienne implémentation rendait
 *  le "permanent" du texte de carte faux dès le tour suivant. voieAtkBonus
 *  persiste (cf. arenaTypes) et est compté par creatureEffectiveAtk, y compris
 *  pendant Lente. */
function applyForteresse(board: BoardState, side: Side): BoardState {
  let b = board;
  let count = 0;
  for (let i = 0; i < 3; i++) {
    const c = b.lanes[i][side];
    if (c && c.move === "rock") {
      b = mutateLaneCreature(b, side, i, (cur) => ({
        ...cur,
        divineShield: true,
        voieAtkBonus: (cur.voieAtkBonus ?? 0) + BALANCE.montagne.forteresseAtk,
      }));
      count++;
    }
  }
  alog("spell", `${side} FINISHER FORTERESSE → ${count} Pierre(s) 🛡 +2 ATK perm`);
  return b;
}

/** Effet VERGER ÉTERNEL — Fanaison off (wiltedSteps=0 sur toutes mes Feuilles)
 *  + flag vergerActive : Fanaison gelée (endOfTurnReset) ET soin Sève qui ne tarit
 *  jamais — 1 PV/tour plancher, 2 si counter Feuille gagné (cf seveHealAmount). */
function applyVerger(board: BoardState, side: Side): BoardState {
  let b = board;
  let count = 0;
  for (let i = 0; i < 3; i++) {
    const c = b.lanes[i][side];
    if (c && c.move === "paper") {
      b = mutateLaneCreature(b, side, i, (cur) => ({ ...cur, wiltedSteps: 0 }));
      count++;
    }
  }
  const hero = side === "a" ? b.a : b.b;
  b = side === "a"
    ? { ...b, a: { ...hero, vergerActive: true } }
    : { ...b, b: { ...hero, vergerActive: true } };
  alog("spell", `${side} FINISHER VERGER → ${count} Feuille(s) Fanaison off + heal 1-2/tour (Sève entretenue)`);
  return b;
}

/** Effet LAME COSMIQUE — flag lameActive : tes Ciseaux pierce TOUT (Aegis,
 *  Provoc opp, anti-taunt opp). Le check runtime vit dans resolveLaneCombat. */
function applyLame(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const b = side === "a"
    ? { ...board, a: { ...hero, lameActive: true } }
    : { ...board, b: { ...hero, lameActive: true } };
  alog("spell", `${side} FINISHER LAME → Tranchant pierce Aegis+Provoc+anti-taunt`);
  return b;
}

/** MÉTAMORPHOSE — niveau d'Esquive « infinie » (Alex 2026-06-23, audit) : on
 *  recharge les Lézards à un SENTINEL élevé chaque tour → ils encaissent autant
 *  de coups/tour qu'il faut sans tomber = réellement INTOUCHABLES. L'ancien
 *  max(.,1) ne donnait qu'1 charge : il DÉGRADAIT même un Lézard de Voie (2
 *  charges), et un coup de combat + un sort le même tour le tuait — en
 *  contradiction directe avec le texte « Esquive infinie / intouchables ». */
export const METAMORPHOSE_DODGE = 9;

/** Effet MÉTAMORPHOSE — flag metamorphoseActive + Lézards rechargés à
 *  METAMORPHOSE_DODGE (intouchables), refresh à chaque endOfTurnReset. */
function applyMetamorphose(board: BoardState, side: Side): BoardState {
  let b = board;
  let count = 0;
  for (let i = 0; i < 3; i++) {
    const c = b.lanes[i][side];
    if (c && c.move === "lizard") {
      b = mutateLaneCreature(b, side, i, (cur) => ({ ...cur, dodgeCharges: Math.max(cur.dodgeCharges, METAMORPHOSE_DODGE) }));
      count++;
    }
  }
  const hero = side === "a" ? b.a : b.b;
  b = side === "a"
    ? { ...b, a: { ...hero, metamorphoseActive: true } }
    : { ...b, b: { ...hero, metamorphoseActive: true } };
  alog("spell", `${side} FINISHER MÉTAMORPHOSE → ${count} Lézard(s) ✨ + dodge refresh/tour`);
  return b;
}

/** Effet CALCUL QUANTIQUE — flag calculActive : tous tes sorts coûtent
 *  −1m (min 0). Le check vit dans applyAllSpells.cost. */
function applyCalcul(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const b = side === "a"
    ? { ...board, a: { ...hero, calculActive: true } }
    : { ...board, b: { ...hero, calculActive: true } };
  alog("spell", `${side} FINISHER CALCUL → tes sorts coûtent −1m`);
  return b;
}

/** Dispatch principal — appelé par arenaCardEffects quand un Finisher est cast.
 *  Marque finisherUsed=true pour éviter re-cast. */
export function applyFinisher(board: BoardState, side: Side, id: CardId): BoardState {
  let b = board;
  switch (id) {
    case "finisher-forteresse": b = applyForteresse(b, side); break;
    case "finisher-verger":     b = applyVerger(b, side); break;
    case "finisher-lame":       b = applyLame(b, side); break;
    case "finisher-metamorphose": b = applyMetamorphose(b, side); break;
    case "finisher-calcul":     b = applyCalcul(b, side); break;
    default:
      alog("spell", `${side} FINISHER UNKNOWN ${id} (no-op)`);
      return board;
  }
  // Marque comme utilisé pour empêcher re-cast (la carte est consommée
  // normalement par applyAllSpells mais on garde le flag pour la prochaine
  // injection éventuelle — cf arenaRules.applySummons).
  const hero = side === "a" ? b.a : b.b;
  return side === "a"
    ? { ...b, a: { ...hero, finisherUsed: true } }
    : { ...b, b: { ...hero, finisherUsed: true } };
}
