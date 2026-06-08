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

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  /** Current step in the sequenced resolver — drives the phase banner so
   *  the player always knows what's about to happen / just happened. */
  resolveStep?: "reveal-opp" | "spells" | "summons" | "combat" | "settle" | null;
}

export function ArenaBoard({ board, playerSide, intent, oppPreview, resolveStep }: ArenaBoardProps) {
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
        <HeroStrip hero={opp} side="opp" turn={board.turn} name="CPU" avatar={undefined} />

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
        <HeroStrip hero={me} side="you" turn={board.turn} name={playerName} avatar={playerAvatar} />
      </div>
    </div>
  );
}

/* ───────────────────────── Hero strip ───────────────────────── */

function HeroStrip({
  hero, side, turn, name, avatar,
}: {
  hero: BoardState["a"];
  side: "you" | "opp";
  turn: number;
  /** Display name shown next to the portrait — player nickname for "you",
   *  "CPU" or persona name for "opp". */
  name: string;
  /** Avatar — emoji char, preset path, or undefined for the default mask. */
  avatar?: string;
}) {
  const accent = side === "you" ? "text-emerald-300" : "text-rose-300";
  const ringColor = side === "you" ? "ring-emerald-400/70" : "ring-rose-400/70";
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const lowHp = hero.hp <= 5;
  // Track previous HP so we can spawn a floating damage popup over the
  // portrait when the hero just took damage.
  const prevHpRef = useRef(hero.hp);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (hero.hp < prev) {
      setDmgPop({ n: prev - hero.hp, key: Date.now() });
      const id = window.setTimeout(() => setDmgPop(null), 1100);
      prevHpRef.current = hero.hp;
      return () => window.clearTimeout(id);
    }
    prevHpRef.current = hero.hp;
  }, [hero.hp]);
  return (
    <div className="flex items-center gap-2 px-1">
      {/* Portrait — avatar + name in a small circle so each side has a face.
       *  Floating damage popup pops out of the portrait on HP loss. */}
      <div className="flex flex-col items-center shrink-0 w-12 relative">
        <HeroPortrait avatar={avatar} ringColor={ringColor} divineShield={hero.divineShield} />
        <span className={"text-[8px] uppercase tracking-wider font-black truncate max-w-[56px] " + accent}>
          {name}
        </span>
        <AnimatePresence>
          {dmgPop && (
            <motion.div
              key={dmgPop.key}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -32, scale: 1.2 }}
              exit={{ opacity: 0, y: -48 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
              style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
            >
              −{dmgPop.n}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* HP + mana stacked vertically — the player reads them in one column. */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* HP bar with numbers ON the bar for prominence. */}
        <div className="flex items-center gap-1">
          <motion.span
            key={hero.hp}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className={
              "text-[12px] font-black tabular-nums w-12 text-right " +
              (lowHp ? "text-rose-300" : "text-white")
            }
          >
            ❤ {hero.hp}/{hero.maxHp}
          </motion.span>
          <div className="flex-1 h-2.5 rounded-full bg-hairline overflow-hidden ring-1 ring-black/40">
            <motion.div
              className={"h-full " + (hpPct > 50 ? "bg-emerald-400" : hpPct > 25 ? "bg-amber-400" : "bg-rose-500")}
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
        {/* Mana + hand size + turn — compact secondary row. */}
        <div className="flex items-center gap-1 text-[9px]">
          <span className="font-bold text-sky-300 tabular-nums w-12 text-right">⋙ {hero.mana}/{hero.maxMana}</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: hero.maxMana }, (_, i) => (
              <span
                key={i}
                className={
                  "w-1.5 h-1.5 rounded-full ring-1 ring-black/40 " +
                  (i < hero.mana ? "bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" : "bg-zinc-700")
                }
              />
            ))}
          </div>
          <span className="ml-auto font-bold text-ink-muted">🂠 {hero.hand.length}</span>
          {side === "you" && <span className="font-bold text-themed">T{turn}</span>}
        </div>
      </div>
    </div>
  );
}

/** Hero portrait — a small circular badge with the avatar inside. Falls
 *  back to a generic CPU mask glyph when no avatar is provided. */
function HeroPortrait({ avatar, ringColor, divineShield }: {
  avatar?: string;
  ringColor: string;
  divineShield: boolean;
}) {
  const isImage = avatar && (avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:"));
  return (
    <div
      className={
        "relative w-10 h-10 rounded-full overflow-hidden ring-2 " + ringColor +
        " bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center " +
        (divineShield ? "shadow-[0_0_12px_-1px_rgba(252,211,77,0.85)]" : "")
      }
    >
      {isImage ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : avatar ? (
        <span className="text-xl">{avatar}</span>
      ) : (
        <span className="text-xl">🤖</span>
      )}
      {divineShield && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px]" title="Bouclier divin">🛡️</span>
      )}
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
    "Tour " + turn + " · Planifie ton coup";
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
  // Track previous HP so we can spawn a "-N" floating popup when this lane's
  // creature takes damage. We guard by move identity to avoid false-positives
  // when one creature dies and another spawns on the same lane.
  const prevRef = useRef<{ hp: number; move: Creature["move"] | null } | null>(null);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (creature && prev && prev.move === creature.move && creature.hp < prev.hp) {
      const dmg = prev.hp - creature.hp;
      setDmgPop({ n: dmg, key: Date.now() });
      const id = window.setTimeout(() => setDmgPop(null), 1000);
      prevRef.current = { hp: creature.hp, move: creature.move };
      return () => window.clearTimeout(id);
    }
    prevRef.current = creature ? { hp: creature.hp, move: creature.move } : null;
  }, [creature]);
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
        {/* Floating damage popup — pops up and fades when this creature's
         *  HP just dropped. Big rose text, hard shadow, drift up. */}
        <AnimatePresence>
          {dmgPop && (
            <motion.div
              key={dmgPop.key}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -28, scale: 1.15 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
              style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
            >
              −{dmgPop.n}
            </motion.div>
          )}
        </AnimatePresence>
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
