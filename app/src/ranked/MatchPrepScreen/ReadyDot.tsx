export function ReadyDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      title={`${label}${on ? " — prêt" : " — en attente"}`}
      className={
        "w-2 h-2 rounded-full transition " +
        (on ? "bg-emerald-400 shadow-[0_0_6px_#34d39988]" : "bg-white/20")
      }
      aria-label={`${label}${on ? " prêt" : " en attente"}`}
    />
  );
}
