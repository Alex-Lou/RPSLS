import { useStore } from "../../store/store";
import { hapticTap } from "../../haptic";
import { AUTO_LEVEL, type GraphicsLevel } from "../../graphics/graphicsQuality";

const LEVEL_LABEL: Record<GraphicsLevel, string> = { low: "Bas", medium: "Moyen", high: "Haut" };

/** Qualité graphique (perf). Réduit les effets coûteux (intro, auras de Voie,
 *  pluie premium, traînées tactiles, particules de menu) pour gagner en
 *  fluidité sur les appareils modestes. PER-APPAREIL : `graphicsQuality` n'est
 *  pas synchronisé au serveur, donc régler la tablette ne touche pas le tél.
 *  `undefined` = Auto (palier détecté pour cet appareil). Alex 2026-06-20. */
export function GraphicsSection() {
  const quality = useStore((s) => s.player.graphicsQuality);
  const measured = useStore((s) => s.player.graphicsMeasured);
  const updateProfile = useStore((s) => s.updateProfile);
  const effective = quality ?? measured ?? AUTO_LEVEL;

  const opts: Array<{ label: string; value: GraphicsLevel | undefined; hint: string }> = [
    { label: "Auto", value: undefined, hint: `détecté : ${LEVEL_LABEL[AUTO_LEVEL]}` },
    { label: "Bas", value: "low", hint: "fluide" },
    { label: "Moyen", value: "medium", hint: "équilibré" },
    { label: "Haut", value: "high", hint: "max effets" },
  ];

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">Qualité graphique</h2>
      <p className="text-xs text-ink-faint mb-3">
        Allège les effets (intro, auras, pluie, traînées tactiles) pour gagner en fluidité sur les appareils modestes. Réglage propre à CET appareil.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((opt) => {
          const active = quality === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => { hapticTap(); updateProfile(opt.value === undefined ? { graphicsQuality: undefined, graphicsMeasured: undefined } : { graphicsQuality: opt.value }); }}
              className={
                "flex flex-col items-center gap-1 py-3 rounded-xl border transition " +
                (active
                  ? "border-white/40 bg-hairline text-white"
                  : "border-hairline bg-hairline text-ink-muted hover:border-white/25")
              }
            >
              <span className="text-sm font-bold leading-none">{opt.label}</span>
              <span className="text-[10px] font-medium text-ink-faint">{opt.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-faint mt-3 text-center">
        Palier actif : <span className="text-ink-muted font-semibold">{LEVEL_LABEL[effective]}</span>
        {quality === undefined && (measured ? " (auto · mesuré)" : " (auto)")}
      </p>
    </section>
  );
}
