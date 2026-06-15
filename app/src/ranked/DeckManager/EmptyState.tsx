/** Shown when filters reduce the collection to zero matches. */
export function EmptyState({ onReset, hasFilters }: { onReset: () => void; hasFilters: boolean }) {
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
