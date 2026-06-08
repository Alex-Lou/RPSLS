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

import { AnimatePresence, motion } from "motion/react";
import { MoveGlyph } from "../icons";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";
import { useArenaPad } from "../ranked/arena";
import { CARDS } from "../ranked/cards";
import { useT } from "../i18n";
import { ArenaLaneSlot } from "./ArenaLaneSlot";
import { ArenaHeroStrip } from "./ArenaHeroStrip";
import { CardSlot } from "../ranked/CardSlot";
import { isValidLaneTarget, targetLabelFor, LANE_SPELL_TARGET_SIDE } from "./arenaTypes";
import type { ArenaTargeting, BoardState, LaneIndex, Side, TurnIntent } from "./arenaTypes";

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
   *  target, the BOARD highlights ONLY the lane slots a spell of that
   *  kind can actually target (my creature for buffs, opp creature for
   *  debuffs, my empty for summons, etc.). */
  targeting?: ArenaTargeting;
  /** Called when the player taps a lane slot while targeting is active.
   *  Receives BOTH the lane AND the side that was tapped, so the parent
   *  can decide what to do (commit to my row, commit to opp row, etc.). */
  onLaneTap?: (lane: LaneIndex, side: Side) => void;
}

export function ArenaBoard({ board, playerSide, intent, oppPreview, playerPreview, resolveStep, combatLane = null, heroHit = null, targeting, onLaneTap }: ArenaBoardProps) {
  // Compute per-side per-lane validity once — drives the slot highlights
  // for BOTH rows so cards targeting opp creatures light up the OPP row.
  const targetLabel = targetLabelFor(targeting ?? null);
  // Project the lanes shape to what isValidLaneTarget expects.
  const laneShape = board.lanes.map((l) => ({
    a: l.a ? { move: l.a.move } : null,
    b: l.b ? { move: l.b.move } : null,
  }));

  /** Compute the lane-card "stickers" each row should display in the corner
   *  of the targeted slot — same pattern as Ranked's LanesBoard CardSlot
   *  (Alex's "je veux la voir collée sur la lane comme dans Constellation
   *  Ranked"). Each sticker = an emerald-rim card chip on PLAYER's side
   *  ownership / rose-rim on CPU's. Position bottom-* for "you" owner,
   *  top-* for "opp" owner so both can be on the same lane without overlap. */
  const oppSide: Side = playerSide === "a" ? "b" : "a";
  function stickersForSide(rowSide: Side) {
    const out: Array<{ lane: LaneIndex; id: import("../ranked/rankedTypes").CardId; owner: "you" | "opp"; position: "tl" | "tr" | "bl" | "br" }> = [];
    // Player's own intent — cast spells the player commits.
    const playerSpells = (playerPreview ?? intent).spells;
    for (const s of playerSpells) {
      if (s.kind !== "lane") continue;
      const tgt = LANE_SPELL_TARGET_SIDE[s.id] ?? "my-creature";
      const targetSide: Side = tgt === "opp-creature" ? oppSide : playerSide;
      if (targetSide === rowSide) out.push({ lane: s.lane, id: s.id, owner: "you", position: "bl" });
    }
    // CPU's intent — only visible during the reveal/spells window.
    const cpuSpells = oppPreview?.spells ?? [];
    for (const s of cpuSpells) {
      if (s.kind !== "lane") continue;
      const tgt = LANE_SPELL_TARGET_SIDE[s.id] ?? "my-creature";
      // For CPU, "my-creature" = oppSide, "opp-creature" = playerSide
      const targetSide: Side = tgt === "opp-creature" ? playerSide : oppSide;
      if (targetSide === rowSide) out.push({ lane: s.lane, id: s.id, owner: "opp", position: "tr" });
    }
    return out;
  }
  const playerRowStickers = stickersForSide(playerSide);
  const oppRowStickers = stickersForSide(oppSide);
  const padId = useArenaPad(useStore((s) => s.player.padId));
  // Player identity for the hero portrait — pulls avatar + nickname from
  // the store so the board reads as "alex vs CPU" instead of "Toi vs Adv".
  const playerAvatar = useStore((s) => s.player.avatar);
  const playerName = useStore((s) => s.player.nickname) || "Toi";
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
        {/* Opponent strip — HP bar flashes when an attack lands on opp hero.
         *  Augur revealed on opp = my augurRevealedB (I cast augur on side b),
         *  i.e. board.augurRevealedB if I'm side a, else board.augurRevealedA. */}
        <ArenaHeroStrip
          hero={opp} side="opp" turn={board.turn} name="CPU" avatar={undefined}
          incomingAttackKey={heroHit?.side === "opp" ? heroHit.key : null}
          augurRevealed={playerSide === "a" ? board.augurRevealedB : board.augurRevealedA}
        />

        {/* Opponent lane row — ghost previews of opp summons during reveal.
         *  Slots become tappable when a spell targets OPP creatures (Curse,
         *  Sangsue, Trou Noir). */}
        <LaneRow
          lanes={board.lanes}
          renderSide={oppSide}
          intent={oppPreview ?? null}
          isPlayer={false}
          combatLane={combatLane}
          validLanes={[0, 1, 2].map((i) => isValidLaneTarget(targeting ?? null, oppSide, i as LaneIndex, laneShape, playerSide))}
          targetLabel={targetLabel}
          onLaneTap={onLaneTap ? (l) => onLaneTap(l, oppSide) : undefined}
          stickers={oppRowStickers}
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

        {/* Player lane row — slots become tappable when targeting wants
         *  THIS side (summon → my empty; aegis/surge → my creature; etc.). */}
        <LaneRow
          lanes={board.lanes}
          renderSide={playerSide}
          intent={intent}
          isPlayer={true}
          combatLane={combatLane}
          validLanes={[0, 1, 2].map((i) => isValidLaneTarget(targeting ?? null, playerSide, i as LaneIndex, laneShape, playerSide))}
          targetLabel={targetLabel}
          onLaneTap={onLaneTap ? (l) => onLaneTap(l, playerSide) : undefined}
          stickers={playerRowStickers}
        />

        {/* Player strip — HP bar flashes when an attack lands on player hero.
         *  Augur cast on me = opp's augurRevealed on my side. */}
        <ArenaHeroStrip
          hero={me} side="you" turn={board.turn} name={playerName} avatar={playerAvatar}
          incomingAttackKey={heroHit?.side === "you" ? heroHit.key : null}
          augurRevealed={playerSide === "a" ? board.augurRevealedA : board.augurRevealedB}
        />
      </div>
    </div>
  );
}


