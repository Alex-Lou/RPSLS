import { CREATURE_STATS, type Creature, type HeroState, type Side } from "../arenaTypes";
import { BALANCE } from "../arenaBalance";
import type { Move } from "../../engine/game";

/* ───────────────────────── Hero helpers ───────────────────────── */

/** Apply damage to a hero, honoring Divine Shield (Aegis on hero). Returns
 *  the new HeroState. If shielded, the shield is consumed and HP unchanged. */
export function damageHero(hero: HeroState, dmg: number): HeroState {
  if (dmg <= 0) return hero;
  if (hero.divineShield) return { ...hero, divineShield: false };
  return { ...hero, hp: Math.max(0, hero.hp - dmg) };
}

export function healHero(hero: HeroState, amount: number): HeroState {
  if (amount <= 0) return hero;
  return { ...hero, hp: Math.min(hero.maxHp, hero.hp + amount) };
}

/* ───────────────────────── Creature helpers ───────────────────────── */

export function makeCreature(move: Move, side: Side, affinity?: Move): Creature {
  const stats = CREATURE_STATS[move];
  const matchesAffinity = affinity !== undefined && affinity === move;
  // Voie bonuses (Constellation Pro v2 Couche 1) — applied at summon if the
  // creature's move matches the hero's affinity. See ArenaLobby's VOIE_BONUS
  // for the user-facing description.
  //   Pierre  : provocationCharges 2 (au lieu de 1)
  //   Ciseaux : hp +1 (HP 2 au lieu de 1 — survit à un échange)
  //   Spock   : voieAtkBonus +1 (ATK perm 3 au lieu de 2)
  //   Feuille : wiltSkipNext true → Fanaison ralentie (wilt tous les 2 tours)
  //   Lézard  : dodgeCharges 2 (au lieu de 1) + voieAtkBonus +1 (ATK 2 au lieu
  //             de 1 — l'esquive devait pouvoir CONVERTIR ; sim : Lézard pur mur
  //             ne gagnait jamais, Mirage à 20%).
  const voieRockCharges = matchesAffinity && move === "rock" ? BALANCE.montagne.voieProvocationCharges : (move === "rock" ? 1 : 0);
  const voieScissorsHpBonus = matchesAffinity && move === "scissors" ? BALANCE.tranchant.voieScissorsHp : 0;
  const voieAtkBonus = matchesAffinity && (move === "spock" || move === "lizard") ? BALANCE.engine.voieAtkBonus : 0;
  // Lot B Round 8 : Lézard base 1 charge dodge, Voie Lézard 2 charges (tunable).
  const dodgeCharges = move === "lizard" ? (matchesAffinity ? BALANCE.mirage.voieLizardDodge : 1) : 0;
  // Voie Feuille : flag persistent + toggle wiltSkipNext démarre à true.
  // 1er endOfTurnReset SKIP (Feuille reste ATK 3 ce tour), 2e wilt à 1, 3e
  // SKIP, 4e wilt à 2, 5e SKIP, etc. → Fanaison divisée par 2.
  const voieFeuille = matchesAffinity && move === "paper";
  const wiltSkipNext = voieFeuille;
  return {
    move,
    side,
    hp: stats.hp + voieScissorsHpBonus,
    atkBuff: 0,
    divineShield: false,
    anchored: false,
    ripostePrimed: false,
    // Innate RPSLS passives — one per symbol, tied to RPSLS identity.
    taunt:       move === "rock",     // 🛡 Provocation
    pierces:     move === "scissors", // ⚔ Tranchant
    pierceUsed:  false,                // Tranchant : 1 charge (consume au 1er bypass Aegis)
    dodgeCharges,                      // ✨ Esquive (Lézard 1 ou 2 charges)
    spellImmune: move === "spock",    // 🧬 Logique
    summonedThisTurn: true,           // Lente (Pierre 0 ATK) / Lent (Lézard 1)
    wiltedSteps: 0,                    // Fanaison (Feuille: -1/turn ou -1/2 turns Voie)
    voieFeuille,                       // Lot B Round 8 — flag Voie Feuille
    wiltSkipNext,                      // Voie Feuille slow wilt toggle
    combatBlunted: false,              // Émoussé (Ciseaux: -1 after 1st combat)
    provocationCharges: voieRockCharges,
    voieAtkBonus,
  };
}

