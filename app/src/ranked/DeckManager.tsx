/**
 * DeckManager — deck editor + boutique.
 *
 * Two tabs:
 * - "Deck" — pick which cards go in the main hand vs reserve. Tap a card
 *   to select, tap a slot to place it. Locked cards stay greyed.
 * - "Boutique" — spend éclats on a pack of {@link PACK_SIZE} cards (with a
 *   reveal animation that highlights new finds vs duplicate-to-dust trades),
 *   or spend poussière to craft a specific locked card.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR, RARITY_BG } from "./cards";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";
import { useT } from "../i18n";
import { useNoMenuFx } from "../fx/menuFx";
import {
  PACK_COST,
  type PackResult,
  craftCost,
} from "../engine/economy";
import { hapticTap, hapticMatchWin } from "../haptic";

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
};

type Tab = "deck" | "shop";

export function DeckManager({ onClose }: { onClose: () => void }) {
  useNoMenuFx(); // deck editor → no menu touch particles
  const t = useT();
  const player = useStore((s) => s.player);
  const setRankedDeck = useStore((s) => s.setRankedDeck);
  const openPack = useStore((s) => s.openPack);
  const craftCard = useStore((s) => s.craftCard);
  const collection = player.cardCollection ?? STARTER_CARDS;
  const eclats = player.eclats ?? 0;
  const dust = player.dust ?? 0;
  const [tab, setTab] = useState<Tab>("deck");
  const [deck, setDeck] = useState<(CardId | null)[]>(() => {
    const saved = player.rankedDeck ?? [];
    const padded = [...saved];
    while (padded.length < TOTAL) padded.push(null as unknown as string);
    return padded.slice(0, TOTAL) as (CardId | null)[];
  });
  const [selected, setSelected] = useState<CardId | null>(null);
  const [packResult, setPackResult] = useState<PackResult | null>(null);

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

  function handleOpenPack() {
    hapticTap();
    const r = openPack();
    if (!r) return;
    hapticMatchWin();
    setPackResult(r);
  }

  function handleCraft(id: CardId) {
    hapticTap();
    const ok = craftCard(id);
    if (ok) hapticMatchWin();
  }

  const usedInDeck = new Set(deck.filter(Boolean));
  const lockedCards = ALL_CARD_IDS.filter((id) => !collection.includes(id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex flex-col gap-4 flex-1 py-2 px-2 max-w-lg mx-auto w-full overflow-y-auto"
    >
      {/* Header — title + close, plus the currency badges that surface the
          player's wallet at a glance no matter which tab is up. */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-themed">Mes cartes</h1>
        <button onClick={onClose} className="text-ink-muted hover:text-white text-xl px-2">✕</button>
      </div>

      <div className="flex items-center gap-2">
        <CurrencyBadge icon="💎" value={eclats} label="Éclats" tone="cyan" />
        <CurrencyBadge icon="✨" value={dust} label="Poussière" tone="violet" />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface border border-hairline">
        <TabButton on={tab === "deck"} onClick={() => setTab("deck")}>Deck</TabButton>
        <TabButton on={tab === "shop"} onClick={() => setTab("shop")}>Boutique</TabButton>
      </div>

      {tab === "deck" && (
        <>
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
            <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted mb-2">
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
          </div>

          {/* Save */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            className="w-full py-3 rounded-2xl font-bold text-white bg-themed shadow-lg transition"
          >
            Sauvegarder le deck
          </motion.button>
        </>
      )}

      {tab === "shop" && (
        <ShopView
          eclats={eclats}
          dust={dust}
          lockedCards={lockedCards}
          onOpenPack={handleOpenPack}
          onCraft={handleCraft}
        />
      )}

      <AnimatePresence>
        {packResult && (
          <PackOpeningModal
            result={packResult}
            onClose={() => setPackResult(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────── Currency badge ─────────── */

function CurrencyBadge({
  icon, value, label, tone,
}: {
  icon: string;
  value: number;
  label: string;
  tone: "cyan" | "violet";
}) {
  const ring = tone === "cyan" ? "ring-cyan-400/40" : "ring-violet-400/40";
  const text = tone === "cyan" ? "text-cyan-300" : "text-violet-300";
  return (
    <div className={"flex-1 rounded-xl bg-surface border border-hairline ring-1 px-3 py-2 flex items-center gap-2 " + ring}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-ink-faint font-bold leading-none">{label}</div>
        <div className={"text-base font-black tabular-nums leading-tight " + text}>{value.toLocaleString("fr-FR")}</div>
      </div>
    </div>
  );
}

/* ─────────── Tab pill ─────────── */

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "py-2 rounded-xl text-sm font-bold transition " +
        (on ? "bg-themed text-white shadow" : "text-ink-muted hover:text-white")
      }
    >
      {children}
    </button>
  );
}

/* ─────────── Boutique tab ─────────── */

function ShopView({
  eclats, dust, lockedCards, onOpenPack, onCraft,
}: {
  eclats: number;
  dust: number;
  lockedCards: CardId[];
  onOpenPack: () => void;
  onCraft: (id: CardId) => void;
}) {
  const t = useT();
  const canBuyPack = eclats >= PACK_COST;
  return (
    <div className="flex flex-col gap-4">
      {/* Pack */}
      <div className="rounded-2xl p-4 bg-surface-raised border border-hairline">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎁</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base">Pack à 3 cartes</div>
            <div className="text-[11px] text-ink-muted leading-snug">
              Tirage aléatoire (60 % commune · 30 % rare · 9 % épique · 1 % légendaire).
              Doublons → poussière.
            </div>
          </div>
        </div>
        <motion.button
          whileTap={canBuyPack ? { scale: 0.97 } : undefined}
          onClick={canBuyPack ? onOpenPack : undefined}
          disabled={!canBuyPack}
          className={
            "w-full py-3 rounded-2xl font-bold text-white shadow-lg transition " +
            (canBuyPack ? "bg-themed hover:scale-[1.01]" : "bg-hairline text-ink-faint cursor-not-allowed")
          }
        >
          {canBuyPack ? `Ouvrir · ${PACK_COST} 💎` : `Il manque ${(PACK_COST - eclats).toLocaleString("fr-FR")} 💎`}
        </motion.button>
      </div>

      {/* Craft */}
      <div className="rounded-2xl p-4 bg-surface-raised border border-hairline">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">⚒️</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base">Forger une carte</div>
            <div className="text-[11px] text-ink-muted leading-snug">
              Choisis une carte verrouillée et paie en poussière pour l'ajouter à ta collection.
            </div>
          </div>
        </div>
        {lockedCards.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-4">
            🎉 Toutes les cartes sont déjà dans ta collection.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {lockedCards.map((id) => {
              const card = CARDS[id];
              const cost = craftCost(id);
              const canCraft = dust >= cost;
              return (
                <div
                  key={id}
                  className={
                    "flex items-center gap-3 rounded-xl p-2 border " +
                    (canCraft ? "border-violet-400/30 bg-violet-500/5" : "border-hairline bg-hairline")
                  }
                >
                  <div className={"w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br " + RARITY_BG[card.rarity]}>
                    <span className="text-2xl">{card.glyph}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{t(card.nameKey)}</div>
                    <div className={"text-[10px] uppercase tracking-wider font-bold " + RARITY_COLOR[card.rarity]}>
                      {card.rarity} · {card.cost} mana
                    </div>
                  </div>
                  <motion.button
                    whileTap={canCraft ? { scale: 0.94 } : undefined}
                    onClick={canCraft ? () => onCraft(id) : undefined}
                    disabled={!canCraft}
                    className={
                      "px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition " +
                      (canCraft
                        ? "bg-violet-500/30 text-violet-100 border border-violet-400/50 hover:bg-violet-500/45"
                        : "bg-hairline text-ink-faint border border-hairline cursor-not-allowed")
                    }
                  >
                    {cost} ✨
                  </motion.button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Pack opening modal ─────────── */

function PackOpeningModal({
  result, onClose,
}: {
  result: PackResult;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 5 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-raised border border-hairline rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="text-center">
          <div className="text-3xl mb-1">🎉</div>
          <h2 className="text-lg font-black bg-gradient-to-br from-amber-300 to-orange-400 bg-clip-text text-transparent">
            Pack ouvert
          </h2>
          {result.dustGained > 0 && (
            <p className="text-[11px] text-violet-300 mt-1 font-bold">
              + {result.dustGained} ✨ (doublons convertis en poussière)
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {result.cards.map((id, i) => {
            const card = CARDS[id];
            const isNew = result.isNew[i];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.6, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.18, type: "spring", stiffness: 220, damping: 18 }}
                className={
                  "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center " +
                  (isNew ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-400/40" : "ring-1 ring-white/20")
                }
              >
                <CardImage id={id} glyphSize="text-2xl" />
                <div className="relative z-10 flex flex-col items-center gap-0.5 p-1">
                  <span className="text-2xl">{card.glyph}</span>
                  <span className="text-[8px] font-bold uppercase text-white/90 text-center leading-tight">
                    {t(card.nameKey)}
                  </span>
                  <span className={"text-[8px] font-bold " + RARITY_COLOR[card.rarity]}>
                    {card.rarity}
                  </span>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.18 }}
                  className="absolute top-1 right-1 z-20"
                >
                  {isNew ? (
                    <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-400 text-zinc-900 px-1.5 py-0.5 rounded-full">
                      NEW
                    </span>
                  ) : (
                    <span className="text-[8px] font-black uppercase tracking-wider bg-violet-400/90 text-zinc-900 px-1.5 py-0.5 rounded-full">
                      +{({
                        common: 5, rare: 15, epic: 40, legendary: 100,
                      } as Record<string, number>)[card.rarity]} ✨
                    </span>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-bold text-white bg-themed shadow-lg"
        >
          Terminer
        </motion.button>
      </motion.div>
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
