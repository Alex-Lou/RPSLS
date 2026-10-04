/**
 * Choix du symbole à invoquer pour le CPU (arenaAI) : biais de persona,
 * pickBestMove (Voie-aware, garde-fou du Tracé) et bestCounter.
 * ⚠ Consomme Math.random() (RNG seedé en lockstep) : l'ordre des tirages est
 * celui d'origine, ne pas le modifier.
 */
import { CREATURE_STATS, moveCountersMove } from "./arenaTypes";
import type { CpuPersona, Creature } from "./arenaTypes";
import { affinityEdges } from "./arenaTrace";
import type { Move } from "../engine/game";

const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

/** Biais d'IA par persona (Alex 2026-06-11). Chaque persona penche pour un
 *  axe gameplay distinct → matches feel différents selon qui te tombe dessus.
 *  - tactician : counter optimal + bloque la Voie joueur intensément
 *  - aggressor : push lethal asap (sorts damage, peu de défense)
 *  - builder   : focus SA Voie pour build 3⭐ rapidement
 *  - defender  : Aegis/Anchor + Pierre Provoc, prudent */
export interface PersonaBias {
  /** % de chance de poser SA Voie sur une lane vide. */
  affinityBuildChance: number;
  /** % de chance de prioriser le counter de la Voie joueur (créature qui
   *  match l'affinity joueur) vs le counter de n'importe quelle créature. */
  blockPlayerVoieChance: number;
  /** Skip chance multiplier (1 = normal, >1 plus passif). */
  spellSkipMult: number;
  /** Si true, le CPU pousse lethal damage agressivement (heist/supernova
   *  cast plus tôt même si player a > 6 HP). */
  prioritizeLethal: boolean;
}

// Bias adoucis (Alex 2026-06-11) : pas de "lecteur parfait", l'IA reste une
// stratégie crédible avec des chances honnêtes — jamais 100%, jamais d'info
// privée. Les valeurs sont volontairement basses pour laisser de la place
// au plan du joueur ; un humain qui joue prudent fait des choix similaires.
const PERSONA_BIAS: Record<CpuPersona, PersonaBias> = {
  tactician: { affinityBuildChance: 0.45, blockPlayerVoieChance: 0.50, spellSkipMult: 1.0, prioritizeLethal: true  },
  aggressor: { affinityBuildChance: 0.30, blockPlayerVoieChance: 0.25, spellSkipMult: 0.8, prioritizeLethal: true  },
  builder:   { affinityBuildChance: 0.60, blockPlayerVoieChance: 0.15, spellSkipMult: 1.2, prioritizeLethal: false },
  defender:  { affinityBuildChance: 0.40, blockPlayerVoieChance: 0.40, spellSkipMult: 1.3, prioritizeLethal: false },
};
const DEFAULT_BIAS: PersonaBias = { affinityBuildChance: 0.45, blockPlayerVoieChance: 0.25, spellSkipMult: 1.0, prioritizeLethal: false };

export function biasFor(persona: CpuPersona | undefined): PersonaBias {
  return persona ? PERSONA_BIAS[persona] : DEFAULT_BIAS;
}

/** Pick the best RPSLS move to summon against `opp`. Voie-aware (Alex
 *  2026-06-11) : si l'IA peut construire SA Constellation (affinityBuildChance)
 *  elle pose son symbole sur lane vide. Face à une créature opp qui MATCH la
 *  Voie joueur, elle priorise la counter (blockPlayerVoieChance) — c'est la
 *  vraie raison d'avoir choisi une Voie : ton plan se voit et se contre.
 *  Pierre is favored slightly (defensive opener, cheap and tanks attacks);
 *  Ciseaux and Lézard are the offensive flavors. */
