/**
 * ArenaPlanPhase — planning UI for Constellation Pro.
 *
 * Three zones, top → bottom:
 *   1. Mana / queue bar — live count of "spent" vs available mana and the
 *      list of queued spells (tap a queued chip to remove it).
 *   2. Move picker — 5 RPSLS buttons. Tapping one enters a "summon
 *      targeting" mode where the next lane tap commits the summon.
 *   3. Hand fanout — player's spell cards. Tapping a card enters a "spell
 *      targeting" mode (lane / hero / self / global depending on the card).
 *   4. Lock button — disabled until the intent fits inside the mana pool.
 *
 * Targeting overlay is rendered ON TOP of the board (via portal-ish absolute
 * positioning) — the player taps a lane or a hero portrait directly.
 *
 * MVP: simple-but-readable. Phase 2 polishes the animations.
 */

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MOVES } from "../engine/game";
import type { Move } from "../engine/game";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { hapticAlert, hapticTap } from "../haptic";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import { useT } from "../i18n";
import type { CardId } from "../ranked/rankedTypes";
import { arenaSupported } from "./arenaCardEffects";
import { ArenaCardInspect } from "./ArenaCardInspect";
import { CARD_TARGET_KIND as SHARED_TARGET_KIND, LANE_SPELL_TARGET_SIDE, type ArenaTargeting } from "./arenaTypes";
import type {
  BoardState,
  LaneIndex,
  PlayedSpell,
  PlannedSummon,
  TurnIntent,
} from "./arenaTypes";

/** Spell target shape needed by a given card — drives the targeting UI. */
// SpellTargetKind is exported from arenaTypes (used elsewhere).

// CARD_TARGET_KIND lives in arenaTypes.ts now (re-exported as SHARED_TARGET_KIND
// in the import header) so the lifted targeting state in ArenaGame can read
// the same table without circular imports.
const CARD_TARGET_KIND = SHARED_TARGET_KIND;

export interface ArenaPlanPhaseProps {
  board: BoardState;
  intent: TurnIntent;
  intentCost: number;
  disabled: boolean;
  /** Active targeting (lifted to ArenaGame so the board can also commit
   *  lane taps). null = idle. */
  targeting: ArenaTargeting;
  /** Setter for the lifted targeting state. */
  onSetTargeting: (t: ArenaTargeting) => void;
  onAddSpell: (spell: PlayedSpell) => void;
  onRemoveSpell: (idx: number) => void;
  onAddSummon: (summon: PlannedSummon) => void;
  onRemoveSummon: (lane: LaneIndex) => void;
  onLock: () => void;
}

