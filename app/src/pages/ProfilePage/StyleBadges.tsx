import { useT } from "../../i18n";
import { PremiumBadge } from "../../ui/PremiumBadge";

/** Pastille « LIVE » : fond animé en temps réel. `inline` = version
 *  statique pour la légende (sinon positionnée en absolu sur la vignette). */
export function LiveChip({ inline = false }: { inline?: boolean }) {
  const t = useT();
  return (
    <span
      className={
        (inline ? "relative inline-flex " : "absolute top-1.5 left-1.5 flex ") +
        "items-center gap-1 bg-cyan-500/85 text-white text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full shadow"
      }
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
      {t("profile.badge.live")}
    </span>
  );
}

/** Pastille « ACTIF » (choix courant). */
export function ActiveChip({ inline = false }: { inline?: boolean }) {
  const t = useT();
  return (
    <span
      className={
        (inline ? "relative inline-flex " : "absolute top-1.5 right-1.5 flex ") +
        "items-center gap-0.5 bg-emerald-500/90 text-white text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full shadow"
      }
    >
      ✓ {t("profile.pad.active")}
    </span>
  );
}

/** Petite légende des pastilles de la grille d'apparences (l'audit relevait
 *  que « LIVE » n'était expliqué nulle part). */
export function StyleLegend() {
  const t = useT();
  return (
    <ul className="flex flex-col gap-1.5 mb-3 p-2.5 rounded-xl bg-hairline border border-hairline text-[11px] text-ink-muted leading-snug">
      <li className="flex items-center gap-2">
        <span className="w-[78px] shrink-0"><LiveChip inline /></span>
        <span>{t("profile.style.legend.live")}</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="w-[78px] shrink-0 relative h-4">
          <PremiumBadge variant="ribbon" label={t("premium.label")} className="left-0 top-0" />
        </span>
        <span>{t("profile.style.legend.premium")}</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="w-[78px] shrink-0"><ActiveChip inline /></span>
        <span>{t("profile.style.legend.active")}</span>
      </li>
    </ul>
  );
}
