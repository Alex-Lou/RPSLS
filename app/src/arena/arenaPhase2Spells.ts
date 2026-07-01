/**
 * Arena Phase-2 spell implementations (15 cards adapted after the initial 15).
 *
 * Extracted from arenaCardEffects.ts to keep that file under the project's
 * 400-line ceiling as the spell roster grows. Each function takes the same
 * (board, side, spell?) shape as the original handlers so the dispatch
 * switch in arenaCardEffects.ts can just import + delegate.
 *
 * The dispatch + priority table stay in arenaCardEffects.ts (single source
 * of truth for spell ordering); only the bodies live here.
 */

import { drawCards, damageHero, healHero, creatureEffectiveAtk, makeCreature } from "./arenaRules";
import {
  getMyCreatureOnLane,
  getOppCreatureOnLane,
  withMyCreatureOnLane,
  withOppCreatureOnLane,
  withSideHero,
} from "./arenaSpellHelpers";
import { MANA_CAP, moveCountersMove, type BoardState, type Creature, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import { MOVES, type Move } from "../engine/game";
import { alog } from "./arenaLog";
import { BALANCE } from "./arenaBalance";
import type { CardId } from "../ranked/rankedTypes";

/** Gaia — heal hero +6 HP. */
export function applyGaia(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, 6));
}

/** Sablier — +2 mana THIS turn, plafonné à MANA_CAP (8). Pure tempo. Le
 *  texte de carte Arena dit explicitement "plafond 8" — pas d'over-cap. */
export function applySablier(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, { ...hero, mana: Math.min(MANA_CAP, hero.mana + 2) });
}

/** Offre — +2 to max mana permanently (cap MANA_CAP). L'illustration montre
 *  "+2" (Alex 2026-06-11), on suit l'image. Le mana courant grimpe aussi de
 *  +2 (capé au nouveau max) pour que le gain soit utilisable dès ce tour. */
export function applyOffre(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const newMax = Math.min(MANA_CAP, hero.maxMana + 2);
  const newMana = Math.min(newMax, hero.mana + 2);
  return withSideHero(board, side, { ...hero, maxMana: newMax, mana: newMana });
}

/** Rempart — give every one of my creatures +2 max HP. Spock Détaché skipped. */
export function applyRempart(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = { ...me, hp: me.hp + 2 };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Contrefort (Montagne) — +2 PV à toutes mes créatures + BOUCLIER (divineShield)
 *  à mes Pierres. Spock ignoré (Détaché). Clone défensif de Rempart avec le
 *  bonus rock. */
export function applyContrefort(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = {
      ...me,
      hp: me.hp + 2,
      divineShield: me.move === "rock" ? true : me.divineShield,
    };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Barricade (Montagne, 2026-06-30) — ANTI-AGGRO instantané (coût 1) : +1 PV à
 *  toutes mes créatures ET mes Pierres regagnent leurs charges de Provocation (le
 *  mur se redresse → encaisse le rush early en attendant que la jauge Strates
 *  monte). Comble le talon #1 (survie early-game). Spock ignoré (Détaché). Lit
 *  BALANCE.montagne.voieProvocationCharges INLINE (frontière de module arenaBalance). */
export function applyBarricade(board: BoardState, side: Side): BoardState {
  const charges = BALANCE.montagne.voieProvocationCharges;
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = {
      ...me,
      hp: me.hp + 1,
      ...(me.move === "rock"
        ? { taunt: true, provocationCharges: Math.max(me.provocationCharges, charges) }
        : {}),
    };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  alog("spell", `${side} BARRICADE → +1 PV camp + Pierres regagnent Provocation (${charges})`);
  return { ...board, lanes };
}

/** Veine Minérale (Montagne, 2026-06-30) — PIOCHE thématique : pioche 1 carte,
 *  +1 de plus si je contrôle ≥2 Pierres (la pioche récompense le mur établi).
 *  Comble le zéro-pioche du kit Montagne (trouver son closer / ses anti-aggro). */
export function applyVeineMinerale(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let rocks = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "rock") rocks++;
  }
  const n = 1 + (rocks >= 2 ? 1 : 0);
  alog("spell", `${side} VEINE MINÉRALE → pioche ${n} (${rocks} Pierre(s))`);
  return withSideHero(board, side, drawCards(hero, n));
}

/** Greffe (Forêt, 2026-06-30) — PIOCHE thématique : pioche 1 carte, +1 si je
 *  contrôle ≥2 Feuilles (la greffe récompense la forêt développée). Comble le
 *  zéro-pioche du kit Forêt ET ajoute enfin une carte NON-soin (texture/profondeur
 *  de deck) sans renforcer le sustain — parallèle de Veine Minérale (rock) /
 *  Saignée (scissors) : chaque Voie a sa pioche flavor. */