export function ArenaPlanPhase({
  board, intent, intentCost, disabled,
  targeting, onSetTargeting,
  onAddSpell, onRemoveSpell, onAddSummon, onRemoveSummon, onLock,
}: ArenaPlanPhaseProps) {
  const t = useT();
  const me = board.a;
  const manaLeft = me.mana - intentCost;
  const canLock = !disabled && intentCost <= me.mana;
  // `targeting` + `onSetTargeting` are LIFTED to ArenaGame (so the board
  // can also commit lane taps). The local setTargeting alias below keeps
  // the rest of this file readable.
  const setTargeting = onSetTargeting;

  /** Inspect mode — first tap on a hand card surfaces a full-screen modal
   *  description. Independent of `targeting` so the player can read a
   *  card without committing to play it. */
  const [inspecting, setInspecting] = useState<CardId | null>(null);

  function pickMoveToSummon(mv: Move) {
    if (disabled) return;
    if (manaLeft < 1) { hapticAlert(); return; }
    hapticTap();
    setInspecting(null); // close any open spell inspect when going to summon
    setTargeting({ kind: "summon", move: mv });
  }

  /** Commit a card — fire if no target needed, else enter targeting. */
  function commitCard(id: CardId) {
    if (disabled) return;
    const card = CARDS[id];
    if (!arenaSupported(id)) { hapticAlert(); return; }
    if (manaLeft < card.cost) { hapticAlert(); return; }
    hapticTap();
    setInspecting(null);
    const targetKind = CARD_TARGET_KIND[id] ?? "global";
    if (targetKind === "self" || targetKind === "global" || targetKind === "hero") {
      onAddSpell({ id, kind: targetKind } as PlayedSpell);
      return;
    }
    setTargeting({ kind: "spell", id, targetKind });
  }

  /** Drop-zone hit-test — finds the ArenaLaneSlot under a screen point and
   *  commits the active targeting to that slot if valid. Used by both the
   *  RPSLS picker drag and the hand-card drag handlers. Returns true if
   *  something was committed (the drag is "consumed"), false otherwise so
   *  the caller can leave targeting active for a regular tap-fallback. */
  function commitDragDrop(point: { x: number; y: number }, current: ArenaTargeting): boolean {
    if (!current) return false;
    if (typeof document === "undefined") return false;
    const els = document.elementsFromPoint(point.x, point.y);
    for (const el of els) {
      const slot = (el as HTMLElement).closest?.("[data-arena-lane]");
      if (!slot) continue;
      const laneStr = (slot as HTMLElement).dataset?.arenaLane;
      const sideStr = (slot as HTMLElement).dataset?.arenaSide;
      if (laneStr == null || sideStr == null) continue;
      const lane = parseInt(laneStr, 10) as LaneIndex;
      const side = sideStr as "a" | "b";
      // Summon: only on MY (a) empty lanes.
      if (current.kind === "summon") {
        if (side !== "a") return false;
        const mine = board.lanes[lane].a;
        if (mine) return false;
        hapticTap();
        onAddSummon({ lane, move: current.move });
        setTargeting(null);
        return true;
      }
      // Spell lane-target: respect LANE_SPELL_TARGET_SIDE.
      if (current.kind === "spell" && current.targetKind === "lane") {
        const want = LANE_SPELL_TARGET_SIDE[current.id] ?? "my-creature";
        const mine = board.lanes[lane].a;
        const opp = board.lanes[lane].b;
        const ok =
          (want === "my-creature" && side === "a" && !!mine) ||
          (want === "opp-creature" && side === "b" && !!opp) ||
          (want === "my-empty-opp-occupied" && side === "a" && !mine && !!opp) ||
          (want === "my-empty" && side === "a" && !mine);
        if (!ok) return false;
        hapticTap();
        onAddSpell({ id: current.id, kind: "lane", lane });
        setTargeting(null);
        return true;
      }
    }
    return false;
  }

  /** Long-press detection — single tap = commit, hold ~750ms = open the
   *  inspect modal. Reduced again (1050 → 750ms) per Alex's "encore réduire
   *  le temps". Still ENOUGH delay to filter out accidental holds but
   *  noticeably snappier mid-turn. */
  const pressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const LONG_PRESS_MS = 750;
  function startPress(id: CardId) {
    longPressedRef.current = false;
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      hapticTap();
      setInspecting(id);
    }, LONG_PRESS_MS);
  }
  function endPress(id: CardId, fire: boolean) {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (fire && !longPressedRef.current) {
      commitCard(id);
    }
  }

  // pickLaneTarget lives in ArenaGame now (handleBoardLaneTap) — lifted
  // along with the targeting state so the BOARD's lane slots can commit
  // the target directly. This file no longer needs a local helper.

  function cancelTargeting() {
    hapticTap();
    setTargeting(null);
    setInspecting(null);
  }

  return (
    <div className="flex flex-col gap-1 px-2 pb-1.5 shrink-0">
      {/* Targeting hint — instructs the player to tap a lane ON THE BOARD
       *  itself now (CCG-style direct target). The board's player
       *  row pulses while targeting is active; this strip just reminds. */}
      <div className="h-6 flex items-center justify-center">
        <AnimatePresence>
          {targeting && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] uppercase tracking-[0.15em] text-amber-300 font-bold flex items-center gap-2"
            >
              {targeting.kind === "summon" && <>↑ Touche une LANE VIDE de ton côté pour invoquer {targeting.move.toUpperCase()}</>}
              {targeting.kind === "spell" && targeting.targetKind === "lane" && (() => {
                const side = LANE_SPELL_TARGET_SIDE[targeting.id] ?? "my-creature";
                if (side === "my-creature") return <>↑ Touche TA CRÉATURE à cibler</>;
                if (side === "opp-creature") return <>↑ Touche la CRÉATURE ADVERSE à cibler</>;
                if (side === "my-empty-opp-occupied") return <>↑ Touche UNE LANE VIDE face à un adversaire</>;
                return <>↑ Touche une lane de ton côté</>;
              })()}
              <button
                onClick={cancelTargeting}
                className="px-2 py-0.5 rounded-full bg-hairline text-[10px] font-bold"
              >Annuler</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Queued summons + spells chips — FIXED HEIGHT to keep the board's
       *  ScaleToFit measurement stable across the turn. Without this, every
       *  added/removed chip changes the plan-phase height, which makes
       *  ScaleToFit re-shrink the board → Alex's "le pad change de
       *  dimensions". Chips themselves are bigger + show an explicit
       *  "Annuler ✕" label so the player understands they're tappable. */}
      <div className="h-7 flex flex-wrap items-center justify-center gap-1.5 max-w-md mx-auto w-full">
        {intent.summons.map((s) => (
          <button
            key={`sum-${s.lane}`}
            onClick={() => onRemoveSummon(s.lane)}
            className="text-[11px] font-bold rounded-full pl-2 pr-1.5 py-0.5 bg-emerald-500/30 border border-emerald-400/65 text-emerald-50 inline-flex items-center gap-1.5 shadow shadow-emerald-500/20 active:scale-95"
          >
            <MoveGlyph move={s.move} className="w-3.5 h-3.5" />
            <span>L{s.lane + 1}</span>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/85 text-white text-[10px] leading-none">✕</span>
          </button>
        ))}
        {intent.spells.map((s, idx) => (
          <button
            key={`sp-${idx}`}
            onClick={() => onRemoveSpell(idx)}
            className="text-[11px] font-bold rounded-full pl-2 pr-1.5 py-0.5 bg-violet-500/30 border border-violet-400/65 text-violet-50 inline-flex items-center gap-1.5 shadow shadow-violet-500/20 active:scale-95"
          >
            <span className="text-[13px] leading-none">{CARDS[s.id].glyph}</span>
            <span>{CARDS[s.id].cost}m</span>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/85 text-white text-[10px] leading-none">✕</span>
          </button>
        ))}
      </div>

      {/* Card inspect — now a FULLSCREEN MODAL (z-50 overlay) rather than
       *  an inline panel, so opening it doesn't touch the plan-phase
       *  height. Zero reflow on the board, fixes Alex's "Arena se resize
       *  quand je choisis une carte" complaint. */}
      <AnimatePresence>
        {inspecting && (
          <ArenaCardInspect
            id={inspecting}
            targetKind={CARD_TARGET_KIND[inspecting] ?? "global"}
            t={t}
            onCommit={() => commitCard(inspecting)}
            onClose={() => setInspecting(null)}
          />
        )}
      </AnimatePresence>

      {/* Mana summary */}
      <div className="text-center text-[10px] text-ink-muted font-bold tabular-nums">
        Mana planifié : <span className={intentCost > me.mana ? "text-rose-300" : "text-sky-300"}>
          {intentCost}/{me.mana}
        </span>
        {intentCost === 0 && !inspecting && <span className="text-ink-faint"> · tape une carte / un coup · hold 1.5s pour lire</span>}
        {inspecting && <span className="text-amber-300"> · lis puis tape ✓ JOUER pour confirmer</span>}
      </div>

      {/* RPSLS move picker — compact strip. Tap to enter targeting mode
       *  THEN tap a lane on the board, OR drag the symbol directly onto a
       *  lane for one-gesture commit. Drag uses framer-motion with
       *  dragSnapToOrigin so the button returns to its place after drop. */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 max-w-md mx-auto w-full">
        {MOVES.map((mv) => {
          const pal = MOVE_PALETTE[mv];
          const cannotAfford = manaLeft < 1;
          const isTargeting = targeting?.kind === "summon" && targeting.move === mv;
          const rim = moveRim(pal.hex);
          const glow = moveGlow(pal.hex);
          const canDrag = !cannotAfford && !disabled;
          return (
            <motion.button
              key={mv}
              type="button"
              drag={canDrag}
              dragSnapToOrigin
              dragMomentum={false}
              dragElastic={0.18}
              dragTransition={{ bounceStiffness: 720, bounceDamping: 28, power: 0.35 }}
              whileDrag={{ scale: 1.12, zIndex: 60, transition: { type: "spring", stiffness: 520, damping: 32 } }}
              onTap={() => pickMoveToSummon(mv)}
              onDragStart={() => {
                if (!canDrag) return;
                hapticTap();
                setInspecting(null);
                setTargeting({ kind: "summon", move: mv });
              }}
              onDragEnd={(_e, info) => {
                if (!canDrag) return;
                commitDragDrop(info.point, { kind: "summon", move: mv });
              }}
              disabled={cannotAfford || disabled}
              className={
                "relative h-12 sm:h-14 rounded-lg flex items-center justify-center active:scale-92 select-none overflow-hidden " +
                (cannotAfford ? "opacity-30 grayscale " : "") +
                (isTargeting ? "scale-105 " : "")
              }
              style={{
                touchAction: "none",
                background: `linear-gradient(160deg, color-mix(in oklab, ${pal.hex} 24%, rgba(20,22,32,0.95)) 0%, color-mix(in oklab, ${pal.hex} 8%, rgba(10,12,20,0.95)) 100%)`,
                border: `2px solid ${isTargeting ? "rgba(252, 211, 77, 0.95)" : rim}`,
                boxShadow: isTargeting
                  ? `0 0 18px -2px rgba(252, 211, 77, 0.85), inset 0 0 14px ${glow}, inset 0 1px 0 rgba(255,255,255,0.12)`
                  : `0 0 14px -3px ${glow}, inset 0 0 10px color-mix(in oklab, ${pal.hex} 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.14)`,
              }}
            >
              {/* Subtle pulse ring — slow breathe in idle, hidden when targeting (overlap with the strong amber ring). */}
              {!isTargeting && !cannotAfford && (
                <motion.span
                  aria-hidden
                  animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-[2px] rounded-md pointer-events-none"
                  style={{ boxShadow: `inset 0 0 8px ${glow}` }}
                />
              )}
              <MoveGlyph move={mv} className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ background: pal.hex, boxShadow: `0 0 5px ${pal.hex}` }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Hand strip — tap = commit/target, hold 1.4s = inspect modal, DRAG =
       *  one-gesture commit to a lane (only meaningful for lane-targeted
       *  spells; non-lane cards just snap back). dragSnapToOrigin returns
       *  the card to its slot after release. */}
      {/* Hand strip — FIXED HEIGHT container so the pad doesn't reflow when
       *  cards leave/enter the hand (Alex flag #3 : l'interface ne doit PAS
       *  bouger). Empty-hand fallback shows a "porte-cartes" placeholder
       *  inside the same h-[82px] box. */}
      <div className="h-[82px] flex items-end justify-center">
      {me.hand.length > 0 ? (
        <div className="flex items-end justify-center gap-1 px-1 overflow-x-auto w-full">
          {me.hand.map((id, i) => {
            const card = CARDS[id];
            const supported = arenaSupported(id);
            const cannotAfford = manaLeft < card.cost;
            const isTargeting = targeting?.kind === "spell" && targeting.id === id;
            const isInspecting = inspecting === id;
            const targetKind = CARD_TARGET_KIND[id] ?? "global";
            const canDragCard = supported && !cannotAfford && !disabled && targetKind === "lane";
            return (
              <div key={`${id}-${i}`} className="flex flex-col items-center gap-0.5 shrink-0">
              <motion.div
                drag={canDragCard}
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0.18}
                dragTransition={{ bounceStiffness: 720, bounceDamping: 28, power: 0.35 }}
                whileDrag={{ scale: 1.12, zIndex: 60, transition: { type: "spring", stiffness: 520, damping: 32 } }}
                onDragStart={() => {
                  // Cancel any in-flight long-press timer — the user is
                  // dragging, not holding to inspect.
                  if (pressTimerRef.current) {
                    window.clearTimeout(pressTimerRef.current);
                    pressTimerRef.current = null;
                  }
                  longPressedRef.current = true; // suppress release-commit
                  if (!canDragCard) return;
                  hapticTap();
                  setInspecting(null);
                  setTargeting({ kind: "spell", id, targetKind: "lane" });
                }}
                onDragEnd={(_e, info) => {
                  if (!canDragCard) return;
                  commitDragDrop(info.point, { kind: "spell", id, targetKind: "lane" });
                }}
                style={{ touchAction: "none" }}
              >
              <button
                onPointerDown={() => startPress(id)}
                onPointerUp={() => endPress(id, true)}
                onPointerLeave={() => endPress(id, false)}
                onPointerCancel={() => endPress(id, false)}
                disabled={!supported || cannotAfford || disabled}
                className={
                  "relative w-[44px] h-[60px] sm:w-[48px] sm:h-[66px] rounded-lg overflow-hidden bg-surface-raised transition " +
                  "ring-2 " + (
                    isTargeting ? "ring-amber-300 scale-110"
                    : isInspecting ? "ring-sky-300 scale-110"
                    : "ring-white/20"
                  ) +
                  (!supported ? " grayscale opacity-30" : cannotAfford ? " opacity-40" : "")
                }
                title={supported ? undefined : "Carte pas encore disponible en Arena"}
              >
                <CardImage id={id} glyphSize="text-xl" />
                <div className="absolute top-0.5 left-0.5 z-10 inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-full bg-black/65 backdrop-blur-sm">
                  {Array.from({ length: card.cost }, (_, k) => (
                    <span key={k} className="w-1 h-1 rounded-full bg-sky-300" />
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5">
                  <div className="text-[6px] sm:text-[7px] font-bold uppercase text-center text-white/90 truncate px-0.5">
                    {/* Resolve via i18n on caller's side — we just show the id-derived label */}
                    {card.glyph}
                  </div>
                </div>
                {!supported && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[7px] uppercase tracking-wider text-ink-muted font-bold text-center px-1 leading-tight">
                      Bientôt
                    </span>
                  </div>
                )}
              </button>
              </motion.div>
              {/* Name label beneath the card — truncated to the card width
               *  so the player can scan their hand without tapping each. */}
              <span
                className={
                  "text-[8px] sm:text-[9px] font-bold uppercase tracking-wider truncate max-w-[48px] leading-none " +
                  (cannotAfford || !supported ? "text-ink-faint" : "text-ink")
                }
                title={t(card.nameKey)}
              >
                {t(card.nameKey)}
              </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 opacity-65">
          <div className="w-[44px] h-[60px] sm:w-[48px] sm:h-[66px] rounded-lg border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center text-2xl">
            🎴
          </div>
          <span className="text-[10px] text-ink-faint italic">
            Main vide — fin de tour pour piocher
          </span>
        </div>
      )}
      </div>

      {/* Lock button — HTML button (stable on device, matches Ranked pattern).
       *  Wrapped in a relative div with an ABSOLUTE blurred glow underneath
       *  that pulses when canLock to indicate "tape ici" (Alex feedback #1).
       *  The button itself stays rigid + cliquable — only the glow animates. */}
      <div className="relative shrink-0 self-center mt-2">
        {canLock && (
          <motion.div
            aria-hidden
            animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.96, 1.06, 0.96] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
              filter: "blur(14px)",
            }}
          />
        )}
        <button
          type="button"
          onClick={() => {
            if (targeting) setTargeting(null);
            if (canLock) {
              hapticTap();
              onLock();
            }
          }}
          disabled={!canLock}
          className={
            "relative px-7 py-2.5 rounded-2xl font-black text-white text-sm transition active:scale-[0.97] " +
            (canLock
              ? "shadow-lg ring-2 ring-amber-300/40"
              : "bg-hairline text-ink-faint cursor-not-allowed")
          }
          style={canLock ? {
            background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.1em",
            touchAction: "manipulation",
          } : { touchAction: "manipulation" }}
        >
          ✓ FIN DE TOUR
        </button>
      </div>
    </div>
  );
}

