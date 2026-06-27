/**
 * Constellation Pro — effets des sorts « Phase 1 » (les ~22 premiers adaptés).
 *
 * Extrait verbatim de arenaCardEffects.ts (Alex 2026-06-22, « au fil de l'eau » :
 * ce fichier-dispatch dépassait 400 lignes ; son propre en-tête prescrivait que
 * SEULS la table de priorité + le switch y restent, les CORPS dans des fichiers
 * phase). Mêmes conventions (board, side, spell?) que phase2/phase3. Comportement
 * BYTE-IDENTIQUE (aucune valeur changée) ; seules les fns passent en `export`.
 */

import { drawCards, damageHero, healHero, damageCreature, makeCreature } from "./arenaRules";
import {
  getMyCreatureOnLane, getOppCreatureOnLane,
  withMyCreatureOnLane, withOppCreatureOnLane, withSideHero, oppSide,
} from "./arenaSpellHelpers";
import { CREATURE_STATS, MANA_CAP, type BoardState, type Creature, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import { BALANCE } from "./arenaBalance";
import { alog } from "./arenaLog";

/** Spock's Détaché malus — ANY of MY buffs (Aegis, Surge, Tide, etc.) that
 *  target a Spock creature get ignored silently. Spock lives in autarky.
 *  Sangsue/Échappée are NOT buffs (they read or destroy), they go through. */
function isDetached(c: Creature | null | undefined): boolean {
  return !!c && c.move === "spock";
}

/** Aegis — Divine Shield: lane-target → my creature there absorbs next dmg.
 *  Self-target → my HERO gets the shield. Spock Détaché ignores it.
 *  BONUS on a Pierre target: ALSO refills its Provocation charge to 1 — Aegis
 *  becomes the dedicated "rebuild the tank" tool when its charge is spent.
 *
 *  Le lock 1×/match a été LEVÉ (Alex 2026-06-11) :
 *  une copie en main = un cast, la règle générique suffit. Une cible
 *  invalide (Spock Détaché, lane vide) fizzle silencieusement comme tout
 *  sort. */
export function applyAegis(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind === "lane") {
    const c = getMyCreatureOnLane(board, side, spell.lane);
    if (!c || isDetached(c)) {
      alog("spell", `💤 ${side} Aegis L${spell.lane} ne fait rien : pas de créature à toi sur cette lane (ou Spock, immunisé aux buffs).`);
      return board;
    }
    const refilled = c.move === "rock"
      ? { ...c, divineShield: true, provocationCharges: Math.max(c.provocationCharges, 1) }
      : { ...c, divineShield: true };
    return withMyCreatureOnLane(board, side, spell.lane, refilled);
  }
  if (spell.kind === "self") {
    const hero = side === "a" ? board.a : board.b;
    return withSideHero(board, side, { ...hero, divineShield: true });
  }
  return board;
}

/** Anchor — my creature on that lane is IMMUNE to enemy spells this turn.
 *  Spock Détaché ignores it (Spock has Logique anyway, doesn't need it). */
export function applyAnchor(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, anchored: true });
}

/** Riposte — if my creature dies in combat this turn, its killer dies too.
 *  Spock Détaché ignores it. */
export function applyRiposte(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, ripostePrimed: true });
}

/** Second Wind — heal my hero (BALANCE.foret.secondWindHeal, défaut 4). */
export function applySecondWind(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, BALANCE.foret.secondWindHeal));
}

/** Precision — +2 ATK this turn to my creature. Spock Détaché ignores it. */
export function applyPrecision(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 2 });
}

/** Surge — +3 ATK this turn to my creature. Spock Détaché ignores it. */
export function applySurge(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 3 });
}

/** Tide — +1 ATK this turn to ALL my creatures. Spock Détaché skipped. */
export function applyTide(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || isDetached(me)) return lane;
    const bumped: Creature = { ...me, atkBuff: me.atkBuff + 1 };
    return side === "a" ? { ...lane, a: bumped } : { ...lane, b: bumped };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Curse — -2 ATK this turn on the opp's creature on the chosen lane.
 *  Blocked by Anchor OR by Logique (Spock's spell immunity). */
export function applyCurse(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) return board;
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, atkBuff: opp.atkBuff - 2 });
}

/** Prescience — draw 2 cards. */
export function applyPrescience(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, drawCards(hero, 2));
}

/** Augur — reveal the opp's hand to the casting side. (Stored on the board
 *  so the UI can render the peek for two turns — Alex 2026-06-11). */
export function applyAugur(board: BoardState, side: Side): BoardState {
  const opp = side === "a" ? board.b : board.a;
  if (side === "a") return { ...board, augurRevealedB: opp.hand.slice(0, 4), augurTurnsLeftB: 2 };
  return { ...board, augurRevealedA: opp.hand.slice(0, 4), augurTurnsLeftA: 2 };
}

