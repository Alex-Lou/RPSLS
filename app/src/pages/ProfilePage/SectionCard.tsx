import type { ReactNode } from "react";

/** Carte de section du Profil — UN SEUL gabarit pour toutes les sections
 *  (titre + sous-titre facultatif + action à droite), pour que les deux
 *  onglets aient la même grammaire visuelle. `tone="danger"` = zone rouge. */
export function SectionCard({
  title, subtitle, action, tone = "default", id, children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Élément aligné à droite du titre (ex. sélecteur d'onglets). */
  action?: ReactNode;
  tone?: "default" | "danger";
  id?: string;
  children: ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <section
      id={id}
      className={
        "rounded-3xl p-4 sm:p-5 border " +
        (danger ? "bg-rose-950/30 border-rose-900/40" : "bg-surface border-hairline")
      }
    >
      <div className={"flex items-center gap-2 flex-wrap " + (subtitle ? "mb-1" : "mb-3")}>
        <h2
          className={
            "text-sm font-semibold uppercase tracking-wider " +
            (danger ? "text-rose-300" : "text-ink-muted")
          }
        >
          {title}
        </h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {subtitle && <p className="text-xs text-ink-faint leading-snug mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

/** Sous-titre interne d'une carte (ex. « Taille du texte » dans Affichage). */
export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
      {children}
    </h3>
  );
}
