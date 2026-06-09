/**
 * DeckManager — full-page deck editor.
 *
 * Surfaces the player's wallet at the top (read-only — the boutique lives
 * on its own ShopPage now, reachable from the burger or from any profile
 * surface's currency chip). Below: main hand (3) + reserve (3) + the full
 * collection. Locked cards stay greyed with a hint.
 */

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { ALL_CARD_IDS, CARDS, isPassiveCard, RARITY_COLOR, RARITY_ORDER } from "./cards";
import { CardImage } from "./CardImage";
import { masteryLevel, MASTERY_MAX_LEVEL } from "../engine/economy";
import type { CardId, CardRarity } from "./rankedTypes";
import { useT } from "../i18n";
import { useNoMenuFx } from "../fx/menuFx";
import { CurrencyBadges } from "./CurrencyBadges";
import { hapticTap } from "../haptic";

const MAIN_SLOTS = 3;
const RESERVE_SLOTS = 3;
const TOTAL = MAIN_SLOTS + RESERVE_SLOTS;

/** Compact French labels per rarity for the filter tabs. */
const RARITY_FR: Record<CardRarity, string> = {
  common: "Communes",
  rare: "Rares",
  epic: "Épiques",
  legendary: "Légendaires",
};

/** Dot color per rarity — used in tab pills and section dividers. */
const RARITY_DOT: Record<CardRarity, string> = {
  common: "bg-zinc-400",
  rare: "bg-blue-400",
  epic: "bg-violet-400",
  legendary: "bg-amber-400",
};

