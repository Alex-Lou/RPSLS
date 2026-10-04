import { useStore } from "../../store/store";
import { hapticTap } from "../../haptic";
import { AUTO_LEVEL, type GraphicsLevel } from "../../graphics/graphicsQuality";
import { useT } from "../../i18n";
import { SectionCard, SubHeading } from "./SectionCard";
import { ChoiceGrid } from "./Toggle";

/** Réglages › Affichage : taille du texte (accessibilité, pilote
 *  --font-scale dans App.tsx) + qualité graphique PAR APPAREIL
 *  (`graphicsQuality` non synchronisé ; `undefined` = Auto). Mêmes patches
 *  `updateProfile` qu'avant, au caractère près. */
export function DisplaySection() {
  const fontScale = useStore((s) => s.player.fontScale ?? 1);
  const quality = useStore((s) => s.player.graphicsQuality);
  const measured = useStore((s) => s.player.graphicsMeasured);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();
  const effective = quality ?? measured ?? AUTO_LEVEL;
  const lvl = (l: GraphicsLevel) => t("profile.gfx." + l);

  const sizes = [
    { key: "n", value: 1, label: t("profile.a11y.normal"), demo: "text-sm" },
    { key: "l", value: 1.15, label: t("profile.a11y.large"), demo: "text-base" },
    { key: "xl", value: 1.3, label: t("profile.a11y.xlarge"), demo: "text-lg" },
  ] as const;

  return (
    <SectionCard title={t("profile.display.title")}>
      <SubHeading>{t("profile.a11y.title")}</SubHeading>
      <p className="text-[11px] text-ink-faint leading-snug mb-2.5">{t("profile.a11y.subtitle")}</p>
      <ChoiceGrid<number>
        options={sizes.map((o) => ({
          key: o.key,
          value: o.value,
          label: (
            <>
              <span className={o.demo + " font-bold leading-none"} aria-hidden>Aa</span>
              <span className="text-[11px] font-medium">{o.label}</span>
            </>
          ),
        }))}
        value={fontScale}
        onPick={(v) => { hapticTap(); updateProfile({ fontScale: v }); }}
      />

      <div className="mt-5">
        <SubHeading>{t("profile.gfx.title")}</SubHeading>
        <p className="text-[11px] text-ink-faint leading-snug mb-2.5">{t("profile.gfx.subtitle")}</p>
        <ChoiceGrid<GraphicsLevel | undefined>
          cols={4}
          options={([
            { key: "auto", value: undefined, label: t("profile.gfx.auto"), hint: t("profile.gfx.detected", { lvl: lvl(AUTO_LEVEL) }) },
            { key: "low", value: "low", label: lvl("low"), hint: t("profile.gfx.hint.low") },
            { key: "medium", value: "medium", label: lvl("medium"), hint: t("profile.gfx.hint.medium") },
            { key: "high", value: "high", label: lvl("high"), hint: t("profile.gfx.hint.high") },
          ] as Array<{ key: string; value: GraphicsLevel | undefined; label: string; hint: string }>).map((o) => ({ ...o, label: <span className="text-sm font-bold leading-none">{o.label}</span> }))}
          value={quality}
          onPick={(v) => {
            hapticTap();
            updateProfile(v === undefined ? { graphicsQuality: undefined, graphicsMeasured: undefined } : { graphicsQuality: v });
          }}
        />
        <p className="text-[11px] text-ink-faint mt-2.5 text-center">
          {t("profile.gfx.activeTier")}{" "}
          <span className="text-ink-muted font-semibold">{lvl(effective)}</span>
          {quality === undefined && (measured ? ` (${t("profile.gfx.autoMeasured")})` : ` (${t("profile.gfx.autoTag")})`)}
        </p>
      </div>
    </SectionCard>
  );
}
