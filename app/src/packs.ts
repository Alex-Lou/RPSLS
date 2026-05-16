/**
 * Three hand-crafted variant packs. Every winner→loser pair has a deliberate
 * narrative verb, just like Sheldon's original RPSLS. No cyclic auto-generation,
 * no nonsense like "Paper covers Fire". If a pair isn't in `verbs`, it's a draw
 * (which never happens for a properly authored pack).
 *
 * Elements within a pack are arranged in cyclic order so each beats the next 2
 * clockwise — but the verbs are authored, not derived.
 */

export type PackId = "rpsls" | "monsters" | "combat";

export interface PackElement {
  id: string;
  emoji: string;
}

export interface Pack {
  id: PackId;
  /** Ordered ring — element i beats i+1 and i+2 (mod 5). */
  elements: PackElement[];
  /** verbs[winnerId][loserId] = i18n key like "verb.crushes". */
  verbs: Record<string, Record<string, string>>;
}

/* ────────── Pack 1: RPSLS (canon Sheldon Cooper) ────────── */
const RPSLS_PACK: Pack = {
  id: "rpsls",
  elements: [
    { id: "rock",     emoji: "🪨" },
    { id: "scissors", emoji: "✂️" },
    { id: "lizard",   emoji: "🦎" },
    { id: "paper",    emoji: "📄" },
    { id: "spock",    emoji: "🖖" },
  ],
  verbs: {
    rock:     { scissors: "verb.crushes",   lizard:  "verb.crushes"    },
    scissors: { lizard:   "verb.decapitates", paper: "verb.cuts"       },
    lizard:   { paper:    "verb.eats",      spock:   "verb.poisons"    },
    paper:    { spock:    "verb.disproves", rock:    "verb.covers"     },
    spock:    { rock:     "verb.vaporizes", scissors:"verb.smashes"    },
  },
};

/* ────────── Pack 2: Monsters (cabinet de curiosités pop) ────────── */
// Order: Vampire → Unicorn → Clown → Zombie → Ghost → Vampire (cyclic)
// Each beats next 2 — verbes assumés absurdes mais marrants :
//   Vampire bites Unicorn       + mesmerizes Clown
//   Unicorn out-sparkles Clown  + impales Zombie (avec sa corne)
//   Clown   mocks Zombie        + scares Ghost (vibe Pennywise)
//   Zombie  outlasts Ghost      + devours Vampire (le twist comique)
//   Ghost   haunts Vampire      + chills Unicorn (gel de l'innocence)
const MONSTERS_PACK: Pack = {
  id: "monsters",
  elements: [
    { id: "vampire", emoji: "🧛" },
    { id: "unicorn", emoji: "🦄" },
    { id: "clown",   emoji: "🤡" },
    { id: "zombie",  emoji: "🧟" },
    { id: "ghost",   emoji: "👻" },
  ],
  verbs: {
    vampire: { unicorn: "verb.bites",        clown:   "verb.mesmerizes"  },
    unicorn: { clown:   "verb.outsparkles",  zombie:  "verb.impales"     },
    clown:   { zombie:  "verb.mocks",        ghost:   "verb.scares"      },
    zombie:  { ghost:   "verb.outlasts",     vampire: "verb.devours"     },
    ghost:   { vampire: "verb.haunts",       unicorn: "verb.chills"      },
  },
};

/* ────────── Pack 3: Arsenal (combat médiéval) ────────── */
// Order: Bow → Sword → Hammer → Spear → Shield → Bow (cyclic)
//   Bow    beats Sword (outranges)    + Hammer (outranges)
//   Sword  beats Hammer (outspeeds)   + Spear (outmaneuvers in close)
//   Hammer beats Spear (snaps shaft)  + Shield (crushes/dents)
//   Spear  beats Shield (pierces)     + Bow (closes the gap)
//   Shield beats Bow (blocks arrows)  + Sword (deflects)
const COMBAT_PACK: Pack = {
  id: "combat",
  elements: [
    { id: "bow",    emoji: "🏹" },
    { id: "sword",  emoji: "⚔️" },
    { id: "hammer", emoji: "🔨" },
    { id: "spear",  emoji: "🔱" },
    { id: "shield", emoji: "🛡️" },
  ],
  verbs: {
    bow:    { sword: "verb.outranges",   hammer: "verb.outranges"     },
    sword:  { hammer:"verb.outspeeds",   spear:  "verb.outmaneuvers"  },
    hammer: { spear: "verb.snaps",       shield: "verb.crushes"       },
    spear:  { shield:"verb.pierces",     bow:    "verb.closes"        },
    shield: { bow:   "verb.blocks",      sword:  "verb.deflects"      },
  },
};

export const PACKS: Pack[] = [RPSLS_PACK, MONSTERS_PACK, COMBAT_PACK];

export function getPack(id: PackId): Pack {
  const p = PACKS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown pack: ${id}`);
  return p;
}

export type Outcome = "a_wins" | "b_wins" | "draw";

export function resolveInPack(pack: Pack, a: string, b: string): Outcome {
  if (a === b) return "draw";
  if (pack.verbs[a]?.[b]) return "a_wins";
  if (pack.verbs[b]?.[a]) return "b_wins";
  return "draw";
}

/** i18n verb key for a pair. Always defined within a pack. */
export function verbKeyForPair(pack: Pack, winner: string, loser: string): string {
  return pack.verbs[winner]?.[loser] ?? "verb.defeats";
}

/** Random opponent move from a pack (for bot play). */
export function randomMoveInPack(pack: Pack): string {
  const ids = pack.elements.map((e) => e.id);
  return ids[Math.floor(Math.random() * ids.length)];
}

/** All 10 directional winner→loser pairs of a pack (for the rules summary). */
export function allWins(pack: Pack): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const winner of Object.keys(pack.verbs)) {
    for (const loser of Object.keys(pack.verbs[winner])) {
      out.push([winner, loser]);
    }
  }
  return out;
}
