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

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MOVES } from "../engine/game";
import type { Move } from "../engine/game";
import { MoveGlyph, MOVE_PALETTE } from "../icons";
import { hapticAlert, hapticTap } from "../haptic";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import type { CardId } from "../ranked/rankedTypes";
import { arenaSupported } from "./arenaCardEffects";
import type {
  BoardState,
  LaneIndex,
  PlayedSpell,
  PlannedSummon,
  TurnIntent,
} from "./arenaTypes";

/** Spell target shape needed by a given card — drives the targeting UI. */
type SpellTargetKind = "lane" | "self" | "hero" | "global";

const CARD_TARGET_KIND: Partial<Record<CardId, SpellTargetKind>> = {
  aegis:        "lane",     // (could also be self — picker offers both)
  precision:    "lane",
  anchor:       "lane",
  "second-wind": "self",
  prescience:   "self",
  surge:        "lane",
  curse:        "lane",
  mirror:       "lane",
  riposte:      "lane",
  augur:        "global",
  heist:        "self",
  tide:         "global",
  oracle:       "self",
  vortex:       "global",
  supernova:    "hero",     // (default to hero; lane is a sub-target via the picker)
};

export interface ArenaPlanPhaseProps {
  board: BoardState;
  intent: TurnIntent;
  intentCost: number;
  disabled: boolean;
  onAddSpell: (spell: PlayedSpell) => void;
  onRemoveSpell: (idx: number) => void;
  onAddSummon: (summon: PlannedSummon) => void;
  onRemoveSummon: (lane: LaneIndex) => void;
  onLock: () => void;
}

