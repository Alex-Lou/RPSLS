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
  /** Active targeting (lifted from ArenaPlanPhase) — when set on a lane
   *  target, the board's player-side lane slots become tappable + pulse. */
  targeting?: { kind: "summon" } | { kind: "spell"; targetKind: string } | null;
  /** Called when the player taps a lane slot while targeting is active. */
  onLaneTap?: (lane: LaneIndex) => void;
}

export function ArenaBoard({ board, playerSide, intent, oppPreview, playerPreview, resolveStep, targeting, onLaneTap }: ArenaBoardProps) {
  // Combat shake fires when the resolver lands on the "combat" step. The
  // creatures shake toward their opposing side for ~400ms BEFORE the death
  // animations + dmg popups land, so the player feels the impact happen.
  const combatShake = resolveStep === "combat";
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

      <div className="relative flex flex-col gap-2 p-2 sm:p-3 flex-1 min-h-0">
        {/* Phase banner — at the top so the player always knows where
         *  we are in the turn loop. Shows planning by default; switches
         *  to the resolver step labels during the sequenced resolve. */}
        <PhaseBanner step={resolveStep ?? null} turn={board.turn} />

        {/* Opponent strip */}
        <ArenaHeroStrip hero={opp} side="opp" turn={board.turn} name="CPU" avatar={undefined} />

        {/* CPU intent reveal banner — visible only during the post-lock
         *  reveal window. Names each spell the CPU committed; the lane
         *  summons surface as ghosts on the opp lane row below. */}
        {oppPreview && (oppPreview.spells.length > 0 || oppPreview.summons.length > 0) && (
          <OppRevealBanner intent={oppPreview} />
        )}

        {/* Lane labels — header row identifying each column so the player
         *  knows WHERE L1/L2/L3 are when the targeting overlay says
         *  "Touche une lane → Lane 1/2/3". */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 -mb-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="text-center text-[9px] uppercase tracking-[0.25em] font-black text-zinc-400"
            >
              ⋅ Lane {i + 1} ⋅
            </div>
          ))}
        </div>

        {/* Opponent lane row — ghost previews of opp summons during reveal. */}
        <LaneRow
          lanes={board.lanes}
          renderSide={oppSide}
          intent={oppPreview ?? null}
          isPlayer={false}
          combatShake={combatShake}
        />

        {/* Center divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent my-0.5" />

        {/* Player reveal banner — mirror of opp's, names YOUR queued spells
         *  during the same window so the player reads BOTH sides at once. */}
        {playerPreview && (playerPreview.spells.length > 0 || playerPreview.summons.length > 0) && (
          <OppRevealBanner intent={playerPreview} side="you" />
        )}

        {/* Player lane row */}
        <LaneRow
          lanes={board.lanes}
          renderSide={playerSide}
          intent={intent}
          isPlayer={true}
          combatShake={combatShake}
          acceptingTaps={acceptingLaneTaps}
          onLaneTap={onLaneTap}
        />

        {/* Player strip */}
        <ArenaHeroStrip hero={me} side="you" turn={board.turn} name={playerName} avatar={playerAvatar} />
      </div>
    </div>
  );
}


/** Phase banner — shows the current step of the turn so the player isn't
 *  guessing what just happened. Stays visible during planning AND during
 *  the sequenced resolver (each step gets its own label + color). */
function PhaseBanner({
  step, turn,
}: {
  step: ArenaBoardProps["resolveStep"];
  turn: number;
}) {
  const label =
    step === "reveal-opp" ? "Adversaire dévoile son tour"  :
    step === "spells"     ? "✨ Sorts déclenchés"          :
    step === "summons"    ? "🌟 Invocations sur les lanes" :
    step === "combat"     ? "⚔️ Combat sur les lanes"     :
    step === "settle"     ? "Fin du tour…"                 :
    // Default (planning) — keep the WIN CONDITION visible at all times so
    // the player never forgets the objective. Alex's feedback: "Je ne
    // comprends pas trop comment gagner ou perdre des points".
    "Tour " + turn + " · Premier à 0 ❤ gagne";
  const tone =
    step === "reveal-opp" ? "from-rose-500/30 to-rose-600/20 border-rose-400/50 text-rose-100"  :
    step === "spells"     ? "from-fuchsia-500/30 to-violet-600/20 border-fuchsia-400/50 text-fuchsia-100" :
    step === "summons"    ? "from-emerald-500/30 to-teal-600/20 border-emerald-400/50 text-emerald-100" :
    step === "combat"     ? "from-amber-500/30 to-orange-600/20 border-amber-400/50 text-amber-100" :
    step === "settle"     ? "from-zinc-500/30 to-zinc-700/20 border-zinc-400/50 text-zinc-100" :
    "from-sky-500/20 to-cyan-600/15 border-sky-400/40 text-sky-100";
  return (
    <motion.div
      key={step ?? "planning"}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        "self-center px-3 py-1 rounded-full bg-gradient-to-r border text-[11px] uppercase tracking-[0.18em] font-black shadow " +
        tone
      }
    >
      {label}
    </motion.div>
  );
}

/* ───────────────────────── Lane row ───────────────────────── */

function LaneRow({
  lanes, renderSide, intent, isPlayer, combatShake = false,
  acceptingTaps = false, onLaneTap,
}: {
  lanes: BoardState["lanes"];
  renderSide: Side;
  intent: TurnIntent | null;
  isPlayer: boolean;
  combatShake?: boolean;
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
        return (
          <ArenaLaneSlot
            key={i}
            lane={lane}
            creature={c}
            plannedSummon={plannedSummon}
            isPlayer={isPlayer}
            showPlanned={!!intent}
            combatShake={combatShake}
            clickable={acceptingTaps}
            onClick={acceptingTaps && onLaneTap ? () => onLaneTap(lane) : undefined}
          />
        );
      })}
    </div>
  );
}


/** Reveal banner — names every spell + summon committed by one side during
 *  the resolver's reveal/spells window. Renders for both sides: rose tone
 *  for the opp, emerald tone for the player ("Tu joues"). */
function OppRevealBanner({ intent, side = "opp" }: { intent: TurnIntent; side?: "opp" | "you" }) {
  const t = useT();
  const labelColor = side === "you" ? "text-emerald-300" : "text-rose-300";
  const label = side === "you" ? "Tu joues" : "Adversaire joue";
  const summonTone = side === "you"
    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100"
    : "bg-rose-500/20 border-rose-400/50 text-rose-100";
  return (
    <motion.div
      initial={{ opacity: 0, y: side === "you" ? 8 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: side === "you" ? 4 : -4 }}
      className="flex flex-wrap items-center justify-center gap-1.5 px-2 -mt-1"
    >
      <span className={"text-[10px] uppercase tracking-[0.2em] font-black " + labelColor}>
        {label}
      </span>
      {intent.summons.map((s, i) => (
        <span
          key={`sm-${i}`}
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
