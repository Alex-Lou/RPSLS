import type { ReactNode } from "react";
import { hapticTap } from "../../haptic";

/** Interrupteur unique de la page Profil (vibrations, combat rapide,
 *  rapports de crash…). Avant : un switch maison ici, une case à cocher
 *  là — l'audit pointait l'incohérence. Rôle ARIA `switch` + aria-checked. */
export function Toggle({
  checked, onChange, label, disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Libellé accessible (le texte visible est porté par ToggleRow). */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => { hapticTap(); onChange(!checked); }}
      className={
        "relative shrink-0 w-12 h-7 rounded-full transition-colors duration-200 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 " +
        (checked ? "bg-emerald-500" : "bg-zinc-600") +
        (disabled ? " opacity-40" : "")
      }
    >
      <span
        aria-hidden
        className={
          "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all duration-200 " +
          (checked ? "left-[22px]" : "left-0.5")
        }
      />
    </button>
  );
}

/** Ligne « libellé + aide + interrupteur ». Toute la ligne est cliquable
 *  (cible tactile large), l'interrupteur reste l'élément accessible. */
export function ToggleRow({
  checked, onChange, title, hint, icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      onClick={(e) => {
        // Un clic sur la ligne (hors interrupteur) bascule aussi la valeur.
        if ((e.target as HTMLElement).closest("[role=switch]")) return;
        hapticTap();
        onChange(!checked);
      }}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-hairline bg-hairline cursor-pointer select-none"
    >
      <span className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="text-lg leading-none mt-0.5 shrink-0" aria-hidden>{icon}</span>}
        <span className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-ink">{title}</span>
          {hint && <span className="text-[11px] text-ink-faint leading-snug">{hint}</span>}
        </span>
      </span>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** Rangée de « pastilles » à choix unique (intensité, taille du texte,
 *  qualité…) — même rendu partout dans les Réglages. */
export function ChoiceGrid<T extends string | number | undefined>({
  options, value, onPick, cols = 3, disabled = false,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode; hint?: ReactNode; key: string }>;
  value: T;
  onPick: (v: T) => void;
  cols?: 2 | 3 | 4;
  disabled?: boolean;
}) {
  const grid = cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";
  return (
    <div
      role="radiogroup"
      className={"grid gap-2 " + grid + (disabled ? " opacity-40 pointer-events-none" : "")}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onPick(opt.value)}
            className={
              "flex flex-col items-center justify-center gap-1 min-h-[52px] py-2.5 px-1 rounded-xl border transition " +
              (active
                ? "border-white/45 bg-white/10 text-ink"
                : "border-hairline bg-hairline text-ink-muted hover:border-white/25")
            }
          >
            {opt.label}
            {opt.hint && <span className="text-[10px] font-medium text-ink-faint leading-tight">{opt.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
