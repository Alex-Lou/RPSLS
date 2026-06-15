import { CardCell } from "./CardCell";
import type { CardId } from "../rankedTypes";

/** Section divider + grid for one mana-cost bucket. Header shows the mana
 *  cost as visual pips so the player reads the curve graphically, not as text. */
export function ManaGroup({
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
