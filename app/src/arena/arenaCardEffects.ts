/**
 * Constellation Pro — card-as-spell effect table.
 *
 * Each of the 46 existing CardIds (from ranked/cards.ts) gets an Arena-mode
 * effect distinct from its Ranked effect (since the underlying mechanics
 * are different: HP/board state vs round wins). For MVP we ship effects
 * for ~15 cards; the rest fall back to a no-op + console warning so they
 * can be filtered out of the deck-builder in Arena context.
 *
 * Spell priorities (lower = earlier in the spell phase):
 *   100  defensive setup — Aegis, Anchor, Riposte
 *   200  buffs / debuffs — Precision, Surge, Curse, Tide
 *   300  utility / draw  — Prescience, Augur, Oracle, Mirror, Heist
 *   400  direct damage / removal — Supernova, Vortex
 *
 * Cards not yet ported to Arena have spellPriority 999 and `arenaSupported`
 * false — the Arena DeckManager filters those out so they can't be loaded.
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked adaptations.
 */

import { drawCards, damageHero, healHero, damageCreature, makeCreature } from "./arenaRules";
import { alog } from "./arenaLog";
import { applyFinisher } from "./arenaFinishers";
import {
  getMyCreatureOnLane,
  getOppCreatureOnLane,
  withMyCreatureOnLane,
  withOppCreatureOnLane,
  withSideHero,
  oppSide,
} from "./arenaSpellHelpers";
import {
  applyGaia, applySablier, applyOffre, applyRempart, applyBenediction,
  applyOracleInverse, applyCascade, applyEchappee, applyMascarade, applySangsue,
  applyTrouNoir, applyMarchandAmes, applyParadoxe, applyJuge, applyGenese,
} from "./arenaPhase2Spells";
import {
  applyFrappeParfaite, applyBastion, applyAvalanche, applySourceVitale,
  applyOmniscience, applyCocon, applyApocalypse, applyImposteur,
} from "./arenaFusionCards";
import {
  applyJetCaillou, applySeve, applyCoupOeil, applyPermutation, applyToileGluante,
  applyGravite, applyDoppelganger, applyPurge, applyRoueDestin, applyPhenix, applySingularite,
} from "./arenaPhase3Spells";
import { CREATURE_STATS, MANA_CAP, type BoardState, type Creature, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

export interface ArenaSpellContext {
  board: BoardState;
  side: Side;
  spell: PlayedSpell;
}

/* ───────────────────────── Priority table ───────────────────────── */

const PRIORITY_TABLE: Partial<Record<CardId, number>> = {
  // Defensive setup (100)
  aegis:        100,
  anchor:       110,
  riposte:      120,
  // Soins du HÉROS (470) — RESOLUS APRÈS les dégâts directs (Alex 2026-06-13) :
  // sinon le joueur voyait son PV MONTER (soin) PUIS DESCENDRE (Supernova) =
  // confus. Maintenant l'anim est dégât D'ABORD, soin ENSUITE. (Le verdict de
  // mort est calculé après TOUS les sorts → second souffle sauve toujours d'un
  // Supernova létal le même tour, le clamp à 0 est rattrapé par le soin.)
  "second-wind": 470,
  gaia:         475,
  // Mana / tempo (160) — fires early so the extra mana can be spent on
  // the same turn.
  sablier:      160,
  offre:        170,
  // Buffs / debuffs (200)
  precision:    200,
  surge:        210,
  tide:         220,
  rempart:      225,
  benediction:  228,
  curse:        230,
  // Utility / draw (300)
  prescience:   300,
  augur:        310,
  oracle:       320,
  "oracle-inverse": 325,
  mirror:       330,
  cascade:      335,
  echappee:     340,
  mascarade:    345,
  // Direct damage / removal (400)
  heist:        400,
  razzia:       408, // vol de la forge adverse (disruption setup)
  // ── 6 arts orphelins (2026-06-13) — alignés sur leur famille ──
  chronomancien: 165, // mana/tempo (tôt)
  surcharge:    215, // buff
  "double-mot": 218, // buff
  toxine:       236, // debuff
  echo:         322, // utility/pioche
  rappel:       412, // removal
  sangsue:      405,
  supernova:    410,
  vortex:       420,
  "trou-noir":  430,
  "marchand-ames": 440,
  paradoxe:     450,
  // Hand / board wipes (500) — fire LAST so prior effects are accounted for.
  juge:         500,
  genese:       510,
  // ⚗️ Cartes de FUSION (Forge 2026-06-13) — priorités alignées sur leur
  // famille (défense tôt, dégâts tard).
  bastion:           105,
  "source-vitale":   142,
  "frappe-parfaite": 212,
  cocon:             232,
  omniscience:       305,
  imposteur:         402,
  avalanche:         415,
  apocalypse:        460,
  // Finishers Lot D — fire EARLY (priority 60) so leur effet est en place
  // avant les autres sorts du tour (buff/debuff/dmg). C'est le climax du
  // hero, l'effet "écrase" la résolution.
  "finisher-forteresse":   60,
  "finisher-verger":       60,
  "finisher-lame":         60,
  "finisher-metamorphose": 60,
  "finisher-calcul":       60,
  // ── Nouvelles cartes Pro (2026-06-12) ──
  phenix:          130, // setup défensif (snapshot avant tout)
  seve:            148, // soin créature (avant buffs)
  "toile-gluante": 245, // debuff (après les buffs adverses)
  purge:           250, // dissipe APRÈS que les buffs adverses aient atterri
  permutation:     255, // manipulation de board
  "coup-oeil":     308, // pioche / info
  doppelganger:    348, // invocation utilitaire
  reverberation:   365, // TARD : rejoue le dernier sort déjà appliqué
  "jet-caillou":   405, // dégât direct créature
  gravite:         408, // dégât de zone
  singularite:     414, // dégât héros (scale board)
  "roue-destin":   418, // gamble, très tard
};

export function spellPriority(id: CardId): number {
  return PRIORITY_TABLE[id] ?? 999;
}

/** Whether a card has an Arena adaptation. The Arena DeckManager hides
 *  cards that return false here so the deck-builder doesn't allow a 0-effect
 *  card to be slotted. Will grow as Phase 2 adapts the remaining 30 cards. */
export function arenaSupported(id: CardId): boolean {
  return id in PRIORITY_TABLE;
}

/* ───────────────────────── Effect dispatch ───────────────────────── */

export function applyArenaSpell(ctx: ArenaSpellContext): BoardState {
  const { board, side, spell } = ctx;
  switch (spell.id) {
    // ── Defensive setup ──
    case "aegis":       return applyAegis(board, side, spell);
    case "anchor":      return applyAnchor(board, side, spell);
    case "riposte":     return applyRiposte(board, side, spell);
    case "second-wind": return applySecondWind(board, side);
    // ── Buffs / debuffs ──
    case "precision":   return applyPrecision(board, side, spell);
    case "surge":       return applySurge(board, side, spell);
    case "tide":        return applyTide(board, side);
    case "curse":       return applyCurse(board, side, spell);
    // ── Utility / draw ──
    case "prescience":  return applyPrescience(board, side);
    case "augur":       return applyAugur(board, side);
    case "oracle":      return applyOracle(board, side);
    case "mirror":      return applyMirror(board, side, spell);
    // ── Healing ──
    case "gaia":        return applyGaia(board, side);
    // ── Mana / tempo ──
    case "sablier":     return applySablier(board, side);
    case "offre":       return applyOffre(board, side);
    // ── Buffs / debuffs ──
    case "rempart":     return applyRempart(board, side);
    case "benediction": return applyBenediction(board, side);
    // ── Utility / draw ──
    case "oracle-inverse": return applyOracleInverse(board, side);
    case "cascade":     return applyCascade(board, side);
    case "echappee":    return applyEchappee(board, side, spell);
    case "mascarade":   return applyMascarade(board, side, spell);
    // ── Direct damage / removal ──
    case "heist":       return applyHeist(board, side);
    case "razzia":      return applyRazzia(board, side);
    case "surcharge":    return applySurcharge(board, side, spell);
    case "toxine":       return applyToxine(board, side, spell);
    case "rappel":       return applyRappel(board, side, spell);
    case "double-mot":   return applyDoubleMot(board, side, spell);
    case "echo":         return applyEcho(board, side);
    case "chronomancien": return applyChronomancien(board, side);
    case "sangsue":     return applySangsue(board, side, spell);
    case "supernova":   return applySupernova(board, side, spell);
    case "vortex":      return applyVortex(board, side);
    case "trou-noir":   return applyTrouNoir(board, side, spell);
    case "marchand-ames": return applyMarchandAmes(board, side);
    case "paradoxe":    return applyParadoxe(board);
    // ── Hand / board wipes ──
    case "juge":        return applyJuge(board);
    case "genese":      return applyGenese(board);
    // ── Nouvelles cartes Pro (2026-06-12) ──
    case "jet-caillou":   return applyJetCaillou(board, side, spell);
    case "seve":          return applySeve(board, side, spell);
    case "coup-oeil":     return applyCoupOeil(board, side);
    case "permutation":   return applyPermutation(board, side, spell);
    case "toile-gluante": return applyToileGluante(board, side, spell);
    case "gravite":       return applyGravite(board, side);
    case "doppelganger":  return applyDoppelganger(board, side);
    case "purge":         return applyPurge(board, side);
    case "roue-destin":   return applyRoueDestin(board, side);
    case "phenix":        return applyPhenix(board, side);
    case "singularite":   return applySingularite(board, side);
    case "reverberation": {
      // Rejoue le DERNIER sort non-réverbération appliqué par ce côté ce tour
      // (tracké dans applyAllSpells) sur sa cible d'origine. Appel récursif à
      // self — borné (le sort rejoué n'est jamais une réverbération).
      const last = side === "a" ? board.lastSpellAppliedA : board.lastSpellAppliedB;
      if (!last) {
        alog("spell", `💤 ${side} Réverbération ne fait rien : aucun sort joué avant elle ce tour.`);
        return board;
      }
      alog("spell", `${side} RÉVERBÉRATION → rejoue [${last.id}]`);
      return applyArenaSpell({ board, side, spell: last });
    }
    // ── ⚗️ Cartes de fusion (Forge) ──
    case "frappe-parfaite": return applyFrappeParfaite(board, side, spell);
    case "bastion":         return applyBastion(board, side, spell);
    case "avalanche":       return applyAvalanche(board, side);
    case "source-vitale":   return applySourceVitale(board, side, spell);
    case "omniscience":     return applyOmniscience(board, side);
    case "cocon":           return applyCocon(board, side, spell);
    case "apocalypse":      return applyApocalypse(board, side);
    case "imposteur":       return applyImposteur(board, side);
    // ── Finishers Lot D — Constellation Pro ──
    case "finisher-forteresse":
    case "finisher-verger":
    case "finisher-lame":
    case "finisher-metamorphose":
    case "finisher-calcul":
      return applyFinisher(board, side, spell.id);
    default:
      // Unadapted card — no-op for MVP. Phase 2 fills these in.
      // eslint-disable-next-line no-console
      console.warn(`[arena] card "${spell.id}" has no Arena effect yet`);
      return board;
  }
}

/* ───────────────────────── Individual spells ───────────────────────── */

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
 *  Le lock 1×/match (aegisCastThisMatch) a été LEVÉ (Alex 2026-06-11) :
 *  une copie en main = un cast, la règle générique suffit. Une cible
 *  invalide (Spock Détaché, lane vide) fizzle silencieusement comme tout
 *  sort. */
function applyAegis(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
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
function applyAnchor(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, anchored: true });
}

