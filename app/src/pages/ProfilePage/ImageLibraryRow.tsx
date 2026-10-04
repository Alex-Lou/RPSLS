import { useT } from "../../i18n";

/**
 * ImageLibraryRow — bandeau horizontal des images importées par le joueur
 * (fonds OU tapis). Chaque tuile montre l'image, entoure l'active en vert et
 * propose un « × » pour la retirer de la bibliothèque. Une tuile « + »
 * finale déclenche `onAdd` tant que le plafond n'est pas atteint.
 */
export function ImageLibraryRow({
  title, items, activeUrl, max, aspect, onPick, onDelete, onAdd,
}: {
  title: string;
  items: string[];
  activeUrl: string | undefined;
  max: number;
  /** Classe Tailwind de ratio des tuiles, ex. "aspect-[9/16]" ou "aspect-[3/2]". */
  aspect: string;
  onPick: (url: string) => void;
  onDelete: (url: string) => void;
  onAdd: () => void;
}) {
  const t = useT();
  if (items.length === 0) return null;
  const full = items.length >= max;
  return (
    <div className="mt-4 pt-4 border-t border-white/8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</h3>
        <span className="text-[10px] text-ink-faint tabular-nums">{items.length} / {max}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 pt-1.5">
        {items.map((url) => {
          const isActive = activeUrl === url;
          return (
            <div key={url} className="relative shrink-0 group">
              <button
                type="button"
                onClick={() => onPick(url)}
                className={
                  "block w-20 " + aspect + " rounded-xl overflow-hidden border-2 transition " +
                  (isActive
                    ? "border-emerald-400/80 ring-2 ring-emerald-400/30 shadow-md shadow-emerald-500/30"
                    : "border-hairline hover:border-white/40")
                }
                style={{ backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center" }}
                aria-label={isActive ? t("profile.lib.activeAria") : t("profile.lib.pickAria")}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(url); }}
                aria-label={t("profile.lib.deleteAria")}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center shadow-md border border-rose-300/60"
              >
                ×
              </button>
              {isActive && (
                <div className="absolute bottom-1 left-1 bg-emerald-500/90 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  {t("profile.pad.active")}
                </div>
              )}
            </div>
          );
        })}
        {!full && (
          <button
            type="button"
            onClick={onAdd}
            className={
              "shrink-0 w-20 " + aspect +
              " rounded-xl border-2 border-dashed border-white/20 hover:border-white/45 hover:bg-hairline transition flex flex-col items-center justify-center gap-1 text-ink-muted"
            }
            aria-label={t("profile.lib.addAria")}
          >
            <span className="text-xl leading-none">＋</span>
            <span className="text-[10px] font-semibold">{t("profile.lib.add")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
