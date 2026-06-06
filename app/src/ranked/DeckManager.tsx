/**
 * DeckManager — full-page deck editor.
 *
 * Surfaces the player's wallet at the top (read-only — the boutique lives
 * on its own ShopPage now, reachable from the burger or from any profile
 * surface's currency chip). Below: main hand (3) + reserve (3) + the full
 * collection. Locked cards stay greyed with a hint.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR } from "./cards";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";
import { useT } from "../i18n";
import { useNoMenuFx } from "../fx/menuFx";
import { CurrencyBadges } from "./CurrencyBadges";
import { hapticTap } from "../haptic";

const MAIN_SLOTS = 3;
const RESERVE_SLOTS = 3;
const TOTAL = MAIN_SLOTS + RESERVE_SLOTS;

/** Cards unlocked by default (commons + first rares). Others need achievements. */
const STARTER_CARDS: CardId[] = ["aegis", "precision", "anchor", "second-wind", "surge", "augur"];

const UNLOCK_HINTS: Partial<Record<CardId, string>> = {
  mirror: "Gagne 3 matchs en mode classé",
  riposte: "Gagne 5 matchs en mode classé",
  curse: "Gagne 10 matchs en mode classé",
  gambit: "Atteins 1200 LP",
  heist: "Atteins le rang Silver",
  tide: "Gagne un tournoi",
  oracle: "Atteins le rang Gold",
  vortex: "Fais 3 sweeps (3-0) en mode classé",
  supernova: "Atteins le rang Platinum",
  // Bonus cards — obtained through the boutique (packs / forge).
  prescience: "Ouvre des packs à la boutique",
  cadence: "Ouvre des packs à la boutique",
  mascarade: "Ouvre des packs à la boutique",
  boussole: "Ouvre des packs à la boutique",
  sangsue: "Ouvre des packs ou forge-la",
  rempart: "Ouvre des packs ou forge-la",
  pillage: "Ouvre des packs ou forge-la",
  "trou-noir": "Ouvre des packs ou forge-la",
  prophetie: "Ouvre des packs ou forge-la",
  conduit: "Ouvre des packs ou forge-la",
  trinite: "Pack rare ou forge légendaire",
};

export function DeckManager({ onClose }: { onClose: () => void }) {
  useNoMenuFx(); // deck editor → no menu touch particles
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
  const [collectionOpen, setCollectionOpen] = useState(true);

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

  const ownedCount = ALL_CARD_IDS.filter((id) => collection.includes(id)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      // Root no longer scrolls: a fixed header + a scroll region + a docked
      // Save footer means the Save button is ALWAYS visible (the player no
      // longer has to discover a hidden scroll to find it).
      className="flex flex-col flex-1 min-h-0 py-2 px-2 max-w-lg mx-auto w-full"
    >
      {/* Header — title + close, plus the read-only wallet so the player
          always knows what they have without leaving the editor. */}
      <div className="shrink-0 flex items-center justify-between gap-3 pb-3">
        <h1 className="text-xl font-extrabold text-themed">Mon Deck</h1>
        <div className="flex items-center gap-2">
          <CurrencyBadges inert />
          <button onClick={onClose} className="text-ink-muted hover:text-white text-xl px-2">✕</button>
        </div>
      </div>

      {/* Scroll region — only this middle band scrolls. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-1">
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

        {/* Collection — collapsible. Tap the header to fold/unfold; the count
            badge + chevron make the affordance obvious, and folding it shrinks
            a long card list so the deck slots stay the focus. */}
        <div>
          <button
            onClick={() => { hapticTap(); setCollectionOpen((o) => !o); }}
            className="w-full flex items-center justify-between gap-2 mb-2 group"
          >
            <span className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
                Collection
              </span>
              <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full bg-hairline text-ink-muted">
                {ownedCount}/{ALL_CARD_IDS.length}
              </span>
            </span>
            <span className={"text-ink-faint text-xs transition-transform duration-200 " + (collectionOpen ? "rotate-180" : "")}>▾</span>
          </button>
          <AnimatePresence initial={false}>
            {collectionOpen && (
              <motion.div
                key="collection-grid"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-4 gap-2 pt-0.5">
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
                            <span className="text-[8px] text-ink-muted text-center leading-tight">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Docked Save footer — always visible, never hidden below the fold.
          A faint top border + raised surface read it as a fixed action bar. */}
      <div className="shrink-0 pt-3 mt-1 border-t border-hairline">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="w-full py-3 rounded-2xl font-bold text-white bg-themed shadow-lg transition"
        >
          Sauvegarder le deck
        </motion.button>
      </div>
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
            ? "border-white/40 bg-hairline animate-pulse"
            : "border-hairline bg-black/20")
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
      className="relative aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-white/20 bg-surface-raised"
    >
      <CardImage id={cardId} glyphSize="text-2xl" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 z-10">
        <div className="text-[7px] font-bold uppercase text-center text-white/90">{t(card.nameKey)}</div>
      </div>
    </button>
  );
}