/** Center status zone — UNIFIED replacement for the old (PhaseBanner +
 *  OppRevealBanner × 2) stack. ONE element at the center between the two
 *  rows. CRITICAL: this container has a FIXED HEIGHT — content variations
 *  (1 line idle vs 2 lines reveal) NEVER change the layout. The chip is
 *  vertically centered; reveal-mode intent chips render as an absolute
 *  overlay below the chip so they don't push the rows around. This is
 *  what makes the pad "stable" like the Ranked LanesBoard. */
function CenterStatus({
  step, turn, combatLane, oppPreview, playerPreview,
}: {
  step: ArenaBoardProps["resolveStep"];
  turn: number;
  combatLane: LaneIndex | null;
  oppPreview: TurnIntent | null | undefined;
  playerPreview: TurnIntent | null | undefined;
}) {
  const laneLabel = combatLane !== null ? ` — Lane ${combatLane + 1}` : "";
  const label =
    step === "reveal-opp" ? "Adversaire dévoile son tour" :
    step === "spells"  ? "✨ Sorts en cours" :
    step === "summons" ? "🌟 Invocations" :
    step === "combat"  ? "⚔️ Combat" + laneLabel :
    step === "settle"  ? "Fin du tour…" :
    "Tour " + turn + " · Premier à 0 ❤";
  const tone: ChipTone =
    step === "reveal-opp" ? "rose" :
    step === "spells"  ? "fuchsia" :
    step === "summons" ? "emerald" :
    step === "combat"  ? "amber"   :
    step === "settle"  ? "zinc"    :
    "sky";
  const showOverlayChips = step === "reveal-opp" && (oppPreview || playerPreview);
  return (
    <div className="relative h-7 flex items-center justify-center">
      <Chip label={label} tone={tone} stepKey={step ?? "planning"} />
      {/* Intent chips overlay during reveal — absolute so the row swap
       *  doesn't change the board's measured height. */}
      <AnimatePresence>
        {showOverlayChips && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute left-0 right-0 top-full mt-0.5 z-20 flex flex-wrap items-center justify-center gap-1.5 pointer-events-none px-2"
          >
            {playerPreview && <IntentChips intent={playerPreview} side="you" />}
            {oppPreview && <IntentChips intent={oppPreview} side="opp" />}
          </motion.div>
        )}
      </AnimatePresence>
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
  validLanes = [false, false, false], targetLabel = "", onLaneTap,
  stickers = [],
}: {
  lanes: BoardState["lanes"];
  renderSide: Side;
  intent: TurnIntent | null;
  isPlayer: boolean;
  combatLane?: LaneIndex | null;
  validLanes?: boolean[];
  targetLabel?: string;
  onLaneTap?: (lane: LaneIndex) => void;
  /** Card stickers to render in the corner of the targeted slot — same
   *  pattern as Ranked's CardSlot. Computed in the parent so both rows
   *  stay in sync. */
  stickers?: Array<{ lane: LaneIndex; id: import("../ranked/rankedTypes").CardId; owner: "you" | "opp"; position: "tl" | "tr" | "bl" | "br" }>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[0, 1, 2].map((i) => {
        const lane = i as LaneIndex;
        const c = lanes[lane][renderSide];
        const plannedSummon = intent?.summons.find((s) => s.lane === lane) ?? null;
        const inCombat = combatLane === lane;
        const valid = validLanes[i] ?? false;
        const laneStickers = stickers.filter((s) => s.lane === lane);
        return (
          <div key={i} className="relative">
            <ArenaLaneSlot
              lane={lane}
              creature={c}
              plannedSummon={plannedSummon}
              isPlayer={isPlayer}
              showPlanned={!!intent}
              chargeAttack={inCombat}
              clickable={valid}
              clickableLabel={targetLabel}
              onClick={valid && onLaneTap ? () => onLaneTap(lane) : undefined}
            />
            {/* Card stickers — small CardSlot badges showing which spells
             *  hit this lane this turn (mirrors Ranked LanesBoard pattern). */}
            {laneStickers.map((s, idx) => (
              <CardSlot key={`${s.id}-${idx}`} id={s.id} position={s.position} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
