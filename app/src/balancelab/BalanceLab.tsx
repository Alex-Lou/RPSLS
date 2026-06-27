/**
 * BalanceLab — shell du Voie Balance Lab : état global (réglages de run + valeurs
 * des sliders BALANCE), pilotage de la sim, câblage du pont window.__voieLab__,
 * et layout cyberpunk des panneaux de viz. Un slider bougé → debounce → re-sim,
 * et le moteur lit le réglage (reset+apply BALANCE avant chaque batch).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSimController } from "./sim/useSimController";
import { DEFAULT_SIM_OPTIONS, type Diff, type SimOptions } from "./sim/simTypes";
import { diagnose } from "./sim/diagnose";
import { WinRateBars } from "./viz/WinRateBars";
import { MatchupHeatmap } from "./viz/MatchupHeatmap";
import { HpCurveChart } from "./viz/HpCurveChart";
import { PowerRadar } from "./viz/PowerRadar";
import { DiagnosticPanel } from "./viz/DiagnosticPanel";
import { SliderPanel } from "./controls/SliderPanel";
import { buildSummary, installVoieLabBridge, type BalancePatch } from "./bridge/voieLabBridge";
import { makeDefaultBalance, type ArenaBalance } from "../arena/arenaBalance";

const GAME_COUNTS = [2000, 4000, 10000, 20000];
const DIFFS: Diff[] = ["easy", "normal", "hard"];

function cloneBalance(b: ArenaBalance): ArenaBalance {
  return {
    engine: { ...b.engine },
    montagne: { ...b.montagne },
    foret: { ...b.foret },
    tranchant: { ...b.tranchant },
    mirage: { ...b.mirage },
    cosmos: { ...b.cosmos },
  };
}
function mergeBalance(b: ArenaBalance, patch: BalancePatch): ArenaBalance {
  const nb = cloneBalance(b);
  for (const k of Object.keys(patch) as (keyof ArenaBalance)[]) {
    Object.assign(nb[k], patch[k]);
  }
  return nb;
}

export function BalanceLab() {
  const { result, progress, running, run } = useSimController();
  const [opts, setOpts] = useState<SimOptions>(DEFAULT_SIM_OPTIONS);
  const [balance, setBalance] = useState<ArenaBalance>(makeDefaultBalance);

  const diagnostics = useMemo(() => (result ? diagnose(result.stats) : []), [result]);

  // Refs « dernière valeur » pour le debounce et le pont (évite les closures périmées).
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const debounceRef = useRef<number | undefined>(undefined);

  const scheduleRun = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      run(optsRef.current, balanceRef.current);
    }, 350);
  }, [run]);

  // 1er run au montage.
  useEffect(() => {
    run(DEFAULT_SIM_OPTIONS, makeDefaultBalance());
  }, [run]);

  // Pont pour Claude / DevTools.
  useEffect(() => {
    installVoieLabBridge({
      ready: !running,
      lastRun: result,
      options: opts,
      balance,
      diagnostics,
      telemetry: null,
      runSim: (o) => {
        const merged = { ...optsRef.current, ...o };
        setOpts(merged);
        run(merged, balanceRef.current);
      },
      setBalance: (patch) => {
        const nb = mergeBalance(balanceRef.current, patch);
        setBalance(nb);
        run(optsRef.current, nb);
      },
      getSummary: () => buildSummary(result, diagnostics),
    });
  }, [result, opts, balance, diagnostics, running, run]);

  const launch = (patch?: Partial<SimOptions>) => {
    const merged = { ...opts, ...patch };
    setOpts(merged);
    run(merged, balanceRef.current);
  };

  const onSlider = (group: keyof ArenaBalance, knob: string, value: number) => {
    setBalance((b) => {
      const nb = cloneBalance(b);
      (nb[group] as Record<string, number>)[knob] = value;
      return nb;
    });
    scheduleRun();
  };

  const onResetBalance = () => {
    const d = makeDefaultBalance();
    setBalance(d);
    run(optsRef.current, d);
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="lab">
      <header className="lab-header">
        <h1 className="lab-title">VOIE&nbsp;BALANCE&nbsp;LAB</h1>
        <div className="lab-sub">
          Simulation IA-vs-IA du moteur réel Constellation&nbsp;Pro — équilibrage des 5 Voies (cible 45–55%)
        </div>
      </header>

      <section className="lab-controls">
        <label className="lab-field">
          <span>PARTIES</span>
          <select value={opts.games} disabled={running} onChange={(e) => launch({ games: Number(e.target.value) })}>
            {GAME_COUNTS.map((g) => (
              <option key={g} value={g}>
                {g.toLocaleString("fr-FR")}
              </option>
            ))}
          </select>
        </label>

        <label className="lab-field">
          <span>IA</span>
          <select value={opts.diff} disabled={running} onChange={(e) => launch({ diff: e.target.value as Diff })}>
            {DIFFS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="lab-field lab-check">
          <input
            type="checkbox"
            checked={opts.fixedSeed}
            disabled={running}
            onChange={(e) => setOpts((o) => ({ ...o, fixedSeed: e.target.checked }))}
          />
          <span>SEED FIXE</span>
        </label>

        <button className="lab-run" disabled={running} onClick={() => launch()}>
          {running ? "SIMULATION…" : "▶ LANCER"}
        </button>

        {result && !running && (
          <span className="lab-meta">
            {result.meta.games.toLocaleString("fr-FR")} parties · {Math.round(result.meta.ms)}ms · seed {result.meta.seed}
          </span>
        )}
      </section>

      {progress && (
        <div className="lab-progress">
          <div className="lab-progress-bar" style={{ width: `${pct}%` }} />
          <span className="lab-progress-label">
            {progress.done.toLocaleString("fr-FR")} / {progress.total.toLocaleString("fr-FR")} ({pct}%)
          </span>
        </div>
      )}

      <main className="lab-grid">
        <Panel title="WIN-RATE PAR VOIE" wide>
          {result ? <WinRateBars stats={result.stats} /> : <Empty />}
        </Panel>

        <Panel title="MATCHUPS (attaquant ▸ défenseur)">
          {result ? <MatchupHeatmap result={result} /> : <Empty />}
        </Panel>

        <Panel title="PROFIL DE PUISSANCE">
          {result ? <PowerRadar stats={result.stats} /> : <Empty />}
        </Panel>

        <Panel title="PV MOYEN PAR TOUR" wide>
          {result ? <HpCurveChart stats={result.stats} /> : <Empty />}
        </Panel>

        <Panel title="LEVIERS D'ÉQUILIBRAGE (sliders → re-sim live)" wide>
          <SliderPanel balance={balance} onChange={onSlider} onReset={onResetBalance} />
        </Panel>

        <Panel title="DIAGNOSTIC" wide>
          <DiagnosticPanel diagnostics={diagnostics} />
        </Panel>
      </main>
    </div>
  );
}

function Panel({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`lab-panel${wide ? " lab-panel-wide" : ""}`}>
      <div className="lab-panel-head">{title}</div>
      <div className="lab-panel-body">{children}</div>
    </section>
  );
}

function Empty() {
  return <div className="lab-empty">— en attente de simulation —</div>;
}
