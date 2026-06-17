/**
 * ArenaBoard — visual board for Constellation Pro (orchestrateur).
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
 *
 * Sous-composants extraits (mêmes responsabilités, JSX verbatim) :
 *   ./LaneRow          — une rangée de 3 cases
 *   ./CenterStatus     — bandeau de phase central (+ Chip/IntentChips)
 *   ./ArenaBoardChips  — overlays Augur / Taunt-block / Anti-taunt
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useStore } from "../../store/store";
import { BattlePad } from "../../BattlePad";
import { useArenaPad } from "../../ranked/arena";
import { CARDS } from "../../ranked/cards";
import { useT } from "../../i18n";
import { ArenaHeroStrip } from "../ArenaHeroStrip";
import { ArenaSpellsReveal } from "../ArenaSpellsReveal";
import { ArenaSpellFX } from "../ArenaSpellFX";
import { ForgeSlot } from "../ArenaForge";
import { ArenaHpVignette } from "../ArenaHpVignette";
import { isValidLaneTarget, targetLabelFor, LANE_SPELL_TARGET_SIDE, CARD_TARGET_KIND } from "../arenaTypes";
import { ArenaCardInspect } from "../ArenaCardInspect";
import { fusionPartnersOf } from "../arenaFusionCards";
import type { ArenaTargeting, BoardState, LaneIndex, Side, TurnIntent } from "../arenaTypes";
import type { CardId } from "../../ranked/rankedTypes";
import { InlineBurger } from "../../ui/ModeLobbyShell";
import { setBurgerHidden } from "../../Sidebar";
import { MoveGlyph } from "../../icons";
import { AugurFlash, TauntBlockChip, AntiTauntChip } from "./ArenaBoardChips";
import { CenterStatus } from "./CenterStatus";
import { LaneRow } from "./LaneRow";

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
  combatChargers?: ("a" | "b")[];
  /** Hero-hit flash event — set briefly when a creature lands an attack
   *  on a hero. The targeted side's HP bar flashes white→red dramatically. */
  heroHit?: { side: "you" | "opp"; lane: LaneIndex; key: number } | null;
  /** Taunt block flash — set when an undefended attack is DEFLECTED by a
   *  taunt creature on the defender's side. Pops a "🪨 ATTAQUE DÉTOURNÉE !"
   *  chip on the defender's row + glows the actual Pierre that ate the
   *  deflection (rockLane), so the player SEES which rock saved them. */
  tauntBlock?: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null;
  /** Anti-taunt bypass — set when an attack reached a hero because the
   *  attacker's Étouffe (Feuille) / Logique (Spock) cancelled the defender's
   *  charged Pierre Provocation. Pops a chip on the bypassed Pierre. */
  antiTaunt?: { bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null;
  /** Signatures FX plein-board (Genèse, Supernova…) — déclenché au step
   *  SPELLS. null au repos. Cf. ArenaSpellFX. */
  spellFX?: { ids: CardId[]; key: number } | null;
  /** Identité cosmétique CPU (strip adverse) — nom réel + portrait hero_*.png
   *  au lieu de « CPU » + 🤖 (Alex 2026-06-13). */
  oppName?: string;
  oppAvatar?: string;
  /** Active targeting (lifted from ArenaPlanPhase) — when set on a lane
   *  target, the BOARD highlights ONLY the lane slots a spell of that
   *  kind can actually target (my creature for buffs, opp creature for
   *  debuffs, my empty for summons, etc.). */
  targeting?: ArenaTargeting;
  /** Called when the player taps a lane slot while targeting is active.
   *  Receives BOTH the lane AND the side that was tapped, so the parent
   *  can decide what to do (commit to my row, commit to opp row, etc.). */
  onLaneTap?: (lane: LaneIndex, side: Side) => void;
  /** Retire un sort planifié par son index dans intent.spells (Alex 2026-06-11) :
   *  tap sur un sticker lane joueur = annuler le sort. */
  onRemoveSpell?: (idx: number) => void;
  /** Annule une invocation planifiée sur une lane (Alex 2026-06-12 "0 souplesse,
   *  je peux pas retirer une invocation juste posée") — tap sur la croix du ghost. */
  onRemoveSummon?: (lane: LaneIndex) => void;
  /** ⚗️ Forge (2026-06-13) : carte posée sur la forge de chaque camp. */
  forgeYou?: CardId | null;
  forgeOpp?: CardId | null;
  /** Tap sur TA forge : dépôt (carte sélectionnée) / fusion (partenaire) /
   *  reprise (rien de sélectionné). */
  onForgeTap?: () => void;
  /** Bump à chaque fusion réussie — déclenche le flash ⚗️. */
  forgeFlashKey?: number | null;
  /** Bump quand on récupère la carte fusionnée — poussière d'or de rappel. */
  forgeRecoverKey?: number | null;
  /** Étát visuel de TA forge selon la sélection : "deposit" (pulse dépôt),
   *  "fuse" (pulse OR partenaire prêt), null. */
  forgeHighlight?: "deposit" | "fuse" | null;
  /** Hauteur px mesurée du slot (BoardFillSlot). Posée en hauteur EXPLICITE sur
   *  la racine du board → le pad `flex-1` la remplit de façon FIABLE sur le
   *  WebView (≠ flex profond), sans scaler les cartes. 0 = pas encore mesuré. */
  fillHeight?: number;
}

