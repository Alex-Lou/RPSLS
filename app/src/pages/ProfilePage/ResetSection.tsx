import { useState } from "react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { SectionCard } from "./SectionCard";

/** Réglages › Zone dangereuse — réinitialisation du profil en 2 temps
 *  (bouton puis confirmation). Action store `resetProfile` inchangée. */
export function ResetSection() {
  const resetProfile = useStore((s) => s.resetProfile);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = useT();

  return (
    <SectionCard tone="danger" title={t("profile.danger.title")} subtitle={t("profile.danger.subtitle")}>
      {!confirmReset ? (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm font-medium"
        >
          {t("profile.danger.reset")}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { resetProfile(); setConfirmReset(false); }}
            className="px-4 py-2.5 rounded-xl bg-rose-500/40 hover:bg-rose-500/60 text-white text-sm font-semibold"
          >
            {t("profile.danger.confirm")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="px-4 py-2.5 rounded-xl bg-hairline text-sm"
          >
            {t("profile.danger.cancel")}
          </button>
        </div>
      )}
    </SectionCard>
  );
}
