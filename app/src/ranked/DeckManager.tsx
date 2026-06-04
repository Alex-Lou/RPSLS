/**
 * DeckManager — full-page deck editor.
 *
 * Shows all unlocked cards. Player taps a card to select, then taps a
 * slot (main or reserve) to place it. 3 main + 3 reserve = 6 total.
 * Locked cards are greyed with unlock hint.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../store";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR } from "./cards";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";
import { useT } from "../i18n";

const MAIN_SLOTS = 3;
const RESERVE_SLOTS = 3;
const TOTAL = MAIN_SLOTS + RESERVE_SLOTS;

/** Cards unlocked by default (commons + first rares). Others need achievements. */
const STARTER_CARDS: CardId[] = ["aegis", "precision", "anchor", "second-wind", "surge", "augur"];

const UNLOCK_HINTS: Partial<Record<CardId, string>> = {
  riposte: "Gagne 5 matchs en mode classé",
  curse: "Gagne 10 matchs en mode classé",
  heist: "Atteins le rang Silver",
  tide: "Gagne un tournoi",
  oracle: "Atteins le rang Gold",
  vortex: "Fais 3 sweeps (3-0) en mode classé",
  supernova: "Atteins le rang Platinum",
};

export function DeckManager({ onClose }: { onClose: () => void }) {
  const t = useT();
  const player = useStore((s) => s.player);
  const setRankedDeck = useStore((s) => s.setRankedDeck);
  const collection = player.cardCollection ?? STARTER_CARDS;
  const [deck, setDeck] = useState<(CardId | null)[]>(() => {
    const saved = player.rankedDeck ?? [];
    const padded = [...saved];
    while (padded.length < TOTAL) padded.push(null as unknown as string);
    return padded.slice(0, TOTAL) as (CardId | null)[];
  });
  const [selected, setSelected] = useState<CardId | null>(null);

  const mainSlots = deck.slice(0, MAIN_SLOTS) as (CardId | null)[];
  const reserveSlots = deck.slice(MAIN_SLOTS, TOTAL) as (CardId | null)[];

  function handleCardTap(id: CardId) {
    if (!collection.includes(id)) return;
    setSelected(selected === id ? null : id);
  }

  function handleSlotTap(slotIdx: number) {
    if (!selected) {
      // Clear the slot
      const next = [...deck];
      next[slotIdx] = null;
      setDeck(next);
      return;
    }
    // Check if card is already in another slot → swap
    const existingIdx = deck.indexOf(selected);
    const next = [...deck];
    if (existingIdx >= 0) next[existingIdx] = deck[slotIdx]; // swap
    next[slotIdx] = selected;
    setDeck(next);
    setSelected(null);
  }

  function handleSave() {
    const validDeck = deck.filter((c): c is CardId => c !== null);
    setRankedDeck(validDeck);
    onClose();
  }

  const usedInDeck = new Set(deck.filter(Boolean));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex flex-col gap-4 flex-1 py-2 px-2 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-themed">
          Mon Deck
        </h1>
        <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl px-2">✕</button>
      </div>

      {/* Main hand */}
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-400 mb-2">
          Main ({mainSlots.filter(Boolean).length}/{MAIN_SLOTS})
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {mainSlots.map((cardId, i) => (
            <DeckSlot key={`main-${i}`} cardId={cardId} slotLabel={`${i + 1}`}
              onClick={() => handleSlotTap(i)} highlight={!!selected} />
          ))}
        </div>
      </div>

      {/* Reserve */}
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-amber-400 mb-2">
          Réserve ({reserveSlots.filter(Boolean).length}/{RESERVE_SLOTS})
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {reserveSlots.map((cardId, i) => (
            <DeckSlot key={`res-${i}`} cardId={cardId} slotLabel={`R${i + 1}`}
              onClick={() => handleSlotTap(MAIN_SLOTS + i)} highlight={!!selected} />
          ))}
        </div>
      </div>

      {/* Collection */}
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-zinc-400 mb-2">
          Collection
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {ALL_CARD_IDS.map((id) => {
            const card = CARDS[id];
            const unlocked = collection.includes(id);
            const inDeck = usedInDeck.has(id);
            const isSelected = selected === id;
            return (
              <motion.button
                key={id}
                onClick={() => handleCardTap(id)}
                whileTap={unlocked ? { scale: 0.92 } : undefined}
                className={
                  "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center transition " +
                  (isSelected
                    ? "ring-2 ring-white shadow-lg shadow-white/30 scale-105"
                    : inDeck
                    ? "ring-2 ring-emerald-400/50 opacity-60"
                    : unlocked
                    ? "ring-1 ring-white/20"
                    : "ring-1 ring-white/5 grayscale opacity-30")
                }
              >
                <CardImage id={id} glyphSize="text-xl" />
                <div className="relative z-10 flex flex-col items-center gap-0.5 p-1">
                  <span className="text-xl">{card.glyph}</span>
                  <span className="text-[7px] font-bold uppercase text-white/90 text-center leading-tight">
                    {t(card.nameKey)}
                  </span>
                  <span className={"text-[7px] font-bold " + RARITY_COLOR[card.rarity]}>
                    {card.cost}m · {card.rarity}
                  </span>
                </div>
                {!unlocked && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-1 z-20">
                    <span className="text-[8px] text-zinc-400 text-center leading-tight">
                      🔒 {UNLOCK_HINTS[id] ?? "Bientôt"}
                    </span>
                  </div>
                )}
                {inDeck && !isSelected && (
                  <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 flex items-center justify-center z-20">
                    <span className="text-[7px] text-zinc-900 font-black">✓</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        className="w-full py-3 rounded-2xl font-bold text-white bg-themed shadow-lg transition"
      >
        Sauvegarder le deck
      </motion.button>
    </motion.div>
  );
}

function DeckSlot({
  cardId, slotLabel, onClick, highlight,
}: {
  cardId: CardId | null;
  slotLabel: string;
  onClick: () => void;
  highlight: boolean;
}) {
  const t = useT();
  if (!cardId) {
    return (
      <button
        onClick={onClick}
        className={
          "aspect-[3/4] rounded-xl border-2 border-dashed flex items-center justify-center transition " +
          (highlight
            ? "border-white/40 bg-white/10 animate-pulse"
            : "border-white/10 bg-black/20")
        }
      >
        <span className="text-[10px] text-zinc-600 font-bold">{slotLabel}</span>
      </button>
    );
  }
  const card = CARDS[cardId];
  return (
    <button
      onClick={onClick}
      className="relative aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-white/20 bg-zinc-950"
    >
      <CardImage id={cardId} glyphSize="text-2xl" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 z-10">
        <div className="text-[7px] font-bold uppercase text-center text-white/90">{t(card.nameKey)}</div>
      </div>
    </button>
  );
}
