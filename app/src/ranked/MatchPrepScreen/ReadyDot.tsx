import { useT } from "../../i18n";
export function ReadyDot({ on, label }: { on: boolean; label: string }) {
  const t = useT();
  const state = on ? t("prep.dotReady") : t("prep.dotWaiting");
  return (
    <span
      title={`${label} — ${state}`}
      className={
        "w-2 h-2 rounded-full transition " +
        (on ? "bg-emerald-400 shadow-[0_0_6px_#34d39988]" : "bg-white/20")
      }
      aria-label={`${label} ${state}`}
    />
  );
}