export function creatureEffectiveAtk(c: Creature): number {
  // Toile Gluante (2026-06-12) : la créature englutée ne peut pas attaquer ce
  // tour → ATK effectif 0 (badge ⚔0). En combat son counter est aussi annulé
  // (cf. arenaCombat) pour qu'elle ne gagne aucune lane.
  if (c.cannotAttack) return 0;
  const base = CREATURE_STATS[c.move].atk + c.atkBuff + c.voieAtkBonus;
  // ── Lente / Lent : the turn a Pierre or Lézard is summoned, its ATK is
  //    suppressed (Pierre → 0, Lézard → 1). All other moves attack normally
  //    the turn they land. Buff stacking still applies (a Surge on Pierre
  //    the turn it's summoned still goes through).
  if (c.summonedThisTurn) {
    if (c.move === "rock")   return Math.max(0, 0 + c.atkBuff + c.voieAtkBonus);
    if (c.move === "lizard") return Math.max(0, 1 + c.atkBuff + c.voieAtkBonus);
  }
  // ── Fanaison : Feuille loses 1 ATK per turn elapsed since summon, floor 1.
  //    So a freshly summoned Paper is 3, next turn 2, then 1, then stays 1.
  if (c.move === "paper" && c.wiltedSteps > 0) {
    return Math.max(1, CREATURE_STATS.paper.atk - c.wiltedSteps + c.atkBuff + c.voieAtkBonus);
  }
  // ── Émoussé : Ciseaux loses 1 ATK permanently after its first combat.
  if (c.combatBlunted) {
    return Math.max(0, base - 1);
  }
  return Math.max(0, base);
}

/** Esquive consommée — −1 charge. Un LÉZARD GRANDIT (+ATK perm) à CHAQUE esquive
 *  réussie : l'évasion se CONVERTIT en menace (win-con Mirage, Alex 2026-06-28).
 *  `BALANCE.mirage.dodgeGrowAtk = 0` → iso-comportement (juste le décrément). Le
 *  point de passage UNIQUE de toute esquive (combat + sorts) pour ne rien rater. */
export function dodgeSave(c: Creature): Creature {
  const dodgeCharges = c.dodgeCharges - 1;
  if (c.move !== "lizard" || BALANCE.mirage.dodgeGrowAtk <= 0) return { ...c, dodgeCharges };
  // Le grandit est PLAFONNÉ (dodgeGrowAtkCap) — fini l'ATK exponentielle d'un
  // Lézard qui esquive 9× (audit 2026-06-28).
  const voieAtkBonus = Math.min(BALANCE.mirage.dodgeGrowAtkCap, c.voieAtkBonus + BALANCE.mirage.dodgeGrowAtk);
  return { ...c, dodgeCharges, voieAtkBonus };
}

/** Apply damage to a creature, honoring its defenses in order:
 *   1. Esquive (Lézard dodgeCharges) — intrinsèque, prioritaire sur divineShield.
 *      Consume 1 charge (et fait grandir le Lézard, cf. dodgeSave). Voie = 2 charges.
 *   2. Divine Shield (Aegis spell) — consommé au 1er dégât.
 *  Returns the new creature, or null if it died. */
export function damageCreature(c: Creature, dmg: number): Creature | null {
  if (dmg <= 0) return c;
  if (c.phasedOut) return c; // ÉCLIPSE N2 : créature en phase = intouchable (zéro dégât, ne consomme même pas d'Esquive) — couvre AoE Gravité/Apocalypse qui ignorent l'Ancre
  if (c.dodgeCharges > 0) return dodgeSave(c);
  if (c.divineShield) return { ...c, divineShield: false };
  const hp = c.hp - dmg;
  if (hp <= 0) return null;
  return { ...c, hp };
}

/** Soigne une créature (Sève). Plafonne à ses PV de base (CREATURE_STATS) MAIS
 *  ne RÉDUIT jamais une créature déjà au-dessus (ex. boostée par Rempart). */
export function healCreature(c: Creature, amount: number): Creature {
  if (amount <= 0) return c;
  const cap = Math.max(c.hp, CREATURE_STATS[c.move].hp);
  return { ...c, hp: Math.min(cap, c.hp + amount) };
}

// bluntOnCombat / damageCreaturePierce → déplacés dans ./arenaCombat.ts
// (refactor 2026-06-09 : arenaRules.ts dépassait 700 lignes).

