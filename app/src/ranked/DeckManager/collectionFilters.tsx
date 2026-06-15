/* ────────────── Collection helpers ────────────── */

/** Rarity tab pill — when active, gets a tinted ring + bg in the rarity color;
 *  when inactive, a quiet hairline outline. The count "owned/total" is the
 *  primary scannable info, the rarity dot the secondary one. */
export function RarityTab({
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
export function FilterChip({
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
