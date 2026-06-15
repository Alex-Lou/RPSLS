import { useStore } from "../../store/store";
import { BACKGROUNDS } from "../../theme/themes";
import { PremiumBadge } from "../../ui/PremiumBadge";
import { OwnedBadgeLongPress } from "../../ui/OwnedBadgeLongPress";

/** Appearance grid — one tile per registered background. Selection logic
 *  (snapshot → apply → peek, premium gating) lives in StyleSection and is
 *  handed in via `onSelect`; this component is the presentational grid. */
export function BackgroundGrid({ onSelect }: { onSelect: (bg: (typeof BACKGROUNDS)[number]) => void }) {
  const player = useStore((s) => s.player);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {BACKGROUNDS.map((bg) => {
        const active = (player.backgroundId ?? "default") === bg.id;
        return (
          <button
            key={bg.id}
            onClick={() => onSelect(bg)}
            className={
              "group rounded-2xl border overflow-hidden transition text-left " +
              (active
                ? "border-white/40 ring-2 ring-white/20"
                : "border-hairline hover:border-white/30")
            }
          >
            <div
              className="aspect-[3/2] w-full relative bg-surface-raised overflow-hidden"
              style={
                bg.custom && player.customBgUrl
                  ? { backgroundImage: `url("${player.customBgUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }
                  : bg.src
                  ? { backgroundImage: `url("${bg.src}")`, backgroundSize: "cover", backgroundPosition: "center" }
                  : bg.accent
                  ? {
                      // Coded scene OR accent-only: preview its palette as a
                      // soft two-point glow so the thumbnail telegraphs the
                      // live colours of the procedural backdrop.
                      backgroundImage:
                        `radial-gradient(120% 90% at 15% 0%, ${bg.accent.from}99, transparent 60%), ` +
                        `radial-gradient(120% 90% at 100% 100%, ${bg.accent.to}88, transparent 60%)`,
                    }
                  : {
                      backgroundImage:
                        "radial-gradient(120% 80% at 20% 0%, rgba(124,92,255,0.45), transparent 60%), radial-gradient(120% 80% at 100% 100%, rgba(45,212,191,0.35), transparent 60%)",
                    }
              }
            >
              {active && (
                <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ACTIVE
                </div>
              )}
              {bg.scene && (
                <div className="absolute top-2 left-2 bg-cyan-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✦ LIVE
                </div>
              )}
              {bg.premiumSetId && (
                (player.ownedPremiumSets ?? []).includes(bg.premiumSetId) ? (
                  <OwnedBadgeLongPress setId={bg.premiumSetId} className="top-2 left-2" />
                ) : (
                  <PremiumBadge variant="ribbon" label="PREMIUM" className="top-2 left-2" />
                )
              )}
              {bg.custom && (player.customBgs?.length ?? 0) === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-xs font-bold">
                  ＋ Importer
                </div>
              )}
              {bg.custom && (player.customBgs?.length ?? 0) > 0 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {player.customBgs?.length} ✦
                </div>
              )}
            </div>
            <div className="p-2.5 bg-surface">
              <div className="flex items-center gap-2">
                {bg.miniature ? (
                  <img
                    src={bg.miniature}
                    alt=""
                    draggable={false}
                    className="w-7 h-7 shrink-0 object-contain select-none"
                  />
                ) : null}
                <span className="text-xs font-semibold truncate">{bg.label}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
