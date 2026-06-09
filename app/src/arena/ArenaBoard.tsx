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
import { BigCardReveal } from "../ranked/BigCardReveal";
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
  /** Taunt block flash — set when an undefended attack is DEFLECTED by a
   *  taunt creature on the defender's side. Pops a "🪨 ATTAQUE DÉTOURNÉE !"
   *  chip on the defender's row + glows the actual Pierre that ate the
   *  deflection (rockLane), so the player SEES which rock saved them. */
  tauntBlock?: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null;
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

export function ArenaBoard({ board, playerSide, intent, oppPreview, playerPreview, resolveStep, combatLane = null, heroHit = null, tauntBlock = null, targeting, onLaneTap }: ArenaBoardProps) {
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
    // Player stickers go top-left (out of the way of ATK badge bottom-left
    // — Alex's "le sticker cache l'ATK" feedback). Opp stickers stay top-
    // right; they share that corner with the passive badges but opp data
    // is less critical to read.
    const playerSpells = (playerPreview ?? intent).spells;
    for (const s of playerSpells) {
      if (s.kind !== "lane") continue;
      const tgt = LANE_SPELL_TARGET_SIDE[s.id] ?? "my-creature";
      const targetSide: Side = tgt === "opp-creature" ? oppSide : playerSide;
      if (targetSide === rowSide) out.push({ lane: s.lane, id: s.id, owner: "you", position: "tl" });
    }
    const cpuSpells = oppPreview?.spells ?? [];
    for (const s of cpuSpells) {
      if (s.kind !== "lane") continue;
      const tgt = LANE_SPELL_TARGET_SIDE[s.id] ?? "my-creature";
      const targetSide: Side = tgt === "opp-creature" ? playerSide : oppSide;
      // Opp stickers go bottom-right so they don't overlap the opp
      // creature's TOP-RIGHT passive badges (Alex flagged that the
      // mini-card hid the badge icons). HP badge bottom-right is slightly
      // covered but that's an acceptable tradeoff vs hiding passive info.
      if (targetSide === rowSide) out.push({ lane: s.lane, id: s.id, owner: "opp", position: "br" });
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
    <div
      className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden
                 border border-emerald-900/40
                 shadow-[inset_0_0_36px_rgba(0,0,0,0.55)]
                 [@media(max-height:560px)]:max-w-md"
    >
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

      {/* AUGUR FLASH — when EITHER side cast Augur this turn, a banner pops
       *  at the center during the spells phase so the player KNOWS the
       *  reveal just happened (then the chips on the hero strip show the
       *  actual cards). Alex flagged that Augur was invisible. */}
      <AnimatePresence>
        {(resolveStep === "spells" || resolveStep === "summons") &&
          ((oppPreview?.spells?.some((s) => s.id === "augur") ?? false) ||
            (playerPreview?.spells?.some((s) => s.id === "augur") ?? false)) && (
          <motion.div
            key="augur-flash"
            initial={{ opacity: 0, scale: 0.6, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className="absolute left-1/2 top-[44%] -translate-x-1/2 z-40 pointer-events-none"
          >
            <div
              className="relative flex items-center gap-2 px-4 py-2 rounded-2xl backdrop-blur-sm shadow-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(217,119,6,0.95) 0%, rgba(252,211,77,0.95) 50%, rgba(245,158,11,0.95) 100%)",
                border: "1px solid rgba(252,211,77,0.7)",
                boxShadow: "0 8px 32px -4px rgba(245,158,11,0.55), 0 0 24px rgba(252,211,77,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="text-2xl leading-none drop-shadow"
              >
                👁
              </motion.span>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[8.5px] uppercase tracking-[0.22em] font-black text-amber-50/95">
                  Augur
                </span>
                <span className="text-[12px] uppercase tracking-[0.14em] font-black text-white drop-shadow">
                  Main révélée
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAUNT BLOCK CHIP — modern cosmic chip, lateral position so two
       *  consecutive deflects on the same row don't overlap. Anchored to
       *  the Pierre that absorbed the attack (rockLane drives left/center/
       *  right). Lighter anim (3 sparks instead of 6) for smoother frame
       *  pacing on mobile. */}
      <AnimatePresence>
        {tauntBlock && (
          <motion.div
            key={tauntBlock.key}
            initial={{ opacity: 0, scale: 0.75, y: tauntBlock.defenderSide === playerSide ? 18 : -18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className={
              "absolute z-40 pointer-events-none " +
              (tauntBlock.defenderSide === playerSide ? "bottom-[42%] " : "top-[42%] ") +
              (tauntBlock.rockLane === 0 ? "left-[6%]" :
               tauntBlock.rockLane === 2 ? "right-[6%]" :
               "left-1/2 -translate-x-1/2")
            }
          >
            {/* Outer glow halo — single short pulse (lighter than before). */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: [0, 0.8, 0], scale: [0.85, 1.8, 2.4] }}
              transition={{ duration: 0.95, ease: "easeOut" }}
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "radial-gradient(circle, rgba(252,211,77,0.7) 0%, rgba(168,85,247,0.3) 40%, transparent 70%)",
                filter: "blur(8px)",
              }}
            />
            {/* Three sparkle motes — same radial pattern, fewer particles. */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos((i / 3) * Math.PI * 2) * 28,
                  y: Math.sin((i / 3) * Math.PI * 2) * 28,
                  scale: [0.5, 1.1, 0.4],
                }}
                transition={{ duration: 0.8, delay: 0.05 + i * 0.04, ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-amber-200"
                style={{ boxShadow: "0 0 6px rgba(252,211,77,0.9)", marginLeft: -3, marginTop: -3 }}
              />
            ))}
            <div
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-sm shadow-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.92) 0%, rgba(217,119,6,0.94) 70%, rgba(252,211,77,0.94) 100%)",
                border: "1px solid rgba(252,211,77,0.65)",
                boxShadow: "0 6px 24px -4px rgba(168,85,247,0.5), 0 0 18px rgba(252,211,77,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <span className="text-base leading-none drop-shadow">🪨</span>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[7.5px] uppercase tracking-[0.2em] font-black text-amber-50/95">
                  Pierre protège
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.12em] font-black text-white drop-shadow">
                  Attaque détournée
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BIG CARD REVEAL — center-stage card flips during reveal step,
       *  mirrors Ranked Pro. Opp card lands top-right, player card lands
       *  bottom-left. Shows during the reveal-opp step only (after that,
       *  the lane-corner CardSlot stickers take over for the rest of
       *  the resolver). */}
      <AnimatePresence>
        {resolveStep === "reveal-opp" && oppPreview && oppPreview.spells.length > 0 && (
          <BigCardReveal key={"opp-" + oppPreview.spells[0].id} id={oppPreview.spells[0].id} side="opp" />
        )}
        {resolveStep === "reveal-opp" && playerPreview && playerPreview.spells.length > 0 && (
          <BigCardReveal key={"you-" + playerPreview.spells[0].id} id={playerPreview.spells[0].id} side="you" />
        )}
      </AnimatePresence>

      {/* Opp HeroStrip — Alex feedback 2026-06-09 point #1 : sortie du wrapper
       *  board (était à l'intérieur, prenait de la place). Position en TOP
       *  HEADER, +/- même niveau que burger+back, hors pad. Compact padding
       *  pour tenir en 1-2 lignes. Lanes opp gagnent l'espace ainsi libéré. */}
      <div className="px-3 pt-1 pb-0.5 sm:pt-2 sm:pb-1 [@media(max-height:560px)]:pt-0.5 [@media(max-height:560px)]:pb-0">
        <ArenaHeroStrip
          hero={opp} board={board} side="opp" turn={board.turn} name="CPU" avatar={undefined}
          incomingAttackKey={heroHit?.side === "opp" ? heroHit.key : null}
          augurRevealed={playerSide === "a" ? board.augurRevealedB : board.augurRevealedA}
        />
      </div>

      <div className="relative px-3 pb-3 sm:px-4 sm:pb-4 flex flex-col gap-3 sm:gap-4 [@media(max-height:560px)]:px-1.5 [@media(max-height:560px)]:pb-1.5 [@media(max-height:560px)]:gap-1.5">
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
          deflectingRockLane={tauntBlock?.defenderSide === oppSide ? tauntBlock.rockLane : null}
          deflectKey={tauntBlock?.defenderSide === oppSide ? tauntBlock.key : null}
          summoningMove={targeting?.kind === "summon"}
        />

        {/* CENTER STATUS ZONE — single bar that owns the phase chip + the
         *  current event ("Adversaire dévoile" / "Sorts" / "Combat Lane N").
         *  Replaces the previous 3-stack (phase banner + 2 reveal banners)
         *  so the eye has ONE thing to read at the center.
         *
         *  Alex feedback 2026-06-09 point #2 : pad trop serré, agrandir le
         *  board. Réduit le my-* du wrapper (was my-2 sm:my-3) pour rendre
         *  le pad plus dense et combler l'espace vide vers la main strip. */}
        <div className="my-0.5 sm:my-1 [@media(max-height:560px)]:my-0">
          <CenterStatus
            step={resolveStep ?? null}
            turn={board.turn}
            oppPreview={oppPreview}
            playerPreview={playerPreview}
          />
        </div>

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
          deflectingRockLane={tauntBlock?.defenderSide === playerSide ? tauntBlock.rockLane : null}
          deflectKey={tauntBlock?.defenderSide === playerSide ? tauntBlock.key : null}
          summoningMove={targeting?.kind === "summon"}
        />

        {/* Player strip — HP bar flashes when an attack lands on player hero.
         *  Augur cast on me = opp's augurRevealed on my side. */}
        <ArenaHeroStrip
          hero={me} board={board} side="you" turn={board.turn} name={playerName} avatar={playerAvatar}
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
  step, turn, oppPreview, playerPreview,
}: {
  step: ArenaBoardProps["resolveStep"];
  turn: number;
  oppPreview: TurnIntent | null | undefined;
  playerPreview: TurnIntent | null | undefined;
}) {
  // Combat label no longer says "Lane N" — the per-lane halo + charge anim
  // already tells the eye which lane is live. Less text-clutter at center.
  const label =
    step === "reveal-opp" ? "Adversaire dévoile son tour" :
    step === "spells"  ? "✨ Sorts en cours" :
    step === "summons" ? "🌟 Invocations" :
    step === "combat"  ? "⚔️ Combat" :
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
  stickers = [], summoningMove = false,
  deflectingRockLane = null,
  deflectKey = null,
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
  /** Lane of the Pierre that just absorbed a deflection on THIS row, if
   *  any. The targeted slot pulses extra-bright for ~1.4s. */
  deflectingRockLane?: LaneIndex | null;
  /** Key that changes each deflection — drives the re-mount of the pulse
   *  anim so consecutive deflects on the same rock re-fire. */
  deflectKey?: number | null;
  /** True when the active targeting is a summon (i.e. RPSLS picker active).
   *  Drives the "↻ Remplacer" label override on occupied lanes. */
  summoningMove?: boolean;
}) {
  // Pierre's Provocation (taunt) is suppressed while opp has ANY of the
  // two RPSLS counters of Rock alive — Paper (Étouffe) OR Spock (Logique
  // anti-taunt). Pre-compute once per row so each slot renders the right
  // visual state (no halo + no badge when suppressed).
  const oppSideKey: Side = renderSide === "a" ? "b" : "a";
  const oppHasStifle = lanes.some((l) => {
    const c = l[oppSideKey];
    return !!c && (c.move === "paper" || c.move === "spock");
  });
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[0, 1, 2].map((i) => {
        const lane = i as LaneIndex;
        const c = lanes[lane][renderSide];
        const plannedSummon = intent?.summons.find((s) => s.lane === lane) ?? null;
        const inCombat = combatLane === lane;
        const valid = validLanes[i] ?? false;
        const laneStickers = stickers.filter((s) => s.lane === lane);
        // Only Pierre cares about suppression today (Étouffe). Other innate
        // passives (Tranchant, Esquive, Logique, Étouffe itself) have no
        // counter-effect — they always render their badge.
        const suppressed = !!c && c.taunt && oppHasStifle;
        return (
          <div
            key={i}
            className="relative"
            data-arena-lane={lane}
            data-arena-side={renderSide}
          >
            {/* COMBAT HALO — golden pulsing ring around the lane slot during
             *  its combat tick. Plays in sync with the per-creature charge
             *  anim so the eye instantly locks on which lane is alive. */}
            <AnimatePresence>
              {inCombat && (
                <motion.div
                  key={"halo-" + i}
                  aria-hidden
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{
                    opacity: [0, 0.85, 0.6, 0.85, 0],
                    boxShadow: [
                      "0 0 0 0 rgba(252,211,77,0)",
                      "0 0 22px 5px rgba(252,211,77,0.7), inset 0 0 0 2px rgba(252,211,77,0.55)",
                      "0 0 16px 4px rgba(252,211,77,0.5), inset 0 0 0 2px rgba(252,211,77,0.4)",
                      "0 0 28px 8px rgba(252,211,77,0.85), inset 0 0 0 3px rgba(252,211,77,0.7)",
                      "0 0 0 0 rgba(252,211,77,0)",
                    ],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                  className="absolute -inset-1 rounded-xl pointer-events-none z-[3]"
                />
              )}
            </AnimatePresence>
            <ArenaLaneSlot
              lane={lane}
              creature={c}
              plannedSummon={plannedSummon}
              isPlayer={isPlayer}
              showPlanned={!!intent}
              chargeAttack={inCombat}
              clickable={valid}
              clickableLabel={
                // "↻ Remplacer" si on est en mode summon ET le slot a déjà
                // une de mes créatures (replace au lieu d'invoquer ici).
                (summoningMove && !!c && isPlayer) ? "↻ Remplacer" : targetLabel
              }
              onClick={valid && onLaneTap ? () => onLaneTap(lane) : undefined}
              passiveSuppressed={suppressed}
              deflectingPulse={deflectingRockLane === lane ? deflectKey ?? 0 : null}
            />
            {/* Card stickers — small CardSlot badges showing which spells
             *  hit this lane this turn (mirrors Ranked LanesBoard pattern).
             *  Owner "you" gets a swoop-from-hand entry anim so the player
             *  sees the cast land on the lane in real time. */}
            {laneStickers.map((s, idx) => (
              <CardSlot
                key={`${s.id}-${idx}`}
                id={s.id}
                position={s.position}
                flyFromHand={s.owner === "you"}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
