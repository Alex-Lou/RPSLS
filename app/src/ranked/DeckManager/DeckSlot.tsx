import { useT } from "../../i18n";
import { CARDS } from "../cards";
import { CardImage } from "../CardImage";
import type { CardId } from "../rankedTypes";

export function DeckSlot({
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
