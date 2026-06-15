import { useStore } from "../../store/store";
import { hapticTap } from "../../haptic";

/** Accessibility — global text size. Drives --font-scale in App.tsx. */
export function AccessibilitySection() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">Accessibilité</h2>
      <p className="text-xs text-ink-faint mb-3">Taille du texte dans toute l'application.</p>
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: "Normal", value: 1, demo: "text-sm" },
          { label: "Grand", value: 1.15, demo: "text-base" },
          { label: "Très grand", value: 1.3, demo: "text-lg" },
        ] as const).map((opt) => {
          const active = (player.fontScale ?? 1) === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => { hapticTap(); updateProfile({ fontScale: opt.value }); }}
              className={
                "flex flex-col items-center gap-1 py-3 rounded-xl border transition " +
                (active
                  ? "border-white/40 bg-hairline text-white"
                  : "border-hairline bg-hairline text-ink-muted hover:border-white/25")
              }
            >
              <span className={opt.demo + " font-bold leading-none"}>Aa</span>
              <span className="text-[11px] font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
