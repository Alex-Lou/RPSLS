/**
 * RankedPickPhase — picking + card targeting UI.
 *
 * Augur targets OPPONENT lanes (top row). Aegis/Surge target YOUR lanes
 * (bottom row). Layout mirrors Constellation casual spacing.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MOVES, type Move } from "../engine/game";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../icons";
import { hapticAlert, hapticTap } from "../haptic";
import { hapticTick, PickShock } from "../match/sharedMatchUI";
import { useT } from "../i18n";
import { LanesBoard } from "./LanesBoard";
import { BoardFillSlot } from "../arena/ArenaGame/BoardFillSlot";
import { CardHand } from "./CardHand";
import { ManaBar } from "./ManaBar";
import { CARDS } from "./cards";
import type { CardId, LaneTarget, PlayedCard } from "./rankedTypes";

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
    <div className="w-full flex-1 min-h-0 flex flex-col items-center gap-1.5 sm:gap-3 pb-2 sm:pb-3">
      {showTimer && <TimerBar startedAt={startedAt} durationMs={deadlineMs} />}

      {/* Targeting hint — rendered in a FIXED-height slot (always reserved)
          so selecting a card doesn't change the layout height and make the
          scale-to-fit wrapper bounce (shrink then grow). */}
      <div className="h-7 flex items-center justify-center shrink-0">
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

      {/* Board — figé par BoardFillSlot : il mesure la hauteur dispo et la pose
          en px sur le board (cadre fixe comme en Pro). Le board est DANS le slot
          mesuré ; le mobilier (chips/mana/main/picker/Lock) reste DEHORS, en
          siblings sous lui → leur apparition/disparition ne re-scale plus tout
          l'écran (fix du pad qui « paniquait »). */}
      <BoardFillSlot>
        {(slotH) => (
          <LanesBoard
            fillHeight={slotH}
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
          />
        )}
      </BoardFillSlot>

      {/* Strip: Boussole reveal + passives + Oracle Inverse peek + Braise
          discount + cross-round V3 effects. Every chip is a compact pill so
          the ScaleToFit wrapper keeps the Lock button on-screen even with
          many active effects. */}
      {(compassRevealed || passives.length > 0
        || (oppHandRevealed && oppHandRevealed.length > 0)
        || braiseStacks > 0
        || (activeEffects && (
          activeEffects.mascaradePoison || activeEffects.bonusManaNext > 0 ||
          activeEffects.cascadeArmed || activeEffects.echoActive ||
          activeEffects.anchorRoundsLeft > 0 || activeEffects.gaiaCharged
        ))
      ) && (
        <div className="w-full max-w-md flex flex-wrap items-center justify-center gap-1.5 px-1">
          {compassRevealed && (
            <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-sky-500/20 border border-sky-400/40 text-sky-200">
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
              className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-violet-500/15 border border-violet-400/30 text-violet-200 inline-flex items-center gap-1"
              title={t(CARDS[id].descKey)}
            >
              <span aria-hidden>{CARDS[id].glyph}</span>
              {t(CARDS[id].nameKey)}
            </span>
          ))}
          {oppHandRevealed && oppHandRevealed.map((id, i) => (
            <span
              key={`peek-${id}-${i}`}
              className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-200 inline-flex items-center gap-1"
              title={t(CARDS[id].descKey)}
            >
              <span aria-hidden>🔮 {CARDS[id].glyph}</span>
              {t(CARDS[id].nameKey)}
            </span>
          ))}
          {braiseStacks > 0 && (
            <EffectChip icon="🔥" tone="ember" label={`Braise −${braiseStacks} mana sur la prochaine carte`} />
          )}
          {activeEffects?.bonusManaNext ? (
            <EffectChip icon="⏱️" tone="sand" label={`+${activeEffects.bonusManaNext} mana au prochain round`} />
          ) : null}
          {activeEffects?.mascaradePoison && (
            <EffectChip icon="🎭" tone="indigo" label="Désinformation armée — l'IA jouera à l'aveugle" />
          )}
          {activeEffects?.cascadeArmed && (
            <EffectChip icon="💧" tone="sky" label="Cascade armée — win = main pleine, lose = main vide" />
          )}
          {activeEffects?.echoActive && (
            <EffectChip icon="🕐" tone="violet" label="Écho actif — défaite annulée + carte refundée" />
          )}
          {activeEffects && activeEffects.anchorRoundsLeft > 0 && (
            <EffectChip icon="⚓" tone="cyan" label={`Ancre ${activeEffects.anchorRoundsLeft}/2 rounds restants`} />
          )}
          {activeEffects?.gaiaCharged && (
            <EffectChip icon="🛡️" tone="emerald" label="Bouclier de Gaïa chargé — 1 défaite absorbée" />
          )}
        </div>
      )}

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
          "shrink-0 mt-1 sm:mt-2 px-7 py-2.5 rounded-2xl font-bold text-white text-sm transition " +
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

