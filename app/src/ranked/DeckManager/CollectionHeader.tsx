import { hapticTap } from "../../haptic";

/** En-tête repliable de la collection (compteur possédées + barre de
 *  progression). Extrait VERBATIM du DeckManager. */
export function CollectionHeader({ ownedCount, totalCount, collectionOpen, onToggle, t }: {
  ownedCount: number;
  totalCount: number;
  collectionOpen: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  return (
    <button
      onClick={() => { hapticTap(); onToggle(); }}
      className="w-full flex items-center justify-between gap-2 group"
    >
      <span className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
          {t("deck.collection")}
        </span>
        <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full bg-hairline text-ink-muted">
          {ownedCount}/{totalCount}
        </span>
        {/* Soft progress bar — at-a-glance "how complete is my collection". */}
        <span className="hidden sm:inline-flex h-1.5 w-20 rounded-full bg-hairline overflow-hidden">
          <span
            className="h-full bg-themed transition-all duration-500"
            style={{ width: `${Math.round((ownedCount / totalCount) * 100)}%` }}
          />
        </span>
      </span>
      <span className={"text-ink-faint text-xs transition-transform duration-200 " + (collectionOpen ? "rotate-180" : "")}>▾</span>
    </button>
  );
}
