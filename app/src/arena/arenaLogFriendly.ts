/**
 * arenaLogFriendly — traducteur "grand public" des logs techniques d'Arena.
 *
 * Alex 2026-06-13 : "un système de logs plus vulgarisé et compréhensible pour
 * tous — détaillé mais simple, complet mais vulgarisé". L'onglet SIMPLE de
 * l'ArenaDebugOverlay passe chaque entrée ici : si un pattern matche, on
 * retourne une phrase claire en français ; sinon `null` → la ligne est
 * simplement omise de l'onglet Simple (les steps internes du moteur —
 * `step=bluntDone`, snapshots de mains, etc. — restent visibles dans
 * l'onglet COMPLET uniquement).
 *
 * Convention solo : side "a" = le joueur ("Toi"), side "b" = l'adversaire.
 * Lanes L0/L1/L2 → "voie 1/2/3". Moves traduits en symboles FR du jeu.
 */

import type { ArenaLogEntry } from "./arenaLog";
import { tNow } from "../i18n/core";

const MOVES = new Set(["rock", "paper", "scissors", "lizard", "spock"]);
const mv = (m: string): string => (MOVES.has(m) ? tNow(`arena.log.move.${m}`) : m);
const who = (s: string): string => (s === "a" ? tNow("arena.log.you") : tNow("arena.log.opp"));
const heroOf = (s: string): string => (s === "a" ? tNow("arena.log.yourHero") : tNow("arena.log.oppHero"));
const lane = (l: string): string => tNow("arena.log.lane", { n: Number(l) + 1 });