export function ArenaPlanPhase({
  board, intent, intentCost, disabled,
  onAddSpell, onRemoveSpell, onAddSummon, onRemoveSummon, onLock,
}: ArenaPlanPhaseProps) {
  const me = board.a;
  const manaLeft = me.mana - intentCost;
  const canLock = !disabled && intentCost <= me.mana;

  /** Targeting mode — set when the player taps a card or a move button.
   *  null = idle (no pending target). */
  const [targeting, setTargeting] = useState<
    | { kind: "summon"; move: Move }
    | { kind: "spell"; id: CardId; targetKind: SpellTargetKind }
    | null
  >(null);

  function pickMoveToSummon(mv: Move) {
    if (disabled) return;
    if (manaLeft < 1) { hapticAlert(); return; }
    hapticTap();
    setTargeting({ kind: "summon", move: mv });
  }

  function pickCardToCast(id: CardId) {
    if (disabled) return;
    const card = CARDS[id];
    if (!arenaSupported(id)) { hapticAlert(); return; }
    if (manaLeft < card.cost) { hapticAlert(); return; }
    const targetKind = CARD_TARGET_KIND[id] ?? "global";
    hapticTap();
    if (targetKind === "self" || targetKind === "global" || targetKind === "hero") {
      // No further input needed — commit immediately.
      onAddSpell({ id, kind: targetKind } as PlayedSpell);
      return;
    }
    setTargeting({ kind: "spell", id, targetKind });
  }

  function pickLaneTarget(lane: LaneIndex) {
    if (!targeting) return;
    if (targeting.kind === "summon") {
      onAddSummon({ lane, move: targeting.move });
      setTargeting(null);
      return;
    }
    if (targeting.kind === "spell" && targeting.targetKind === "lane") {
      onAddSpell({ id: targeting.id, kind: "lane", lane });
      setTargeting(null);
      return;
    }
  }

  function cancelTargeting() {
    hapticTap();
    setTargeting(null);
  }

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2 shrink-0">
      {/* Targeting hint — fixed-height slot so the layout doesn't bounce. */}
      <div className="h-6 flex items-center justify-center">
        <AnimatePresence>
          {targeting && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] uppercase tracking-[0.15em] text-amber-300 font-bold flex items-center gap-2"
            >
              {targeting.kind === "summon" && <>Touche une lane pour invoquer {targeting.move.toUpperCase()}</>}
              {targeting.kind === "spell" && targeting.targetKind === "lane" && <>Touche une lane pour cibler</>}
              <button
                onClick={cancelTargeting}
                className="px-2 py-0.5 rounded-full bg-hairline text-[10px] font-bold"
              >Annuler</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lane target buttons — only visible when targeting */}
      {targeting && (
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto w-full">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => pickLaneTarget(i as LaneIndex)}
              className="py-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-100 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/30 transition"
            >
              Lane {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Queued summons + spells chips */}
      {(intent.spells.length > 0 || intent.summons.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md mx-auto w-full">
          {intent.summons.map((s) => (
            <button
              key={`sum-${s.lane}`}
              onClick={() => onRemoveSummon(s.lane)}
              className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/50 text-emerald-100 inline-flex items-center gap-1"
            >
              <MoveGlyph move={s.move} className="w-3 h-3" />
              <span>L{s.lane + 1} · 1m</span>
              <span className="text-rose-300">✕</span>
            </button>
          ))}
          {intent.spells.map((s, idx) => (
            <button
              key={`sp-${idx}`}
              onClick={() => onRemoveSpell(idx)}
              className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-violet-500/20 border border-violet-400/50 text-violet-100 inline-flex items-center gap-1"
            >
              <span>{CARDS[s.id].glyph}</span>
              <span>{CARDS[s.id].cost}m</span>
              <span className="text-rose-300">✕</span>
            </button>
          ))}
        </div>
      )}

      {/* Mana summary */}
      <div className="text-center text-[10px] text-ink-muted font-bold tabular-nums">
        Mana planifié : <span className={intentCost > me.mana ? "text-rose-300" : "text-sky-300"}>
          {intentCost}/{me.mana}
        </span>
        {intentCost === 0 && <span className="text-ink-faint"> · touche une carte ou un coup ↓</span>}
      </div>

      {/* RPSLS move picker — summon row */}
      <div className="grid grid-cols-5 gap-1.5 max-w-md mx-auto w-full">
        {MOVES.map((mv) => {
          const pal = MOVE_PALETTE[mv];
          const cannotAfford = manaLeft < 1;
          const isTargeting = targeting?.kind === "summon" && targeting.move === mv;
          return (
            <button
              key={mv}
              onClick={() => pickMoveToSummon(mv)}
              disabled={cannotAfford || disabled}
              className={
                "relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition " +
                "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring +
                (cannotAfford ? " opacity-30 grayscale" : "") +
                (isTargeting ? " ring-amber-300 scale-105" : "")
              }
            >
              <MoveGlyph move={mv} className="w-8 h-8" />
              <span className="text-[7px] uppercase tracking-wider font-bold text-white/90">{mv}</span>
              <span className="text-[7px] font-bold text-sky-300">1m</span>
            </button>
          );
        })}
      </div>

      {/* Hand fanout — spell cards */}
      {me.hand.length > 0 ? (
        <div className="flex items-end justify-center gap-1 px-1 pt-1 overflow-x-auto">
          {me.hand.map((id, i) => {
            const card = CARDS[id];
            const supported = arenaSupported(id);
            const cannotAfford = manaLeft < card.cost;
            const isTargeting = targeting?.kind === "spell" && targeting.id === id;
            return (
              <button
                key={`${id}-${i}`}
                onClick={() => pickCardToCast(id)}
                disabled={!supported || cannotAfford || disabled}
                className={
                  "relative w-[52px] h-[72px] sm:w-[58px] sm:h-[80px] rounded-xl overflow-hidden bg-surface-raised shrink-0 transition " +
                  "ring-2 " + (isTargeting ? "ring-amber-300 scale-105" : "ring-white/20") +
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
            );
          })}
        </div>
      ) : (
        <div className="text-center text-[10px] text-ink-faint italic">
          Main vide — fin de tour pour piocher.
        </div>
      )}

      {/* Lock button */}
      <button
        onClick={onLock}
        disabled={!canLock}
        className={
          "mt-1 px-6 py-2 rounded-2xl font-bold text-white text-sm transition " +
          (canLock
            ? "shadow-lg"
            : "bg-hairline text-ink-faint cursor-not-allowed")
        }
        style={canLock ? {
          background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
          boxShadow: "0 8px 24px -8px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
          fontFamily: "var(--font-headline)",
          letterSpacing: "0.06em",
        } : undefined}
      >
        ✓ Fin de tour
      </button>
    </div>
  );
}
