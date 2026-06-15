import { useStore } from "../../store/store";

/**
 * PremiumIntensitySlider — discreet "thermometer" slider that adjusts the
 * signature FX density of the active premium theme. Reads / writes
 * `player.premiumIntensity[setId]`; the active backdrop reads the live
 * value via `usePremiumIntensity(setId)` (see store/store.ts selector) so
 * any drag pulses through to canvas in real time.
 *
 * Range 0.1 – 2.0 with step 0.05. 1.0 = the shipping look; below pours
 * fewer raindrops / fewer petals / fewer sparks; above floods the scene.
 */
export function PremiumIntensitySlider({ setId, label, accent }: {
  setId: string;
  label: string;
  accent: { from: string; to: string } | null;
}) {
  const intensity = useStore((s) => s.player.premiumIntensity?.[setId] ?? 1.0);
  const updateProfile = useStore((s) => s.updateProfile);
  // Range widened to [0.1, 2.0] — Alex flagged that at the previous min
  // (0.4) the rain was still pouring. 0.1 = barely-there sprinkle, 2.0 =
  // a downpour you can't look away from. 1.0 stays the "shipping look".
  const MIN = 0.1, MAX = 2.0;
  const setValue = (v: number) => {
    const clamped = Math.max(MIN, Math.min(MAX, v));
    const current = useStore.getState().player.premiumIntensity ?? {};
    updateProfile({ premiumIntensity: { ...current, [setId]: clamped } });
  };
  // Map [MIN, MAX] -> [0, 100] for the visual fill.
  const fillPct = ((intensity - MIN) / (MAX - MIN)) * 100;
  const accentGrad = accent
    ? `linear-gradient(90deg, ${accent.from}, ${accent.to})`
    : "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))";
  return (
    <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Intensité — {label}
        </h2>
        <span
          className="text-xs font-black tabular-nums px-2 py-0.5 rounded-full"
          style={{
            background: "color-mix(in oklab, var(--theme-primary) 18%, transparent)",
            color: "var(--ink)",
          }}
        >
          {Math.round(intensity * 100)}%
        </span>
      </div>
      <p className="text-[11px] text-ink-faint mb-3 leading-snug">
        Règle la densité des effets signature : pluie, pétales, étincelles, motes…
      </p>
      <div className="relative h-9 flex items-center">
        {/* Track */}
        <div
          className="absolute inset-x-0 h-2 rounded-full"
          style={{ background: "color-mix(in oklab, black 35%, transparent)" }}
        />
        {/* Filled portion (accent gradient) */}
        <div
          className="absolute left-0 h-2 rounded-full pointer-events-none"
          style={{
            width: `${fillPct}%`,
            background: accentGrad,
            boxShadow: "0 0 12px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
          }}
        />
        {/* Tick marks at 50% / 100% / 150% */}
        {[0, 50, 100].map((p) => (
          <div
            key={p}
            aria-hidden
            className="absolute h-3 w-0.5 bg-white/25 rounded-full"
            style={{ left: `calc(${p}% - 1px)` }}
          />
        ))}
        {/* Native input — invisible, drives the value. Custom thumb via CSS. */}
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.05}
          value={intensity}
          onChange={(e) => setValue(parseFloat(e.currentTarget.value))}
          className="relative w-full appearance-none bg-transparent z-10 cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:shadow-lg
                     [&::-webkit-slider-thumb]:border-2
                     [&::-webkit-slider-thumb]:border-white/80
                     [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-white
                     [&::-moz-range-thumb]:border-0"
          aria-label="Intensité des effets premium"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-faint mt-1.5">
        <span>Discret</span>
        <span>Standard</span>
        <span>Intense</span>
      </div>
    </section>
  );
}
