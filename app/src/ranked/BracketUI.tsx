/**
 * BracketUI — visual components for the tournament bracket.
 * BracketTree, MatchCard, PlayerChip, Connectors.
 */

import { motion } from "motion/react";
import type { TournamentState, BracketPlayer } from "./TournamentBracket";

interface MatchSlot {
  p1: BracketPlayer | null;
  p2: BracketPlayer | null;
  winner: BracketPlayer | null;
  status: "pending" | "playing" | "done";
}

type PrimarySlots = Map<string, string>;

// Each player's chip with `layoutId` must render in exactly ONE place per frame,
// otherwise Motion can't match source/target and the slide becomes a jump-cut.
// We pick the furthest-advanced slot as the live one; earlier slots get ghosts.
function computePrimarySlots(t: TournamentState): PrimarySlots {
  const primary: PrimarySlots = new Map();
  const visit = (round: string, mi: number, slot: "p1" | "p2", p: BracketPlayer | null) => {
    if (!p) return;
    primary.set(p.id, `${round}${mi}${slot}`);
  };
  t.quarters.forEach((m, i) => { visit("q", i, "p1", m.p1); visit("q", i, "p2", m.p2); });
  t.semis.forEach((m, i) => { visit("s", i, "p1", m.p1); visit("s", i, "p2", m.p2); });
  visit("f", 0, "p1", t.final.p1);
  visit("f", 0, "p2", t.final.p2);
  if (t.champion) primary.set(t.champion.id, "champ");
  return primary;
}

export function BracketTree({ tournament }: { tournament: TournamentState }) {
  const t = tournament;
  const primary = computePrimarySlots(t);
  return (
    <div className="w-full overflow-x-auto py-2">
      <div className="flex items-center gap-1 min-w-[480px]">
        <RoundCol label="Quarts">
          {t.quarters.map((m, i) => (
            <MatchCard key={`q${i}`} match={m} round="q" idx={i} primary={primary} />
          ))}
        </RoundCol>
        <Connectors count={4} />
        <RoundCol label="Demis">
          {t.semis.map((m, i) => (
            <MatchCard key={`s${i}`} match={m} round="s" idx={i} primary={primary} />
          ))}
        </RoundCol>
        <Connectors count={2} />
        <RoundCol label="Finale">
          <MatchCard match={t.final} round="f" idx={0} primary={primary} />
        </RoundCol>
        <Connectors count={1} />
        <div className="flex flex-col items-center gap-1.5 px-3 shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">Champion</div>
          {t.champion ? (
            <PlayerChip player={t.champion} size="lg" />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-amber-400/30 flex items-center justify-center text-2xl">
              🏆
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoundCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 shrink-0">
      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">{label}</div>
      <div className="flex flex-col gap-4 justify-center">{children}</div>
    </div>
  );
}

function MatchCard({ match, round, idx, primary }: {
  match: MatchSlot; round: "q" | "s" | "f"; idx: number; primary: PrimarySlots;
}) {
  const playing = match.status === "playing";
  const done = match.status === "done";
  const slotKey = (s: "p1" | "p2") => `${round}${idx}${s}`;
  return (
    <div className={
      "flex flex-col gap-0.5 rounded-lg border p-0.5 transition " +
      (playing ? "border-amber-400/50 bg-amber-500/10 shadow-md shadow-amber-500/20" : "border-white/10 bg-white/[0.03]")
    }>
      <SlotRow
        player={match.p1}
        isPrimary={!!match.p1 && primary.get(match.p1.id) === slotKey("p1")}
        lost={done && match.winner?.id !== match.p1?.id}
        won={done && match.winner?.id === match.p1?.id}
      />
      <div className="h-px bg-white/5" />
      <SlotRow
        player={match.p2}
        isPrimary={!!match.p2 && primary.get(match.p2.id) === slotKey("p2")}
        lost={done && match.winner?.id !== match.p2?.id}
        won={done && match.winner?.id === match.p2?.id}
      />
    </div>
  );
}

function SlotRow({ player, isPrimary, lost, won }: {
  player: BracketPlayer | null; isPrimary: boolean; lost: boolean; won: boolean;
}) {
  if (!player) {
    return (
      <div className="w-24 sm:w-28 h-7 rounded-md flex items-center justify-center">
        <span className="text-[9px] text-zinc-700 italic">En attente…</span>
      </div>
    );
  }
  if (!isPrimary) {
    return <GhostChip player={player} lost={lost} />;
  }
  return <PlayerChip player={player} size="sm" dimmed={lost} won={won} />;
}

function GhostChip({ player, lost }: { player: BracketPlayer; lost: boolean }) {
  const isPhoto = player.avatar.startsWith("data:");
  return (
    <div className={
      "w-24 sm:w-28 h-7 rounded-md flex items-center gap-1.5 overflow-hidden px-1.5 " +
      (lost ? "opacity-25 grayscale line-through text-zinc-400" : "opacity-40 text-zinc-400")
    }>
      {isPhoto ? (
        <img src={player.avatar} alt="" className="shrink-0 w-4 h-4 rounded-full object-cover" />
      ) : (
        <span className="shrink-0 text-xs">{player.avatar}</span>
      )}
      <span className="truncate flex-1 text-[10px] font-semibold">{player.name}</span>
      <span className="shrink-0 text-[8px] text-zinc-500">Lv.{player.level}</span>
    </div>
  );
}

function PlayerChip({ player, size, dimmed = false, won = false }: {
  player: BracketPlayer; size: "sm" | "lg"; dimmed?: boolean; won?: boolean;
}) {
  const isPhoto = player.avatar.startsWith("data:");
  const lg = size === "lg";
  const color = dimmed
    ? "opacity-25 grayscale line-through"
    : player.isYou
    ? "bg-emerald-500/20 text-emerald-200"
    : won
    ? "bg-amber-500/10 text-amber-200"
    : "text-zinc-300";
  return (
    <motion.div
      layoutId={`player-${player.id}`}
      transition={{ type: "spring", stiffness: 200, damping: 22, duration: 0.6 }}
      className={
        (lg ? "w-12 h-12 rounded-full" : "w-24 sm:w-28 h-7 rounded-md") +
        " flex items-center gap-1.5 overflow-hidden transition " +
        (lg ? "justify-center " : "px-1.5 ") +
        color +
        (lg ? " ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/30" : "")
      }
    >
      {isPhoto ? (
        <img src={player.avatar} alt="" className={lg ? "w-full h-full object-cover" : "shrink-0 w-4 h-4 rounded-full object-cover"} />
      ) : (
        <span className={lg ? "text-2xl" : "shrink-0 text-xs"}>{player.avatar}</span>
      )}
      {!lg && (
        <>
          <span className="truncate flex-1 text-[10px] font-semibold">{player.name}</span>
          <span className="shrink-0 text-[8px] text-zinc-500">Lv.{player.level}</span>
        </>
      )}
    </motion.div>
  );
}

function Connectors({ count }: { count: number }) {
  const h = count === 4 ? "h-[240px]" : count === 2 ? "h-[180px]" : "h-[100px]";
  return (
    <div className={"flex flex-col justify-around shrink-0 w-5 sm:w-7 " + h}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col flex-1">
          <div className="flex-1 border-t border-r border-white/15 rounded-tr-md" />
          <div className="flex-1 border-b border-r border-white/15 rounded-br-md" />
        </div>
      ))}
    </div>
  );
}
