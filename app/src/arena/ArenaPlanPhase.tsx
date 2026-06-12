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
import { arenaSpellCost } from "./arenaSpellHelpers";
import { alog } from "./arenaLog";
import { ArenaHeroStrip } from "./ArenaHeroStrip";
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
  /** Player hero strip props — le strip est rendu ICI (juste au-dessus du
   *  picker) plutôt que dans ArenaBoard, pour qu'il soit à 1px des moves
   *  (Alex 2026-06-11). */
  incomingAttackKey?: number | null;
  playerName: string;
  playerAvatar?: string;
}

export function ArenaPlanPhase({
  board, intent, intentCost, disabled,
  targeting, onSetTargeting,
  onAddSpell, onRemoveSpell, onAddSummon, onRemoveSummon: _onRemoveSummon, onLock,
  incomingAttackKey, playerName, playerAvatar,
}: ArenaPlanPhaseProps) {
  // _onRemoveSummon : préfixé _ car la chip miniature qui l'utilisait a été
  // retirée (Alex 2026-06-11). Le retap du picker move annule maintenant.
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
    alog("hand", `TAP move ${mv}${disabled ? " (disabled)" : ""}`);
    if (disabled) return;
    // Re-tap sur le move déjà en target = ANNULER (Alex 2026-06-11). Avant
    // une phrase jaune "Annuler" était affichée ; maintenant retap suffit.
    if (targeting?.kind === "summon" && targeting.move === mv) {
      hapticTap();
      setTargeting(null);
      return;
    }
    if (manaLeft < 1) { hapticAlert(); return; }
    hapticTap();
    setInspecting(null);
    setTargeting({ kind: "summon", move: mv });
  }

  /** Commit a card — fire if no target needed, else enter targeting. */
  function commitCard(id: CardId) {
    alog("hand", `TAP card ${id}${disabled ? " (disabled)" : ""}`);
    if (disabled) return;
    // Re-tap sur la carte déjà en target = ANNULER (Alex 2026-06-11).
    if (targeting?.kind === "spell" && targeting.id === id) {
      hapticTap();
      setTargeting(null);
      return;
    }
    if (!arenaSupported(id)) { hapticAlert(); return; }
    if (manaLeft < arenaSpellCost(me, id)) { hapticAlert(); return; }
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

  // cancelTargeting retiré (Alex 2026-06-11) : la phrase jaune "Annuler" qui
  // l'utilisait est supprimée. Le re-tap sur le move/carte annule directement.

  return (
    <div className="flex flex-col gap-1 px-2 pb-1.5 shrink-0">
      {/* Phrase jaune retirée (Alex 2026-06-11) : les lanes illuminées indiquent
       *  déjà où cibler, et re-tap sur le move/carte = annuler. */}

      {/* Zone chips planifiés RETIRÉE (Alex 2026-06-11 "ordonner le tout") :
       *  - les sorts LANE-target s'affichent comme stickers en éventail dans
       *    le coin sup-gauche de leur lane (cf. ArenaBoard).
       *  - les sorts UTILITY (hero/self/global) s'affichent en mini-cards sur
       *    le strip you (à droite, tappables pour retirer).
       *  → plus de zone 52px entre le pad et le strip you. */}

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

      {/* Mana summary déplacé SOUS le bouton FIN DE TOUR (Alex 2026-06-11). */}

      {/* ════ PLAYER HERO STRIP — rendu ICI, JUSTE au-dessus du picker, pour
       *  être à ~1px des moves (Alex 2026-06-11). Bloc indépendant. ════ */}
      <div className="pl-0 pr-1 shrink-0 mb-0.5">
        <ArenaHeroStrip
          hero={me}
          board={board}
          side="you"
          turn={board.turn}
          name={playerName}
          avatar={playerAvatar}
          incomingAttackKey={incomingAttackKey}
          augurRevealed={board.augurRevealedA}
          pendingUtility={intent.spells.filter((s) => s.kind !== "lane")}
          onRemoveUtility={(localIdx) => {
            // Mappe l'index local (dans la liste filtrée utility) vers l'index
            // global dans intent.spells, puis retire.
            let seen = -1;
            for (let i = 0; i < intent.spells.length; i++) {
              if (intent.spells[i].kind !== "lane") {
                seen += 1;
                if (seen === localIdx) { onRemoveSpell(i); return; }
              }
            }
          }}
        />
      </div>

      {/* RPSLS move picker — compact strip. Tap to enter targeting mode
       *  THEN tap a lane on the board, OR drag the symbol directly onto a
       *  lane for one-gesture commit. Drag uses framer-motion with
       *  dragSnapToOrigin so the button returns to its place after drop. */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 max-w-md mx-auto w-full">
        {MOVES.map((mv) => {
          const pal = MOVE_PALETTE[mv];
          const cannotAfford = manaLeft < 1;
          // isTargeting OU déjà confirmé dans intent.summons (Alex 2026-06-11) :
          // le glow gold sur le picker remplace la mini-carte chip de la queue.
          const isPlannedSummon = intent.summons.some((s) => s.move === mv);
          const isTargeting = (targeting?.kind === "summon" && targeting.move === mv) || isPlannedSummon;
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

      {/* É1 COCKPIT (audit UX 2026-06-12) — la main et le bouton FIN DE TOUR
       *  partagent une RANGÉE façon Hearthstone : main éventail flex-1 +
       *  bouton ROND doré fixe à droite (badge mana planifié intégré). */}
      <div className="shrink-0 flex items-end gap-1.5">
      {/* Hand strip — tap = commit/target, hold 1.4s = inspect modal, DRAG =
       *  one-gesture commit to a lane. É2 : éventail COURBE (rotate/y par
       *  index, carte active remontée ×1.16) — transform-only, GPU. */}
      <div className="h-[88px] flex-1 min-w-0 flex items-end justify-center relative z-30">
      {(() => {
        // Filtre visuel (Alex 2026-06-11) : les cartes mises dans l'intent
        // sont DIRECTEMENT retirées de la main affichée → sentiment CCG net.
        // On compte combien de copies de chaque id sont déjà queue, et on
        // skip ce nombre depuis le début de la main.
        const queuedById = new Map<CardId, number>();
        for (const sp of intent.spells) {
          queuedById.set(sp.id, (queuedById.get(sp.id) ?? 0) + 1);
        }
        const visibleHand: Array<{ id: CardId; i: number }> = [];
        const skipLeft = new Map(queuedById);
        for (let i = 0; i < me.hand.length; i++) {
          const id = me.hand[i];
          const left = skipLeft.get(id) ?? 0;
          if (left > 0) { skipLeft.set(id, left - 1); continue; }
          visibleHand.push({ id, i });
        }
        return visibleHand.length > 0 ? (
        // Alex feedback : "pas dispo le slide" → ajout de touchAction
        // pan-x au wrapper pour permettre le scroll horizontal natif sans
        // que le drag-card intercepte le swipe horizontal.
        // justify-start au lieu de center pour que le scroll soit utile
        // (si center et qu'il manque de place, les cards des extrémités
        // sont coupées sans pouvoir scroller).
        <div
          className="flex items-end justify-start gap-1 px-1 overflow-x-auto w-full"
          style={{ touchAction: "pan-x", scrollbarWidth: "thin" }}
        >
          <AnimatePresence>
          {visibleHand.map(({ id, i }, pos) => {
            const card = CARDS[id];
            const supported = arenaSupported(id);
            const cannotAfford = manaLeft < arenaSpellCost(me, id);
            const isTargeting = targeting?.kind === "spell" && targeting.id === id;
            const isInspecting = inspecting === id;
            const targetKind = CARD_TARGET_KIND[id] ?? "global";
            // É2 — géométrie de l'éventail : rotation répartie (max ±12°),
            // creux parabolique vers les bords, carte active redressée +
            // remontée au-dessus des voisines.
            const n = visibleHand.length;
            const center = (n - 1) / 2;
            const stepDeg = n > 1 ? Math.min(5, 24 / (n - 1)) : 0;
            const fanAngle = (pos - center) * stepDeg;
            const fanY = Math.pow(Math.abs(pos - center), 2) * (n > 6 ? 1.1 : 1.7);
            const fanActive = isTargeting || isInspecting;
            // Lock Aegis 1×/match levé (Alex 2026-06-11) — la règle "1 copie
            // en main = 1 cast" suffit pour empêcher l'abus.
            const canDragCard = supported && !cannotAfford && !disabled && targetKind === "lane";
            return (
              <motion.div
                key={`${id}-${i}`}
                layout
                initial={{ scale: 0.7, opacity: 0 }}
                // É2 — éventail : rotation/creux par index ; carte active
                // redressée, remontée et agrandie AU-DESSUS des voisines.
                animate={{
                  scale: fanActive ? 1.16 : 1,
                  opacity: 1,
                  rotate: fanActive ? 0 : fanAngle,
                  y: fanActive ? -12 : fanY,
                }}
                exit={{ scale: 0.5, opacity: 0, y: -16 }}
                // Réarrangement QUASI-INSTANTANÉ (Alex 2026-06-11) : layout +
                // exit très courts (~90ms) pour que le joueur enchaîne la
                // carte suivante sans attendre la fin de l'anim.
                transition={{ layout: { duration: 0.09, ease: "easeOut" }, duration: 0.12, ease: "easeOut" }}
                className="flex flex-col items-center gap-0.5 shrink-0 -ml-2 first:ml-0"
                style={{ transformOrigin: "50% 100%", zIndex: fanActive ? 60 : pos }}
              >
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
                  // É2 : plus de scale-110 interne — l'emphase (×1.16 + remontée)
                  // est portée par l'enveloppe éventail.
                  "ring-2 " + (
                    isTargeting ? "ring-amber-300"
                    : isInspecting ? "ring-sky-300"
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
                {/* Badge ⚠ Pleine vie sur Second souffle (Alex 2026-06-11) :
                 *  carte cast à HP max = mana + carte brûlés pour rien. Visuel
                 *  avertit sans bloquer (choix CCG classique). */}
                {id === "second-wind" && me.hp >= me.maxHp && (
                  <div
                    className="absolute top-0.5 right-0.5 z-10 px-1 py-0.5 rounded-md bg-amber-500/90 text-[8px] font-black text-zinc-900 leading-none shadow"
                    title="Tu es à pleine vie — la carte sera dépensée sans effet"
                  >
                    ⚠
                  </div>
                )}
              </button>
              </motion.div>
              {/* Name label beneath the card — truncated to the card width
               *  so the player can scan their hand without tapping each. */}
              <span
                className={
                  "text-[8px] sm:text-[9px] font-bold uppercase tracking-wider truncate max-w-[44px] leading-none " +
                  (cannotAfford || !supported ? "text-ink-faint" : "text-ink")
                }
                title={t(card.nameKey)}
              >
                {t(card.nameKey)}
              </span>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 opacity-65">
          <div className="w-[44px] h-[60px] sm:w-[48px] sm:h-[66px] rounded-lg border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center text-2xl">
            🎴
          </div>
          <span className="text-[10px] text-ink-faint italic">
            {me.hand.length === 0 && me.deck.length + me.discard.length === 0
              ? "Plus de cartes à piocher (deck + défausse vides)"
              : me.hand.length === 0
              ? "Main vide — fin de tour pour piocher"
              : "Toutes les cartes en main sont déjà planifiées"}
          </span>
        </div>
      );
      })()}
      </div>

      {/* É1 — FIN DE TOUR : bouton ROND doré fixe (ancre visuelle façon
       *  Hearthstone), badge MANA PLANIFIÉ intégré. Remplace l'ancien pill
       *  centré + la ligne texte "Mana restant" (info dans le bouton). */}
      <div className="relative shrink-0 pb-1.5 pr-0.5">
        {canLock && (
          <motion.div
            aria-hidden
            animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.94, 1.1, 0.94] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(252,211,77,0.85), transparent 70%)", filter: "blur(10px)" }}
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
            "relative w-14 h-14 rounded-full flex flex-col items-center justify-center leading-none transition active:scale-[0.94] " +
            (canLock
              ? "text-zinc-900 shadow-xl ring-2 ring-amber-200/80"
              : "bg-hairline text-ink-faint cursor-not-allowed ring-2 ring-white/10")
          }
          style={canLock ? {
            background: "linear-gradient(140deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)",
            fontFamily: "var(--font-headline)",
            boxShadow: "0 6px 18px -4px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.5)",
            touchAction: "manipulation",
          } : { touchAction: "manipulation" }}
        >
          <span className="text-[11px] font-black tracking-wider">FIN</span>
          <span
            className={
              "mt-0.5 text-[10px] font-black tabular-nums " +
              (canLock ? "text-zinc-900/80" : intentCost > me.mana ? "text-rose-300" : "text-sky-300")
            }
            title="Mana restant après ton plan"
          >
            {manaLeft}⋙
          </span>
        </button>
      </div>
      </div>
    </div>
  );
}

