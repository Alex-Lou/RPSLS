/** Ligne de la fiche descriptive d'une Voie (lobby Arena, long-press). */
export function FicheRow({ icon, label, text }: { icon: string; label: string; text: string }) {
  // icon = chemin PNG (/MenuIcons/…) → <img> ; sinon emoji legacy (fallback).
  const isImg = icon.startsWith("/");
  return (
    <div className="flex gap-2 mb-2.5 items-start">
      {isImg ? (
        <img src={icon} alt="" draggable={false} className="w-5 h-5 shrink-0 object-contain mt-0.5" />
      ) : (
        <span className="text-sm shrink-0">{icon}</span>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-faint font-bold">{label}</div>
        <p className="text-[12px] leading-snug text-ink">{text}</p>
      </div>
    </div>
  );
}
