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
import { MoveGlyph } from "../icons";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";
import { useArenaPad } from "../ranked/arena";
import { CARDS } from "../ranked/cards";
import { useT } from "../i18n";
import { ArenaLaneSlot } from "./ArenaLaneSlot";
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
}

export function ArenaBoard({ board, playerSide, intent, oppPreview, playerPreview, resolveStep }: ArenaBoardProps) {
  // Combat shake fires when the resolver lands on the "combat" step. The
  // creatures shake toward their opposing side for ~400ms BEFORE the death
  // animations + dmg popups land, so the player feels the impact happen.
  const combatShake = resolveStep === "combat";
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
        <HeroPortrait avatar={avatar} ringColor={ringColor} divineShield={hero.divineShield} damaged={!!dmgPop} />
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
        {/* HP bar — taller, segmented every 5 HP, glow on the filled portion,
         *  pulse at low HP. The numeric readout sits ON the left so it's the
         *  first thing the eye lands on. */}
        <div className="flex items-center gap-1.5">
          <motion.span
            key={hero.hp}
            initial={{ scale: 1.35, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#ffffff" }}
            transition={{ duration: 0.3 }}
            className="text-[13px] font-black tabular-nums w-12 text-right"
          >
            ❤ {hero.hp}/{hero.maxHp}
          </motion.span>
          <div
            className={
              "relative flex-1 h-3 rounded-full bg-zinc-900/80 overflow-hidden ring-1 ring-black/50 " +
              (lowHp ? "animate-pulse" : "")
            }
          >
            <motion.div
              className={
                "h-full transition-colors " +
                (hpPct > 50 ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[inset_0_0_8px_rgba(110,231,183,0.6)]" :
                 hpPct > 25 ? "bg-gradient-to-r from-amber-500 to-amber-300 shadow-[inset_0_0_8px_rgba(252,211,77,0.6)]" :
                 "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[inset_0_0_8px_rgba(251,113,133,0.6)]")
              }
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.45 }}
            />
            {/* Per-5-HP tick marks so 12/20 reads as "more than half" at a
             *  glance instead of math. Drawn over the bar with low opacity. */}
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: Math.max(1, Math.floor(hero.maxHp / 5)) - 1 }, (_, i) => (
                <div
                  key={i}
                  className="border-r border-black/40"
                  style={{ width: `${100 / Math.max(1, Math.floor(hero.maxHp / 5))}%` }}
                />
              ))}
            </div>
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
 *  back to a generic CPU mask glyph when no avatar is provided.
 *  `damaged` flips on for ~600ms when the hero just took damage — the ring
 *  pulses red so the player FEELS the hit beyond the floating −N number. */
function HeroPortrait({ avatar, ringColor, divineShield, damaged }: {
  avatar?: string;
  ringColor: string;
  divineShield: boolean;
  damaged?: boolean;
}) {
  const isImage = avatar && (avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:"));
  return (
    <motion.div
      animate={damaged ? { scale: [1, 1.08, 0.96, 1], x: [0, -2, 2, -1, 1, 0] } : { scale: 1, x: 0 }}
      transition={damaged ? { duration: 0.5 } : { duration: 0.2 }}
      className={
        "relative w-10 h-10 rounded-full overflow-hidden ring-2 " +
        (damaged ? "ring-rose-400 shadow-[0_0_18px_-1px_rgba(244,63,94,0.95)]" : ringColor) +
        " bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center " +
        (divineShield && !damaged ? "shadow-[0_0_12px_-1px_rgba(252,211,77,0.85)]" : "")
      }
    >
      {isImage ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : avatar ? (
        <span className="text-xl">{avatar}</span>
      ) : (
        <span className="text-xl">🤖</span>
      )}
      {damaged && (
        <span className="absolute inset-0 bg-rose-500/35 pointer-events-none" aria-hidden />
      )}
      {divineShield && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px]" title="Bouclier divin">🛡️</span>
      )}
    </motion.div>
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
}: {
  lanes: BoardState["lanes"];
  renderSide: Side;
  intent: TurnIntent | null;
  isPlayer: boolean;
  combatShake?: boolean;
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
