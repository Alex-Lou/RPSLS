import { useRef } from "react";
import { useStore } from "../../store/store";

/**
 * PeekIntensitySlider — VERTICAL slider mounted inside the full-screen
 * backdrop peek overlay. Sits on the right edge so the player can dial the
 * FX density LIVE while previewing the theme — they SEE the rain thin
 * out, the petals slow down, the sparks pour as they drag. Alex's ask:
 * "le bouton de réglage d'intensité doit egalement être présent, vertical
 * sur le côté, pres des aperçus, sinon le joueur ne sait pas qu'il peut
 * bénéficier de ça". The slider docks at right-edge, vertical, with a
 * themed track + glassy thumb + live % readout + a tiny rotated label so
 * the affordance is obvious without taking screen real estate.
 *
 * Range matches PremiumIntensitySlider (0.1 – 2.0). Both write the same
 * `player.premiumIntensity[setId]` field so changes here persist + are
 * picked up by every consumer (StormRain, PremiumTouchLayer, the shader
 * uniform).
 */
export function PeekIntensitySlider({ setId, accent }: {
  setId: string;
  accent: { from: string; to: string } | null;
}) {
  const intensity = useStore((s) => s.player.premiumIntensity?.[setId] ?? 1.0);
  const updateProfile = useStore((s) => s.updateProfile);
  const MIN = 0.1, MAX = 2.0;
  const setValue = (v: number) => {
    const clamped = Math.max(MIN, Math.min(MAX, v));
    const current = useStore.getState().player.premiumIntensity ?? {};
    updateProfile({ premiumIntensity: { ...current, [setId]: clamped } });
  };
  const fillPct = ((intensity - MIN) / (MAX - MIN)) * 100;
  const accentGrad = accent
    ? `linear-gradient(0deg, ${accent.from}, ${accent.to})`
    : "linear-gradient(0deg, var(--theme-primary), var(--theme-secondary))";

  // Custom pointer handler — the rotated <input type="range"> approach
  // didn't work in the Android WebView (touch coordinates weren't being
  // mapped through the rotation, so dragging did nothing — Alex's "le
  // bouton ne bouge pas"). Here we own the pointer events: read the y
  // coordinate relative to the track, invert it (top = MAX), normalise,
  // and call setValue. setPointerCapture keeps the gesture sticky once
  // the user starts dragging, even if the finger drifts off the track.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const onPointerEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const yFromTop = e.clientY - rect.top;
    // Bottom = MIN, Top = MAX. Invert: yNorm at bottom = 0, at top = 1.
    const yNorm = 1 - Math.max(0, Math.min(1, yFromTop / rect.height));
    setValue(MIN + yNorm * (MAX - MIN));
  };

  return (
    // Floats independently of the bottom button column. Pointer-events-none
    // on the wrapper so the rest of the screen stays interactive; the inner
    // track div has pointer-events-auto.
    <div
      className="
        fixed pointer-events-none flex flex-col items-center gap-1
        right-[max(var(--sai-right),8px)]
        top-1/2 -translate-y-1/2
        select-none
      "
    >
      <div className="text-[9px] uppercase tracking-[0.22em] font-black text-white/95 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 drop-shadow">
        Intensité
      </div>
      <div
        className="text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full"
        style={{
          background: "color-mix(in oklab, var(--theme-primary) 80%, black 20%)",
          color: "white",
          boxShadow: "0 4px 12px -4px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
        }}
      >
        {Math.round(intensity * 100)}%
      </div>

      {/* The track — owns all pointer events. Larger hit zone (36px wide)
          even though the visible track is 6px, so the touch target meets
          Material's 48dp minimum guideline. */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Intensité des effets premium"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={intensity}
        className="relative pointer-events-auto touch-none cursor-pointer"
        style={{ width: 36, height: 240 }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onPointerEvent(e);
        }}
        onPointerMove={(e) => {
          // Only update while a button is down (avoids hover-induced updates).
          if (e.buttons === 0) return;
          onPointerEvent(e);
        }}
      >
        {/* Track background */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 h-full rounded-full pointer-events-none"
          style={{
            width: 6,
            background: "rgba(0,0,0,0.55)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        />
        {/* Filled portion */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-full pointer-events-none"
          style={{
            width: 6,
            height: `${fillPct}%`,
            background: accentGrad,
            boxShadow: "0 0 14px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
          }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map((p) => (
          <div
            key={p}
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 w-3 h-0.5 bg-white/30 rounded-full pointer-events-none"
            style={{ bottom: `calc(${p}% - 1px)` }}
          />
        ))}
        {/* Thumb */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            width: 22,
            height: 22,
            bottom: `calc(${fillPct}% - 11px)`,
            background: "white",
            boxShadow:
              "0 4px 14px -2px color-mix(in oklab, var(--theme-primary) 55%, transparent)," +
              "inset 0 0 0 2px color-mix(in oklab, var(--theme-primary) 35%, white)",
          }}
        />
      </div>

      <div className="absolute right-full mr-2 top-9 text-[9px] uppercase tracking-wider font-bold text-white/70 drop-shadow">
        Max
      </div>
      <div className="absolute right-full mr-2 bottom-1 text-[9px] uppercase tracking-wider font-bold text-white/70 drop-shadow">
        Min
      </div>
    </div>
  );
}
