/**
 * ArenaBoard — visual board for Constellation Pro.
 *
 * Layout (top → bottom):
 *   opponent hero strip  (portrait, HP bar, mana pips, hand size)
 *   opponent lane row    (3 slots — empty or creature card)
 *   player   lane row    (3 slots — empty or creature card)
 *   player   hero strip  (portrait, HP bar, mana pips)
 *
 * The hand fanout + lock button live in ArenaPlanPhase, not here.
 * This component is mostly read-only — taps to summon/spell happen in
 * the plan phase, which routes back to ArenaGame's handlers.
 */

import { motion } from "motion/react";
import { MoveGlyph } from "../icons";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";
import { useArenaPad } from "../ranked/arena";
import { CREATURE_STATS, type BoardState, type Creature, type LaneIndex, type Side, type TurnIntent } from "./arenaTypes";

export interface ArenaBoardProps {
  board: BoardState;
  /** Which side is "us" (the player) — always "a" in MVP vs CPU. */
  playerSide: Side;
  /** The player's pending intent — used to render ghost-previews of the
   *  summons/spells that WILL fire on lock. */
  intent: TurnIntent;
}

export function ArenaBoard({ board, playerSide, intent }: ArenaBoardProps) {
  const padId = useArenaPad(useStore((s) => s.player.padId));
  const oppSide: Side = playerSide === "a" ? "b" : "a";
  const me = board[playerSide];
  const opp = board[oppSide];

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-emerald-900/40 shadow-[inset_0_0_36px_rgba(0,0,0,0.55)] flex-1 min-h-0 flex flex-col">
      {/* Backdrop — same pad system as Ranked, so themes carry over. */}
      <div className="absolute inset-0 pointer-events-none">
        <BattlePad padId={padId} className="w-full h-full" compact />
      </div>
      {/* Radial vignette for legibility. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.7), rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      <div className="relative flex flex-col gap-2 p-2 sm:p-3 flex-1 min-h-0">
        {/* Opponent strip */}
        <HeroStrip hero={opp} side="opp" turn={board.turn} />

        {/* Opponent lane row */}
        <LaneRow
          lanes={board.lanes}
          renderSide={oppSide}
          intent={null}
          isPlayer={false}
        />

        {/* Center divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent my-0.5" />

        {/* Player lane row */}
        <LaneRow
          lanes={board.lanes}
          renderSide={playerSide}
          intent={intent}
          isPlayer={true}
        />

        {/* Player strip */}
        <HeroStrip hero={me} side="you" turn={board.turn} />
      </div>
    </div>
  );
}

/* ───────────────────────── Hero strip ───────────────────────── */

