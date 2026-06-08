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
import { CARDS } from "../ranked/cards";
import { useT } from "../i18n";
import { ArenaLaneSlot } from "./ArenaLaneSlot";
import { ArenaHeroStrip } from "./ArenaHeroStrip";
import type { BoardState, LaneIndex, Side, TurnIntent } from "./arenaTypes";

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
  /** Player-side mirror of oppPreview — shows what YOU just committed
   *  (chip strip). Same lifetime as oppPreview. */
  playerPreview?: TurnIntent | null;
  /** Current step in the sequenced resolver — drives the phase banner so
   *  the player always knows what's about to happen / just happened. */
  resolveStep?: "reveal-opp" | "spells" | "summons" | "combat" | "settle" | null;
  /** Which lane is currently animating its combat (0/1/2) or null when no
   *  lane is "live". Drives the per-lane charge anim. */
  combatLane?: LaneIndex | null;
  /** Hero-hit flash event — set briefly when a creature lands an attack
   *  on a hero. The targeted side's HP bar flashes white→red dramatically. */
  heroHit?: { side: "you" | "opp"; lane: LaneIndex; key: number } | null;
  /** Active targeting (lifted from ArenaPlanPhase) — when set on a lane
   *  target, the board's player-side lane slots become tappable + pulse. */
  targeting?: { kind: "summon" } | { kind: "spell"; targetKind: string } | null;
  /** Called when the player taps a lane slot while targeting is active. */
  onLaneTap?: (lane: LaneIndex) => void;
}

export function ArenaBoard({ board, playerSide, intent, oppPreview, playerPreview, resolveStep, combatLane = null, heroHit = null, targeting, onLaneTap }: ArenaBoardProps) {
  // When targeting is active and wants a lane (summon, or spell with
  // lane target), the player-side lane slots pulse + become tappable.
  const acceptingLaneTaps =
    !!targeting && (
      targeting.kind === "summon" ||
      (targeting.kind === "spell" && (targeting as { targetKind?: string }).targetKind === "lane")
    );
  const padId = useArenaPad(useStore((s) => s.player.padId));
  // Player identity for the hero portrait — pulls avatar + nickname from
  // the store so the board reads as "alex vs CPU" instead of "Toi vs Adv".
  const playerAvatar = useStore((s) => s.player.avatar);
  const playerName = useStore((s) => s.player.nickname) || "Toi";
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

      <div className="relative flex flex-col gap-1.5 p-2 sm:p-3 flex-1 min-h-0">
        {/* Opponent strip — HP bar flashes when an attack lands on opp hero. */}
        <ArenaHeroStrip
          hero={opp} side="opp" turn={board.turn} name="CPU" avatar={undefined}
          incomingAttackKey={heroHit?.side === "opp" ? heroHit.key : null}
        />

        {/* Opponent lane row — ghost previews of opp summons during reveal. */}
        <LaneRow
          lanes={board.lanes}
          renderSide={oppSide}
          intent={oppPreview ?? null}
          isPlayer={false}
          combatLane={combatLane}
        />

        {/* CENTER STATUS ZONE — single bar that owns the phase chip + the
         *  current event ("Adversaire dévoile" / "Sorts" / "Combat Lane N").
         *  Replaces the previous 3-stack (phase banner + 2 reveal banners)
         *  so the eye has ONE thing to read at the center. */}
        <CenterStatus
          step={resolveStep ?? null}
          turn={board.turn}
          combatLane={combatLane}
          oppPreview={oppPreview}
          playerPreview={playerPreview}
        />

        {/* Player lane row */}
        <LaneRow
          lanes={board.lanes}
          renderSide={playerSide}
          intent={intent}
          isPlayer={true}
          combatLane={combatLane}
          acceptingTaps={acceptingLaneTaps}
          onLaneTap={onLaneTap}
        />

        {/* Player strip — HP bar flashes when an attack lands on player hero. */}
        <ArenaHeroStrip
          hero={me} side="you" turn={board.turn} name={playerName} avatar={playerAvatar}
          incomingAttackKey={heroHit?.side === "you" ? heroHit.key : null}
        />
      </div>
    </div>
  );
}


/** Center status zone — UNIFIED replacement for the old (PhaseBanner +
 *  OppRevealBanner × 2) stack. ONE element at the center between the two
 *  rows, switching content based on what's happening:
 *    • planning  — "Tour N · Premier à 0 ❤"
 *    • reveal-opp — "Adversaire dévoile" + chips of both sides' intents
 *    • spells    — "✨ Sorts en cours"
 *    • summons   — "🌟 Invocations"
 *    • combat    — "⚔️ Combat — Lane {N}"
 *    • settle    — "Fin du tour…"
 *  Always one ROW high so the layout doesn't jump when content swaps. */
