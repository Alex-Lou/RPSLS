import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { MOVES } from "../../engine/game";

export function ByMoveStatsSection() {
  const player = useStore((s) => s.player);
  const t = useT();
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  if (totalGames === 0) return null;

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">{t("profile.bymove.title")}</h2>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {MOVES.map((m) => {
          const s = player.stats.byMove[m];
          const wr = s.picked > 0 ? (s.won / s.picked) * 100 : 0;
          return (
            <div key={m} className="bg-hairline rounded-xl p-2 sm:p-3 text-center min-w-0">
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-ink-muted truncate">
                {t("element." + m)}
              </div>
              <div className="mt-1 text-base sm:text-lg font-bold">{s.picked}</div>
              <div className="text-[9px] sm:text-[10px] text-ink-faint">{t("profile.bymove.wonPct", { p: wr.toFixed(0) })}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