function PickerBar({ onPickInNextEmpty }: { onPickInNextEmpty: (m: Move) => void }) {
  const t = useT();
  const [shockMove, setShockMove] = useState<Move | null>(null);
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md" role="group" aria-label="Move picker">
      {MOVES.map((mv, i) => {
        const pal = MOVE_PALETTE[mv];
        return (
          <motion.button
            key={mv}
            onClick={() => {
              hapticTick();
              setShockMove(mv);
              setTimeout(() => setShockMove((cur) => (cur === mv ? null : cur)), 450);
              onPickInNextEmpty(mv);
            }}
            aria-label={`Pick ${t("element." + mv)}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.86 }}
            className="relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 text-white transition"
            // Dark glass surface so the white-silhouette PNG glyph reads
            // unambiguously on every theme. The per-move identity comes
            // from the rim + glow, which now blend ~45% toward the active
            // theme accent (moveRim/moveGlow) so the frames harmonise with
            // the chosen background while each move stays recognisable.
            style={{
              background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
              border: `2px solid ${moveRim(pal.hex)}`,
              boxShadow: `0 0 12px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <PickShock show={shockMove === mv} />
            <MoveGlyph move={mv} className="w-12 h-12 sm:w-14 sm:h-14" />
            <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold leading-none" style={{ color: moveRim(pal.hex) }}>{mv}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Cross-round effect chip — one consistent visual style for every "pending"
 *  effect (Braise discount, Sablier/Offre bonus mana, Cascade armed, Écho
 *  stop-loss, Ancre watch, Mascarade poison, Gaïa shield charged). Tone =
 *  the card's signature palette so each effect reads by colour at a glance. */
type EffectTone = "ember" | "sand" | "sky" | "cyan" | "violet" | "emerald" | "indigo";
const EFFECT_PALETTE: Record<EffectTone, string> = {
  ember:   "bg-orange-500/20 border-orange-400/50 text-orange-100",
  sand:    "bg-amber-500/20 border-amber-400/50 text-amber-100",
  sky:     "bg-sky-500/20 border-sky-400/50 text-sky-100",
  cyan:    "bg-cyan-500/20 border-cyan-400/50 text-cyan-100",
  violet:  "bg-violet-500/20 border-violet-400/50 text-violet-100",
  emerald: "bg-emerald-500/20 border-emerald-400/50 text-emerald-100",
  indigo:  "bg-indigo-500/20 border-indigo-400/50 text-indigo-100",
};
function EffectChip({
  icon, tone, label,
}: {
  icon: string;
  tone: EffectTone;
  label: string;
}) {
  return (
    <span
      className={
        "text-[11px] font-bold rounded-full px-2 py-0.5 border inline-flex items-center gap-1 " +
        EFFECT_PALETTE[tone]
      }
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function TimerBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  const prevLevel = useRef<"calm" | "urgent" | "critical">("calm");
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!id) id = setInterval(() => setNow(Date.now()), 250); };
    const stop = () => { if (id) { clearInterval(id); id = undefined; } };
    const onVis = () => { if (document.hidden) stop(); else { setNow(Date.now()); start(); } };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remaining / durationMs));
  const urgent = remaining < 3000 && remaining > 0;
  const critical = remaining < 1000 && remaining > 0;
  const level: "calm" | "urgent" | "critical" = critical ? "critical" : urgent ? "urgent" : "calm";
  useEffect(() => {
    if (level !== prevLevel.current) {
      if (level === "urgent") hapticTap();
      if (level === "critical") hapticAlert();
      prevLevel.current = level;
    }
  }, [level]);
  const color = critical ? "bg-rose-500" : urgent ? "bg-amber-400" : "bg-themed";
  const num = Math.ceil(remaining / 1000);
  return (
    <div className="w-full max-w-md flex items-center gap-3">
      <motion.span
        key={num}
        initial={{ scale: critical ? 1.4 : 1 }}
        animate={{ scale: 1 }}
        className={"text-lg sm:text-xl font-mono tabular-nums w-14 text-right font-extrabold " +
          (critical ? "text-rose-300" : urgent ? "text-amber-300" : "text-ink")}
      >{num}s</motion.span>
      <div className="flex-1 h-2.5 rounded-full bg-hairline overflow-hidden">
        <motion.div
          className={"h-full " + color}
          animate={{ width: `${(progress * 100).toFixed(1)}%`, opacity: critical ? [0.5, 1, 0.5] : 1 }}
          transition={{ width: { duration: 0.1, ease: "linear" }, opacity: critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.1 } }}
        />
      </div>
      {urgent && !critical && (
        <span className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-amber-300/90 font-bold">{tr("lanes.hurry")}</span>
      )}
    </div>
  );
}
