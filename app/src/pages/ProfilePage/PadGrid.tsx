import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { PAD_META } from "../../types";
import type { PadId } from "../../types";
import { BattlePad } from "../../BattlePad";
import { LazyMount } from "../../fx/LazyMount";
import { PremiumBadge } from "../../ui/PremiumBadge";
import { OwnedBadgeLongPress } from "../../ui/OwnedBadgeLongPress";
import { ActiveChip } from "./StyleBadges";
import { padLabel, padTagline } from "./padText";

/** Grille des tapis du compartiment actif (stylés / simples / images). La
 *  logique (import, verrou premium, aperçu) vit dans StyleSection et arrive
 *  via `onSelect` ; ici, présentation seule. Chaque vignette est le VRAI
 *  tapis figé (BattlePad frozen), monté paresseusement. */
export function PadGrid({ padTab, onSelect }: { padTab: "styled" | "svg" | "img"; onSelect: (id: PadId) => void }) {
  const player = useStore((s) => s.player);
  const t = useT();
  const owned = player.ownedPremiumSets ?? [];
  const libCount = player.customPads?.length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {(Object.keys(PAD_META) as PadId[]).filter((id) => PAD_META[id].category === padTab).map((id) => {
        const meta = PAD_META[id];
        const active = player.padId === id;
        const isCustom = id === "custom";
        const needsImport = isCustom && libCount === 0;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(id)}
            className={
              "group rounded-2xl border overflow-hidden transition text-left flex flex-col " +
              (active ? "border-emerald-400/70 ring-2 ring-emerald-400/30" : "border-hairline hover:border-white/30")
            }
          >
            <div className="aspect-[3/2] w-full relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950">
              {!needsImport && (
                <LazyMount className="absolute inset-0 w-full h-full">
                  <BattlePad padId={id} frozen compact className="w-full h-full" />
                </LazyMount>
              )}
              {active && <ActiveChip />}
              {meta.premiumSetId && (
                owned.includes(meta.premiumSetId) ? (
                  <OwnedBadgeLongPress setId={meta.premiumSetId} className="top-1.5 left-1.5" />
                ) : (
                  <PremiumBadge variant="ribbon" label={t("premium.label")} className="top-1.5 left-1.5" />
                )
              )}
              {needsImport && (
                <div className="absolute inset-0 flex items-center justify-center text-ink text-xs font-bold bg-black/45">
                  {t("profile.style.import")}
                </div>
              )}
              {isCustom && libCount > 0 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {libCount} ✦
                </div>
              )}
            </div>
            <div className="px-2.5 py-2 bg-surface flex-1">
              <span className="block text-xs font-semibold truncate">{padLabel(t, id)}</span>
              <p className="text-[10px] text-ink-faint mt-0.5 leading-snug line-clamp-2">{padTagline(t, id)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
