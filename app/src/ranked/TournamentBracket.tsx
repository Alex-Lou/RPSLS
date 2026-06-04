/**
 * TournamentBracket — types, data factory, and pure helpers.
 *
 * The bracket is fully generic over its size: a tournament is just a list of
 * rounds, `rounds[0]` being the first round (size/2 matches) and the last
 * round the final (1 match). This lets the same engine drive a 4, 8 or 16
 * player tree without any branching on the size.
 *
 * Visual components live in BracketUI.tsx. Page view in BracketPage.tsx.
 */

/* ──────────── Types ──────────── */

export type TournamentSize = 4 | 8 | 16;
export const TOURNAMENT_SIZES: TournamentSize[] = [4, 8, 16];

export interface BracketPlayer {
  id: string;
  name: string;
  avatar: string;
  level: number;
  isYou?: boolean;
}

export interface MatchSlot {
  p1: BracketPlayer | null;
  p2: BracketPlayer | null;
  winner: BracketPlayer | null;
  status: "pending" | "playing" | "done";
}

export interface TournamentState {
  size: TournamentSize;
  /** Persistent player identity, kept across size re-rolls. */
  you: BracketPlayer;
  /** rounds[0] = first round … rounds[last] = final. */
  rounds: MatchSlot[][];
  champion: BracketPlayer | null;
  phase: "select" | "running" | "complete";
}

/* ──────────── Data factory ──────────── */

const CPU_POOL: Omit<BracketPlayer, "id">[] = [
  { name: "Nova", avatar: "🤖", level: 3 },
  { name: "Blitz", avatar: "⚡", level: 5 },
  { name: "Shadow", avatar: "🌑", level: 2 },
  { name: "Vortex", avatar: "🌀", level: 7 },
  { name: "Phantom", avatar: "👻", level: 4 },
  { name: "Cipher", avatar: "🔮", level: 6 },
  { name: "Zenith", avatar: "💫", level: 8 },
  { name: "Ember", avatar: "🔥", level: 5 },
  { name: "Frost", avatar: "❄️", level: 4 },
  { name: "Echo", avatar: "🛰️", level: 6 },
  { name: "Onyx", avatar: "⬛", level: 3 },
  { name: "Quasar", avatar: "🌟", level: 9 },
  { name: "Riot", avatar: "💥", level: 7 },
  { name: "Saber", avatar: "⚔️", level: 6 },
  { name: "Talon", avatar: "🦅", level: 5 },
  { name: "Wraith", avatar: "💀", level: 8 },
];

