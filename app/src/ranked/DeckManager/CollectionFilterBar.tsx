import { hapticTap } from "../../haptic";
import { VOIE_DEF } from "../../arena/arenaVoies";
import { RARITY_ORDER } from "../cards";
import type { CardRarity } from "../rankedTypes";
import { RARITY_TAB_KEY, RARITY_DOT, RARITY_RING, VOIE_CHIP_ICON, type VoieFilter } from "./deckManagerConstants";
import { RarityTab, FilterChip } from "./collectionFilters";

/** Barre de filtres de la collection (recherche, onglets de rareté, Voies en
 *  arène, bascules possédées/deck/passives). Extraite VERBATIM du DeckManager
 *  (rendu en fragment → DOM inchangé). */
export function CollectionFilterBar({
  searchQuery, setSearchQuery, rarityFilter, setRarityFilter, ownedCount, totalCount,
  ownedByRarity, mode, voieFilter, setVoieFilter, ownedOnly, setOwnedOnly,
  inDeckOnly, setInDeckOnly, passiveOnly, setPassiveOnly, anyFilterActive,
  clearAllFilters, t,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  rarityFilter: CardRarity | "all";
  setRarityFilter: (r: CardRarity | "all") => void;
  ownedCount: number;
  totalCount: number;
  ownedByRarity: Record<CardRarity, { owned: number; total: number }>;
  mode: "ranked" | "arena";
  voieFilter: VoieFilter;
  setVoieFilter: (v: VoieFilter) => void;
  ownedOnly: boolean;
  setOwnedOnly: (f: (v: boolean) => boolean) => void;
  inDeckOnly: boolean;
  setInDeckOnly: (f: (v: boolean) => boolean) => void;
  passiveOnly: boolean;
  setPassiveOnly: (f: (v: boolean) => boolean) => void;
  anyFilterActive: boolean;
  clearAllFilters: () => void;
  t: (key: string) => string;
}) {
  return (
    <>
      {/* Search box — compact, with a clear (✕) when active. */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs pointer-events-none">🔍</span>
        <input
          type="text"
          inputMode="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("deck.searchPlaceholder")}
          className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-surface-raised border border-hairline focus:border-white/40 focus:outline-none text-white placeholder:text-ink-faint transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            aria-label={t("deck.clearSearch")}
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
          label={t("deck.filter.all")}
          count={`${ownedCount}/${totalCount}`}
          dotClass="bg-white/70"
        />
        {RARITY_ORDER.map((r) => (
          <RarityTab
            key={r}
            active={rarityFilter === r}
            onClick={() => { hapticTap(); setRarityFilter(r); }}
            label={t(RARITY_TAB_KEY[r])}
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
            label={t("deck.filter.myPath")}
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
            label={t("deck.filter.neutral")}
          />
          <FilterChip
            active={voieFilter === "all"}
            onClick={() => { hapticTap(); setVoieFilter("all"); }}
            icon="∗"
            label={t("deck.filter.all")}
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
          label={t("deck.filter.owned")}
        />
        <FilterChip
          active={inDeckOnly}
          onClick={() => { hapticTap(); setInDeckOnly((v) => !v); }}
          icon="✓"
          label={t("deck.filter.inDeck")}
        />
        <FilterChip
          active={passiveOnly}
          onClick={() => { hapticTap(); setPassiveOnly((v) => !v); }}
          icon="∞"
          label={t("deck.filter.passive")}
        />
        {anyFilterActive && (
          <button
            onClick={() => { hapticTap(); clearAllFilters(); }}
            className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted hover:text-white px-2 py-1 transition"
          >
            {t("deck.reset")}
          </button>
        )}
      </div>
    </>
  );
}