export function applyGreffe(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let leaves = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "paper") leaves++;
  }
  const n = 1 + (leaves >= 3 ? 1 : 0); // bonus rare (board plein) → surtout un cantrip neutre, pas un robinet d'avantage (anti-ré-inflate Forêt)
  alog("spell", `${side} GREFFE → pioche ${n} (${leaves} Feuille(s))`);
  return withSideHero(board, side, drawCards(hero, n));
}

/** Grondement (Montagne, 2026-06-30) — AURA récurrente : pose tremorActive sur le
 *  héros → chaque fin de tour, le héros adverse subit des dégâts = mes Strates en
 *  jeu (cap grondementCap). 2e axe de dégâts (anti back-load d'Éboulis Final).
 *  COUNTERABLE (≠ chip Cosmos imparable) : wiper mes Pierres coupe le chip. Aura
 *  permanente (pas reset). Re-cast = no-op (déjà actif). Lu en endOfTurnCleanup. */
export function applyGrondement(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  if (hero.tremorActive) {
    alog("spell", `💤 ${side} Grondement déjà actif (aura permanente).`);
    return board;
  }
  alog("spell", `${side} GRONDEMENT → aura : chaque fin de tour, dégâts héros adverse = mes Strates`);
  return withSideHero(board, side, { ...hero, tremorActive: true });
}

/** Veine de Gaïa (Montagne) — soigne mon héros de +2 PV par PIERRE que je
 *  contrôle (récompense un board défensif établi). 0 Pierre = soin nul. */
export function applyVeineGaia(board: BoardState, side: Side): BoardState {
  let rocks = 0;
  for (const lane of board.lanes) {
    const me = side === "a" ? lane.a : lane.b;
    if (me && me.move === "rock") rocks++;
  }
  const hero = side === "a" ? board.a : board.b;
  alog("spell", `${side} VEINE DE GAÏA → +${rocks * 2} PV héros (${rocks} Pierre(s))`);
  return withSideHero(board, side, healHero(hero, rocks * 2));
}

/** Frénésie (Tranchant) — tous mes Ciseaux gagnent +2 ATK ce tour (+1 de plus
 *  s'ils sont émoussés = combatBlunted, récompense l'agressivité continue). */
export function applyFrenesie(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move !== "scissors") return lane;
    const buffed: Creature = { ...me, atkBuff: me.atkBuff + 2 + (me.combatBlunted ? 1 : 0) };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Ramure (Forêt) — BOUCLIER VIVANT : un divineShield à TOUTES mes créatures
 *  (absorbe 1 source de dégât chacune). Spock ignoré (Détaché). Aucun PV/ATK
 *  touché → protection pure, board-wide. */
export function applyRamure(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = { ...me, divineShield: true };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  alog("spell", `${side} RAMURE → bouclier vivant à toutes mes créatures`);
  return { ...board, lanes };
}

/** Dilatation Temporelle (Cosmos) — +1 mana max PERMANENT (cap MANA_CAP) ; le
 *  mana courant grimpe aussi de +1 (capé au nouveau max) pour être utilisable
 *  dès ce tour. Ramp léger bas de courbe (clone d'Offre en +1). */
export function applyDilatation(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const newMax = Math.min(MANA_CAP, hero.maxMana + 1);
  return withSideHero(board, side, { ...hero, maxMana: newMax, mana: Math.min(newMax, hero.mana + 1) });
}

/** Bénédiction — +1 ATK this turn to ALL my creatures. Spock Détaché skipped. */
export function applyBenediction(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = { ...me, atkBuff: me.atkBuff + 1 };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Oracle Inverse — peek FULL opp hand (Augur shows the first 4 only).
 *  Reste affichée 2 tours comme Augur (Alex 2026-06-11). */
export function applyOracleInverse(board: BoardState, side: Side): BoardState {
  const opp = side === "a" ? board.b : board.a;
  if (side === "a") return { ...board, augurRevealedB: opp.hand.slice(), augurTurnsLeftB: 2 };
  return { ...board, augurRevealedA: opp.hand.slice(), augurTurnsLeftA: 2 };
}

/** Cascade — draw 3 cards, then discard 1 random from hand (cycle a bad hand). */
export function applyCascade(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let after = drawCards(hero, 3);
  if (after.hand.length > 0) {
    const idx = Math.floor(Math.random() * after.hand.length);
    const droppedHand = [...after.hand.slice(0, idx), ...after.hand.slice(idx + 1)];
    after = { ...after, hand: droppedHand, discard: [...after.discard, after.hand[idx]] };
  }
  return withSideHero(board, side, after);
}

/** Reflet-Écho (Mirage) — cycle : pioche 1 carte puis défausse 1 au hasard. Fait
 *  tourner une main bloquée (insaisissable). Calqué sur Cascade (draw 3/disc 1). */
export function applyRefletEcho(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let after = drawCards(hero, 1);
  if (after.hand.length > 0) {
    const idx = Math.floor(Math.random() * after.hand.length);
    after = { ...after, hand: [...after.hand.slice(0, idx), ...after.hand.slice(idx + 1)], discard: [...after.discard, after.hand[idx]] };
  }
  return withSideHero(board, side, after);
}

/** Échappée — destroy 1 of my own creatures on the chosen lane, draw 2.
 *  "Cycle" a bad creature into fresh cards. */
export function applyEchappee(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c) return board;
  let after = withMyCreatureOnLane(board, side, spell.lane, null);
  const hero = side === "a" ? after.a : after.b;
  after = withSideHero(after, side, drawCards(hero, 2));
  return after;
}

