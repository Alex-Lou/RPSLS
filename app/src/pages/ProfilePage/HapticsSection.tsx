import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { hapticTap, hapticMatchStart } from "../../haptic";
import { SectionCard } from "./SectionCard";
import { ChoiceGrid, ToggleRow } from "./Toggle";

/** Réglages › Vibrations : interrupteur + intensité + bouton de test.
 *  Champs inchangés (`hapticEnabled`, `hapticIntensity`, défauts true / med). */
export function HapticsSection() {
  const enabled = useStore((s) => s.player.hapticEnabled ?? true);
  const intensity = useStore((s) => s.player.hapticIntensity ?? "med");
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();

  return (
    <SectionCard title={t("profile.haptic.title")} subtitle={t("profile.haptic.subtitle")}>
      <ToggleRow
        icon="📳"
        title={t("profile.haptic.enable")}
        checked={enabled}
        onChange={(v) => updateProfile({ hapticEnabled: v })}
      />
      <div className="mt-3">
        <span className="block text-[11px] text-ink-faint mb-1.5">{t("profile.haptic.intensity")}</span>
        <ChoiceGrid
          disabled={!enabled}
          options={(["low", "med", "high"] as const).map((lvl) => ({
            key: lvl,
            value: lvl,
            label: <span className="text-xs font-semibold">{t(`profile.haptic.${lvl}`)}</span>,
          }))}
          value={intensity}
          onPick={(lvl) => {
            updateProfile({ hapticIntensity: lvl });
            // Petite vibration au nouveau niveau pour sentir la différence.
            setTimeout(() => hapticTap(), 60);
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => hapticMatchStart()}
        disabled={!enabled}
        className={
          "mt-3 w-full py-2.5 rounded-xl text-xs font-semibold border transition " +
          (enabled
            ? "border-white/20 bg-white/5 text-ink hover:bg-white/10"
            : "opacity-40 border-hairline bg-hairline text-ink-faint")
        }
      >
        {t("profile.haptic.test")}
      </button>
    </SectionCard>
  );
}