function HeroStrip({
  hero, side, turn,
}: {
  hero: BoardState["a"];
  side: "you" | "opp";
  turn: number;
}) {
  const accent = side === "you" ? "text-emerald-300" : "text-rose-300";
  const label = side === "you" ? "Toi" : "Adv";
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  return (
    <div className="flex items-center gap-2 px-1">
      <div className={"text-[10px] uppercase tracking-[0.25em] font-bold " + accent + " w-9 shrink-0"}>
        ✦ {label}
      </div>
      {/* HP bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-black text-white tabular-nums">{hero.hp}/{hero.maxHp}</span>
        <div className="flex-1 h-2 rounded-full bg-hairline overflow-hidden">
          <motion.div
            className={"h-full " + (hpPct > 50 ? "bg-emerald-400" : hpPct > 25 ? "bg-amber-400" : "bg-rose-500")}
            animate={{ width: `${hpPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        {/* Divine shield ring on hero */}
        {hero.divineShield && (
          <span className="text-xs" title="Bouclier divin">🛡️</span>
        )}
      </div>
      {/* Mana pips */}
      <div className="flex items-center gap-0.5 shrink-0">
        {Array.from({ length: hero.maxMana }, (_, i) => (
          <span
            key={i}
            className={
              "w-1.5 h-1.5 rounded-full ring-1 ring-black/40 " +
              (i < hero.mana ? "bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" : "bg-zinc-700")
            }
          />
        ))}
        <span className="text-[9px] font-bold text-sky-300 ml-1 tabular-nums">{hero.mana}/{hero.maxMana}</span>
      </div>
      {/* Hand size */}
      <div className="text-[9px] font-bold text-ink-muted shrink-0 ml-1">
        🂠 {hero.hand.length}
      </div>
      {/* Turn counter on the player strip */}
      {side === "you" && (
        <div className="text-[9px] font-bold text-themed shrink-0 ml-1">
          T{turn}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Lane row ───────────────────────── */

function LaneRow({
  lanes, renderSide, intent, isPlayer,
}: {
  lanes: BoardState["lanes"];
  renderSide: Side;
  intent: TurnIntent | null;
  isPlayer: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[0, 1, 2].map((i) => {
        const lane = i as LaneIndex;
        const c = lanes[lane][renderSide];
        const plannedSummon = intent?.summons.find((s) => s.lane === lane) ?? null;
        return (
          <LaneSlot
            key={i}
            lane={lane}
            creature={c}
            plannedSummon={plannedSummon}
            isPlayer={isPlayer}
          />
        );
      })}
    </div>
  );
}

function LaneSlot({
  creature, plannedSummon, isPlayer, lane: _lane,
}: {
  lane: LaneIndex;
  creature: Creature | null;
  plannedSummon: { lane: LaneIndex; move: Creature["move"] } | null;
  isPlayer: boolean;
}) {
  if (creature) {
    const stats = CREATURE_STATS[creature.move];
    const atk = Math.max(0, stats.atk + creature.atkBuff);
    const lowHp = creature.hp <= 1;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: isPlayer ? 8 : -8, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={
          "aspect-[5/4] w-full rounded-xl border-2 relative flex flex-col items-center justify-center bg-surface-2 " +
          (creature.anchored ? "ring-2 ring-zinc-300/60 " : "") +
          (creature.divineShield ? "border-yellow-300/80 " : isPlayer ? "border-emerald-400/50" : "border-rose-400/50")
        }
      >
        <MoveGlyph move={creature.move} className="w-9 h-9 sm:w-11 sm:h-11" />
        {/* ATK/HP corner stats */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-1 pb-0.5">
          <span className="text-[11px] font-black text-amber-300 tabular-nums leading-none">
            {atk}
            {creature.atkBuff > 0 && <span className="text-[8px] text-emerald-300 ml-0.5">+{creature.atkBuff}</span>}
            {creature.atkBuff < 0 && <span className="text-[8px] text-rose-300 ml-0.5">{creature.atkBuff}</span>}
          </span>
          <span className={"text-[11px] font-black tabular-nums leading-none " + (lowHp ? "text-rose-300" : "text-white")}>
            ❤ {creature.hp}
          </span>
        </div>
        {/* Status indicators top-right */}
        <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
          {creature.divineShield && <span className="text-[10px]" title="Bouclier divin">🛡️</span>}
          {creature.anchored && <span className="text-[10px]" title="Ancré">⚓</span>}
          {creature.ripostePrimed && <span className="text-[10px]" title="Riposte">⚔️</span>}
        </div>
      </motion.div>
    );
  }

  if (plannedSummon && isPlayer) {
    // Ghost-preview of the planned summon — semi-transparent until lock.
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 0.55, scale: 1 }}
        className="aspect-[5/4] w-full rounded-xl border-2 border-dashed border-emerald-300/70 bg-emerald-500/10 relative flex items-center justify-center"
      >
        <MoveGlyph move={plannedSummon.move} className="w-9 h-9 sm:w-11 sm:h-11 opacity-70" />
        <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-emerald-200/90 uppercase tracking-wider font-bold">
          en attente
        </span>
      </motion.div>
    );
  }

  return (
    <div className="aspect-[5/4] w-full rounded-xl border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">vide</span>
    </div>
  );
}
