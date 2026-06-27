/**
 * voieLabBridge — expose l'état calculé du Lab sur window.__voieLab__ pour que
 * Claude le lise/pilote via preview_eval (PC) ou le pont DevTools WebView (tel).
 * getSummary() renvoie un texte compact token-friendly.
 */
import { VOIE_META, type SimOptions, type SimResult, type VoieStats } from "../sim/simTypes";
import type { Diagnostic } from "../sim/diagnose";
import type { ArenaBalance } from "../../arena/arenaBalance";

/** Patch partiel par groupe (ce qu'accepte setBalance / applyBalance). */
export type BalancePatch = Partial<{ [K in keyof ArenaBalance]: Partial<ArenaBalance[K]> }>;

export interface VoieLabBridge {
  ready: boolean;
  lastRun: SimResult | null;
  options: SimOptions;
  balance: ArenaBalance;
  diagnostics: Diagnostic[];
  telemetry: VoieStats[] | null;
  runSim: (opts?: Partial<SimOptions>) => void;
  setBalance: (patch: BalancePatch) => void;
  getSummary: () => string;
}

declare global {
  interface Window {
    __voieLab__?: VoieLabBridge;
  }
}

export function buildSummary(run: SimResult | null, diagnostics: Diagnostic[]): string {
  if (!run) return "VOIE LAB — aucun run encore.";
  const head = `RUN seed=${run.meta.seed} ${run.meta.games} parties ${Math.round(run.meta.ms)}ms`;
  const line = [...run.stats]
    .sort((a, b) => b.winRate - a.winRate)
    .map((s) => {
      const wr = (s.winRate * 100).toFixed(1);
      const flag = s.winRate > 0.55 ? "(>cible)" : s.winRate < 0.45 ? "(<cible)" : "";
      return `${VOIE_META[s.move].name} ${wr}%${flag}`;
    })
    .join(" | ");
  const diag = diagnostics.map((d) => `${d.severity === "high" ? "⚠ " : ""}${d.text}`).join(" ");
  return `${head}\n${line}\nDIAG: ${diag}`;
}

export function installVoieLabBridge(b: VoieLabBridge): void {
  window.__voieLab__ = b;
}
