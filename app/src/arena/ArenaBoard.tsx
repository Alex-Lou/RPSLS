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
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";
import { useArenaPad } from "../ranked/arena";
import { CARDS } from "../ranked/cards";
import { useT } from "../i18n";
import { CREATURE_STATS, type BoardState, type Creature, type LaneIndex, type Side, type TurnIntent } from "./arenaTypes";

export interface ArenaBoardProps {
  board: BoardState;
  /** Which side is "us" (the player) — always "a" in MVP vs CPU. */
  playerSide: Side;
  /** The player's pending intent — used to render ghost-previews of the
   *  summons/spells that WILL fire on lock. */
  intent: TurnIntent;
  /** OPP intent preview — set during the "Adversaire joue…" window between
   *  lock and resolver. Ghost previews on opp lanes + chip strip of their
   *  spells so the player SEES what's incoming before damage lands. */
  oppPreview?: TurnIntent | null;
}

export function ArenaBoard({ board, playerSide, intent, oppPreview }: ArenaBoardProps) {
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

        {/* CPU intent reveal banner — visible only during the post-lock
         *  reveal window. Names each spell the CPU committed; the lane
         *  summons surface as ghosts on the opp lane row below. */}
        {oppPreview && (oppPreview.spells.length > 0 || oppPreview.summons.length > 0) && (
          <OppRevealBanner intent={oppPreview} />
        )}

        {/* Opponent lane row — ghost previews of opp summons during reveal. */}
        <LaneRow
          lanes={board.lanes}
          renderSide={oppSide}
          intent={oppPreview ?? null}
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
  /** For the player row: their own planned summons (ghost previews).
   *  For the opp row during reveal: the CPU's committed summons. Both show
   *  the same ghost-card visual so the player can read either side's plan. */
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
            showPlanned={!!intent}
          />
        );
      })}
    </div>
  );
}