export function pickBestMove(
  opp: Creature | null,
  myAffinity: Move | undefined,
  oppAffinity: Move | undefined,
  bias: PersonaBias,
  humanStars = 0,
): Move {
  // LE TRACÉ — garde-fou IA : SEULEMENT quand l'humain est PROCHE du tracé (≥2
  // arêtes), le CPU ÉVITE (dans ses pioches random) de poser les 2 symboles que la
  // Voie humaine counter → il se dérobe au dernier moment, sans rendre le early/mid
  // mou (Alex 2026-06-23 « beaucoup plus mou »). Build de SA Voie + counters gardés.
  const avoidMoves: Move[] = oppAffinity && humanStars >= 2 ? affinityEdges(oppAffinity) : [];
  const draw = (bag: Move[]): Move => {
    const pool = avoidMoves.length ? bag.filter((m) => !avoidMoves.includes(m)) : bag;
    const safe = pool.length ? pool : bag;
    return safe[Math.floor(Math.random() * safe.length)];
  };
  // Cas lane VIDE : opportunité de poser SA Voie pour build sa Constellation.
  if (!opp) {
    // 🦎 MIRAGE — engagement renforcé sur les Lézards : tout le kit Mirage
    //   (Frappe/Nuée/Faux-Semblant/Éclipse + montée d'Esquive) est Lézard-gated,
    //   et un Lézard de Voie arrive avec des charges d'Esquive (il survit à un
    //   counter). Sans densité de Lézards, le kit fizzle = carburant absent
    //   (constaté sim : Mirage 19%, le CPU posait surtout des counters non-Lézard).
    //   Les autres Voies gardent leur build chance (leur symbole GAGNE le RPSLS,
    //   pas besoin de sur-densité). Plancher 0.75 pour Mirage uniquement.
    const buildChance = myAffinity === "lizard"
      ? Math.max(bias.affinityBuildChance, 0.75)
      : bias.affinityBuildChance;
    if (myAffinity && Math.random() < buildChance) {
      return myAffinity;
    }
    // Sinon bag défensif (mêmes proportions qu'avant) — varié.
    const bag: Move[] = ["rock", "rock", "rock", "spock", "spock", "scissors", "scissors", "lizard", "paper"];
    return draw(bag);
  }
  // Face à une créature opp qui MATCH la Voie joueur → priorité blocage
  // (le CPU "lit" ton plan et le contre).
  if (oppAffinity && opp.move === oppAffinity && Math.random() < bias.blockPlayerVoieChance) {
    return bestCounter(opp.move, myAffinity);
  }
  // Variance vs counter parfait (Round 9) — 30% bag random pour pas que le
  // joueur sente "CPU triche". Builder persona varie plus (1.3× skip implique
  // moins d'agression brute) — déjà calibré par bias.
  if (Math.random() < 0.30) {
    const bag: Move[] = ["rock", "rock", "rock", "spock", "spock", "scissors", "scissors", "lizard", "paper"];
    return draw(bag);
  }
  if (MOVES.some((mv) => moveCountersMove(mv, opp.move))) return bestCounter(opp.move, myAffinity);
  // Fallback when the move can't be RPSLS-countered (impossible in practice
  // for the 5-symbol table, but guards against future extensions). Random
  // from the bag instead of hardcoded Scissors.
  const fallbackBag: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
  return draw(fallbackBag);
}

/** Meilleur counter RPSLS de `oppMove`. Si MA Voie fait partie des counters, on
 *  la préfère (audit 2026-10 : le tri ATK/HP choisissait toujours Ciseaux vs
 *  Feuille, Feuille vs Spock, jamais Lézard → la Voie n'était pas jouée et le
 *  moteur de Voie ne montait pas). Sinon : meilleur ATK/HP pour l'échange. */
export function bestCounter(oppMove: Move, myAffinity: Move | undefined): Move {
  const counters = MOVES.filter((mv) => moveCountersMove(mv, oppMove));
  if (myAffinity && counters.includes(myAffinity)) return myAffinity;
  let best = counters[0];
  for (const mv of counters) {
    const s = CREATURE_STATS[mv];
    const bs = CREATURE_STATS[best];
    if (s.atk * 10 + s.hp > bs.atk * 10 + bs.hp) best = mv;
  }
  return best;
}
