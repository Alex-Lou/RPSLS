/**
 * DiagnosticPanel — la sortie en langage simple : pour chaque Voie, ce qui
 * cloche (surpuissance, faiblesse, tempo, finisher trop lent) avec une sévérité
 * colorée. C'est le payload le plus parlant — pour Alex ET pour Claude (bridge).
 */
import type { Diagnostic } from "../sim/diagnose";

const ICON: Record<Diagnostic["severity"], string> = { high: "▲", warn: "◆", ok: "●" };

export function DiagnosticPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (!diagnostics.length) {
    return <div className="lab-empty">— en attente de simulation —</div>;
  }
  return (
    <ul className="lab-diag">
      {diagnostics.map((d, i) => (
        <li key={i} className={`lab-diag-item sev-${d.severity}`}>
          <span className="lab-diag-icon">{ICON[d.severity]}</span>
          {d.text}
        </li>
      ))}
    </ul>
  );
}