/** Riposte — if my creature dies in combat this turn, its killer dies too.
 *  Spock Détaché ignores it. */
function applyRiposte(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, ripostePrimed: true });
}

/** Second Wind — heal +4 HP to my hero. */
function applySecondWind(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, 4));
}

/** Precision — +2 ATK this turn to my creature. Spock Détaché ignores it. */
function applyPrecision(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 2 });
}

/** Surge — +3 ATK this turn to my creature. Spock Détaché ignores it. */
function applySurge(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 3 });
}

/** Tide — +1 ATK this turn to ALL my creatures. Spock Détaché skipped. */
function applyTide(board: BoardState, side: Side): BoardState {
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
function applyCurse(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) return board;
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, atkBuff: opp.atkBuff - 2 });
}

/** Prescience — draw 2 cards. */
function applyPrescience(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, drawCards(hero, 2));
}

/** Augur — reveal the opp's hand to the casting side. (Stored on the board
 *  so the UI can render the peek for two turns — Alex 2026-06-11). */
function applyAugur(board: BoardState, side: Side): BoardState {
  const opp = side === "a" ? board.b : board.a;
  if (side === "a") return { ...board, augurRevealedB: opp.hand.slice(0, 4), augurTurnsLeftB: 2 };
  return { ...board, augurRevealedA: opp.hand.slice(0, 4), augurTurnsLeftA: 2 };
}

