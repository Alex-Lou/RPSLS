import { useStore } from "../../store/store";
import { PAD_META } from "../../types";
import type { PadId } from "../../types";
import { BattlePad } from "../../BattlePad";
import { LazyMount } from "../../fx/LazyMount";
import { PremiumBadge } from "../../ui/PremiumBadge";
import { OwnedBadgeLongPress } from "../../ui/OwnedBadgeLongPress";

/** Pad grid for the active pad bucket (styled / svg / img). Selection logic
 *  (custom import, premium gate, open preview) lives in StyleSection and is
 *  handed in via `onSelect`; this is the presentational grid. */
export function PadGrid({ padTab, onSelect }: { padTab: "styled" | "svg" | "img"; onSelect: (id: PadId) => void }) {
  const player = useStore((s) => s.player);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {(Object.keys(PAD_META) as PadId[]).filter((id) => PAD_META[id].category === padTab).map((id) => {
        const meta = PAD_META[id];
        const active = player.padId === id;
        const isCustom = id === "custom";
        const needsImport = isCustom && (player.customPads?.length ?? 0) === 0;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={
              "group rounded-2xl border overflow-hidden transition text-left " +
              (active
                ? "border-white/40 ring-2 ring-white/20"
                : "border-hairline hover:border-white/30")
            }
          >
            <div className="aspect-[3/2] w-full bg-black/50 relative overflow-hidden"
              style={{
                background: `radial-gradient(ellipse 100% 80% at 30% 20%, ${
                  id === "volcanic" ? "#ff450066" :
                  id === "abyss" ? "#00e5c844" :
                  id === "nebula" ? "#9333ea44" :
                  id === "aurora_borealis" ? "#34d39944" :
                  id === "casino_noir" ? "#fbbf2444" :
                  id === "casino" ? "#10b98144" :
                  id === "holy" ? "#fbbf2433" :
                  id === "quantum" ? "#22d3ee44" :
                  id === "galaxy" ? "#a855f744" :
                  id === "neon" ? "#06b6d444" :
                  id === "cyberpunk" ? "#f0abfc44" :
                  id === "cosmos" ? "#6366f144" :
                  id === "aura" ? "var(--theme-primary, #a855f7)44" :
                  "rgba(100,100,120,0.25)"
                }, transparent 70%), linear-gradient(135deg, rgba(15,15,25,0.95), rgba(25,20,35,0.95))`
              }}
            >
              {/* Real pad, frozen on a settled frame — a representative
                  still that entices, with zero animation cost (the full
                  animation plays when the preview is opened). Deferred
                  via LazyMount so opening the Pads tab doesn't synchronously
                  paint all 13 SVG pads at once: they fade in as you scroll. */}
              {!needsImport && (
                <LazyMount className="absolute inset-0 w-full h-full">
                  <BattlePad padId={id} frozen compact className="w-full h-full" />
                </LazyMount>
              )}
              {active && (
                <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  ACTIVE
                </div>
              )}
              {meta.premiumSetId && (
                (player.ownedPremiumSets ?? []).includes(meta.premiumSetId) ? (
                  <OwnedBadgeLongPress setId={meta.premiumSetId} className="top-2 left-2" />
                ) : (
                  <PremiumBadge variant="ribbon" label="PREMIUM" className="top-2 left-2" />
                )
              )}
              {needsImport && (
                <div className="absolute inset-0 flex items-center justify-center text-ink text-xs font-bold bg-black/45">
                  ＋ Importer
                </div>
              )}
              {isCustom && (player.customPads?.length ?? 0) > 0 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {player.customPads?.length} ✦
                </div>
              )}
            </div>
            <div className="p-3 bg-hairline">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{meta.label}</span>
              </div>
              <p className="text-[11px] text-ink-muted mt-0.5">{meta.tagline}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
