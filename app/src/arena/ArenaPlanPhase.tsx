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
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { hapticAlert, hapticTap } from "../haptic";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import { useT } from "../i18n";
import type { CardId } from "../ranked/rankedTypes";
import { arenaSupported } from "./arenaCardEffects";
import { ArenaCardInspect } from "./ArenaCardInspect";
import { ArenaHowItWorks } from "./ArenaHowItWorks";
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
  onAddSpell, onRemoveSpell, onRemoveSummon, onLock,
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
  const [howOpen, setHowOpen] = useState(false);

  function pickMoveToSummon(mv: Move) {
    if (disabled) return;
    if (manaLeft < 1) { hapticAlert(); return; }
    hapticTap();
    setInspecting(null); // close any open spell inspect when going to summon
    setTargeting({ kind: "summon", move: mv });
  }

  function pickCardToCast(id: CardId) {
    if (disabled) return;
    const card = CARDS[id];
    if (!arenaSupported(id)) { hapticAlert(); return; }
    if (manaLeft < card.cost) { hapticAlert(); return; }
    // Two-tap UX: first tap surfaces the inspect panel so the player reads
    // what the card actually DOES. Second tap on the SAME card commits.
    // Tap a different card → switches inspect to the new card.
    if (inspecting !== id) {
      hapticTap();
      setInspecting(id);
      return;
    }
    const targetKind = CARD_TARGET_KIND[id] ?? "global";
    hapticTap();
    setInspecting(null);
    if (targetKind === "self" || targetKind === "global" || targetKind === "hero") {
      // No further input needed — commit immediately.
      onAddSpell({ id, kind: targetKind } as PlayedSpell);
      return;
    }
    setTargeting({ kind: "spell", id, targetKind });
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
       *  itself now (Hearthstone-style direct target). The board's player
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
            onCommit={() => pickCardToCast(inspecting)}
            onClose={() => setInspecting(null)}
          />
        )}
      </AnimatePresence>

      {/* Mana summary */}
      <div className="text-center text-[10px] text-ink-muted font-bold tabular-nums">
        Mana planifié : <span className={intentCost > me.mana ? "text-rose-300" : "text-sky-300"}>
          {intentCost}/{me.mana}
        </span>
        {intentCost === 0 && !inspecting && <span className="text-ink-faint"> · touche une carte ou un coup ↓</span>}
        {inspecting && <span className="text-amber-300"> · re-touche la carte pour la jouer</span>}
      </div>

      {/* RPSLS move picker — compact strip. Was aspect-[4/5] cards that
       *  took 15% of the screen; now h-12 pills so the board reclaims the
       *  vertical space. Same dark-glass + neon-rim aesthetic. */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 max-w-md mx-auto w-full">
        {MOVES.map((mv) => {
          const pal = MOVE_PALETTE[mv];
          const cannotAfford = manaLeft < 1;
          const isTargeting = targeting?.kind === "summon" && targeting.move === mv;
          const rim = moveRim(pal.hex);
          const glow = moveGlow(pal.hex);
          return (
            <button
              key={mv}
              onClick={() => pickMoveToSummon(mv)}
              disabled={cannotAfford || disabled}
              className={
                "relative h-12 sm:h-14 rounded-lg flex items-center justify-center transition active:scale-92 " +
                (cannotAfford ? "opacity-30 grayscale " : "") +
                (isTargeting ? "scale-105 " : "")
              }
              style={{
                background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
                border: `2px solid ${isTargeting ? "rgba(252, 211, 77, 0.9)" : rim}`,
                boxShadow: isTargeting
                  ? "0 0 14px -2px rgba(252, 211, 77, 0.7), inset 0 1px 0 rgba(255,255,255,0.08)"
                  : `0 0 8px -2px ${glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
            >
              <MoveGlyph move={mv} className="w-8 h-8 sm:w-9 sm:h-9" />
              <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-sky-300" />
            </button>
          );
        })}
      </div>

      {/* Hand strip — compact (44-48px wide) cards with their NAMES visible
       *  underneath so the player recognises what's in hand without having
       *  to tap each one. The modal inspect (on tap) still gives the full
       *  card text. */}
      {me.hand.length > 0 ? (
        <div className="flex items-end justify-center gap-1 px-1 overflow-x-auto">
          {me.hand.map((id, i) => {
            const card = CARDS[id];
            const supported = arenaSupported(id);
            const cannotAfford = manaLeft < card.cost;
            const isTargeting = targeting?.kind === "spell" && targeting.id === id;
            const isInspecting = inspecting === id;
            return (
              <div key={`${id}-${i}`} className="flex flex-col items-center gap-0.5 shrink-0">
              <button
                onClick={() => pickCardToCast(id)}
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
        <div className="text-center text-[10px] text-ink-faint italic">
          Main vide — fin de tour pour piocher.
        </div>
      )}

      {/* Lock button + "Comment ça marche" — side-by-side. The "?" opens
       *  a fullscreen explanation modal so the player can read up on
       *  cibles / persistance / shields without leaving the match. */}
      <div className="flex items-center justify-center gap-2 mt-0.5">
        <button
          onClick={() => setHowOpen(true)}
          className="w-9 h-9 rounded-full bg-zinc-900 border border-emerald-700/50 text-emerald-300 text-sm font-black active:scale-95"
          aria-label="Comment ça marche"
          title="Comment ça marche"
        >
          ?
        </button>
        <button
          onClick={onLock}
          disabled={!canLock}
          className={
            "px-5 py-1.5 rounded-xl font-bold text-white text-xs transition " +
            (canLock
              ? "shadow-md"
              : "bg-hairline text-ink-faint cursor-not-allowed")
          }
          style={canLock ? {
            background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
            boxShadow: "0 4px 14px -4px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.08em",
          } : undefined}
        >
          ✓ FIN DE TOUR
        </button>
      </div>
      <AnimatePresence>{howOpen && <ArenaHowItWorks onClose={() => setHowOpen(false)} />}</AnimatePresence>
    </div>
  );
}