/** Oracle — draw 3 cards. */
function applyOracle(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, drawCards(hero, 3));
}

/** Mirror — copy the opp's creature on a lane onto YOUR side of the same
 *  lane (if your side of that lane is empty). The copy starts at full HP. */
function applyMirror(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  const mine = getMyCreatureOnLane(board, side, spell.lane);
  if (!opp || mine) return board;
  // Pass my affinity so the copy gets the Voie bonus if applicable.
  const myAffinity = (side === "a" ? board.a : board.b).affinity;
  return withMyCreatureOnLane(board, side, spell.lane, makeCreature(opp.move, side, myAffinity));
}

/** Larcin (Heist) — vrai VOL d'une carte aléatoire de la main adverse
 *  (Alex 2026-06-11). La carte volée arrive dans MA main (respecte HAND_CAP,
 *  sinon burn). Si l'adversaire n'a plus de cartes en main, fallback sur
 *  3 dégâts au héros opp — un Larcin n'est jamais vain.
 *
 *  Cohérent avec l'anim Larcin (carte qui s'arrache de l'opp, vole vers moi). */
function applyHeist(board: BoardState, side: Side): BoardState {
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
function applyRazzia(board: BoardState, side: Side): BoardState {
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
function applySurcharge(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  const hp = Math.max(1, c.hp - 1);
  alog("spell", `${side} SURCHARGE L${spell.lane} : +4 ATK, ${c.hp}→${hp} PV`);
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 4, hp });
}

