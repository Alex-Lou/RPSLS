/**
 * BracketUI — visual components for the tournament bracket.
 *
 * Fully generic over the number of rounds: it walks `tournament.rounds` and
 * lays every column out at the same fixed height with `justify-around`, so a
 * 4, 8 or 16-player tree all align their connectors automatically. The active
 * match auto-scrolls into view.
 */

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  type TournamentState,
  type BracketPlayer,
  type MatchSlot,
  roundLabel,
} from "./TournamentBracket";

type PrimarySlots = Map<string, string>;

// Each player's chip with `layoutId` must render in exactly ONE place per frame,
// otherwise Motion can't match source/target and the slide becomes a jump-cut.
// Walking rounds in order means the furthest-advanced slot wins; earlier slots
// render as ghosts.
function computePrimarySlots(t: TournamentState): PrimarySlots {
  const primary: PrimarySlots = new Map();
  t.rounds.forEach((round, ri) =>
    round.forEach((m, mi) => {
      if (m.p1) primary.set(m.p1.id, `r${ri}m${mi}p1`);
      if (m.p2) primary.set(m.p2.id, `r${ri}m${mi}p2`);
    }),
  );
  if (t.champion) primary.set(t.champion.id, "champ");
  return primary;
}

export function BracketTree({ tournament }: { tournament: TournamentState }) {
  const t = tournament;
  const primary = computePrimarySlots(t);
  const total = t.rounds.length;
  const compact = t.size === 16;

  // Vertical rhythm: every column shares one height so justify-around centres
  // each round's matches exactly between its two parents.
  const unit = compact ? 52 : 64;
  const height = Math.max(2, t.rounds[0]?.length ?? 2) * unit;

  const playingRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    playingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [t.rounds]);

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden py-2 px-1 [scrollbar-width:thin]">
      <div className="flex items-stretch gap-1" style={{ height }}>
        {t.rounds.map((round, ri) => (
          <div key={`round-${ri}`} className="flex items-stretch gap-1 shrink-0">
            <RoundCol label={roundLabel(ri, total)}>
              {round.map((m, mi) => (
                <MatchCard
                  key={`r${ri}m${mi}`}
                  match={m}
                  round={ri}
                  idx={mi}
                  primary={primary}
                  compact={compact}
                  playingRef={m.status === "playing" ? playingRef : undefined}
                />
              ))}
            </RoundCol>
            {ri < total - 1 && <Connectors count={round.length} />}
          </div>
        ))}
        <Connectors count={1} />
        <ChampionCol champion={t.champion} />
      </div>
    </div>
  );
}

function ChampionCol({ champion }: { champion: BracketPlayer | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-2 shrink-0">
      <div className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">Champion</div>
      {champion ? (
        <PlayerChip player={champion} size="lg" />
      ) : (
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-amber-400/30 flex items-center justify-center text-2xl">
          🏆
        </div>
      )}
    </div>
  );
}

function RoundCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center shrink-0 h-full">
      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1 shrink-0">
        {label}
      </div>
      <div className="flex flex-col justify-around flex-1 w-full items-center">{children}</div>
    </div>
  );
}

function MatchCard({ match, round, idx, primary, compact, playingRef }: {
  match: MatchSlot;
  round: number;
  idx: number;
  primary: PrimarySlots;
  compact: boolean;
  playingRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const playing = match.status === "playing";
  const done = match.status === "done";
  const slotKey = (s: "p1" | "p2") => `r${round}m${idx}${s}`;
  return (
    <div
      ref={playingRef}
      className={
        "flex flex-col gap-0.5 rounded-lg border p-0.5 transition " +
        (playing
          ? "border-amber-400/60 bg-amber-500/10 shadow-md shadow-amber-500/20"
          : "border-white/10 bg-white/[0.03]")
      }
    >
      <SlotRow
        player={match.p1}
        compact={compact}
        isPrimary={!!match.p1 && primary.get(match.p1.id) === slotKey("p1")}
        lost={done && match.winner?.id !== match.p1?.id}
        won={done && match.winner?.id === match.p1?.id}
      />
      <div className="h-px bg-white/5" />
      <SlotRow
        player={match.p2}
        compact={compact}
        isPrimary={!!match.p2 && primary.get(match.p2.id) === slotKey("p2")}
        lost={done && match.winner?.id !== match.p2?.id}
        won={done && match.winner?.id === match.p2?.id}
      />
    </div>
  );
}

function SlotRow({ player, isPrimary, lost, won, compact }: {
  player: BracketPlayer | null; isPrimary: boolean; lost: boolean; won: boolean; compact: boolean;
}) {
  const w = compact ? "w-[4.75rem]" : "w-24 sm:w-28";
  if (!player) {
    return (
      <div className={w + " h-6 rounded-md flex items-center justify-center"}>
        <span className="text-[9px] text-zinc-700 italic">—</span>
      </div>
    );
  }
  if (!isPrimary) {
    return <GhostChip player={player} lost={lost} compact={compact} />;
  }
  return <PlayerChip player={player} size="sm" dimmed={lost} won={won} compact={compact} />;
}

function GhostChip({ player, lost, compact }: { player: BracketPlayer; lost: boolean; compact: boolean }) {
  const isPhoto = /^(data:|\/|https?:)/.test(player.avatar);
  const w = compact ? "w-[4.75rem]" : "w-24 sm:w-28";
  return (
    <div className={
      w + " h-6 rounded-md flex items-center gap-1.5 overflow-hidden px-1.5 " +
      (lost ? "opacity-25 grayscale line-through text-zinc-400" : "opacity-40 text-zinc-400")
    }>
      {isPhoto ? (
        <img src={player.avatar} alt="" className="shrink-0 w-4 h-4 rounded-full object-cover" />
      ) : (
        <span className="shrink-0 text-xs">{player.avatar}</span>
      )}
      <span className="truncate flex-1 text-[10px] font-semibold">{player.name}</span>
    </div>
  );
}

function PlayerChip({ player, size, dimmed = false, won = false, compact = false }: {
  player: BracketPlayer; size: "sm" | "lg"; dimmed?: boolean; won?: boolean; compact?: boolean;
}) {
  const isPhoto = /^(data:|\/|https?:)/.test(player.avatar);
  const lg = size === "lg";
  const w = compact ? "w-[4.75rem]" : "w-24 sm:w-28";
  const color = dimmed
    ? "opacity-25 grayscale line-through"
    : player.isYou
    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
    : won
    ? "bg-amber-500/10 text-amber-200"
    : "text-zinc-300";
  return (
    <motion.div
      layoutId={`player-${player.id}`}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className={
        (lg ? "w-12 h-12 rounded-full" : w + " h-6 rounded-md") +
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
          {player.isYou && <span className="shrink-0 text-[7px] uppercase tracking-wide text-emerald-300/80">toi</span>}
        </>
      )}
    </motion.div>
  );
}

/** A column of `count` right-pointing elbows, one per match in the round to its
 *  left. Shares the parent height + justify-around so the elbows line up with
 *  the matches at any bracket size. */
function Connectors({ count }: { count: number }) {
  return (
    <div className="flex flex-col justify-around shrink-0 w-4 sm:w-6 h-full pt-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col flex-1 py-0.5">
          <div className="flex-1 border-t border-r border-white/15 rounded-tr-md" />
          <div className="flex-1 border-b border-r border-white/15 rounded-br-md" />
        </div>
      ))}
    </div>
  );
}