/** Traduit une entrée de log en phrase simple, ou null si interne/technique. */
export function friendlyArenaLog(e: ArenaLogEntry): string | null {
  const m = e.msg;

  // Déjà vulgarisés à la source (blocages 🚫, fizzles 💤) : tels quels.
  if (m.startsWith("🚫") || m.startsWith("💤")) return m;

  let x: RegExpMatchArray | null;

  // ── Tours ──
  if ((x = m.match(/^=== Tour (\d+) === a\.hp=(\d+) b\.hp=(\d+)/)))
    return tNow("arena.log.turn", { turn: x[1], a: x[2], b: x[3] });
  if (/BUT D'OR|Mort subite/i.test(m)) return tNow("arena.log.suddenDeath");
  if (/HARD CAP/.test(m)) return tNow("arena.log.hardCap");

  // ── Invocations ──
  if ((x = m.match(/^([ab]) pose (\w+) L(\d)/)))
    return tNow("arena.log.summon", { who: who(x[1]), move: mv(x[2]), lane: lane(x[3]) });

  // ── Sorts nommés ──
  if ((x = m.match(/^([ab]) SUPERNOVA → 6 dmg hero ([ab])/)))
    return tNow("arena.log.supernovaHero", { who: who(x[1]), hero: heroOf(x[2]) });
  if ((x = m.match(/^([ab]) SUPERNOVA L(\d) → 6 dmg/)))
    return tNow("arena.log.supernovaLane", { who: who(x[1]), lane: lane(x[2]) });
  if ((x = m.match(/^([ab]) LARCIN → \[([\w-]+)\] volée/)))
    return tNow("arena.log.heist", { who: who(x[1]), card: x[2] });
  if ((x = m.match(/^([ab]) LARCIN → main adverse vide.*3 dmg hero ([ab])/)))
    return tNow("arena.log.heistEmpty", { who: who(x[1]), hero: heroOf(x[2]) });
  if ((x = m.match(/^([ab]) MASCARADE L(\d) : (\w+) → (\w+)(?: \(counter (\w+)\))?/)))
    return x[5]
      ? tNow("arena.log.mascaradeCounter", { who: who(x[1]), lane: lane(x[2]), from: mv(x[3]), to: mv(x[4]), counter: mv(x[5]) })
      : tNow("arena.log.mascarade", { who: who(x[1]), lane: lane(x[2]), from: mv(x[3]), to: mv(x[4]) });
  if ((x = m.match(/^([ab]) VERGER/)))
    return tNow("arena.log.verger", { who: who(x[1]) });
  if ((x = m.match(/^([ab]) MÉTAMORPHOSE/)))
    return tNow("arena.log.metamorphose", { who: who(x[1]) });
  if (/FINISHER UNLOCKED/i.test(m)) {
    const side = m.match(/^([ab])/)?.[1];
    return tNow("arena.log.finisherUnlocked", { who: side ? who(side) : "" });
  }
  if ((x = m.match(/^([ab]).*constellation ⭐ (\d)\/3/i)))
    return tNow("arena.log.constellation", { who: who(x[1]), n: x[2] });

  // ── ⚗️ Forge / fusions ──
  if ((x = m.match(/^([ab]) FORGE dépôt : ([\w-]+)/)))
    return tNow("arena.log.forgeDeposit", { who: who(x[1]), card: x[2] });
  if ((x = m.match(/^([ab]) FORGE reprise : ([\w-]+)/)))
    return tNow("arena.log.forgeTakeBack", { who: who(x[1]), card: x[2] });
  if ((x = m.match(/^([ab]) FUSION ⚗️ : ([\w-]+) \+ ([\w-]+) = ([\w-]+)/)))
    return tNow("arena.log.fusion", { who: who(x[1]), a: x[2], b: x[3], result: x[4] });

  // ── Économie expert (exil légendaires, mulligan) ──
  if ((x = m.match(/^([ab]) EXIL légendaire : \[([\w,-]+)\]/)))
    return tNow("arena.log.legendaryExile", { who: who(x[1]), card: x[2] });
  if (/^mulligan :/.test(m))
    return tNow("arena.log.mulligan");

  // ── Caps / garde-fous ──
  if ((x = m.match(/BYPASS BLOCKED ([ab])/)))
    return tNow("arena.log.bypassBlocked", { who: who(x[1]) });

  // ── Combat (catégorie combat, messages "L0 ...") ──
  if ((x = m.match(/^L(\d) A wins → B die\. Splash (\d+) → hero b/)))
    return tNow("arena.log.combatAWinsSplash", { lane: lane(x[1]), n: x[2] });
  if ((x = m.match(/^L(\d) B wins → A die\. Splash (\d+) → hero a/)))
    return tNow("arena.log.combatBWinsSplash", { lane: lane(x[1]), n: x[2] });
  if ((x = m.match(/^L(\d) A wins → B die\. Splash absorbé/)))
    return tNow("arena.log.combatAWinsAbsorbed", { lane: lane(x[1]) });
  if ((x = m.match(/^L(\d) B wins → A die\. Splash absorbé/)))
    return tNow("arena.log.combatBWinsAbsorbed", { lane: lane(x[1]) });
  if ((x = m.match(/^L(\d) (A|B) wins → AEGIS save (A|B)/)))
    return tNow("arena.log.aegisSave", { lane: lane(x[1]), creature: x[3] === "A" ? tNow("arena.log.yourCreature") : tNow("arena.log.oppCreature") });
  if ((x = m.match(/^L(\d) (A|B) wins → ESQUIVE save (A|B) \(charge (\d) → (\d)\)/)))
    return tNow("arena.log.dodgeSave", { lane: lane(x[1]), creature: x[3] === "A" ? tNow("arena.log.yourCreature") : tNow("arena.log.theOppCreature"), n: x[5] });
  if ((x = m.match(/^L(\d).*Splash (\d+) → DEFLECTED par Pierre L(\d)/)))
    return tNow("arena.log.rockTaunt", { lane: lane(x[3]) });
  if ((x = m.match(/^L(\d) (\w+)\(([ab])\)\d+HP undefended → hero ([ab]) atk=(\d+)/)))
    return tNow("arena.log.undefended", { lane: lane(x[1]), move: mv(x[2]), n: x[5], hero: heroOf(x[4]) });
  if ((x = m.match(/^L(\d) RIPOSTE/)))
    return tNow("arena.log.riposte", { lane: lane(x[1]) });

  // ── Sorts Phase 2/3 avec logs dédiés (formats alignés sur arenaPhase3Spells) ──
  if ((x = m.match(/^([ab]) PERMUTATION L(\d) : (\w+) ↔ (\w+)/)))
    return tNow("arena.log.permutation", { who: who(x[1]), lane: lane(x[2]), a: mv(x[3]), b: mv(x[4]) });
  if ((x = m.match(/^([ab]) TOILE GLUANTE L(\d) : (\w+)/)))
    return tNow("arena.log.toileGluante", { who: who(x[1]), move: mv(x[3]), lane: lane(x[2]) });
  if ((x = m.match(/^([ab]) GRAVITÉ → .*?(\d+) tuée\(s\) → pioche (\d+)/)))
    return tNow("arena.log.gravityKills", { who: who(x[1]), killed: x[2], drawn: x[3] });
  if ((x = m.match(/^([ab]) GRAVITÉ/)))
    return tNow("arena.log.gravity", { who: who(x[1]) });
  if ((x = m.match(/^([ab]) COUP D'ŒIL → pioche 1 \+ révèle ([\w-]+|\(main vide\))/)))
    return tNow("arena.log.peek", { who: who(x[1]), card: x[2] });
  if ((x = m.match(/^([ab]) DOPPELGÄNGER → copie (\w+) sur L(\d)/)))
    return tNow("arena.log.doppelganger", { who: who(x[1]), move: mv(x[2]), lane: lane(x[3]) });
  if ((x = m.match(/^([ab]) PURGE/)))
    return tNow("arena.log.purge", { who: who(x[1]) });
  if ((x = m.match(/^([ab]) PHÉNIX/i)))
    return tNow("arena.log.phoenix", { who: who(x[1]) });
  if ((x = m.match(/^([ab]) ROUE DU DESTIN → (.+)/i)))
    return tNow("arena.log.wheel", { who: who(x[1]), result: x[2] });
  if ((x = m.match(/^([ab]) SINGULARITÉ → .*?= (\d+) dmg/i)))
    return tNow("arena.log.singularity", { who: who(x[1]), n: x[2] });
  if ((x = m.match(/^([ab]) RÉVERBÉRATION/i)))
    return tNow("arena.log.reverb", { who: who(x[1]) });

  // Interne / technique (steps moteur, snapshots de main, états) → omis.
  return null;
}