function LaneSlot({
  creature, plannedSummon, isPlayer, showPlanned = false, lane: _lane,
}: {
  lane: LaneIndex;
  creature: Creature | null;
  plannedSummon: { lane: LaneIndex; move: Creature["move"] } | null;
  isPlayer: boolean;
  /** When false, the ghost-preview branch is skipped (used to suppress the
   *  player's own planned summons from rendering on the opp row, etc.). */
  showPlanned?: boolean;
}) {
  if (creature) {
    const stats = CREATURE_STATS[creature.move];
    const atk = Math.max(0, stats.atk + creature.atkBuff);
    const lowHp = creature.hp <= 1;
    const pal = MOVE_PALETTE[creature.move];
    const rim = moveRim(pal.hex);
    const glow = moveGlow(pal.hex);
    // Side affinity tinting: player creatures get an emerald inner badge,
    // opp creatures get a rose one — visual ownership cue independent of
    // the move's signature color (kept on the frame rim).
    const sideTint = isPlayer ? "rgba(52,211,153,0.55)" : "rgba(244,63,94,0.55)";
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: isPlayer ? 12 : -12, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        // Layout shake when HP drops — `key={creature.hp}` triggers a
        // damage flash on re-render. (Phase 2 will add a real hit anim.)
        className={
          "aspect-[5/4] w-full rounded-xl relative flex flex-col items-center justify-center overflow-hidden transition " +
          (creature.divineShield ? "" : "")
        }
        style={{
          background: "linear-gradient(160deg, rgba(20,22,32,0.94) 0%, rgba(10,12,20,0.94) 100%)",
          border: `2px solid ${creature.divineShield ? "rgba(252,211,77,0.95)" : rim}`,
          boxShadow:
            (creature.divineShield
              ? "0 0 20px -2px rgba(252,211,77,0.7), "
              : `0 0 14px -3px ${glow}, `) +
            `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${sideTint}30`,
        }}
      >
        {/* Subtle pad-side dot ribbon top-left to anchor "who owns this" */}
        <div
          className="absolute top-1 left-1 w-2 h-2 rounded-full"
          style={{ background: sideTint, boxShadow: `0 0 6px ${sideTint}` }}
          aria-hidden
        />
        {/* Glyph occupies most of the card, like the in-hand cards */}
        <MoveGlyph move={creature.move} className="w-10 h-10 sm:w-12 sm:h-12" />
        {/* Move name label sits between glyph and stats — tiny, rim-colored */}
        <span
          className="text-[7px] uppercase tracking-wider font-black leading-none mt-0.5"
          style={{ color: rim }}
        >
          {creature.move}
        </span>
        {/* ATK and HP corner badges — bigger, "card-like", easier to scan */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-1 pb-0.5">
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/85 text-amber-50 text-[10px] font-black leading-none tabular-nums shadow">
            ⚔ {atk}
            {creature.atkBuff > 0 && <span className="text-[7px] opacity-90">+{creature.atkBuff}</span>}
            {creature.atkBuff < 0 && <span className="text-[7px] opacity-90">{creature.atkBuff}</span>}
          </span>
          <motion.span
            key={creature.hp}
            initial={{ scale: 1.3, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#fee2e2" }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-600/85 text-[10px] font-black leading-none tabular-nums shadow"
          >
            ❤ {creature.hp}/{stats.hp}
          </motion.span>
        </div>
        {/* Status icons row top-right */}
        <div className="absolute top-1 right-1 flex items-center gap-0.5">
          {creature.divineShield && <span className="text-[10px]" title="Bouclier divin">🛡️</span>}
          {creature.anchored && <span className="text-[10px]" title="Ancré">⚓</span>}
          {creature.ripostePrimed && <span className="text-[10px]" title="Riposte">⚔️</span>}
        </div>
      </motion.div>
    );
  }

  if (plannedSummon && showPlanned) {
    // Ghost-preview of the planned summon — semi-transparent until lock.
    // Same move-tinted rim as the real creature, but dashed border + 60%
    // opacity so the player reads "this WILL be there, not yet committed".
    const pal = MOVE_PALETTE[plannedSummon.move];
    const rim = moveRim(pal.hex);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        className="aspect-[5/4] w-full rounded-xl relative flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(20,22,32,0.55) 0%, rgba(10,12,20,0.55) 100%)",
          border: `2px dashed ${rim}`,
          boxShadow: `0 0 10px -3px ${moveGlow(pal.hex)}80`,
        }}
      >
        <MoveGlyph move={plannedSummon.move} className="w-10 h-10 sm:w-12 sm:h-12 opacity-80" />
        <span
          className="text-[7px] uppercase tracking-wider font-bold leading-none mt-0.5 opacity-90"
          style={{ color: rim }}
        >
          {plannedSummon.move}
        </span>
        <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-emerald-200/90 uppercase tracking-[0.18em] font-black">
          en attente
        </span>
      </motion.div>
    );
  }

  return (
    <div className="aspect-[5/4] w-full rounded-xl border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center">
      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">vide</span>
    </div>
  );
}

/** Opp-reveal banner — surfaces the CPU's committed intent during the
 *  reveal window. Lists each spell as a chip with the card's glyph + name +
 *  cost so the player can read what's about to fire. Summons land as ghost
 *  previews on the opp lane row, not here. */
function OppRevealBanner({ intent }: { intent: TurnIntent }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex flex-wrap items-center justify-center gap-1.5 px-2 -mt-1"
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-rose-300 font-black">
        Adversaire joue
      </span>
      {intent.summons.map((s, i) => (
        <span
          key={`sm-${i}`}
          className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-rose-500/20 border border-rose-400/50 text-rose-100"
        >
          <MoveGlyph move={s.move} className="w-3 h-3" />
          <span>L{s.lane + 1}</span>
        </span>
      ))}
      {intent.spells.map((s, i) => {
        const card = CARDS[s.id];
        const laneSuffix = s.kind === "lane" ? ` L${s.lane + 1}` : "";
        return (
          <span
            key={`sp-${i}`}
            className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-100"
            title={t(card.descKey)}
          >
            <span>{card.glyph}</span>
            <span>{t(card.nameKey)}{laneSuffix}</span>
          </span>
        );
      })}
    </motion.div>
  );
}
