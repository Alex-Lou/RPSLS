/**
 * DeckManager — full-page deck editor.
 *
 * Surfaces the player's wallet at the top (read-only — the boutique lives
 * on its own ShopPage now, reachable from the burger or from any profile
 * surface's currency chip). Below: main hand (3) + reserve (3) + the full
 * collection. Locked cards stay greyed with a hint.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { ALL_CARD_IDS, CARDS, isPassiveCard, RARITY_COLOR, RARITY_ORDER, STARTER_COLLECTION } from "./cards";
import { isFusible } from "../arena/arenaFusionCards";
import { isCastOnDraw } from "../arena/arenaCastOnDraw";
import { ARENA_LEGENDARY_CAP } from "../arena/arenaDecks";
import { CardImage } from "./CardImage";
import { masteryLevel, MASTERY_MAX_LEVEL } from "../engine/economy";
import type { CardId, CardRarity } from "./rankedTypes";
import { useT } from "../i18n";
import { useNoMenuFx } from "../fx/menuFx";
import { CurrencyBadges } from "./CurrencyBadges";
import { hapticTap } from "../haptic";
import { setBurgerHidden } from "../Sidebar";

// Taille du deck PAR MODE (Alex 2026-06-13) : Classé = 6, Pro = 8. Decks
// SÉPARÉS dans le store (rankedDeck / arenaDeck) → éditer l'un n'écrase pas
// l'autre. Calculée dans le composant à partir de la prop `mode`.
const SLOTS_BY_MODE = { ranked: 6, arena: 10 } as const;

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

export function DeckManager({ onClose, mode = "ranked" }: { onClose: () => void; mode?: "ranked" | "arena" }) {
  useNoMenuFx(); // deck editor → no menu touch particles
  const TOTAL = SLOTS_BY_MODE[mode];
  // Burger flottant MASQUÉ (Alex 2026-06-13) : le DeckManager a sa propre
  // flèche Retour dans l'en-tête → le burger top-left chevauchait + laissait
  // un vide. On le cache tant que l'éditeur est ouvert (Arena ET Classé, vu
  // que le composant est partagé → la "jolie mise en forme" bénéficie aux
  // deux modes d'un seul coup). Restauré au unmount.
  useEffect(() => {
    setBurgerHidden(true);
    return () => setBurgerHidden(false);
  }, []);
  const t = useT();
  const player = useStore((s) => s.player);
  const setRankedDeck = useStore((s) => s.setRankedDeck);
  const setArenaDeck = useStore((s) => s.setArenaDeck);
  // Source + setter selon le mode. Pro retombe sur le deck Classé si pas
  // encore d'arenaDeck (migration douce des joueurs existants).
  const savedDeck = mode === "arena" ? (player.arenaDeck ?? player.rankedDeck ?? []) : (player.rankedDeck ?? []);
  const saveDeck = mode === "arena" ? setArenaDeck : setRankedDeck;
  const collection = player.cardCollection ?? STARTER_COLLECTION;
  const [deck, setDeck] = useState<(CardId | null)[]>(() => {
    const padded = [...savedDeck];
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

  const equipped = deck.filter(Boolean).length;

  // Tap a card → open detail modal AND set as selected. The modal has a
  // "Mettre dans mon deck" button that closes the modal WHILE keeping the
  // card selected so a follow-up slot-tap assigns it (Alex flag : modal
  // ouvert empêchait l'assignation). X / backdrop closes WITHOUT
  // assigning (selected resets too).
  const [modalOpen, setModalOpen] = useState(false);
  // Toast (Alex 2026-06-13) : message court + visible SANS scroller, pour
  // dire pourquoi une carte n'a pas pu être ajoutée (deck plein…) ou
  // confirmer l'ajout/retrait. Auto-dismiss.
  const [deckMsg, setDeckMsg] = useState<{ text: string; tone: "good" | "warn" | "info"; key: number } | null>(null);
  useEffect(() => {
    if (!deckMsg) return;
    const id = window.setTimeout(() => setDeckMsg(null), 2400);
    return () => window.clearTimeout(id);
  }, [deckMsg?.key]);

  function handleCardTap(id: CardId) {
    if (!collection.includes(id)) return;
    setSelected(id);
    setModalOpen(true);
  }

  // Bouton "Mettre dans mon deck" (Alex 2026-06-13) : place DIRECTEMENT la
  // carte dans le 1er emplacement libre, ou affiche pourquoi c'est impossible
  // — le joueur ne remonte plus le deck pour comprendre. Si la carte est déjà
  // dans le deck, le bouton la RETIRE (toggle intuitif).
  function handlePickForDeck() {
    if (!selected) return;
    const card = CARDS[selected];
    const name = t(card.nameKey);
    const existingIdx = deck.indexOf(selected);
    if (existingIdx >= 0) {
      const next = [...deck]; next[existingIdx] = null; setDeck(next);
      setDeckMsg({ text: `« ${name} » retirée du deck`, tone: "info", key: Date.now() });
      setModalOpen(false); setSelected(null);
      return;
    }
    // CAP légendaires en ARENA (Alex 2026-06-13 équité) : pas plus de
    // ARENA_LEGENDARY_CAP légendaires dans le deck → fini le flood de bombes en
    // repioche. (Le retrait ci-dessus reste toujours possible.)
    if (mode === "arena" && card.rarity === "legendary") {
      const legCount = deck.filter((c) => c !== null && CARDS[c]?.rarity === "legendary").length;
      if (legCount >= ARENA_LEGENDARY_CAP) {
        setModalOpen(false);
        setDeckMsg({ text: `Max ${ARENA_LEGENDARY_CAP} légendaires en Arena (équité) — retires-en une d'abord`, tone: "warn", key: Date.now() });
        return;
      }
    }
    const freeIdx = deck.indexOf(null);
    if (freeIdx < 0) {
      // Deck plein : pas de cul-de-sac. On GARDE la carte sélectionnée, on
      // ferme la fiche, et on invite à taper l'emplacement à remplacer (les
      // slots pulsent déjà via `highlight={!!selected}`). Le tap suivant sur
      // un slot fait le swap (handleSlotTap). Alex 2026-06-13.
      setModalOpen(false);
      setDeckMsg({ text: `Deck plein (${TOTAL}/${TOTAL}) — tape la carte à remplacer ↑`, tone: "warn", key: Date.now() });
      return; // `selected` reste set
    }
    const next = [...deck]; next[freeIdx] = selected; setDeck(next);
    setDeckMsg({ text: `« ${name} » ajoutée (emplacement ${freeIdx + 1})`, tone: "good", key: Date.now() });
    setModalOpen(false); setSelected(null);
  }

  function handleSlotTap(slotIdx: number) {
    const slotCard = deck[slotIdx];
    if (!selected) {
      // Pas de carte choisie : taper un slot REMPLI ouvre sa FICHE (avec le
      // bouton « Retirer ») au lieu de le vider sèchement sans confirmation
      // (Alex 2026-06-13). Un slot vide ne fait rien.
      if (slotCard) {
        setSelected(slotCard);
        setModalOpen(true);
      }
      return;
    }
    // Carte choisie → place / remplace (swap si elle est déjà ailleurs).
    const existingIdx = deck.indexOf(selected);
    const next = [...deck];
    if (existingIdx >= 0) next[existingIdx] = slotCard; // swap
    next[slotIdx] = selected;
    // CAP légendaires ARENA (Alex 2026-06-13 équité) — vaut AUSSI pour le swap,
    // sinon on pouvait dépasser le cap en remplaçant un slot.
    if (mode === "arena" && CARDS[selected].rarity === "legendary"
        && next.filter((c) => c !== null && CARDS[c]?.rarity === "legendary").length > ARENA_LEGENDARY_CAP) {
      setDeckMsg({ text: `Max ${ARENA_LEGENDARY_CAP} légendaires en Arena (équité) — retires-en une d'abord`, tone: "warn", key: Date.now() });
      return; // swap annulé, selected reste set
    }
    setDeck(next);
    setDeckMsg({
      text: slotCard
        ? `« ${t(CARDS[selected].nameKey)} » remplace l'emplacement ${slotIdx + 1}`
        : `« ${t(CARDS[selected].nameKey)} » placée (emplacement ${slotIdx + 1})`,
      tone: "good", key: Date.now(),
    });
    setSelected(null);
  }

  function handleSave() {
    const validDeck = deck.filter((c): c is CardId => c !== null);
    saveDeck(validDeck);
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
      // -mt-10 (Alex 2026-06-13) : remonte le panneau dans l'espace mort
      // laissé par le pt-12 global (burger maintenant masqué) → la nav
      // respire en haut au lieu de flotter sous un vide.
      className="flex flex-col flex-1 min-h-0 -mt-10 pt-1 pb-2 px-2 max-w-lg mx-auto w-full"
    >
      {/* Header — cadrage TEMPLATE Pro (Alex 2026-06-13) : retour 40px à
          gauche, titre gradient centré, spacer symétrique à droite. Monnaies
          en ligne compacte dessous. */}
      <div className="shrink-0 flex flex-col gap-2 pb-2">
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            aria-label="Retour"
            className="shrink-0 w-10 h-10 rounded-xl border border-hairline bg-black/45 backdrop-blur flex items-center justify-center text-ink active:scale-95 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </motion.button>
          <div className="flex-1 min-w-0 text-center">
            <h1
              className="text-lg sm:text-2xl font-extrabold tracking-tight leading-tight bg-gradient-to-br from-fuchsia-300 to-violet-300 bg-clip-text text-transparent truncate"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              Mon Deck
            </h1>
            <p className="text-[10px] text-ink-muted leading-tight">
              {mode === "arena"
                ? "8 cartes · chaque choix devient 3/2/2/1 copies selon la rareté"
                : "6 cartes · Constellation Classée"}
            </p>
          </div>
          <div className="shrink-0 w-10 h-10" aria-hidden />
        </div>
        <div className="flex items-center justify-center">
          <CurrencyBadges inert />
        </div>
      </div>

      {/* Scroll region — only this middle band scrolls. */}
      {/* pl-2 (Alex 2026-06-13 #2) : ~2px de marge gauche en plus → les
       *  rings des filtres/cartes ne se font plus rogner d'1px par le bord. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pl-2 pr-1">
        {/* Deck — grille selon le mode (Alex 2026-06-13 #1) : 6 cartes = 3×2
         *  propre, 8 cartes = 4×2 ; plus de slots vides en bout de ligne. */}
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.25em] font-bold text-emerald-400 mb-2">
            Mon deck ({equipped}/{TOTAL})
          </h2>
          <div className={"grid gap-2 " + (TOTAL === 6 ? "grid-cols-3" : TOTAL === 10 ? "grid-cols-5" : "grid-cols-4")}>
            {(deck as (CardId | null)[]).map((cardId, i) => (
              <DeckSlot key={`slot-${i}`} cardId={cardId} slotLabel={`${i + 1}`}
                onClick={() => handleSlotTap(i)} highlight={!!selected} />
            ))}
          </div>
        </div>

        {/* CardDetailModal mounts via portal at the end of this component —
            see the bottom of the JSX tree. No in-flow panel anymore. */}

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
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-1 no-scrollbar">
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
                            showFusion={mode === "arena"}
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

      {/* Card detail MODAL — portal overlay opened on card tap. The
       *  "Sélectionner pour le deck" button closes the modal while
       *  KEEPING the card selected so the next slot-tap assigns it. */}
      <CardDetailModal
        id={modalOpen ? selected : null}
        masteryXp={(player.cardMastery ?? {})[selected ?? ""] ?? 0}
        owned={selected ? collection.includes(selected) : false}
        inDeck={selected ? usedInDeck.has(selected) : false}
        deckFull={deck.indexOf(null) < 0}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onPickForDeck={handlePickForDeck}
        t={t}
      />

      {/* Toast (Alex 2026-06-13) — message d'ajout/retrait/refus, TOUJOURS
       *  visible (fixed, sous l'en-tête) : plus besoin de remonter le deck. */}
      <AnimatePresence>
        {deckMsg && (
          <motion.div
            key={deckMsg.key}
            initial={{ opacity: 0, y: -14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className={
              "fixed left-1/2 -translate-x-1/2 z-[9998] px-4 py-2 rounded-2xl text-[12.5px] font-bold shadow-2xl backdrop-blur border whitespace-nowrap max-w-[90vw] truncate " +
              (deckMsg.tone === "good"
                ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-100"
                : deckMsg.tone === "warn"
                ? "bg-amber-500/25 border-amber-400/60 text-amber-100"
                : "bg-zinc-700/60 border-zinc-500/60 text-zinc-100")
            }
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
          >
            {deckMsg.tone === "good" ? "✓ " : deckMsg.tone === "warn" ? "⚠ " : "↺ "}
            {deckMsg.text}
          </motion.div>
        )}
      </AnimatePresence>
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

/* ────────────── Card detail modal ────────────── */

/** Card detail modal — fullscreen portal overlay opened when a collection
 *  card is tapped. Replaces the old in-flow panel that forced the player
 *  to scroll back to the top to read details. Click backdrop or X to close.
 *  Inside, CardDetailContent is reused as-is. */
function CardDetailModal({
  id, masteryXp, owned, inDeck, deckFull, onClose, onPickForDeck, t,
}: {
  id: CardId | null;
  masteryXp: number;
  owned: boolean;
  inDeck: boolean;
  /** Deck plein (0 slot libre) — change le CTA en "Remplacer une carte". */
  deckFull: boolean;
  /** Called by the backdrop / ✕ button : closes the modal AND clears
   *  the selection. The card is "forgotten". */
  onClose: () => void;
  /** Called by the "Mettre dans mon deck" button : closes the modal
   *  but KEEPS the selection so the next slot tap assigns it. Only
   *  available if the card is OWNED. */
  onPickForDeck: () => void;
  t: (key: string) => string;
}) {
  return createPortal(
    <AnimatePresence>
      {id && (
        <motion.div
          key="card-detail-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md"
          >
            <CardDetailContent
              key={id}
              id={id}
              masteryXp={masteryXp}
              owned={owned}
              inDeck={inDeck}
              t={t}
            />
            {/* "Mettre dans mon deck" CTA — only meaningful for owned cards.
             *  Closes the modal but keeps the card selected so the next
             *  slot-tap assigns it (Alex flag : modal cassait l'assign). */}
            {owned && (
              <button
                onClick={onPickForDeck}
                className="mt-2 w-full py-2.5 rounded-2xl bg-themed shadow-lg font-black text-white text-sm transition active:scale-[0.97]"
                style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.08em" }}
              >
                {inDeck ? "✕ Retirer du deck" : deckFull ? "🔁 Remplacer une carte…" : "✓ Mettre dans mon deck"}
              </button>
            )}
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-zinc-900 border-2 border-hairline text-white text-lg font-bold flex items-center justify-center shadow-2xl hover:bg-zinc-800 transition"
              aria-label="Fermer"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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
  cost, ids, collection, usedInDeck, selected, onCardTap, showFusion, t,
}: {
  cost: number;
  ids: CardId[];
  // String[] not CardId[] — the store persists cardCollection as plain
  // strings; we don't re-validate here since ALL_CARD_IDS bounds `ids`.
  collection: string[];
  usedInDeck: Set<string | CardId | null>;
  selected: CardId | null;
  onCardTap: (id: CardId) => void;
  /** Affiche le badge ⚗ fusion (mode Arena seulement — la fusion n'existe
   *  pas en Classé). Alex 2026-06-13. */
  showFusion: boolean;
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
            showFusion={showFusion}
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
  id, index, unlocked, inDeck, isSelected, onClick, showFusion = false, t,
}: {
  id: CardId;
  index: number;
  unlocked: boolean;
  inDeck: boolean;
  isSelected: boolean;
  onClick: () => void;
  showFusion?: boolean;
  t: (key: string) => string;
}) {
  const card = CARDS[id];
  // ⚗ Fusionnable (Arena) : marqueur DISTINCT du point de rareté — Alex
  // confondait le point « rose » (= rareté ÉPIQUE violet) avec la fusion.
  const fusible = showFusion && isFusible(id);
  // ⚡ Cartes « à la pioche » (Cast When Drawn, Arena) : badge bleu DISTINCT du
  // ⚗ fusion — le joueur repère d'un coup d'œil les cartes qui s'activent au
  // tirage. Alex 2026-06-13.
  const castDraw = showFusion && isCastOnDraw(id);
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
      {/* Coin sup-droit — Alex 2026-06-13 : en ARENA, ⚗ = FUSIONNABLE (et
       *  RIEN sinon → fini les « points roses » ambigus ; la rareté reste
       *  lisible via le texte coloré du bas). En CLASSÉ (pas de fusion), le
       *  micro-point de rareté comme avant. */}
      {fusible ? (
        <div
          className="absolute top-0.5 right-0.5 z-10 px-1 h-3.5 rounded-full bg-amber-400/95 flex items-center justify-center shadow ring-1 ring-amber-200/60"
          title="Fusionnable sur la Forge (Arena)"
        >
          <span className="text-[8px] leading-none">⚗</span>
        </div>
      ) : castDraw ? (
        <div
          className="absolute top-0.5 right-0.5 z-10 px-1 h-3.5 rounded-full bg-sky-400/95 flex items-center justify-center shadow ring-1 ring-sky-200/70"
          title="Se déclenche À LA PIOCHE (Cast When Drawn)"
        >
          <span className="text-[8px] leading-none">⚡</span>
        </div>
      ) : !showFusion ? (
        <div
          className={"absolute top-1 right-1 z-10 w-1.5 h-1.5 rounded-full " + RARITY_DOT[card.rarity]}
          aria-hidden
        />
      ) : null}
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
