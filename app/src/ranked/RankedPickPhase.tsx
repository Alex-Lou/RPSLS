/**
 * RankedPickPhase — picking + card targeting UI.
 *
 * Augur targets OPPONENT lanes (top row). Aegis/Surge target YOUR lanes
 * (bottom row). Layout mirrors Constellation casual spacing.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { type Move } from "../engine/game";
import { useT } from "../i18n";
import { LanesBoard } from "./LanesBoard";
import { CardHand } from "./CardHand";
import { ManaBar } from "./ManaBar";
import { CARDS } from "./cards";
import type { CardId, LaneTarget, PlayedCard } from "./rankedTypes";
import { PickerBar, EffectChip, TimerBar } from "./RankedPickParts";

export interface RankedPickPhaseProps {
  youName: string;
  opponentName: string;
  picks: [Move | null, Move | null, Move | null];
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  cardPlayed: PlayedCard | null;
  mana: number;
  manaMax?: number;
  passives?: CardId[];
  /** Braise (Ember) stacks — mana discount on the next card played. The hand
   *  uses it to display effective cost + adjust the playable check. */
  braiseStacks?: number;
  /** Cross-round V3 effects gathered for the chip strip. Each truthy field
   *  renders one chip explaining the queued effect. */
  activeEffects?: {
    mascaradePoison: boolean;
    bonusManaNext: number;
    cascadeArmed: boolean;
    echoActive: boolean;
    anchorRoundsLeft: number;
    gaiaCharged: boolean;
  };
  compassRevealed?: { lane: LaneTarget | null; cardId?: CardId } | null;
  /** Oracle / Télépathie reveal — the opponent's 3 moves shown face-up on
   *  the opp row during pick phase. */
  oracleRevealed?: [Move, Move, Move] | null;
  /** Oracle Inverse reveal — 3 cards peeked from the opponent's notional hand,
   *  shown as a soft chip strip beside the passives during the pick phase. */
  oppHandRevealed?: CardId[] | null;
  hand: CardId[];
  oppHandSize: number;
  augurCooldown: number;
  startedAt: number;
  deadlineMs: number;
  showTimer?: boolean;
  onPickMove: (mv: Move) => void;
  onPlayCard: (card: PlayedCard) => void;
  onCancelCard: () => void;
  onClearLane: (lane: LaneTarget) => void;
  onLock: () => void;
  revealAugurFor: (lane: LaneTarget) => Move;
  /** Remonte la hauteur mesurée du board (BoardFillSlot) pour que la phase reveal
   *  réutilise EXACTEMENT la même taille → plateau stable d'une phase à l'autre. */
  onBoardMeasure?: (h: number) => void;
}

