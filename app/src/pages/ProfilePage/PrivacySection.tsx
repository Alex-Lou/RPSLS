import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { SectionCard } from "./SectionCard";
import { ToggleRow } from "./Toggle";

/** Réglages › Confidentialité — rapports de crash anonymisés + lien vers la
 *  politique. Le champ `crashReports` pilote Sentry.init / close dans App.tsx.
 *  Même Toggle que partout ailleurs (avant : une case à cocher isolée). */
export function PrivacySection() {
  const crashReports = useStore((s) => s.player.crashReports ?? false);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();

  return (
    <SectionCard title={t("profile.privacy.title")}>
      <ToggleRow
        icon="📡"
        title={t("profile.privacy.crash")}
        hint={t("profile.privacy.crashHint")}
        checked={crashReports}
        onChange={(v) => updateProfile({ crashReports: v })}
      />
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("rpsls:navigate", { detail: "privacy" }))}
        className="mt-3 w-full text-left text-xs text-violet-300 hover:text-violet-200 underline underline-offset-2 py-1"
      >
        {t("profile.privacy.policy")}
      </button>
    </SectionCard>
  );
}
