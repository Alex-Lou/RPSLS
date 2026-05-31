/**
 * TournamentBracket — types, data factory, and pure helpers.
 * Visual components live in BracketUI.tsx. Page view in BracketPage.tsx.
 */

/* ──────────── Types ──────────── */

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
  players: BracketPlayer[];
  quarters: [MatchSlot, MatchSlot, MatchSlot, MatchSlot];
  semis: [MatchSlot, MatchSlot];
  final: MatchSlot;
  champion: BracketPlayer | null;
  phase: "lobby" | "running" | "complete";
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
];

function emptyMatch(): MatchSlot {
  return { p1: null, p2: null, winner: null, status: "pending" };
}

export function makeTournament(youName: string, youAvatar: string, youLevel: number): TournamentState {
  const you: BracketPlayer = { id: "you", name: youName, avatar: youAvatar, level: youLevel, isYou: true };
  const cpus = CPU_POOL.map((c, i) => ({ ...c, id: `cpu-${i}` }));
  const all = [you, ...cpus];
  return {
    players: all,
    quarters: [
      { p1: all[0], p2: all[1], winner: null, status: "pending" },
      { p1: all[2], p2: all[3], winner: null, status: "pending" },
      { p1: all[4], p2: all[5], winner: null, status: "pending" },
      { p1: all[6], p2: all[7], winner: null, status: "pending" },
    ],
    semis: [emptyMatch(), emptyMatch()],
    final: emptyMatch(),
    champion: null,
    phase: "lobby",
  };
}

/* ──────────── Pure helpers ──────────── */

export function feedWinner(t: TournamentState, roundIdx: number, matchIdx: number, winner: BracketPlayer) {
  if (roundIdx === 0) {
    const semiIdx = Math.floor(matchIdx / 2);
    const slot = matchIdx % 2 === 0 ? "p1" : "p2";
    (t.semis as MatchSlot[])[semiIdx] = { ...(t.semis as MatchSlot[])[semiIdx], [slot]: winner };
  } else if (roundIdx === 1) {
    const slot = matchIdx === 0 ? "p1" : "p2";
    t.final = { ...t.final, [slot]: winner };
  }
}

export function findPlayerMatch(t: TournamentState): { opp: BracketPlayer } | null {
  const rounds: MatchSlot[][] = [t.quarters as MatchSlot[], t.semis as MatchSlot[], [t.final]];
  for (const round of rounds) {
    for (const m of round) {
      if (m.status === "playing" && m.p1 && m.p2) {
        if (m.p1.isYou) return { opp: m.p2 };
        if (m.p2.isYou) return { opp: m.p1 };
      }
    }
  }
  return null;
}

export function resolvePlayerMatch(t: TournamentState, playerWon: boolean): TournamentState {
  const next = { ...t };
  const rounds: MatchSlot[][] = [next.quarters as MatchSlot[], next.semis as MatchSlot[], [next.final]];
  for (let ri = 0; ri < rounds.length; ri++) {
    for (let mi = 0; mi < rounds[ri].length; mi++) {
      const m = rounds[ri][mi];
      if (m.status === "playing" && m.p1 && m.p2 && (m.p1.isYou || m.p2.isYou)) {
        const winner = playerWon
          ? (m.p1.isYou ? m.p1 : m.p2)
          : (m.p1.isYou ? m.p2 : m.p1);
        rounds[ri][mi] = { ...m, winner, status: "done" };
        feedWinner(next, ri, mi, winner);
        if (next.final.status === "done" && next.final.winner) {
          return { ...next, champion: next.final.winner, phase: "complete" };
        }
        return { ...next, phase: "running" };
      }
    }
  }
  return next;
}
