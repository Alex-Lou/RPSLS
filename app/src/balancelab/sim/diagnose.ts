/**
 * diagnose — traduit les stats agrégées en phrases d'équilibrage en langage
 * simple (la sortie la plus utile pour Alex ET pour Claude via le bridge).
 * Règles déterministes, cible d'équilibre 45–55%, matchup « domination » >60%.
 */
import { VOIE_META, type VoieStats } from "./simTypes";

export type Severity = "high" | "warn" | "ok";

export interface Diagnostic {
  severity: Severity;
  text: string;
}

const label = (s: VoieStats) => VOIE_META[s.move].name;

export function diagnose(stats: VoieStats[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const s of stats) {
    const crushed = stats.filter((o) => o.move !== s.move && (s.vsWinRate[o.move] ?? 0.5) > 0.6);
    if (crushed.length >= 3) {
      out.push({ severity: "high", text: `${label(s)} écrase ${crushed.length} Voies (>60% contre chacune) — surpuissant.` });
    }
    if (s.winRate > 0.55) {
      out.push({ severity: "high", text: `${label(s)} gagne ${(s.winRate * 100).toFixed(0)}% (cible 45–55) — à nerf.` });
    } else if (s.winRate < 0.45) {
      out.push({ severity: "warn", text: `${label(s)} ne gagne que ${(s.winRate * 100).toFixed(0)}% — à buff.` });
    }
    if (s.avgTurns < 7) {
      out.push({ severity: "warn", text: `${label(s)} clôt en ${s.avgTurns.toFixed(1)} tours — très rapide, peu interactif.` });
    }
    if (s.finisherFireRate < 0.2) {
      out.push({ severity: "warn", text: `Finisher ${label(s)} ne se déclenche que ${(s.finisherFireRate * 100).toFixed(0)}% — engine trop lent.` });
    }
  }
  if (out.length === 0) {
    out.push({ severity: "ok", text: "Équilibre nominal : toutes les Voies dans 45–55%, aucun matchup >60%." });
  }
  return out;
}
