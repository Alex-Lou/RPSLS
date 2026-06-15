import { useStore } from "../../store/store";

/** Privacy — anonymized crash reports + link to the policy. The
 *  toggle drives Sentry.init / Sentry.close in App.tsx. */
export function PrivacySection() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">Confidentialité</h2>
      <label className="flex items-center justify-between gap-3 mb-3 p-3 rounded-xl bg-surface border border-hairline cursor-pointer hover:border-white/20 transition">
        <span className="flex flex-col">
          <span className="text-sm font-bold text-ink">📡 Envoyer les rapports de crash</span>
          <span className="text-[10px] text-ink-faint leading-snug">
            Trace anonymisée envoyée à Sentry quand l'app plante. Aucune donnée personnelle.
          </span>
        </span>
        <input
          type="checkbox"
          checked={player.crashReports ?? false}
          onChange={(e) => updateProfile({ crashReports: e.target.checked })}
          aria-label="Toggle crash reports"
          className="w-5 h-5 accent-violet-500 cursor-pointer"
        />
      </label>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("rpsls:navigate", { detail: "privacy" }))}
        className="w-full text-left text-xs text-violet-300 hover:text-violet-200 underline underline-offset-2"
      >
        Voir la politique de confidentialité complète →
      </button>
    </section>
  );
}