function emptyMatch(): MatchSlot {
  return { p1: null, p2: null, winner: null, status: "pending" };
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Initial state before the player has chosen a bracket size. */
export function initialTournament(youName: string, youAvatar: string, youLevel: number): TournamentState {
  return {
    size: 8,
    you: { id: "you", name: youName, avatar: youAvatar, level: youLevel, isYou: true },
    rounds: [],
    champion: null,
    phase: "select",
  };
}

/** Build a ready-to-run bracket of the requested size, seeding `you` into a
 *  random slot among freshly shuffled CPU opponents. */
export function buildBracket(you: BracketPlayer, size: TournamentSize): TournamentState {
  const cpus = shuffle(CPU_POOL)
    .slice(0, size - 1)
    .map((c, i) => ({ ...c, id: `cpu-${i}` }));
  // Drop the player into a random seed so it isn't always match 1.
  const slots: BracketPlayer[] = [...cpus];
  slots.splice(Math.floor(Math.random() * (cpus.length + 1)), 0, you);

  const round0: MatchSlot[] = [];
  for (let i = 0; i < size; i += 2) {
    round0.push({ p1: slots[i], p2: slots[i + 1], winner: null, status: "pending" });
  }
  const rounds: MatchSlot[][] = [round0];
  let n = round0.length;
  while (n > 1) {
    n = Math.floor(n / 2);
    rounds.push(Array.from({ length: n }, emptyMatch));
  }
  return { size, you, rounds, champion: null, phase: "running" };
}

/* ──────────── Pure helpers ──────────── */

function cloneRounds(t: TournamentState): MatchSlot[][] {
  return t.rounds.map((r) => r.slice());
}

function finalMatch(t: TournamentState): MatchSlot | null {
  return t.rounds.length ? t.rounds[t.rounds.length - 1][0] : null;
}

/** Feed a match winner into its slot in the next round. */
export function feedWinner(t: TournamentState, roundIdx: number, matchIdx: number, winner: BracketPlayer) {
  const nr = roundIdx + 1;
  if (nr >= t.rounds.length) return; // was the final
  const target = Math.floor(matchIdx / 2);
  const slot = matchIdx % 2 === 0 ? "p1" : "p2";
  t.rounds[nr][target] = { ...t.rounds[nr][target], [slot]: winner };
}

/** The opponent the player must currently fight (match marked "playing"). */
export function findPlayerMatch(t: TournamentState): { opp: BracketPlayer } | null {
  for (const round of t.rounds) {
    for (const m of round) {
      if (m.status === "playing" && m.p1 && m.p2) {
        if (m.p1.isYou) return { opp: m.p2 };
        if (m.p2.isYou) return { opp: m.p1 };
      }
    }
  }
  return null;
}

/** True once the player has lost a completed match. */
export function isPlayerEliminated(t: TournamentState): boolean {
  for (const round of t.rounds) {
    for (const m of round) {
      if (m.status === "done" && m.winner) {
        const youIn = m.p1?.isYou || m.p2?.isYou;
        if (youIn && !m.winner.isYou) return true;
      }
    }
  }
  return false;
}

/** Any CPU-vs-CPU match still waiting to be simulated. */
export function hasPendingCpuMatch(t: TournamentState): boolean {
  for (const round of t.rounds) {
    for (const m of round) {
      if (m.status === "pending" && m.p1 && m.p2 && !m.p1.isYou && !m.p2.isYou) return true;
    }
  }
  return false;
}

/** Slight upset-friendly winner pick weighted by level. */
function pickCpuWinner(a: BracketPlayer, b: BracketPlayer): BracketPlayer {
  const pa = (a.level + 4) / (a.level + b.level + 8); // dampened so upsets happen
  return Math.random() < pa ? a : b;
}

/**
 * Advance the bracket by one step:
 *  - if the next pending match is the player's, flag it "playing" (the page
 *    then surfaces the "Combattre" CTA);
 *  - otherwise resolve one CPU-vs-CPU match.
 * Returns a new state (immutable).
 */
export function simulateOneCpuMatch(t: TournamentState): TournamentState {
  const next: TournamentState = { ...t, rounds: cloneRounds(t), phase: "running" };
  for (let ri = 0; ri < next.rounds.length; ri++) {
    for (let mi = 0; mi < next.rounds[ri].length; mi++) {
      const m = next.rounds[ri][mi];
      if (m.status === "pending" && m.p1 && m.p2) {
        if (m.p1.isYou || m.p2.isYou) {
          next.rounds[ri][mi] = { ...m, status: "playing" };
          return next;
        }
        const winner = pickCpuWinner(m.p1, m.p2);
        next.rounds[ri][mi] = { ...m, winner, status: "done" };
        feedWinner(next, ri, mi, winner);
        return next;
      }
    }
  }
  const fin = finalMatch(next);
  if (fin && fin.status === "done" && fin.winner) {
    return { ...next, champion: fin.winner, phase: "complete" };
  }
  return next;
}

/** Resolve the player's live match after the real RankedGame ends. */
export function resolvePlayerMatch(t: TournamentState, playerWon: boolean): TournamentState {
  const next: TournamentState = { ...t, rounds: cloneRounds(t) };
  for (let ri = 0; ri < next.rounds.length; ri++) {
    for (let mi = 0; mi < next.rounds[ri].length; mi++) {
      const m = next.rounds[ri][mi];
      if (m.status === "playing" && m.p1 && m.p2 && (m.p1.isYou || m.p2.isYou)) {
        const winner = playerWon ? (m.p1.isYou ? m.p1 : m.p2) : (m.p1.isYou ? m.p2 : m.p1);
        next.rounds[ri][mi] = { ...m, winner, status: "done" };
        feedWinner(next, ri, mi, winner);
        const fin = finalMatch(next);
        if (fin && fin.status === "done" && fin.winner) {
          return { ...next, champion: fin.winner, phase: "complete" };
        }
        return { ...next, phase: "running" };
      }
    }
  }
  return next;
}

/** Round name from its distance to the final ("Finale", "Demis", …). */
export function roundLabel(roundIdx: number, total: number): string {
  const dist = total - 1 - roundIdx;
  switch (dist) {
    case 0: return "Finale";
    case 1: return "Demis";
    case 2: return "Quarts";
    case 3: return "8es";
    case 4: return "16es";
    default: return `Tour ${roundIdx + 1}`;
  }
}
