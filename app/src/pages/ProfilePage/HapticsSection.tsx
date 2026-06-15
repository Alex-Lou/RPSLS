import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { hapticTap, hapticMatchStart } from "../../haptic";

export function HapticsSection() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-1">
        {t("profile.haptic.title")}
      </h2>
      <p className="text-xs text-ink-faint mb-3">
        {t("profile.haptic.subtitle")}
      </p>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-sm text-ink-muted">{t("profile.haptic.enable")}</span>
        <button
          onClick={() => updateProfile({ hapticEnabled: !(player.hapticEnabled ?? true) })}
          className={
            "w-12 h-7 rounded-full transition relative " +
            ((player.hapticEnabled ?? true)
              ? "bg-emerald-500/70"
              : "bg-zinc-700")
          }
        >
          <span
            className={
              "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all " +
              ((player.hapticEnabled ?? true) ? "left-[22px]" : "left-0.5")
            }
          />
        </button>
      </div>
      <div className={"grid grid-cols-3 gap-2 " + ((player.hapticEnabled ?? true) ? "" : "opacity-40 pointer-events-none")}>
        {(["low", "med", "high"] as const).map((lvl) => {
          const active = (player.hapticIntensity ?? "med") === lvl;
          return (
            <button
              key={lvl}
              onClick={() => {
                updateProfile({ hapticIntensity: lvl });
                // Give a sample buzz at the new level so the player
                // can actually feel the difference between pills.
                setTimeout(() => hapticTap(), 60);
              }}
              className={
                "rounded-xl py-2 text-xs font-semibold border transition " +
                (active
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                  : "border-hairline bg-hairline text-ink-muted hover:bg-hairline")
              }
            >
              {t(`profile.haptic.${lvl}`)}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => hapticMatchStart()}
        className={
          "mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition " +
          ((player.hapticEnabled ?? true)
            ? "border-violet-400/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
            : "opacity-40 pointer-events-none border-hairline bg-hairline text-ink-faint")
        }
      >
        {t("profile.haptic.test")}
      </button>
    </section>
  );
}