/** Tab pill ring color when ACTIVE (mirrors RARITY_DOT). */
const RARITY_RING: Record<CardRarity, string> = {
  common: "ring-zinc-400/60 bg-zinc-400/15 text-zinc-100",
  rare: "ring-blue-400/60 bg-blue-400/15 text-blue-100",
  epic: "ring-violet-400/60 bg-violet-400/15 text-violet-100",
  legendary: "ring-amber-400/60 bg-amber-400/15 text-amber-100",
};

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
  // V3 bonus cards — same pack/forge economy as Lot 1.
  sablier: "Ouvre des packs à la boutique",
  remanence: "Ouvre des packs à la boutique",
  offre: "Ouvre des packs à la boutique",
  braise: "Ouvre des packs à la boutique",
  echappee: "Ouvre des packs à la boutique",
  "oracle-inverse": "Ouvre des packs ou forge-la",
  fardeau: "Ouvre des packs ou forge-la",
  crepuscule: "Ouvre des packs ou forge-la",
  cascade: "Ouvre des packs ou forge-la",
  "echo-temporel": "Ouvre des packs ou forge-la",
  "ancre-temporelle": "Ouvre des packs ou forge-la",
  metamorphose: "Ouvre des packs ou forge-la",
  gaia: "Ouvre des packs ou forge-la",
  "marchand-ames": "Ouvre des packs ou forge-la",
  telepathie: "Ouvre des packs ou forge-la",
  paradoxe: "Ouvre des packs ou forge-la",
  benediction: "Ouvre des packs ou forge-la",
  schrodinger: "Pack rare ou forge légendaire",
  juge: "Pack rare ou forge légendaire",
  genese: "Pack rare ou forge légendaire",
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
  /* ──────────── Collection filters ────────────
   * rarityFilter: which rarity tab is active ("all" or one of the 4 rarities).
   * ownedOnly:    when true, hide locked cards (default: show all so the
   *               player sees what's available to chase).
   * inDeckOnly:   when true, show only cards currently equipped.
   * passiveOnly:  when true, show only passive cards (deck-building helper).
   * searchQuery:  free-text contains match on card name (lowercase). */
  const [rarityFilter, setRarityFilter] = useState<CardRarity | "all">("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [inDeckOnly, setInDeckOnly] = useState(false);
  const [passiveOnly, setPassiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mainSlots = deck.slice(0, MAIN_SLOTS) as (CardId | null)[];
  const reserveSlots = deck.slice(MAIN_SLOTS, TOTAL) as (CardId | null)[];

  // Ref + auto-scroll to bring the detail panel into view next to the tapped
  // card. Without this, tapping a card deep in the collection leaves the
  // detail panel stuck above the scroll — Alex flagged the "chiant de
  // scroll" feedback on long lists.
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  function handleCardTap(id: CardId) {
    if (!collection.includes(id)) return;
    const willSelect = selected !== id;
    setSelected(willSelect ? id : null);
    if (willSelect) {
      // Defer to next frame so the panel has rendered before we scroll.
      requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
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

  /** Count owned cards per rarity — shown in the rarity tab pills so the
   *  player knows at a glance "how much of each tier I've collected". */
  const ownedByRarity = useMemo(() => {
    const counts: Record<CardRarity, { owned: number; total: number }> = {
      common: { owned: 0, total: 0 },
      rare: { owned: 0, total: 0 },
      epic: { owned: 0, total: 0 },
      legendary: { owned: 0, total: 0 },
    };
    for (const id of ALL_CARD_IDS) {
      const r = CARDS[id].rarity;
      counts[r].total += 1;
      if (collection.includes(id)) counts[r].owned += 1;
    }
    return counts;
  }, [collection]);

  /** Filtered + grouped collection. Grouping is by mana cost within the
   *  active rarity filter — gives the player a natural curve view inside
   *  each tab without forcing them to scan a flat 46-card grid. */
  const groupedByMana = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = ALL_CARD_IDS.filter((id) => {
      const card = CARDS[id];
      if (rarityFilter !== "all" && card.rarity !== rarityFilter) return false;
      if (ownedOnly && !collection.includes(id)) return false;
      if (inDeckOnly && !usedInDeck.has(id)) return false;
      if (passiveOnly && !isPassiveCard(id)) return false;
      if (q) {
        const name = t(card.nameKey).toLowerCase();
        if (!name.includes(q) && !id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // Group by mana cost (1/2/3/4) so the player sees their curve.
    const groups: Record<number, CardId[]> = {};
    for (const id of filtered) {
      const cost = CARDS[id].cost;
      (groups[cost] ??= []).push(id);
    }
    // Within each cost bucket: rarity asc, then alphabetical name — the
    // resulting order matches how a deck-builder mentally scans cards.
    for (const cost of Object.keys(groups)) {
      groups[+cost].sort((a, b) => {
        const ra = RARITY_ORDER.indexOf(CARDS[a].rarity);
        const rb = RARITY_ORDER.indexOf(CARDS[b].rarity);
        if (ra !== rb) return ra - rb;
        return t(CARDS[a].nameKey).localeCompare(t(CARDS[b].nameKey));
      });
    }
    return [1, 2, 3, 4]
      .filter((c) => groups[c]?.length)
      .map((c) => ({ cost: c, ids: groups[c] }));
  }, [rarityFilter, ownedOnly, inDeckOnly, passiveOnly, searchQuery, collection, usedInDeck, t]);

  const totalShown = groupedByMana.reduce((sum, g) => sum + g.ids.length, 0);
  const anyFilterActive = rarityFilter !== "all" || ownedOnly || inDeckOnly || passiveOnly || searchQuery.length > 0;

  function clearAllFilters() {
    setRarityFilter("all");
    setOwnedOnly(false);
    setInDeckOnly(false);
    setPassiveOnly(false);
    setSearchQuery("");
  }

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
      {/* Header — two rows so the title doesn't get squeezed between a
          full-width currency strip and the close button (which used to wrap
          "Mon Deck" onto two lines on narrow phones). Row 1: title + close
          target. Row 2: the read-only currency strip, full width. */}
      <div className="shrink-0 flex flex-col gap-2 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-themed tracking-tight truncate">
            Mon Deck
          </h1>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 w-9 h-9 -mr-1 rounded-full text-ink-muted hover:text-white hover:bg-hairline text-xl leading-none flex items-center justify-center transition"
          >✕</button>
        </div>
        <CurrencyBadges inert />
      </div>

      {/* Scroll region — only this middle band scrolls. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-1">
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

        {/* Card detail panel — replaces the implicit "what does this do?" with
            an explicit info card whenever the player selects something from
            the collection. Auto-scrolls into view on selection so it lands
            NEAR the tapped card instead of getting stuck at the top — Alex
            feedback "il faut que l'aperçu apparaisse au-dessus de la ligne
            de la carte touchée". */}
        <div ref={detailPanelRef}>
          <CardDetailPanel
            id={selected}
            masteryXp={(player.cardMastery ?? {})[selected ?? ""] ?? 0}
            owned={selected ? collection.includes(selected) : false}
            inDeck={selected ? usedInDeck.has(selected) : false}
            t={t}
          />
        </div>

        {/* Collection — collapsible header + sticky filter bar + curve-grouped
            cards grid. Designed to scale past 46 cards without becoming a wall
            of icons: a rarity tab + an owned/in-deck/passive toggle + a search
            input cut the visible set down to 6–12 cards, and a mana-cost
            divider inside each tab gives the player a deck-builder's curve view. */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { hapticTap(); setCollectionOpen((o) => !o); }}
            className="w-full flex items-center justify-between gap-2 group"
          >
            <span className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
                Collection
              </span>
              <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full bg-hairline text-ink-muted">
                {ownedCount}/{ALL_CARD_IDS.length}
              </span>
              {/* Soft progress bar — at-a-glance "how complete is my collection". */}
              <span className="hidden sm:inline-flex h-1.5 w-20 rounded-full bg-hairline overflow-hidden">
                <span
                  className="h-full bg-themed transition-all duration-500"
                  style={{ width: `${Math.round((ownedCount / ALL_CARD_IDS.length) * 100)}%` }}
                />
              </span>
            </span>
            <span className={"text-ink-faint text-xs transition-transform duration-200 " + (collectionOpen ? "rotate-180" : "")}>▾</span>
          </button>

          <AnimatePresence initial={false}>
            {collectionOpen && (
              <motion.div
                key="collection-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 pt-1">
                  {/* Search box — compact, with a clear (✕) when active. */}
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs pointer-events-none">🔍</span>
                    <input
                      type="text"
                      inputMode="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher une carte…"
                      className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-surface-raised border border-hairline focus:border-white/40 focus:outline-none text-white placeholder:text-ink-faint transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        aria-label="Effacer la recherche"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-hairline text-ink-muted hover:text-white text-[10px] flex items-center justify-center"
                      >✕</button>
                    )}
                  </div>

                  {/* Rarity tabs — horizontal pills with owned/total per rarity.
                      Vertical padding (py-1.5) prevents the active pill's ring
                      from clipping against the overflow container's edges. */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 -mx-1 px-1 no-scrollbar">
                    <RarityTab
                      active={rarityFilter === "all"}
                      onClick={() => { hapticTap(); setRarityFilter("all"); }}
                      label="Toutes"
                      count={`${ownedCount}/${ALL_CARD_IDS.length}`}
                      dotClass="bg-white/70"
                    />
                    {RARITY_ORDER.map((r) => (
                      <RarityTab
                        key={r}
                        active={rarityFilter === r}
                        onClick={() => { hapticTap(); setRarityFilter(r); }}
                        label={RARITY_FR[r]}
                        count={`${ownedByRarity[r].owned}/${ownedByRarity[r].total}`}
                        dotClass={RARITY_DOT[r]}
                        activeRingClass={RARITY_RING[r]}
                      />
                    ))}
                  </div>

                  {/* Filter chips — multi-select toggles. Reset button appears
                      only when at least one filter is active so the bar stays
                      clean in the default state. py-0.5 keeps the active ring
                      from clipping at the top edge. */}
                  <div className="flex items-center gap-1.5 flex-wrap py-0.5">
                    <FilterChip
                      active={ownedOnly}
                      onClick={() => { hapticTap(); setOwnedOnly((v) => !v); }}
                      icon="📥"
                      label="Possédées"
                    />
                    <FilterChip
                      active={inDeckOnly}
                      onClick={() => { hapticTap(); setInDeckOnly((v) => !v); }}
                      icon="✓"
                      label="Dans mon deck"
                    />
                    <FilterChip
                      active={passiveOnly}
                      onClick={() => { hapticTap(); setPassiveOnly((v) => !v); }}
                      icon="∞"
                      label="Passives"
                    />
                    {anyFilterActive && (
                      <button
                        onClick={() => { hapticTap(); clearAllFilters(); }}
                        className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted hover:text-white px-2 py-1 transition"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>

                  {/* Grouped grid — one section per mana cost present in the
                      filtered set. AnimatePresence on the wrapper smooths the
                      tab/filter switch without re-mounting each card. */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${rarityFilter}-${ownedOnly}-${inDeckOnly}-${passiveOnly}-${searchQuery}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col gap-3 pt-1"
                    >
                      {totalShown === 0 ? (
                        <EmptyState onReset={clearAllFilters} hasFilters={anyFilterActive} />
                      ) : (
                        groupedByMana.map(({ cost, ids }) => (
                          <ManaGroup
                            key={`cost-${cost}`}
                            cost={cost}
                            ids={ids}
                            collection={collection}
                            usedInDeck={usedInDeck}
                            selected={selected}
                            onCardTap={handleCardTap}
                            t={t}
                          />
                        ))
                      )}
                    </motion.div>
                  </AnimatePresence>
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
      className="relative aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-inset ring-white/20 bg-surface-raised"
    >
      <CardImage id={cardId} glyphSize="text-2xl" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 z-10">
        <div className="text-[7px] font-bold uppercase text-center text-white/90">{t(card.nameKey)}</div>
      </div>
    </button>
  );
}

/* ────────────── Card detail panel ────────────── */

/** Card detail panel — surfaces the full card text when one is tapped, so the
 *  player understands what they're equipping without playing a match to find
 *  out. Sits between the deck slots and the collection grid; always rendered
 *  (placeholder when no selection) so the layout doesn't jump when picking
 *  cards in/out. */
function CardDetailPanel({
  id, masteryXp, owned, inDeck, t,
}: {
  id: CardId | null;
  masteryXp: number;
  owned: boolean;
  inDeck: boolean;
  t: (key: string) => string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {id ? (
        <CardDetailContent
          key={id}
          id={id}
          masteryXp={masteryXp}
          owned={owned}
          inDeck={inDeck}
          t={t}
        />
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl border border-dashed border-hairline bg-black/20 px-3 py-3 text-center text-[11px] text-ink-faint"
        >
          Touche une carte dans la collection pour lire son effet
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CardDetailContent({
  id, masteryXp, owned, inDeck, t,
}: {
  id: CardId;
  masteryXp: number;
  owned: boolean;
  inDeck: boolean;
  t: (key: string) => string;
}) {
  const card = CARDS[id];
  const mastery = masteryLevel(masteryXp);
  const passive = isPassiveCard(id);
  // Rarity-tinted left border so each tier reads at a glance.
  const borderTint =
    card.rarity === "common"   ? "border-l-zinc-400"  :
    card.rarity === "rare"     ? "border-l-blue-400"  :
    card.rarity === "epic"     ? "border-l-violet-400" :
                                 "border-l-amber-400";
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={
        "relative rounded-xl border border-hairline border-l-4 bg-surface-raised px-3 py-2.5 flex gap-3 " +
        borderTint
      }
    >
      {/* Thumbnail — fixed small footprint so the text gets the room. */}
      <div className="relative w-14 h-[74px] sm:w-16 sm:h-[84px] shrink-0 rounded-md overflow-hidden ring-1 ring-white/15">
        <CardImage id={id} glyphSize="text-xl" />
      </div>
      {/* Right column: header line + description + target hint + footer chips. */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-extrabold text-white truncate">
            {t(card.nameKey)}
          </span>
          <span className={"text-[10px] font-bold uppercase tracking-wider " + RARITY_COLOR[card.rarity]}>
            {passive ? "Passive" : card.rarity}
          </span>
        </div>
        {/* Mana cost as a pip cluster — same visual language as the hand. */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">Coût</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: card.cost }, (_, k) => (
              <span key={k} className="w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" />
            ))}
          </div>
        </div>
        <p className="text-[11px] sm:text-xs text-ink leading-snug">
          {t(card.descKey)}
        </p>
        {card.targetHintKey && t(card.targetHintKey) && (
          <p className="text-[10px] text-ink-muted leading-snug italic">
            🎯 {t(card.targetHintKey)}
          </p>
        )}
        {/* Footer chips: ownership + in-deck + mastery progress (if owned). */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {!owned && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-zinc-600/40 text-ink-muted border border-hairline">
              🔒 Verrouillée
            </span>
          )}
          {owned && inDeck && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
              ✓ Dans le deck
            </span>
          )}
          {owned && !inDeck && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-white/5 text-ink-muted border border-hairline">
              Possédée
            </span>
          )}
          {owned && mastery > 1 && (
            <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-400/40">
              {mastery >= MASTERY_MAX_LEVEL ? "⭐" : "✦"} Maîtrise {mastery}/{MASTERY_MAX_LEVEL}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────── Collection helpers ────────────── */

/** Rarity tab pill — when active, gets a tinted ring + bg in the rarity color;
 *  when inactive, a quiet hairline outline. The count "owned/total" is the
 *  primary scannable info, the rarity dot the secondary one. */
function RarityTab({
  active, onClick, label, count, dotClass, activeRingClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: string;
  dotClass: string;
  /** Optional tinted look when active — defaults to a neutral white ring
   *  (used by the "Toutes" tab which has no rarity color of its own). */
  activeRingClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition " +
        (active
          ? (activeRingClass ?? "bg-white/15 ring-white/40 text-white") + " ring-1"
          : "bg-hairline/40 ring-1 ring-hairline text-ink-muted hover:text-white")
      }
    >
      <span className={"w-1.5 h-1.5 rounded-full " + dotClass} aria-hidden />
      <span>{label}</span>
      <span className="text-[9px] font-black tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/** Multi-select toggle chip — owned-only, in-deck-only, passives-only. */
function FilterChip({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition " +
        (active
          ? "bg-emerald-400/20 ring-1 ring-emerald-400/50 text-emerald-100"
          : "bg-hairline/40 ring-1 ring-hairline text-ink-muted hover:text-white")
      }
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Section divider + grid for one mana-cost bucket. Header shows the mana
 *  cost as visual pips so the player reads the curve graphically, not as text. */
function ManaGroup({
  cost, ids, collection, usedInDeck, selected, onCardTap, t,
}: {
  cost: number;
  ids: CardId[];
  // String[] not CardId[] — the store persists cardCollection as plain
  // strings; we don't re-validate here since ALL_CARD_IDS bounds `ids`.
  collection: string[];
  usedInDeck: Set<string | CardId | null>;
  selected: CardId | null;
  onCardTap: (id: CardId) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-0.5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: cost }, (_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" />
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
          {cost} mana
        </span>
        <span className="text-[9px] font-black tabular-nums text-ink-faint">
          ({ids.length})
        </span>
        <div className="flex-1 h-px bg-hairline ml-1" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ids.map((id, i) => (
          <CardCell
            key={id}
            id={id}
            index={i}
            unlocked={collection.includes(id)}
            inDeck={usedInDeck.has(id)}
            isSelected={selected === id}
            onClick={() => onCardTap(id)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

/** Single card cell — the entire visual was extracted from the old inline
 *  rendering so the new layout reuses it inside each mana group AND so a
 *  per-cell staggered fade animation is possible (index-based delay). */
function CardCell({
  id, index, unlocked, inDeck, isSelected, onClick, t,
}: {
  id: CardId;
  index: number;
  unlocked: boolean;
  inDeck: boolean;
  isSelected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) {
  const card = CARDS[id];
  return (
    <motion.button
      onClick={onClick}
      whileTap={unlocked ? { scale: 0.92 } : undefined}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      // Tight stagger (16ms × index) — visible but never feels slow.
      transition={{ delay: Math.min(index * 0.016, 0.24), duration: 0.18 }}
      className={
        "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center transition " +
        (isSelected
          ? "ring-2 ring-inset ring-white shadow-lg shadow-white/30 scale-105"
          : inDeck
          ? "ring-2 ring-inset ring-emerald-400/50 opacity-70"
          : unlocked
          ? "ring-1 ring-inset ring-white/20"
          : "ring-1 ring-inset ring-white/5 grayscale opacity-30")
      }
    >
      <CardImage id={id} glyphSize="text-xl" />
      {/* Mana cost pip — top-left corner, always visible (helps with curve scanning). */}
      <div className="absolute top-0.5 left-0.5 z-10 inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-full bg-black/65 backdrop-blur-sm">
        {Array.from({ length: card.cost }, (_, k) => (
          <span key={k} className="w-1 h-1 rounded-full bg-sky-300" />
        ))}
      </div>
      {/* Rarity micro-dot — top-right so it doesn't fight the mana pips. */}
      <div
        className={"absolute top-1 right-1 z-10 w-1.5 h-1.5 rounded-full " + RARITY_DOT[card.rarity]}
        aria-hidden
      />
      {/* Name + rarity at the bottom — no duplicate glyph here (CardImage already
       *  renders the glyph as a fallback when card.art is null; superimposing
       *  another glyph on top of the actual art read as visual clutter). */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/65 backdrop-blur-sm py-0.5 px-1 flex flex-col items-center gap-0">
        <span className="text-[7px] font-bold uppercase text-white/95 text-center leading-tight truncate w-full">
          {t(card.nameKey)}
        </span>
        <span className={"text-[7px] font-bold leading-none " + RARITY_COLOR[card.rarity]}>
          {isPassiveCard(id) ? "passive" : card.rarity}
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
        <div className="absolute top-0.5 right-3 z-20 w-3 h-3 rounded-full bg-emerald-400 flex items-center justify-center">
          <span className="text-[7px] text-zinc-900 font-black">✓</span>
        </div>
      )}
    </motion.button>
  );
}

/** Shown when filters reduce the collection to zero matches. */
function EmptyState({ onReset, hasFilters }: { onReset: () => void; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
      <div className="text-3xl opacity-40">📭</div>
      <div className="text-xs text-ink-muted">
        Aucune carte ne correspond aux filtres.
      </div>
      {hasFilters && (
        <button
          onClick={onReset}
          className="mt-1 text-[10px] uppercase tracking-wider text-themed font-bold hover:underline"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}