export function ArenaBoard({ board, playerSide, intent, oppPreview, playerPreview, resolveStep, combatLane = null, combatChargers = [], heroHit = null, tauntBlock = null, antiTaunt = null, spellFX = null, oppName, oppAvatar, targeting, onLaneTap, onRemoveSpell, onRemoveSummon, forgeYou = null, forgeOpp = null, onForgeTap, forgeFlashKey = null, forgeRecoverKey = null, forgeHighlight = null, fillHeight }: ArenaBoardProps) {
  // SECOUSSE D'IMPACT (Alex 2026-06-12) : à chaque tick de combat (combatLane
  // change), le pad tremble brièvement, calé sur l'apex du slam (~0.3s après
  // le départ de la charge). Animation controls = pas de remount des lanes.
  // É4 — burger flottant OFF pendant le match (l'InlineBurger du strip opp le
  // remplace). Restauré au unmount (écrans match-end/sudden-death le gardent).
  useEffect(() => {
    setBurgerHidden(true);
    return () => setBurgerHidden(false);
  }, []);

  const padShake = useAnimationControls();
  const t = useT();
  // Fiche LECTURE SEULE d'une carte adverse révélée par Augure (long-press).
  const [inspectOpp, setInspectOpp] = useState<CardId | null>(null);
  useEffect(() => {
    if (combatLane === null) return;
    padShake.start({
      x: [0, 0, 5, -5, 3, -1, 0],
      y: [0, 0, -2, 2, -1, 0, 0],
      transition: { duration: 0.55, times: [0, 0.5, 0.62, 0.74, 0.85, 0.94, 1], ease: "easeOut" },
    });
  }, [combatLane, padShake]);

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
    const out: Array<{ lane: LaneIndex; id: import("../../ranked/rankedTypes").CardId; owner: "you" | "opp"; position: "tl" | "tr" | "bl" | "br"; idx: number; name: string }> = [];
    // Player stickers go TOP-LEFT (Alex 2026-06-11) : les minis des sorts
    // lane-target planifiés se collent au coin sup-gauche de la lane ciblée,
    // en éventail si plusieurs. idx = index dans intent.spells pour la
    // suppression au tap. Opp stickers bottom-right (read-only preview).
    const playerSpells = (playerPreview ?? intent).spells;
    playerSpells.forEach((s, i) => {
      if (s.kind !== "lane") return;
      const tgt = LANE_SPELL_TARGET_SIDE[s.id] ?? "my-creature";
      const targetSide: Side = tgt === "opp-creature" ? oppSide : playerSide;
      if (targetSide === rowSide) out.push({ lane: s.lane, id: s.id, owner: "you", position: "tl", idx: i, name: t(CARDS[s.id].nameKey) });
    });
    const cpuSpells = oppPreview?.spells ?? [];
    cpuSpells.forEach((s, i) => {
      if (s.kind !== "lane") return;
      const tgt = LANE_SPELL_TARGET_SIDE[s.id] ?? "my-creature";
      const targetSide: Side = tgt === "opp-creature" ? playerSide : oppSide;
      if (targetSide === rowSide) out.push({ lane: s.lane, id: s.id, owner: "opp", position: "br", idx: i, name: t(CARDS[s.id].nameKey) });
    });
    return out;
  }
  const playerRowStickers = stickersForSide(playerSide);
  const oppRowStickers = stickersForSide(oppSide);
  const padId = useArenaPad(useStore((s) => s.player.padId));
  // Le player strip (avatar/nickname) est rendu dans ArenaPlanPhase désormais
  // (Alex 2026-06-11). ArenaBoard ne rend plus que l'opp strip + le pad.
  const opp = board[oppSide];

  return (
    <div
      className="relative w-full max-w-3xl mx-auto px-0.5 flex flex-col gap-0 sm:gap-0.5 [@media(max-height:560px)]:max-w-md"
      style={{ minHeight: fillHeight ? fillHeight : undefined }}
    >
      {/* 🩸 Danger rouge crescendo quand TES PV ≤ 10 → 0 (fixed plein écran,
       *  auto-démonté hors danger — cf. ArenaHpVignette). */}
      <ArenaHpVignette hp={board[playerSide].hp} />
      {/* ════════ OPP HERO STRIP — SPACER en flow (réserve la place pour que
       *  le pad NE BOUGE PAS) + strip réel rendu en PORTAL vers document.body
       *  (Alex 2026-06-11). Le portal échappe au clip `overflow-y-auto` du
       *  <main> (la "muraille marron" qui coupait le haut) et se positionne
       *  en `fixed` au MÊME niveau que le burger, EN AVANT de tout. ════════ */}
      {/* Spacer réduit (Alex 2026-06-11) : h-[34px] pour remonter le haut du
       *  pad et équilibrer l'espace haut (opp strip→pad) avec l'espace bas
       *  (pad→strip you). Ajustable si pas pile symétrique. */}
      <div className="shrink-0 h-[34px]" aria-hidden />
      {typeof document !== "undefined" && createPortal(
        // É4 (Alex 2026-06-12, audit UX) : burger themed INLINE intégré à la
        // rangée du strip adverse (le flottant est masqué pendant le match —
        // cf. useEffect setBurgerHidden plus haut). left-14 → left-2 : plus
        // d'espace réservé au flottant.
        <div
          // right-12 : coin haut-droit réservé au bouton Logs 🐛 (Alex 2026-06-12).
          className="fixed left-2 right-12 z-[55] flex items-center gap-1.5"
          style={{ top: "max(env(safe-area-inset-top, 0px), 32px)" }}
        >
          <InlineBurger />
          <div className="flex-1 min-w-0">
            <ArenaHeroStrip
              hero={opp} board={board} side="opp" turn={board.turn} name={oppName ?? "CPU"} avatar={oppAvatar}
              incomingAttackKey={heroHit?.side === "opp" ? heroHit.key : null}
              augurRevealed={playerSide === "a" ? board.augurRevealedB : board.augurRevealedA}
              pendingUtility={oppPreview?.spells.filter((s) => s.kind !== "lane")}
              onInspectCard={setInspectOpp}
              calm={resolveStep !== null}
            />
          </div>
        </div>,
        document.body,
      )}
      {/* Fiche LECTURE SEULE d'une carte adverse révélée (Augure) — portal. */}
      {createPortal(
        <AnimatePresence>
          {inspectOpp && (
            <ArenaCardInspect
              id={inspectOpp}
              targetKind={CARD_TARGET_KIND[inspectOpp] ?? "global"}
              t={t}
              readOnly
              onCommit={() => {}}
              onClose={() => setInspectOpp(null)}
              fusionRecipes={fusionPartnersOf(inspectOpp).map((r) => ({
                partner: r.a === inspectOpp ? r.b : r.a,
                result: r.result,
              }))}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* ════════ LE PAD DE JEU — SURFACE élargie en full-bleed (Alex 2026-06-11).
       *  -mx-[10px] casse la marge du parent (px-3 PlayPage + px-0.5) pour
       *  laisser ~4px de chaque bord d'écran ; px-[10px] re-inset le contenu
       *  pour que les LANES/cases/textes restent EXACTEMENT à leur taille et
       *  position (seule la surface noire grossit). w-full retiré car le
       *  stretch flex + marge négative gère la largeur. ════════ */}
      <div
        className="relative flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden
                   border border-emerald-900/40
                   shadow-[inset_0_0_36px_rgba(0,0,0,0.55)]
                   -mx-[6px] px-[6px]"
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

      <AugurFlash resolveStep={resolveStep} oppPreview={oppPreview} playerPreview={playerPreview} />

      <TauntBlockChip tauntBlock={tauntBlock} playerSide={playerSide} />

      <AntiTauntChip antiTaunt={antiTaunt} playerSide={playerSide} />

      {/* DÉFILÉ CROUPIER — toutes les cartes jouées de chaque côté arrivent
       *  face cachée, flip et glissent vers leur position de repos en cascade
       *  (Alex 2026-06-11). Remplace l'ancien BigCardReveal qui n'affichait
       *  que la première carte. Pendant le step reveal-opp uniquement. */}
      <AnimatePresence>
        {resolveStep === "reveal-opp" && oppPreview && oppPreview.spells.length > 0 && (
          <ArenaSpellsReveal
            key={"opp-" + oppPreview.spells.map((s) => s.id).join("|")}
            spells={oppPreview.spells}
            side="opp"
          />
        )}
        {resolveStep === "reveal-opp" && playerPreview && playerPreview.spells.length > 0 && (
          <ArenaSpellsReveal
            key={"you-" + playerPreview.spells.map((s) => s.id).join("|")}
            spells={playerPreview.spells}
            side="you"
          />
        )}
      </AnimatePresence>

      {/* Opp strip déplacé HORS du pad (tout en haut, voir début du return).
       *  Le pad ne contient plus que les lanes + center status. */}

      {/* Pad interne — étiré (Alex 2026-06-11) : padding horizontal réduit
       *  pour donner du large aux lanes, padding vertical court pour pousser
       *  le centre, gap entre les rangées augmenté → vraie "intimité" des 2
       *  camps avec un espace central généreux pour les chip queues combat. */}
      {/* py augmenté (Alex 2026-06-11) : pousse les 2 rangées de lanes vers le
       *  centre (~4-5px chacune) pour ne pas coller les bords du pad. */}
      {/* SECOUSSE D'IMPACT du board (Alex 2026-06-12 "combats trop mous") :
       *  via animation controls (PAS de key → pas de remount des lanes), le
       *  pad entier tremble brièvement au moment où le coup atterrit. */}
      <motion.div animate={padShake} className="relative z-[1] flex-1 min-h-0 flex flex-col justify-between py-[13px] px-1.5 sm:py-4 sm:px-2 gap-4 sm:gap-6 [@media(max-height:560px)]:py-1.5 [@media(max-height:560px)]:px-1 [@media(max-height:560px)]:gap-2">
        {/* É3 (audit UX) — filigrane de la Voie au centre du pad : habille le
         *  vide entre les rangées hors reveal. Ultra-subtil (5%), -z-10 pour
         *  rester DERRIÈRE lanes/status, pointer-events-none. */}
        {board[playerSide].affinity && (
          <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none" aria-hidden>
            <MoveGlyph move={board[playerSide].affinity!} className="w-28 h-28 sm:w-36 sm:h-36 opacity-[0.05]" />
          </div>
        )}
        {/* ✦ SIGNATURES FX plein-board (Genèse, Supernova…) — overlay z-40 sur
         *  toute la zone des lanes, joué au step SPELLS puis auto-démonté. */}
        <ArenaSpellFX fx={spellFX} />
        {/* Opponent lane row — ghost previews of opp summons during reveal.
         *  Slots become tappable when a spell targets OPP creatures (Curse,
         *  Sangsue, Trou Noir). */}
        <LaneRow
          lanes={board.lanes}
          renderSide={oppSide}
          intent={oppPreview ?? null}
          isPlayer={false}
          combatLane={combatLane}
          combatChargers={combatChargers}
          validLanes={[0, 1, 2].map((i) => isValidLaneTarget(targeting ?? null, oppSide, i as LaneIndex, laneShape, playerSide))}
          targetLabel={targetLabel}
          onLaneTap={onLaneTap ? (l) => onLaneTap(l, oppSide) : undefined}
          stickers={oppRowStickers}
          onRemoveSticker={onRemoveSpell}
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
        {/* Bande centrale = [⚗️ Forge adverse] [statut flex-1] [⚗️ TA Forge]
         *  (Alex 2026-06-13) — les flancs vides du pad deviennent les cases
         *  de fusion, visibles des deux camps (info warfare). */}
        <div className="shrink-0 flex items-center gap-1.5">
          <ForgeSlot card={forgeOpp} mine={false} />
          <div className="flex-1 min-w-0">
            <CenterStatus
              step={resolveStep ?? null}
              turn={board.turn}
              oppPreview={oppPreview}
              playerPreview={playerPreview}
            />
          </div>
          <ForgeSlot
            card={forgeYou}
            mine
            onTap={onForgeTap}
            highlight={forgeHighlight}
            flashKey={forgeFlashKey}
            recoverKey={forgeRecoverKey}
            forged={!!forgeYou && CARDS[forgeYou]?.kind === "fusion"}
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
          combatChargers={combatChargers}
          validLanes={[0, 1, 2].map((i) => isValidLaneTarget(targeting ?? null, playerSide, i as LaneIndex, laneShape, playerSide))}
          targetLabel={targetLabel}
          onLaneTap={onLaneTap ? (l) => onLaneTap(l, playerSide) : undefined}
          stickers={playerRowStickers}
          onRemoveSticker={onRemoveSpell}
          onRemoveSummon={onRemoveSummon}
          deflectingRockLane={tauntBlock?.defenderSide === playerSide ? tauntBlock.rockLane : null}
          deflectKey={tauntBlock?.defenderSide === playerSide ? tauntBlock.key : null}
          summoningMove={targeting?.kind === "summon"}
        />

        {/* Player strip déplacé HORS du pad (voir après la fermeture du pad). */}
      </motion.div>
      {/* ════════ FIN DU CONTENU INTERNE DU PAD ════════ */}
      </div>
      {/* ════════ FIN DU PAD (div avec backdrop BattlePad) ════════ */}

      {/* PLAYER HERO STRIP déplacé dans ArenaPlanPhase (juste au-dessus du
       *  picker) pour être à 1px des moves (Alex 2026-06-11). N'est plus ici. */}
    </div>
  );
}