/** Oracle — draw 3 cards. */
export function applyOracle(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, drawCards(hero, 3));
}

/** Mirror (Miroir) — REWORK (Alex 2026-06-17) : copie la créature adverse d'une
 *  lane sur TA case vide de la MÊME lane AVEC SES STATS ACTUELLES (PV courants +
 *  buffs ATK + bonus de Voie type Strates) → un 4/4 buffé devient TON 4/4.
 *
 *  POURQUOI : avant, Miroir ne copiait qu'un corps de BASE → STRICTEMENT moins
 *  bon qu'invoquer GRATUITEMENT le counter du symbole (kill propre), donc inutile.
 *  Désormais elle ÉGALE une menace développée qu'on ne peut PAS recréer en
 *  invoquant — vrai cas d'usage, et chiant pour l'adversaire (son investissement
 *  est copié). Les capacités GRANTÉES (bouclier Aegis, esquive bonus) ne sont PAS
 *  copiées — seules les stats. Copie FRAÎCHE chez toi (Lente si Pierre/Lézard). */
export function applyMirror(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  const mine = getMyCreatureOnLane(board, side, spell.lane);
  if (!opp || mine) return board;
  // Base du MÊME symbole côté moi (flags naturels du move + mon bonus de Voie),
  // puis on ÉCRASE les stats par celles ACTUELLES de la créature adverse.
  const myAffinity = (side === "a" ? board.a : board.b).affinity;
  const base = makeCreature(opp.move, side, myAffinity);
  return withMyCreatureOnLane(board, side, spell.lane, {
    ...base,
    hp: opp.hp,                     // PV courants (y compris au-dessus de la base via Rempart)
    atkBuff: opp.atkBuff,           // buffs ATK accumulés
    voieAtkBonus: opp.voieAtkBonus, // bonus de Voie (Strates, etc.) → ATK égalée
  });
}

/** Larcin (Heist) — vrai VOL d'une carte aléatoire de la main adverse
 *  (Alex 2026-06-11). La carte volée arrive dans MA main (respecte HAND_CAP,
 *  sinon burn). Si l'adversaire n'a plus de cartes en main, fallback sur
 *  3 dégâts au héros opp — un Larcin n'est jamais vain.
 *
 *  Cohérent avec l'anim Larcin (carte qui s'arrache de l'opp, vole vers moi). */
export function applyHeist(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? board.a : board.b;
  if (oppHero.hand.length === 0) {
    alog("spell", `${side} LARCIN → main adverse vide, fallback 3 dmg hero ${oppS}`);
    return withSideHero(board, oppS, damageHero(oppHero, 3));
  }
  // Pige aléatoire dans la main adverse.
  const idx = Math.floor(Math.random() * oppHero.hand.length);
  const stolen = oppHero.hand[idx];
  const newOppHand = [...oppHero.hand.slice(0, idx), ...oppHero.hand.slice(idx + 1)];
  let after = withSideHero(board, oppS, { ...oppHero, hand: newOppHand });
  const mine = side === "a" ? after.a : after.b;
  // Larcin OVERDRAW (Alex 2026-06-11 "pourquoi elle va pas dans ma main ?") :
  // la carte volée arrive TOUJOURS dans la main, même si tu es déjà à
  // HAND_CAP=7 → 8 cartes autorisées pour le Larcin. Sinon le sort perdait
  // tout son sens narratif quand ta main était pleine.
  const newMyHand = [...mine.hand, stolen];
  alog("spell", `${side} LARCIN → [${stolen}] volée à ${oppS} et ajoutée en main (${newMyHand.length}/8 cap+1)`);
  // Side-channel : on stocke l'ID volé sur le board pour que l'UI sync l'anim
  // Larcin avec la VRAIE carte (au lieu d'une heuristique première-carte).
  after = withSideHero(after, side, { ...mine, hand: newMyHand });
  return { ...after, lastHeistStolenA: side === "a" ? stolen : after.lastHeistStolenA,
                     lastHeistStolenB: side === "b" ? stolen : after.lastHeistStolenB };
}

/** Razzia — vole la carte posée sur la FORGE adverse (dépôt ou carte forgée
 *  non récupérée) → arrive dans TA main. Forge adverse vide : sans effet. */
export function applyRazzia(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const oppForge = oppS === "a" ? board.forgeA : board.forgeB;
  if (!oppForge) {
    alog("spell", `${side} RAZZIA → forge ${oppS} vide, sans effet`);
    return board;
  }
  const mine = side === "a" ? board.a : board.b;
  const after = withSideHero(board, side, { ...mine, hand: [...mine.hand, oppForge] });
  alog("spell", `${side} RAZZIA → vole [${oppForge}] sur la forge ${oppS} → main`);
  return oppS === "a" ? { ...after, forgeA: null } : { ...after, forgeB: null };
}

