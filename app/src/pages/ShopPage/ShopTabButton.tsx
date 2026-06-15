/* ─────────── Tab pill ─────────── */

export function ShopTabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "py-2 rounded-xl text-sm font-bold transition " +
        (on ? "bg-themed text-white shadow" : "text-ink-muted hover:text-white")
      }
    >
      {children}
    </button>
  );
}
