import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { DIFFICULTY_META } from "../../types";
import type { Difficulty } from "../../types";

export function DifficultySection() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-1">
        {t("profile.diff.title")}
      </h2>
      <p className="text-xs text-ink-faint mb-3">
        {t("profile.diff.subtitle")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((id) => {
          const active = player.difficulty === id;
          return (
            <button
              key={id}
              onClick={() => updateProfile({ difficulty: id })}
              className={
                "rounded-2xl p-3 border transition flex flex-col items-start gap-1.5 text-left w-full min-w-0 " +
                (active
                  ? "border-white/40 bg-hairline"
                  : "border-hairline bg-hairline hover:bg-hairline hover:border-white/20")
              }
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-xl shrink-0">{DIFFICULTY_META[id].emoji}</span>
                <span className="font-semibold text-sm flex-1 truncate">{t("diff." + id)}</span>
                {active && (
                  <span className="text-[9px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                    {t("profile.diff.active")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-muted leading-snug">{t("diff." + id + ".desc")}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
