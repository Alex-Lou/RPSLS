import { ATOUTS_BY_ID, type AtoutId } from "../../../ranked/atouts";
import { Move } from "../../../engine/game";
import { useT } from "../../../i18n";

export function AtoutBar({
  chosen, used, canUse, vabanqueArmed, lectureMove,
  onUseLecture, onUseVabanque,
}: {
  chosen: AtoutId[];
  used: AtoutId[];
  canUse: boolean;
  vabanqueArmed: boolean;
  lectureMove: Move | null;
  onUseLecture: () => void;
  onUseVabanque: () => void;
}) {
  const t = useT();
  return (
    <div className="shrink-0 flex flex-col gap-1">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {chosen.map((id) => {
          const a = ATOUTS_BY_ID[id];
          const isUsed = used.includes(id);
          const manual = a.kind === "manual";
          // Lecture et Va-banque ne se cumulent pas sur la même manche.
          const blocked = (id === "lecture" && vabanqueArmed) || (id === "vabanque" && !!lectureMove);
          const active = manual && !isUsed && canUse && !blocked;
          const onClick = id === "lecture" ? onUseLecture : id === "vabanque" ? onUseVabanque : undefined;
          return (
            <button
              key={id}
              onClick={active ? onClick : undefined}
              disabled={!active}
              className={"flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition " +
                (isUsed ? "opacity-35 line-through border-hairline bg-hairline text-ink-muted"
                 : active ? "border-amber-400/60 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25"
                 : "border-hairline bg-hairline text-ink-muted")}
            >
              <span>{a.glyph}</span>
              <span>{t(`atout.${id}.name`)}</span>
              {!manual && !isUsed && <span className="text-[8px] uppercase tracking-wider opacity-60">{t("atout.kind.auto")}</span>}
            </button>
          );
        })}
      </div>
      {lectureMove && (
        <div className="text-center text-[11px] text-amber-300 font-bold">
          {t("atout.lecture.reveal", { move: t("element." + lectureMove) })}
        </div>
      )}
      {vabanqueArmed && (
        <div className="text-center text-[11px] text-amber-300 font-bold">{t("atout.vabanque.armed")}</div>
      )}
    </div>
  );
}