function CenterStatus({
  step, turn, combatLane, oppPreview, playerPreview,
}: {
  step: ArenaBoardProps["resolveStep"];
  turn: number;
  combatLane: LaneIndex | null;
  oppPreview: TurnIntent | null | undefined;
  playerPreview: TurnIntent | null | undefined;
}) {
  // Reveal step gets a 2-line layout: title chip on top + intent chips below.
  // Everything else is a single chip.
  if (step === "reveal-opp" && (oppPreview || playerPreview)) {
    return (
      <div className="flex flex-col items-center gap-1 py-0.5">
        <Chip label="Adversaire dévoile son tour" tone="rose" />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {playerPreview && <IntentChips intent={playerPreview} side="you" />}
          {oppPreview && <IntentChips intent={oppPreview} side="opp" />}
        </div>
      </div>
    );
  }
  const laneLabel = combatLane !== null ? ` — Lane ${combatLane + 1}` : "";
  const label =
    step === "spells"  ? "✨ Sorts en cours" :
    step === "summons" ? "🌟 Invocations" :
    step === "combat"  ? "⚔️ Combat" + laneLabel :
    step === "settle"  ? "Fin du tour…" :
    "Tour " + turn + " · Premier à 0 ❤";
  const tone: ChipTone =
    step === "spells"  ? "fuchsia" :
    step === "summons" ? "emerald" :
    step === "combat"  ? "amber"   :
    step === "settle"  ? "zinc"    :
    "sky";
  return (
    <div className="flex items-center justify-center py-0.5">
      <Chip label={label} tone={tone} stepKey={step ?? "planning"} />
    </div>
  );
}

type ChipTone = "rose" | "fuchsia" | "emerald" | "amber" | "zinc" | "sky";
function Chip({ label, tone, stepKey }: { label: string; tone: ChipTone; stepKey?: string }) {
  const toneCls =
    tone === "rose"    ? "from-rose-500/30 to-rose-600/20 border-rose-400/50 text-rose-100" :
    tone === "fuchsia" ? "from-fuchsia-500/30 to-violet-600/20 border-fuchsia-400/50 text-fuchsia-100" :
    tone === "emerald" ? "from-emerald-500/30 to-teal-600/20 border-emerald-400/50 text-emerald-100" :
    tone === "amber"   ? "from-amber-500/30 to-orange-600/20 border-amber-400/50 text-amber-100" :
    tone === "zinc"    ? "from-zinc-500/30 to-zinc-700/20 border-zinc-400/50 text-zinc-100" :
                         "from-sky-500/20 to-cyan-600/15 border-sky-400/40 text-sky-100";
  return (
    <motion.div
      key={stepKey ?? label}
      initial={{ opacity: 0, y: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={"px-3 py-1 rounded-full bg-gradient-to-r border text-[11px] uppercase tracking-[0.18em] font-black shadow " + toneCls}
    >
      {label}
    </motion.div>
  );
}

/** Intent chips — compact list of summons + spells one side committed. */
function IntentChips({ intent, side }: { intent: TurnIntent; side: "you" | "opp" }) {
  const t = useT();
  const summonTone = side === "you"
    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100"
    : "bg-rose-500/20 border-rose-400/50 text-rose-100";
  if (intent.summons.length === 0 && intent.spells.length === 0) return null;
  return (
    <>
      {intent.summons.map((s, i) => (
        <span
          key={`${side}-sm-${i}`}
          className={"inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 border " + summonTone}
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
            key={`${side}-sp-${i}`}
            className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-100"
            title={t(card.descKey)}
          >
            <span>{card.glyph}</span>
            <span>{t(card.nameKey)}{laneSuffix}</span>
          </span>
        );
      })}
    </>
  );
}

/* ───────────────────────── Lane row ───────────────────────── */

function LaneRow({
  lanes, renderSide, intent, isPlayer, combatLane = null,
  acceptingTaps = false, onLaneTap,
}: {
  lanes: BoardState["lanes"];
  renderSide: Side;
  intent: TurnIntent | null;
  isPlayer: boolean;
  /** Which lane is "live" in the per-lane combat anim — its creature on
   *  this side gets the CHARGE animation; the other two stay still. */
  combatLane?: LaneIndex | null;
  /** When true (player row only, while targeting is active) lane slots
   *  become tappable + show a pulsing outline. */
  acceptingTaps?: boolean;
  onLaneTap?: (lane: LaneIndex) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[0, 1, 2].map((i) => {
        const lane = i as LaneIndex;
        const c = lanes[lane][renderSide];
        const plannedSummon = intent?.summons.find((s) => s.lane === lane) ?? null;
        const inCombat = combatLane === lane;
        return (
          <ArenaLaneSlot
            key={i}
            lane={lane}
            creature={c}
            plannedSummon={plannedSummon}
            isPlayer={isPlayer}
            showPlanned={!!intent}
            chargeAttack={inCombat}
            clickable={acceptingTaps}
            onClick={acceptingTaps && onLaneTap ? () => onLaneTap(lane) : undefined}
          />
        );
      })}
    </div>
  );
}