/** A creature's "per-turn" buffs (atkBuff, anchored, riposte) reset at the
 *  END of the turn so they don't snowball forever. Persistent damage stays.
 *  Innate passives (taunt, pierces, spellImmune) and consumed
 *  resources (dodgeCharges, combatBlunted) persist across turns.
 *  - divineShield: persists across turns until consumed by damage.
 *  - summonedThisTurn: cleared (the "Lente/Lent" malus only bites turn 1).
 *  - wiltedSteps: incremented for Paper (drives Fanaison).
 *  - wiltSkipNext: Voie Feuille toggle — skip wilt this turn et flip false.
 *  - vergerActive (param) : Finisher VERGER ÉTERNEL du hero propriétaire —
 *    Fanaison OFF en continu (le wilt ne s'incrémente plus du tout). Avant,
 *    le finisher ne faisait qu'un reset one-shot et les Feuilles re-fanaient
 *    dès le tour suivant, contrairement au texte de la carte. */
/** STRATES — Voie de la Montagne (Alex 2026-06-17, pilote « Voies = archétypes »).
 *  Une PIERRE du joueur Montagne qui a TENU un tour (a survécu au combat ET
 *  n'était pas fraîchement posée) gagne +1 ATK PERMANENT (voieAtkBonus), cap +3.
 *  « La défense produit l'offensive » : le mur qui tient grossit en menace. 100%
 *  ADDITIF (ne change jamais l'issue du combat) → faible risque. `wasFreshlySummoned`
 *  = c.summonedThisTurn AVANT endOfTurnReset (sinon une Pierre gagnerait une Strate
 *  le tour même de son arrivée). voieAtkBonus est porté par creatureEffectiveAtk +
 *  persiste tour à tour → l'ATK affichée monte d'elle-même (cue lisible). */
export const STRATE_CAP = 3;
export function gainStrateIfHeld(c: Creature, ownerAffinity: Move | undefined, wasFreshlySummoned: boolean): Creature {
  if (ownerAffinity !== "rock" || c.move !== "rock" || wasFreshlySummoned || c.voieAtkBonus >= STRATE_CAP) return c;
  // Une Pierre qui TIENT épaissit le mur : +1 ATK ET +1 PV (le mur grossit en
  // menace ET en durabilité). Le +PV est plafonné en lockstep avec STRATE_CAP
  // (early-return ci-dessus) → max +3 PV. Rend la Montagne réellement increvable
  // à la défense (sim : sans ça elle finissait à 6 PV et fondait vs heal/chip).
  return { ...c, voieAtkBonus: c.voieAtkBonus + BALANCE.montagne.strateAtk, hp: c.hp + BALANCE.montagne.strateHp };
}

export function endOfTurnReset(c: Creature, vergerActive = false, trancheBonus = 0): Creature {
  // Lot B Round 8 — Voie Feuille slow wilt (Fanaison ÷ 2) :
  //   voieFeuille=true + wiltSkipNext=true  → SKIP wilt ce tour, flip à false
  //   voieFeuille=true + wiltSkipNext=false → wilt + flip à true (skip prochain)
  //   voieFeuille=false (Feuille normale)   → wilt chaque tour, no toggle
  let wilted = c.wiltedSteps;
  let nextSkip = c.wiltSkipNext;
  if (c.move === "paper" && !vergerActive) {
    if (c.voieFeuille) {
      if (c.wiltSkipNext) {
        // Skip ce tour, prochain tour wilt.
        nextSkip = false;
      } else {
        // Wilt ce tour, prochain tour skip.
        wilted = c.wiltedSteps + 1;
        nextSkip = true;
      }
    } else {
      // Feuille normale (hors Voie) : wilt chaque tour.
      wilted = c.wiltedSteps + 1;
    }
  }
  return {
    ...c,
    // TRANCHE (engine Tranchant) : atkBuff repart non pas à 0 mais au bonus GLOBAL
    // de la jauge Tranche du propriétaire (re-appliqué chaque tour → +ATK à TOUT le
    // camp, peu importe le symbole). 0 hors Tranchant. Additif aux buffs du tour.
    atkBuff: trancheBonus,
    anchored: false,
    ripostePrimed: false,
    cannotAttack: false, // Toile Gluante expire en fin de tour
    phasedOut: false,    // Éclipse expire en fin de tour
    justRevived: false,  // flamme de renaissance Phénix consommée
    summonedThisTurn: false,
    wiltedSteps: wilted,
    wiltSkipNext: nextSkip,
  };
}