/* ─── 6 arts orphelins câblés (Alex 2026-06-13) ─────────────────────────── */

/** Surcharge — overcharge : +4 ATK ce tour à TA créature, mais −1 PV (coût,
 *  clampé à 1 → ne se suicide pas). Spock Détaché ignore le buff. */
export function applySurcharge(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  const hp = Math.max(1, c.hp - 1);
  alog("spell", `${side} SURCHARGE L${spell.lane} : +4 ATK, ${c.hp}→${hp} PV`);
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 4, hp });
}

/** Toxine — frappe toxique : −3 PV ET −2 ATK à une créature ennemie (tue si ≤0). */
export function applyToxine(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp) return board;
  const hp = opp.hp - 3;
  if (hp <= 0) {
    alog("spell", `${side} TOXINE L${spell.lane} : créature ennemie empoisonnée à mort`);
    return withOppCreatureOnLane(board, side, spell.lane, null);
  }
  alog("spell", `${side} TOXINE L${spell.lane} : ${opp.hp}→${hp} PV, −2 ATK`);
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, hp, atkBuff: opp.atkBuff - 2 });
}

/** Rappel — retire (rappelle du champ) une créature ennemie. */
export function applyRappel(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp) return board;
  alog("spell", `${side} RAPPEL L${spell.lane} : créature ennemie ${opp.move} rappelée (retirée)`);
  return withOppCreatureOnLane(board, side, spell.lane, null);
}

/** Double Mot — DOUBLE l'ATK effective d'une de tes créatures ce tour (ajoute
 *  base+buff au buff). Spock Détaché ignore. */
export function applyDoubleMot(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  const eff = CREATURE_STATS[c.move].atk + c.atkBuff;
  alog("spell", `${side} DOUBLE MOT L${spell.lane} : ATK ×2 (+${eff})`);
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + eff });
}

/** Echo — duplique une carte AU HASARD de ta main (résonance). */
export function applyEcho(board: BoardState, side: Side): BoardState {
  const me = side === "a" ? board.a : board.b;
  if (me.hand.length === 0) return board;
  const idx = Math.floor(Math.random() * me.hand.length);
  const copy = me.hand[idx];
  alog("spell", `${side} ECHO : duplique [${copy}] en main`);
  return withSideHero(board, side, { ...me, hand: [...me.hand, copy] });
}

/** Chronomancien — accélération temporelle : +3 mana ce tour (clampé MANA_CAP). */
export function applyChronomancien(board: BoardState, side: Side): BoardState {
  const me = side === "a" ? board.a : board.b;
  const mana = Math.min(MANA_CAP, me.mana + 3);
  alog("spell", `${side} CHRONOMANCIEN : ${me.mana}→${mana} mana`);
  return withSideHero(board, side, { ...me, mana });
}

/** Supernova — 6 damage to a target (lane creature OR opp hero). */
export function applySupernova(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind === "hero") {
    const oppS = oppSide(side);
    const oppHero = oppS === "a" ? board.a : board.b;
    alog("spell", `${side} SUPERNOVA → 6 dmg hero ${oppS}`);
    return withSideHero(board, oppS, damageHero(oppHero, 6));
  }
  if (spell.kind === "lane") {
    const opp = getOppCreatureOnLane(board, side, spell.lane);
    // Spock's Logique fizzle hostile spells, just like Anchor.
    if (!opp || opp.anchored || opp.spellImmune) {
      alog("spell", `💤 ${side} Supernova L${spell.lane} ne fait rien : aucune créature adverse, ou elle est ancrée/immunisée (Spock).`);
      return board;
    }
    alog("spell", `${side} SUPERNOVA L${spell.lane} → 6 dmg creature opp`);
    const damaged = damageCreature(opp, 6);
    return withOppCreatureOnLane(board, side, spell.lane, damaged);
  }
  return board;
}

/** Vortex — rotate the opp's creatures clockwise across their 3 lanes. */
export function applyVortex(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  const c0 = oppS === "a" ? lanes[0].a : lanes[0].b;
  const c1 = oppS === "a" ? lanes[1].a : lanes[1].b;
  const c2 = oppS === "a" ? lanes[2].a : lanes[2].b;
  // 0→1, 1→2, 2→0
  const newC: [Creature | null, Creature | null, Creature | null] = [c2, c0, c1];
  for (let i = 0; i < 3; i++) {
    if (oppS === "a") lanes[i] = { ...lanes[i], a: newC[i] };
    else lanes[i] = { ...lanes[i], b: newC[i] };
  }
  return { ...board, lanes };
}