/** Toxine — frappe toxique : −3 PV ET −2 ATK à une créature ennemie (tue si ≤0). */
function applyToxine(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
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
function applyRappel(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp) return board;
  alog("spell", `${side} RAPPEL L${spell.lane} : créature ennemie ${opp.move} rappelée (retirée)`);
  return withOppCreatureOnLane(board, side, spell.lane, null);
}

/** Double Mot — DOUBLE l'ATK effective d'une de tes créatures ce tour (ajoute
 *  base+buff au buff). Spock Détaché ignore. */
function applyDoubleMot(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  const eff = CREATURE_STATS[c.move].atk + c.atkBuff;
  alog("spell", `${side} DOUBLE MOT L${spell.lane} : ATK ×2 (+${eff})`);
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + eff });
}

/** Echo — duplique une carte AU HASARD de ta main (résonance). */
function applyEcho(board: BoardState, side: Side): BoardState {
  const me = side === "a" ? board.a : board.b;
  if (me.hand.length === 0) return board;
  const idx = Math.floor(Math.random() * me.hand.length);
  const copy = me.hand[idx];
  alog("spell", `${side} ECHO : duplique [${copy}] en main`);
  return withSideHero(board, side, { ...me, hand: [...me.hand, copy] });
}

/** Chronomancien — accélération temporelle : +3 mana ce tour (clampé MANA_CAP). */
function applyChronomancien(board: BoardState, side: Side): BoardState {
  const me = side === "a" ? board.a : board.b;
  const mana = Math.min(MANA_CAP, me.mana + 3);
  alog("spell", `${side} CHRONOMANCIEN : ${me.mana}→${mana} mana`);
  return withSideHero(board, side, { ...me, mana });
}

/** Supernova — 6 damage to a target (lane creature OR opp hero). */
function applySupernova(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
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
function applyVortex(board: BoardState, side: Side): BoardState {
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

/* Phase 2 spells (gaia, sablier, offre, rempart, benediction, oracle-inverse,
 * cascade, echappee, mascarade, sangsue, trou-noir, marchand-ames, paradoxe,
 * juge, genese) live in arenaPhase2Spells.ts — imported above. */
