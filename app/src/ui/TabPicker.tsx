/**
 * TabPicker — themed pill-row tab switcher.
 *
 * Used wherever a small set of mutually-exclusive views needs a compact
 * switcher (profile cosmetics tabs, pad-category sub-filter, etc.). The
 * selected pill picks up `--theme-primary` via `bg-themed` so the picker
 * matches the active palette without per-call styling.
 */

import type { ReactNode } from "react";

export interface TabPickerOption<T extends string> {
  id: T;
  label: ReactNode;
}

export function TabPicker<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  options: ReadonlyArray<TabPickerOption<T>>;
  value: T;
  onChange: (id: T) => void;
  /** "sm" = px-2.5 (tighter row), "md" = px-3 (default). */
  size?: "sm" | "md";
  /** Extra classes on the container (e.g. "shrink-0"). */
  className?: string;
}) {
  const padX = size === "sm" ? "px-2.5" : "px-3";
  return (
    <div
      className={
        "flex gap-1 p-1 rounded-xl bg-hairline border border-hairline " + className
      }
      role="tablist"
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={
              padX + " py-1 rounded-lg text-xs font-semibold transition " +
              (active ? "bg-themed text-zinc-900 shadow" : "text-ink-muted hover:text-ink")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