/** Mascarade — DÉGUISEMENT (Alex 2026-06-11, refonte) : transforme TA créature
 *  ciblée en le symbole qui BAT la créature adverse en face (elle gagne la
 *  lane ce tour). Sans adversaire en face : elle prend le symbole de ta Voie.
 *  Fizzle s'il n'y a pas de créature à toi sur la lane. La créature redevient
 *  fraîche (PV/charges du nouveau symbole + passif correspondant). */
export function applyMascarade(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const me = getMyCreatureOnLane(board, side, spell.lane);
  if (!me) {
    alog("spell", `💤 ${side} Mascarade L${spell.lane} ne fait rien : aucune créature à toi sur cette lane à déguiser.`);
    return board;
  }
  const oppC = getOppCreatureOnLane(board, side, spell.lane);
  const hero = side === "a" ? board.a : board.b;
  // Symbole de déguisement : celui qui counter l'adversaire en face ;
  // sinon le symbole de Voie (pour relancer la Constellation).
  let newMove: Move;
  if (oppC) {
    newMove = MOVES.find((m) => moveCountersMove(m, oppC.move)) ?? me.move;
  } else {
    newMove = hero.affinity ?? me.move;
  }
  const disguised = makeCreature(newMove, side, hero.affinity);
  alog("spell", `${side} MASCARADE L${spell.lane} : ${me.move} → ${newMove}${oppC ? ` (counter ${oppC.move})` : ""}`);
  return withMyCreatureOnLane(board, side, spell.lane, disguised);
}

/** Sangsue — heal hero by the effective ATK of my creature on the lane, CAPÉ
 *  (BALANCE.foret.sangsueCap). Uses creatureEffectiveAtk so the value matches
 *  what the creature actually deals in combat (CREATURE_STATS + atkBuff). Le cap
 *  coupe le double-dip compoundant avec Photosynthèse (+1 ATK perm) qui rendait
 *  le vol de vie infini (Alex 2026-06-30, passe nerf Forêt). */
export function applySangsue(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c) return board;
  const atk = Math.min(BALANCE.foret.sangsueCap, creatureEffectiveAtk(c));
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, atk));
}

/** Trou Noir — destroy the opp's creature on a lane outright (ignores Anchor
 *  — this is a Singularity, not a poke). Spock's Logique IS strong enough to
 *  resist a single-target removal — the only sort that can clear Spock is
 *  combat or a board-wide (Genèse, Vortex). */
export function applyTrouNoir(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (opp?.spellImmune) return board;
  return withOppCreatureOnLane(board, side, spell.lane, null);
}

/** Marchand d'Âmes — pay 2 HP, draw 3 cards. Faustian. */
export function applyMarchandAmes(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const wounded = { ...hero, hp: Math.max(0, hero.hp - 2) };
  return withSideHero(board, side, drawCards(wounded, 3));
}

/** Paradoxe Temporel — both heroes take 5 damage. Self-harm board reset. */
export function applyParadoxe(board: BoardState): BoardState {
  return { ...board, a: damageHero(board.a, 5), b: damageHero(board.b, 5) };
}

/** Le Juge — both sides discard their full hand and draw 4 fresh. */
export function applyJuge(board: BoardState): BoardState {
  const reset = (h: BoardState["a"]): BoardState["a"] => {
    const discardAll = { ...h, discard: [...h.discard, ...h.hand], hand: [] as CardId[] };
    return drawCards(discardAll, 4);
  };
  return { ...board, a: reset(board.a), b: reset(board.b) };
}

/** Genèse — destroy ALL creatures on the board, both sides draw 3. */
export function applyGenese(board: BoardState): BoardState {
  const emptyLanes = board.lanes.map(() => ({ a: null, b: null })) as [LaneState, LaneState, LaneState];
  return {
    ...board,
    lanes: emptyLanes,
    a: drawCards(board.a, 3),
    b: drawCards(board.b, 3),
  };
}
