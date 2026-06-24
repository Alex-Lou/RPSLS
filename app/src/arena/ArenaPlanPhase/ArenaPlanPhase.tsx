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

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { ArenaDeckDrop } from "../ArenaDeckDrop";
import type { Move } from "../../engine/game";
import { hapticAlert, hapticTap } from "../../haptic";
import { CARDS } from "../../ranked/cards";
import { useT } from "../../i18n";
import type { CardId } from "../../ranked/rankedTypes";
import { arenaSupported } from "../arenaCardEffects";
import { arenaSpellCost } from "../arenaSpellHelpers";
import { isFusible, findFusionResult, fusionPartnersOf } from "../arenaFusionCards";
import { alog } from "../arenaLog";
import { ArenaHeroStrip } from "../ArenaHeroStrip";
import { ArenaCardInspect } from "../ArenaCardInspect";
import { CARD_TARGET_KIND as SHARED_TARGET_KIND, intentManaGrant, OPENING_TURNS, type ArenaTargeting } from "../arenaTypes";
import { ArenaCardBack } from "../ArenaCardBack";
import type {
  BoardState,
  LaneIndex,
  PlayedSpell,
  PlannedSummon,
  TurnIntent,
} from "../arenaTypes";
import { ArenaMovePicker } from "./ArenaMovePicker";
import { ArenaHandFanout } from "./ArenaHandFanout";
import { ArenaLockButton } from "./ArenaLockButton";
import { commitDragDrop as commitDragDropImpl } from "./arenaPlanDrag";

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
  /** Dépôt / fusion sur TA forge — lit le targeting courant (carte glissée).
   *  Permet le drag d'une carte jusqu'à la case de fusion (Alex 2026-06-13). */
  onForgeTap?: () => void;
  /** Dépôt / fusion FIABLE d'une carte EXPLICITE (bouton ⚗ de la fiche) —
   *  indépendant du targeting, marche pour tout ciblage (Alex 2026-06-13). */
  onForgeDeposit?: (id: CardId) => void;
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
  onForgeTap, onForgeDeposit,
  incomingAttackKey, playerName, playerAvatar,
}: ArenaPlanPhaseProps) {
  // _onRemoveSummon : préfixé _ car la chip miniature qui l'utilisait a été
  // retirée (Alex 2026-06-11). Le retap du picker move annule maintenant.
  const t = useT();
  const me = board.a;
  // Budget = mana + mana « tempo » offert par les cartes planifiées (Sablier,
  // Offre) → utilisable DÈS CE TOUR (Alex 2026-06-13).
  const manaBudget = me.mana + intentManaGrant(intent);
  const manaLeft = manaBudget - intentCost;
  // Tu peux TOUJOURS finir ton tour (Alex 2026-06-17) : le Lock n'est PLUS gaté
  // sur le mana (avant : bouton mort silencieux si intent inabordable). Si
  // l'intent dépasse le budget, handleLockTurn retire les cartes en trop avant
  // de résoudre. L'abordabilité reste imposée à l'AJOUT (pickMoveToSummon/playCard).
  const canLock = !disabled;
  // `targeting` + `onSetTargeting` are LIFTED to ArenaGame (so the board
  // can also commit lane taps). The local setTargeting alias below keeps
  // the rest of this file readable.
  const setTargeting = onSetTargeting;

  /** Inspect mode — first tap on a hand card surfaces a full-screen modal
   *  description. Independent of `targeting` so the player can read a
   *  card without committing to play it. */
  const [inspecting, setInspecting] = useState<CardId | null>(null);
  // POSITION touchée dans l'éventail (Alex 2026-06-13) : targeting/inspecting
  // ne stockent que l'ID → avec 2 copies de la même carte en main, LES DEUX
  // se soulevaient. On retient la position tapée : elle seule s'active.
  const [activePos, setActivePos] = useState<number | null>(null);
  // Carte sous le doigt (Alex 2026-06-13 « certaines cartes ne veulent pas
  // être sélectionnées ») : au pointer-down on la passe DEVANT (z + remontée)
  // → le geste atterrit sur la bonne carte malgré le chevauchement de l'éventail.
  const [pressedPos, setPressedPos] = useState<number | null>(null);
  // RÉVÉLATION phase 1→2 « DÉPLOIEMENT » (Alex 2026-06-17) : joué UNE fois quand
  // l'OUVERTURE finit (turn = OPENING_TURNS+1) et que les 1res cartes sont en
  // main → elles tombent du deck + se RETOURNENT (ArenaDeckDrop). Auto-dismiss.
  const [deckDrop, setDeckDrop] = useState<{ key: number; cards: CardId[] } | null>(null);
  const deckDropFiredRef = useRef(false);
  useEffect(() => {
    if (deckDropFiredRef.current) return;
    if (board.turn === OPENING_TURNS + 1 && me.hand.length > 0 && !disabled) {
      deckDropFiredRef.current = true;
      setDeckDrop({ key: Date.now(), cards: me.hand });
      const id = window.setTimeout(() => setDeckDrop(null), 2100);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.turn, me.hand.length, disabled]);
  // (Pill nom : rendue par-carte sous la carte active — cf. éventail.)

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

  /** Joue RÉELLEMENT la carte : arme la cible lane, ou auto-joue l'utilitaire.
   *  Appelé par le tap direct ET par « Lancer » dans la fiche — AUCUNE
   *  redirection fiche ici (sinon le bouton Lancer rouvrirait la fiche en
   *  boucle pour un utilitaire fusible). */
  function playCard(id: CardId) {
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

  /** Tap sur une carte : re-tap (carte déjà ciblée) = annule ; sinon JOUE/arme
   *  directement. Les cartes FUSIBLES self/hero/global ne détournent PLUS le tap
   *  vers la fiche (Alex 2026-06-13 « Second Souffle / Supernova réagissent
   *  VRAIMENT bizarrement ») : la carte se soulevait (fanActive sur isInspecting)
   *  PUIS une modale s'ouvrait = effet de DEMI-SÉLECTION, pire à l'extrémité
   *  gauche où le chevauchement est le plus serré. Le chemin Forge reste
   *  accessible par APPUI LONG → fiche → ⚗ (Déposer / Fusionner). Règle nette,
   *  cohérente pour TOUTES les cartes : tap = jouer. */
  function commitCard(id: CardId) {
    alog("hand", `TAP card ${id}${disabled ? " (disabled)" : ""}`);
    if (disabled) return;
    if (targeting?.kind === "spell" && targeting.id === id) {
      hapticTap();
      setTargeting(null);
      return;
    }
    playCard(id);
  }

  /** Drop-zone hit-test — délègue à arenaPlanDrag (logique pure). Garde la
   *  signature (point, current) attendue par le picker en bindant les deps. */
  const commitDragDrop = (point: { x: number; y: number }, current: ArenaTargeting): boolean =>
    commitDragDropImpl(point, current, { board, onAddSummon, onAddSpell, setTargeting, onForgeTap });

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
    <div className="flex flex-col gap-1 px-2 pb-1.5 landscape:gap-0.5 landscape:pb-0.5 shrink-0 landscape:w-full landscape:max-w-4xl landscape:mx-auto landscape:px-0.5">
      {/* RÉVÉLATION « DÉPLOIEMENT » plein écran (portal) — passage phase 1→2. */}
      {deckDrop && createPortal(
        <ArenaDeckDrop key={deckDrop.key} cards={deckDrop.cards} phaseName="Déploiement" />,
        document.body,
      )}
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
            onCommit={() => { playCard(inspecting); setInspecting(null); }}
            onClose={() => setInspecting(null)}
            forgeHint={(() => {
              if (!isFusible(inspecting)) return undefined;
              const r = board.forgeA ? findFusionResult(inspecting, board.forgeA) : null;
              return r ? `⚗ Fusionner → ${t(CARDS[r].nameKey)}` : "⚗ Déposer sur la Forge";
            })()}
            onForge={isFusible(inspecting) && onForgeDeposit
              ? () => { onForgeDeposit(inspecting); setInspecting(null); }
              : undefined}
            fusionRecipes={fusionPartnersOf(inspecting).map((r) => ({
              partner: r.a === inspecting ? r.b : r.a,
              result: r.result,
            }))}
          />
        )}
      </AnimatePresence>

      {/* Mana summary déplacé SOUS le bouton FIN DE TOUR (Alex 2026-06-11). */}

      {/* ════ PLAYER HERO STRIP — rendu ICI, JUSTE au-dessus du picker, pour
       *  être à ~1px des moves (Alex 2026-06-11). Bloc indépendant. ════ */}
      <div className="pl-0 pr-1 shrink-0 mb-0.5 landscape:mb-0">
        <ArenaHeroStrip
          hero={me}
          board={board}
          side="you"
          calm={disabled}
          turn={board.turn}
          name={playerName}
          avatar={playerAvatar}
          incomingAttackKey={incomingAttackKey}
          augurRevealed={board.augurRevealedA}
          pendingUtility={intent.spells.filter((s) => s.kind !== "lane")}
          /* Croix de retrait DISPONIBLE tant que « Fin de tour » pas appuyé
           * (disabled=false). Alex 2026-06-13 : « il faut la petite croix pour
           * retirer un Second Souffle tant que pas locké ». Post-lock
           * (resolving) → undefined → chips non-retirables. */
          onRemoveUtility={disabled ? undefined : (localIdx) => {
            // Mappe l'index local (liste utility filtrée) → index global intent.
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
      {/* PAYSAGE TABLETTE (Alex 2026-06-20) : picker + deck/main + Fin de tour sur
       *  UNE rangée (le deck de phase 1 ne prend plus une ligne entière, on gagne
       *  de la hauteur). `contents` = transparent en PORTRAIT (empilé comme avant,
       *  inchangé) ; `landscape:flex-row` les met côte à côte en PAYSAGE. */}
      <div className="contents landscape:flex landscape:flex-row landscape:items-end landscape:justify-center landscape:gap-2 landscape:w-full landscape:max-w-3xl landscape:mx-auto">
      <ArenaMovePicker
        intent={intent}
        manaLeft={manaLeft}
        disabled={disabled}
        targeting={targeting}
        pickMoveToSummon={pickMoveToSummon}
        setInspecting={setInspecting}
        setTargeting={setTargeting}
        commitDragDrop={commitDragDrop}
      />

      {/* OUVERTURE (Alex 2026-06-17) : T1-3 la main est VIDE par design — on
       *  N'ANNONCE RIEN (ni icône main vide, ni « cartes au tour 4 ») pour garder
       *  la SURPRISE du déblocage. La phase d'ouverture = invocations seulement,
       *  le joueur le découvre par le jeu. (Bannière retirée.) */}
      {/* É1 COCKPIT (audit UX 2026-06-12) — la main et le bouton FIN DE TOUR
       *  partagent une RANGÉE façon Hearthstone : main éventail flex-1 +
       *  bouton ROND doré fixe à droite (badge mana planifié intégré). */}
      <div className="shrink-0 flex items-end gap-1.5 landscape:flex-none landscape:min-w-0">
        {board.turn <= OPENING_TURNS ? (
          /* DECK FACE CACHÉE qui ATTEND (Alex 2026-06-17) : occupe l'espace de la
             main pendant l'ouverture + POSE la surprise — c'est cette pile qui
             « tombera » à T4 (chute de deck). Dos premium ArenaCardBack. */
          <div className="flex-1 flex flex-col items-center justify-end gap-1 pb-0.5" aria-hidden>
            <div className="relative" style={{ width: 54, height: 74 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${(i - 1) * 4}deg) translateX(${(i - 1) * 3}px)`, zIndex: i }}
                >
                  <ArenaCardBack className="w-full h-full" glow={i === 2} />
                </div>
              ))}
            </div>
            {/* INDICATEUR de phase (Alex 2026-06-17 : « Ouverture » se lisait comme
             *  un bouton « appuyer pour ouvrir ») → « PHASE 1 », un statut non
             *  actionnable qui annonce la « PHASE 2 · DÉPLOIEMENT » de la révélation,
             *  sans dire QUAND les cartes arrivent (surprise préservée). */}
            <div className="text-[8px] uppercase tracking-[0.32em] font-black text-amber-200/60">Phase 1</div>
          </div>
        ) : (
          <ArenaHandFanout
            intent={intent}
            me={me}
            board={board}
            manaLeft={manaLeft}
            targeting={targeting}
            inspecting={inspecting}
            disabled={disabled}
            activePos={activePos}
            setActivePos={setActivePos}
            pressedPos={pressedPos}
            setPressedPos={setPressedPos}
            startPress={startPress}
            endPress={endPress}
          />
        )}
        <ArenaLockButton
          canLock={canLock}
          targeting={targeting}
          setTargeting={setTargeting}
          onLock={onLock}
        />
      </div>
      </div>
    </div>
  );
}