export function RankedPickPhase({
  youName, opponentName,
  picks, augurRevealed, cardPlayed, mana, manaMax = 4, passives = [], braiseStacks = 0, activeEffects, compassRevealed, oracleRevealed, oppHandRevealed,
  hand, oppHandSize, augurCooldown,
  startedAt, deadlineMs, showTimer = true,
  onPickMove, onPlayCard, onCancelCard, onClearLane, onLock,
  revealAugurFor,
}: RankedPickPhaseProps) {
  const t = useT();
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);

  const allFilled = picks.every((p) => p !== null);
  const remaining = 3 - picks.filter(Boolean).length;
  // ManaBar.spent must honor Braise discount so the displayed reserve matches
  // what the player will actually pay at lock-time.
  const reservedMana = cardPlayed ? Math.max(1, CARDS[cardPlayed.id].cost - braiseStacks) : 0;
  const isAugurTargeting = selectedCard === "augur";
  const isOracleTargeting = selectedCard === "oracle";
  // Carte à cibler sur TES lanes (aegis/surge/precision/anchor/…) → on surligne
  // TES 3 cases dans la couleur du thème pour montrer où la poser (Alex 2026-07).
  // Les cartes héros/self s'auto-jouent (jamais « sélectionnées ») → aucune lane
  // surlignée pour elles ⇒ le surlignage distingue carte-lane vs carte-héros.
  const isMyLaneTargeting = !!selectedCard && CARDS[selectedCard]?.target === "lane";

  function handleMyLaneTap(lane: LaneTarget) {
    if (selectedCard) {
      const card = CARDS[selectedCard];
      if (card.target === "lane") {
        onPlayCard({
          id: selectedCard as
            | "aegis" | "surge" | "precision" | "anchor" | "curse" | "tide"
            | "riposte" | "mirror" | "sangsue"
            | "remanence" | "echappee" | "crepuscule",
          lane,
        });
        setSelectedCard(null);
      }
      return;
    }
    if (picks[lane]) onClearLane(lane);
  }

  function handleOppLaneTap(lane: LaneTarget) {
    if (isAugurTargeting) {
      const revealed = revealAugurFor(lane);
      onPlayCard({ id: "augur", lane, revealed });
      setSelectedCard(null);
    }
  }

  function handleSelectCard(id: CardId | null) {
    if (cardPlayed) onCancelCard();
    const card = id ? CARDS[id] : null;
    // Cards with no lane target: activate immediately
    if (card && (card.target === "lane-reveal-all" || card.target === "lane-rotate" || card.target === "self" || card.target === "gamble" || card.target === "none")) {
      if (id === "oracle") {
        const r: [Move, Move, Move] = [revealAugurFor(0), revealAugurFor(1), revealAugurFor(2)];
        onPlayCard({ id: "oracle", revealed: r });
      } else if (id === "vortex") {
        onPlayCard({ id: "vortex" });
      } else if (id === "supernova") {
        onPlayCard({ id: "supernova" });
      } else if (id === "second-wind") {
        onPlayCard({ id: "second-wind" });
      } else if (id === "tide") {
        // Tide targets "self" but we store a dummy lane 0
        onPlayCard({ id: "tide", lane: 0 as LaneTarget });
      } else if (id === "gambit") {
        onPlayCard({ id: "gambit" });
      } else if (id) {
        // Bonus "none"-target actives — immediate, no lane tap. Lot 1:
        // prescience, mascarade, boussole, rempart, trou-noir, trinite.
        // V3: sablier, offre, braise, cascade, echo-temporel, ancre-temporelle,
        // metamorphose, marchand-ames, paradoxe, benediction, schrodinger,
        // juge, genese, fardeau, oracle-inverse, telepathie.
        onPlayCard({
          id: id as
            | "prescience" | "mascarade" | "boussole" | "rempart" | "trou-noir" | "trinite"
            | "sablier" | "offre" | "braise" | "cascade" | "echo-temporel"
            | "ancre-temporelle" | "metamorphose" | "marchand-ames"
            | "paradoxe" | "benediction" | "schrodinger" | "juge" | "genese"
            | "fardeau" | "oracle-inverse" | "telepathie",
        });
      }
      return;
    }
    setSelectedCard(id);
  }

  function handleLock() {
    if (!allFilled) return;
    if (selectedCard && !cardPlayed) setSelectedCard(null);
    onLock();
  }

  const targetingHint = (() => {
    if (!selectedCard) return null;
    const card = CARDS[selectedCard];
    if (card.target === "lane-reveal") return t("ranked.cta.augurReveal");
    return t("ranked.cta.playCard");
  })();

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-0.5 sm:gap-1 pb-0.5 sm:pb-1">
      {showTimer && <TimerBar startedAt={startedAt} durationMs={deadlineMs} />}

      {/* Targeting hint — rendered in a FIXED-height slot (always reserved)
          so selecting a card doesn't change the layout height and make the
          scale-to-fit wrapper bounce (shrink then grow). */}
      <div className="h-6 flex items-center justify-center shrink-0">
        <AnimatePresence>
          {targetingHint && (
            <motion.div
              key={targetingHint}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              className="text-[12px] sm:text-sm uppercase tracking-[0.18em] text-amber-300 font-bold flex items-center gap-2"
            >
              {targetingHint}
              <button
                onClick={() => setSelectedCard(null)}
                className="px-2 py-0.5 rounded-full bg-hairline hover:bg-hairline text-[11px] font-bold"
              >
                {t("ranked.cta.cancelCard")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Board — PLEINE LARGEUR, hauteur NATURELLE, JAMAIS rétréci. Plus de
          BoardFillSlot (son transform:scale rapetissait tout le pad + le centrait
          = les « marges géantes » qu'Alex voyait). Si trop haut sur petit écran,
          le conteneur scrolle (shrink-0 partout) au lieu de tout rapetisser. */}
      <LanesBoard
        youName={youName}
        opponentName={opponentName}
        picks={picks}
        oppPicks={null}
        augurRevealed={augurRevealed}
        oracleRevealed={oracleRevealed}
        myCard={cardPlayed}
        oppCard={null}
        mode="picking"
        oppHandSize={oppHandSize}
        compassPeek={compassRevealed}
        onLaneClick={handleMyLaneTap}
        onOppLaneClick={handleOppLaneTap}
        augurTargeting={isAugurTargeting || isOracleTargeting}
        myLaneTargeting={isMyLaneTargeting}
      />

      {/* Strip: Boussole reveal + passives + Oracle Inverse peek + Braise
          discount + cross-round V3 effects. Every chip is a compact pill so
          the ScaleToFit wrapper keeps the Lock button on-screen even with
          many active effects. */}
      {/* TOUJOURS monté, hauteur 1 ligne réservée + scroll horizontal : les chips
          qui apparaissent/changent ne re-mesurent plus le board → fin du rescale
          du pad entre les manches (le strip restait le dernier coupable). Les noms
          de carte sont tronqués pour borner la largeur de chaque chip. */}
      <div className="w-full max-w-md min-h-[0.5rem] shrink-0 flex items-center px-1">
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto w-full">
          {compassRevealed && (
            <span className="shrink-0 whitespace-nowrap text-[11px] font-bold rounded-full px-2 py-0.5 bg-sky-500/20 border border-sky-400/40 text-sky-200">
              {compassRevealed.cardId
                ? (compassRevealed.lane === null
                    ? t("ranked.compass.cardOnly", { name: t(CARDS[compassRevealed.cardId].nameKey) })
                    : t("ranked.compass.cardLane", { name: t(CARDS[compassRevealed.cardId].nameKey), n: compassRevealed.lane + 1 }))
                : (compassRevealed.lane === null
                    ? t("ranked.compass.none")
                    : t("ranked.compass.lane", { n: compassRevealed.lane + 1 }))}
            </span>
          )}
          {passives.map((id) => (
            <span
              key={id}
              className="shrink-0 max-w-[42vw] text-[11px] font-bold rounded-full px-2 py-0.5 bg-violet-500/15 border border-violet-400/30 text-violet-200 inline-flex items-center gap-1"
              title={t(CARDS[id].descKey)}
            >
              <span aria-hidden className="shrink-0">{CARDS[id].glyph}</span>
              <span className="truncate">{t(CARDS[id].nameKey)}</span>
            </span>
          ))}
          {oppHandRevealed && oppHandRevealed.map((id, i) => (
            <span
              key={`peek-${id}-${i}`}
              className="shrink-0 max-w-[42vw] text-[11px] font-bold rounded-full px-2 py-0.5 bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-200 inline-flex items-center gap-1"
              title={t(CARDS[id].descKey)}
            >
              <span aria-hidden className="shrink-0">🔮 {CARDS[id].glyph}</span>
              <span className="truncate">{t(CARDS[id].nameKey)}</span>
            </span>
          ))}
          {braiseStacks > 0 && (
            <EffectChip icon="🔥" tone="ember" label={t("ranked.effect.braise", { n: braiseStacks })} />
          )}
          {activeEffects?.bonusManaNext ? (
            <EffectChip icon="⏱️" tone="sand" label={t("ranked.effect.bonusMana", { n: activeEffects.bonusManaNext })} />
          ) : null}
          {activeEffects?.mascaradePoison && (
            <EffectChip icon="🎭" tone="indigo" label={t("ranked.effect.mascarade")} />
          )}
          {activeEffects?.cascadeArmed && (
            <EffectChip icon="💧" tone="sky" label={t("ranked.effect.cascade")} />
          )}
          {activeEffects?.echoActive && (
            <EffectChip icon="🕐" tone="violet" label={t("ranked.effect.echo")} />
          )}
          {activeEffects && activeEffects.anchorRoundsLeft > 0 && (
            <EffectChip icon="⚓" tone="cyan" label={t("ranked.effect.anchor", { n: activeEffects.anchorRoundsLeft })} />
          )}
          {activeEffects?.gaiaCharged && (
            <EffectChip icon="🛡️" tone="emerald" label={t("ranked.effect.gaia")} />
          )}
        </div>
      </div>

      {/* Mana + your fanned hand — bottom-of-board zone, near the move
          picker so cards and moves are reachable by the same thumb. */}
      <div className="w-full max-w-md flex items-center gap-2 px-1">
        <ManaBar mana={mana} max={manaMax} spent={reservedMana} />
        <div className="flex-1 min-w-0">
          <CardHand
            hand={hand}
            mana={mana}
            braiseStacks={braiseStacks}
            selected={selectedCard}
            playedId={cardPlayed?.id ?? null}
            onSelect={handleSelectCard}
            disabled={false}
            augurCooldown={augurCooldown}
          />
        </div>
      </div>

      {/* Moves + Lock — bottom zone */}
      <PickerBar onPickInNextEmpty={onPickMove} />

      <button
        onClick={handleLock}
        disabled={!allFilled}
        aria-label={allFilled ? t("lanes.lockButton") : t("lanes.pickRemaining", { n: remaining })}
        className={
          "shrink-0 mt-1.5 sm:mt-2 px-7 py-2 rounded-2xl font-bold text-white text-sm transition " +
          (allFilled
            ? "shadow-lg hover:scale-[1.02]"
            : "bg-hairline text-ink-faint cursor-not-allowed")
        }
        // Theme-driven gradient: reads the active theme's CSS vars instead
        // of hardcoded violet/fuchsia/teal so the Lock button blends with
        // the player's chosen palette (Casino gold, Cyberpunk neon, etc.)
        // rather than sticking out as a fixed cosmic look.
        style={
          allFilled
            ? {
                background:
                  "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
                boxShadow: "0 8px 24px -8px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
                fontFamily: "var(--font-headline)",
                letterSpacing: "0.06em",
              }
            : undefined
        }
      >
        {allFilled ? t("lanes.lockButton") : t("lanes.pickRemaining", { n: remaining })}
      </button>
    </div>
  );
}
