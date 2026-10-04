import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { MOVES } from "../../engine/game";
import { MOVE_PNG } from "../../icons";
import { SectionCard } from "./SectionCard";

/** Profil › Statistiques par coup (masquée tant qu'aucune partie jouée). */
export function ByMoveStatsSection() {
  const player = useStore((s) => s.player);
  const t = useT();
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  if (totalGames === 0) return null;

  return (
    <SectionCard title={t("profile.bymove.title")} subtitle={t("profile.bymove.subtitle")}>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {MOVES.map((m) => {
          const s = player.stats.byMove[m];
          const wr = s.picked > 0 ? (s.won / s.picked) * 100 : 0;
          return (
            <div key={m} className="bg-hairline rounded-xl px-1 py-2 sm:p-3 text-center min-w-0 flex flex-col items-center">
              <img src={MOVE_PNG[m]} alt="" aria-hidden draggable={false} className="w-6 h-6 object-contain" />
              <div className="mt-0.5 w-full text-[10px] sm:text-xs text-ink-muted truncate">
                {t("element." + m)}
              </div>
              <div className="mt-1 text-base sm:text-lg font-bold tabular-nums">{s.picked}</div>
              <div className="text-[9px] sm:text-[10px] text-ink-faint">{t("profile.bymove.wonPct", { p: wr.toFixed(0) })}</div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
