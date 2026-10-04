import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { BACKGROUNDS } from "../../theme/themes";
import { PremiumBadge } from "../../ui/PremiumBadge";
import { OwnedBadgeLongPress } from "../../ui/OwnedBadgeLongPress";
import { AppearanceThumb } from "./AppearanceThumb";
import { ActiveChip, LiveChip } from "./StyleBadges";

/** Grille des apparences — une tuile par fond enregistré. La logique de
 *  sélection (instantané → application → aperçu plein écran, verrou premium)
 *  vit dans StyleSection et arrive via `onSelect` ; ici, présentation seule. */
export function BackgroundGrid({ onSelect }: { onSelect: (bg: (typeof BACKGROUNDS)[number]) => void }) {
  const player = useStore((s) => s.player);
  const t = useT();
  const owned = player.ownedPremiumSets ?? [];
  const libCount = player.customBgs?.length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {BACKGROUNDS.map((bg) => {
        const active = (player.backgroundId ?? "default") === bg.id;
        const animated = !!(bg.scene || bg.premiumScene);
        const label = bg.custom ? t("profile.style.myImage") : bg.label;
        return (
          <button
            key={bg.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(bg)}
            className={
              "group rounded-2xl border overflow-hidden transition text-left " +
              (active ? "border-emerald-400/70 ring-2 ring-emerald-400/30" : "border-hairline hover:border-white/30")
            }
          >
            <div className="aspect-[3/2] w-full relative overflow-hidden bg-surface-raised">
              <AppearanceThumb bg={bg} customUrl={bg.custom ? player.customBgUrl : undefined} />
              {active && <ActiveChip />}
              {bg.premiumSetId ? (
                owned.includes(bg.premiumSetId) ? (
                  <OwnedBadgeLongPress setId={bg.premiumSetId} className="top-1.5 left-1.5" />
                ) : (
                  <PremiumBadge variant="ribbon" label={t("premium.label")} className="top-1.5 left-1.5" />
                )
              ) : (
                animated && <LiveChip />
              )}
              {bg.custom && libCount === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-xs font-bold">
                  {t("profile.style.import")}
                </div>
              )}
              {bg.custom && libCount > 0 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {libCount} ✦
                </div>
              )}
            </div>
            <div className="px-2.5 py-2 bg-surface flex items-center gap-2">
              {bg.miniature && (
                <img src={bg.miniature} alt="" draggable={false} className="w-6 h-6 shrink-0 object-contain select-none" />
              )}
              <span className="text-xs font-semibold truncate">{label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
