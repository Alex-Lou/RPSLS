import { motion } from "motion/react";
import { useT } from "../../i18n";
import { hapticTap } from "../../haptic";
import type { ProfileTab } from "./useProfileTab";

/** Contrôle segmenté « Profil | Réglages » en tête de page. Pleine largeur,
 *  cibles de 44 px, indicateur animé (layoutId) aux couleurs du thème. */
export function ProfileTabBar({ value, onChange }: { value: ProfileTab; onChange: (t: ProfileTab) => void }) {
  const t = useT();
  const tabs: Array<{ id: ProfileTab; label: string; icon: string }> = [
    { id: "profile", label: t("profile.tab.profile"), icon: "👤" },
    { id: "settings", label: t("profile.tab.settings"), icon: "⚙️" },
  ];
  return (
    <div
      role="tablist"
      aria-label={t("profile.tabs.aria")}
      className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface border border-hairline"
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            id={`profile-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`profile-panel-${tab.id}`}
            onClick={() => { if (!active) { hapticTap(); onChange(tab.id); } }}
            className={
              "relative h-11 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 " +
              (active ? "text-zinc-900" : "text-ink-muted hover:text-ink")
            }
          >
            {active && (
              <motion.span
                layoutId="profile-tab-pill"
                className="absolute inset-0 rounded-xl bg-themed shadow"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative" aria-hidden>{tab.icon}</span>
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
