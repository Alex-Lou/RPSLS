/**
 * BracketUI — visual components for the tournament bracket.
 *
 * The tree is fully generic over the number of rounds: it walks
 * `tournament.rounds` and lays every column out at the same fixed height with
 * `justify-around`, so a 4 / 8 / 16-player tree all align their connectors
 * automatically.
 *
 * The bracket container scrolls on BOTH axes when the tree exceeds its
 * viewport, so the active match + the "Combattre" CTA below it stay
 * reachable on any phone (a 16-player tree no longer pushes the CTA off
 * the visible area). The active match auto-scrolls into view.
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
  // Visual density tuned per size: larger chips on 4/8 trees, compact on 16
  // so the whole tree fits inside a phone-height container without losing
  // legibility. The unit drives a fixed per-column height so every round
  // aligns vertically via justify-around.
  const compact = t.size === 16;
  const unit = compact ? 60 : 80;
  const rows = Math.max(2, t.rounds[0]?.length ?? 2);
  const height = rows * unit;

  const playingRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    playingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, [t.rounds]);

  return (
    // The bracket is its own bounded scroll area so the "Combattre" CTA
    // below it always stays on screen — even on a 16-player tree.
    // max-h: leaves room above for the page header and below for the CTA.
    <div
      className="
        w-full max-h-[55vh] sm:max-h-[60vh]
        overflow-auto py-3 px-2
        rounded-2xl
        bg-zinc-950/55 border border-white/12
        shadow-inner shadow-black/30
      "
    >
      <div className="flex items-stretch gap-2 min-w-max" style={{ height }}>
        {t.rounds.map((round, ri) => (
          <div key={`round-${ri}`} className="flex items-stretch gap-1.5 shrink-0">
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
    <div className="flex flex-col items-center justify-center gap-2 px-3 shrink-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-extrabold">
        Champion
      </div>
      {champion ? (
        <PlayerChip player={champion} size="lg" />
      ) : (
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-amber-400/40 flex items-center justify-center text-2xl bg-amber-500/5">
          🏆
        </div>
      )}
    </div>
  );
}

function RoundCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center shrink-0 h-full">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-300 font-extrabold mb-1.5 shrink-0">
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
    <motion.div
      ref={playingRef}
      animate={playing ? { scale: [1, 1.025, 1] } : { scale: 1 }}
      transition={playing ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      className={
        "flex flex-col gap-0.5 rounded-xl border p-1 transition " +
        (playing
          ? "border-amber-300/80 bg-amber-500/15 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40"
          : done
          ? "border-white/12 bg-zinc-900/55"
          : "border-white/12 bg-zinc-900/40")
      }
    >
      <SlotRow
        player={match.p1}
        compact={compact}
        isPrimary={!!match.p1 && primary.get(match.p1.id) === slotKey("p1")}
        lost={done && match.winner?.id !== match.p1?.id}
        won={done && match.winner?.id === match.p1?.id}
      />
      <div className="h-px bg-white/10" />
      <SlotRow
        player={match.p2}
        compact={compact}
        isPrimary={!!match.p2 && primary.get(match.p2.id) === slotKey("p2")}
        lost={done && match.winner?.id !== match.p2?.id}
        won={done && match.winner?.id === match.p2?.id}
      />
    </motion.div>
  );
}

function SlotRow({ player, isPrimary, lost, won, compact }: {
  player: BracketPlayer | null; isPrimary: boolean; lost: boolean; won: boolean; compact: boolean;
}) {
  const w = compact ? "w-[5.25rem]" : "w-28 sm:w-32";
  if (!player) {
    return (
      <div className={w + " h-7 rounded-md flex items-center justify-center"}>
        <span className="text-[10px] text-zinc-600 italic">—</span>
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
  const w = compact ? "w-[5.25rem]" : "w-28 sm:w-32";
  return (
    <div className={
      w + " h-7 rounded-md flex items-center gap-1.5 overflow-hidden px-1.5 " +
      (lost ? "opacity-30 grayscale line-through text-zinc-400" : "opacity-50 text-zinc-300")
    }>
      {isPhoto ? (
        <img src={player.avatar} alt="" className="shrink-0 w-5 h-5 rounded-full object-cover" />
      ) : (
        <span className="shrink-0 text-sm">{player.avatar}</span>
      )}
      <span className="truncate flex-1 text-[11px] font-semibold">{player.name}</span>
    </div>
  );
}

function PlayerChip({ player, size, dimmed = false, won = false, compact = false }: {
  player: BracketPlayer; size: "sm" | "lg"; dimmed?: boolean; won?: boolean; compact?: boolean;
}) {
  const isPhoto = /^(data:|\/|https?:)/.test(player.avatar);
  const lg = size === "lg";
  const w = compact ? "w-[5.25rem]" : "w-28 sm:w-32";
  const color = dimmed
    ? "opacity-30 grayscale line-through text-zinc-400"
    : player.isYou
    ? "bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-300/60 font-bold"
    : won
    ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/50"
    : "text-zinc-100";
  return (
    <motion.div
      layoutId={`player-${player.id}`}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className={
        (lg ? "w-14 h-14 rounded-full" : w + " h-7 rounded-md") +
        " flex items-center gap-1.5 overflow-hidden transition " +
        (lg ? "justify-center " : "px-1.5 ") +
        color +
        (lg ? " ring-2 ring-amber-300/80 shadow-lg shadow-amber-500/40" : "")
      }
    >
      {isPhoto ? (
        <img src={player.avatar} alt="" className={lg ? "w-full h-full object-cover" : "shrink-0 w-5 h-5 rounded-full object-cover"} />
      ) : (
        <span className={lg ? "text-2xl" : "shrink-0 text-sm"}>{player.avatar}</span>
      )}
      {!lg && (
        <>
          <span className="truncate flex-1 text-[11px] font-semibold">{player.name}</span>
          {player.isYou && <span className="shrink-0 text-[8px] uppercase tracking-wide text-emerald-200/90 font-bold">toi</span>}
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
    <div className="flex flex-col justify-around shrink-0 w-5 sm:w-7 h-full pt-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col flex-1 py-0.5">
          <div className="flex-1 border-t-2 border-r-2 border-white/25 rounded-tr-md" />
          <div className="flex-1 border-b-2 border-r-2 border-white/25 rounded-br-md" />
        </div>
      ))}
    </div>
  );
}
