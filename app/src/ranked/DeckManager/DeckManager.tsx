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
import { ALL_CARD_IDS, CARDS, isPassiveCard, RARITY_ORDER, STARTER_COLLECTION } from "../cards";
import { ARENA_LEGENDARY_CAP, isDeckable, resolveArenaDeckSource } from "../../arena/arenaDecks";
import { SIGNATURE_DECK, VOIE_DEF } from "../../arena/arenaVoies";
import type { Move } from "../../engine/game";

/** Filtre de collection par Voie en Arène (Alex 2026-06-22 « un filtre pour
 *  chaque voie ») : "myvoie" = ta Voie active + neutres ; un Move = cette Voie ;
 *  "neutral" = cartes neutres ; "all" = tout. */
type VoieFilter = "myvoie" | "neutral" | "all" | Move;
/** Symboles RPSLS des chips de Voie (décoratifs). */
const VOIE_CHIP_ICON: Record<Move, string> = {
  rock: "⛰", paper: "🌿", scissors: "⚔", lizard: "🦎", spock: "🖖",
};
import type { CardId, CardRarity } from "../rankedTypes";
import { useT } from "../../i18n";
import { useNoMenuFx } from "../../fx/menuFx";
import { CurrencyBadges } from "../CurrencyBadges";
import { hapticTap } from "../../haptic";
import { setBurgerHidden } from "../../Sidebar";
import { SLOTS_BY_MODE, RARITY_FR, RARITY_DOT, RARITY_RING } from "./deckManagerConstants";
import { DeckSlot } from "./DeckSlot";
import { CardDetailModal } from "./CardDetailModal";
import { RarityTab, FilterChip } from "./collectionFilters";
import { ManaGroup } from "./ManaGroup";
import { EmptyState } from "./EmptyState";

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
      // ARÈNE : ne montrer que les cartes réellement équipables (isDeckable =
      // source unique, cf. arenaDecks). Masque les cartes sans effet Arène
      // (no-op Classé : gambit, boussole…) et les Finishers (injectés à jauge
      // pleine, non draftables) — sinon le builder les laissait équiper puis
      // buildPlayerDeck les retirait au match (UX trompeuse). Le Classé reste
      // inchangé (montre toute la collection).
      if (mode === "arena" && !isDeckable(id)) return false;
      if (rarityFilter !== "all" && card.rarity !== rarityFilter) return false;
      if (ownedOnly && !collection.includes(id)) return false;
      if (inDeckOnly && !usedInDeck.has(id)) return false;
      if (passiveOnly && !isPassiveCard(id)) return false;
      // VOIE (arène) : masque les cartes d'une AUTRE Voie ; garde tes signatures
      // (voie===affinity) + les neutres (voie absente).
      if (mode === "arena") {
        const cv = card.voie;
        if (voieFilter === "myvoie") {
          if (arenaAffinity && cv !== undefined && cv !== arenaAffinity) return false;
        } else if (voieFilter === "neutral") {
          if (cv !== undefined) return false;
        } else if (voieFilter !== "all") {
          if (cv !== voieFilter) return false;
        }
      }
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
  }, [rarityFilter, ownedOnly, inDeckOnly, passiveOnly, voieFilter, arenaAffinity, mode, searchQuery, collection, usedInDeck, t]);

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

                  {/* FILTRE PAR VOIE (arène, Alex 2026-06-22) — voir CHAQUE Voie
                      distinctement (fini « tout est mélangé »). Single-select. */}
                  {mode === "arena" && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 no-scrollbar">
                      <FilterChip
                        active={voieFilter === "myvoie"}
                        onClick={() => { hapticTap(); setVoieFilter("myvoie"); }}
                        icon="✦"
                        label="Ma Voie"
                      />
                      {(["rock", "paper", "scissors", "lizard", "spock"] as const).map((m) => (
                        <FilterChip
                          key={m}
                          active={voieFilter === m}
                          onClick={() => { hapticTap(); setVoieFilter(m); }}
                          icon={VOIE_CHIP_ICON[m]}
                          label={VOIE_DEF[m].shortLabel}
                        />
                      ))}
                      <FilterChip
                        active={voieFilter === "neutral"}
                        onClick={() => { hapticTap(); setVoieFilter("neutral"); }}
                        icon="○"
                        label="Neutres"
                      />
                      <FilterChip
                        active={voieFilter === "all"}
                        onClick={() => { hapticTap(); setVoieFilter("all"); }}
                        icon="∗"
                        label="Toutes"
                      />
                    </div>
                  )}

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
            style={{ top: "calc(var(--sai-top) + 3.5rem)" }}
          >
            {deckMsg.tone === "good" ? "✓ " : deckMsg.tone === "warn" ? "⚠ " : "↺ "}
            {deckMsg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
