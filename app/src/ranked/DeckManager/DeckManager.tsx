/**
 * DeckManager — full-page deck editor.
 *
 * Surfaces the player's wallet at the top (read-only — the boutique lives
 * on its own ShopPage now, reachable from the burger or from any profile
 * surface's currency chip). Below: main hand (3) + reserve (3) + the full
 * collection. Locked cards stay greyed with a hint.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../../store/store";
import { ALL_CARD_IDS, CARDS, STARTER_COLLECTION } from "../cards";
import { ARENA_LEGENDARY_CAP, resolveArenaDeckSource } from "../../arena/arenaDecks";
import { SIGNATURE_DECK } from "../../arena/arenaVoies";
import type { CardId, CardRarity } from "../rankedTypes";
import { useT } from "../../i18n";
import { useNoMenuFx } from "../../fx/menuFx";
import { CurrencyBadges } from "../CurrencyBadges";
import { useTopBar } from "../../nav/topBarStore";
import { SLOTS_BY_MODE, type VoieFilter } from "./deckManagerConstants";
import { DeckSlot } from "./DeckSlot";
import { CardDetailModal } from "./CardDetailModal";
import { CollectionFilterBar } from "./CollectionFilterBar";
import { CollectionHeader } from "./CollectionHeader";
import { countOwnedByRarity, groupCollectionByMana } from "./collectionGrouping";
import { DeckToast } from "./DeckToast";
import { ManaGroup } from "./ManaGroup";
import { EmptyState } from "./EmptyState";

export function DeckManager({ onClose, mode = "ranked" }: { onClose: () => void; mode?: "ranked" | "arena" }) {
  useNoMenuFx(); // deck editor → no menu touch particles
  const TOTAL = SLOTS_BY_MODE[mode];
  const t = useT();
  // Titre + retour dans la barre du haut unifiée (plus d'en-tête maison).
  useTopBar({ title: t("lobby.deck.title"), onBack: onClose });
  const player = useStore((s) => s.player);
  const setRankedDeck = useStore((s) => s.setRankedDeck);
  const setArenaDeck = useStore((s) => s.setArenaDeck);
  const setArenaVoieDeck = useStore((s) => s.setArenaVoieDeck);
  // DECK PAR VOIE (Alex 2026-06-22) : en arène, la source = ton deck CUSTOM de la
  // Voie active > deck SIGNATURE curé > deck libre (fallback Classé) ; la sauvegarde
  // va dans le slot de CETTE Voie. Le Classé reste inchangé.
  const savedDeck = mode === "arena"
    ? resolveArenaDeckSource(player.arenaAffinity, player.arenaDeckByVoie, player.arenaDeck ?? player.rankedDeck)
    : (player.rankedDeck ?? []);
  const saveDeck = mode === "arena"
    ? (d: string[]) => (player.arenaAffinity ? setArenaVoieDeck(player.arenaAffinity, d) : setArenaDeck(d))
    : setRankedDeck;
  // COLLECTION EFFECTIVE — en arène, les cartes de TA Voie (tag voie===affinity +
  // cartes du deck signature) sont DISPONIBLES sans les « posséder » (kit de la
  // Voie, zéro impact éco/collection). Hors arène : collection possédée stricte.
  const baseCollection = player.cardCollection ?? STARTER_COLLECTION;
  const collection = (mode === "arena" && player.arenaAffinity)
    ? [...new Set<string>([
        ...baseCollection,
        ...ALL_CARD_IDS.filter((id) => CARDS[id]?.voie === player.arenaAffinity),
        ...(SIGNATURE_DECK[player.arenaAffinity] ?? []),
      ])]
    : baseCollection;
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
  // VOIE (arène, Alex 2026-06-17 « n'afficher que les cartes de la voie ») :
  // quand actif (défaut en arène), la collection ne montre que TES cartes de Voie
  // (signatures voie===affinity + NEUTRES voie absente) et masque les autres
  // Voies. Toggle via la chip « Ma Voie ». arenaAffinity = la Voie choisie.
  const arenaAffinity = player.arenaAffinity;
  // Filtre par Voie (arène) — défaut « Ma Voie » (ta Voie active + neutres) ;
  // chips dédiés pour voir CHAQUE Voie distinctement (Alex 2026-06-22).
  const [voieFilter, setVoieFilter] = useState<VoieFilter>(mode === "arena" ? "myvoie" : "all");

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
      setDeckMsg({ text: t("deck.msg.removed", { name }), tone: "info", key: Date.now() });
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
        setDeckMsg({ text: t("deck.msg.legendaryCap", { n: ARENA_LEGENDARY_CAP }), tone: "warn", key: Date.now() });
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
      setDeckMsg({ text: t("deck.msg.full", { n: TOTAL }), tone: "warn", key: Date.now() });
      return; // `selected` reste set
    }
    const next = [...deck]; next[freeIdx] = selected; setDeck(next);
    setDeckMsg({ text: t("deck.msg.added", { name, slot: freeIdx + 1 }), tone: "good", key: Date.now() });
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
      setDeckMsg({ text: t("deck.msg.legendaryCap", { n: ARENA_LEGENDARY_CAP }), tone: "warn", key: Date.now() });
      return; // swap annulé, selected reste set
    }
    setDeck(next);
    setDeckMsg({
      text: slotCard
        ? t("deck.msg.replaced", { name: t(CARDS[selected].nameKey), slot: slotIdx + 1 })
        : t("deck.msg.placed", { name: t(CARDS[selected].nameKey), slot: slotIdx + 1 }),
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
  const ownedByRarity = useMemo(() => countOwnedByRarity(collection), [collection]);

  /** Filtered + grouped collection. Grouping is by mana cost within the
   *  active rarity filter — gives the player a natural curve view inside
   *  each tab without forcing them to scan a flat 46-card grid. */
  const groupedByMana = useMemo(() => groupCollectionByMana({
    searchQuery, mode, rarityFilter, ownedOnly, inDeckOnly, passiveOnly,
    voieFilter, arenaAffinity, collection, usedInDeck, t,
  }), [rarityFilter, ownedOnly, inDeckOnly, passiveOnly, voieFilter, arenaAffinity, mode, searchQuery, collection, usedInDeck, t]);

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
      className="flex flex-col flex-1 min-h-0 pb-2 px-2 max-w-lg mx-auto w-full"
    >
      {/* Sous-titre + monnaies (titre et retour : barre du haut). */}
      <div className="shrink-0 flex flex-col gap-2 pb-2">
        <p className="text-[11px] text-ink-muted leading-tight text-center">
          {mode === "arena"
            ? t("deck.sub.arena")
            : t("deck.sub.ranked")}
        </p>
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
            {t("deck.myDeck", { n: equipped, total: TOTAL })}
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
          <CollectionHeader
            ownedCount={ownedCount} totalCount={ALL_CARD_IDS.length}
            collectionOpen={collectionOpen}
            onToggle={() => setCollectionOpen((o) => !o)}
            t={t}
          />

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
                  <CollectionFilterBar
                    searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    rarityFilter={rarityFilter} setRarityFilter={setRarityFilter}
                    ownedCount={ownedCount} totalCount={ALL_CARD_IDS.length}
                    ownedByRarity={ownedByRarity} mode={mode}
                    voieFilter={voieFilter} setVoieFilter={setVoieFilter}
                    ownedOnly={ownedOnly} setOwnedOnly={setOwnedOnly}
                    inDeckOnly={inDeckOnly} setInDeckOnly={setInDeckOnly}
                    passiveOnly={passiveOnly} setPassiveOnly={setPassiveOnly}
                    anyFilterActive={anyFilterActive} clearAllFilters={clearAllFilters}
                    t={t}
                  />

                  {/* Grouped grid — one section per mana cost present in the
                      filtered set. AnimatePresence on the wrapper smooths the
                      tab/filter switch without re-mounting each card. */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${rarityFilter}-${ownedOnly}-${inDeckOnly}-${passiveOnly}-${voieFilter}-${searchQuery}`}
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
          {t("deck.save")}
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
      <DeckToast deckMsg={deckMsg} />
    </motion.div>
  );
}
