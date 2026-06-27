/**
 * SliderPanel — les leviers d'équilibrage groupés par Voie. Chaque slider mute
 * BALANCE.<voie>.<knob> (via l'état React du Lab) → debounce → re-sim. Les
 * ranges encadrent le défaut moteur ; un repère « modifié » signale les écarts.
 */
import { DEFAULT_BALANCE, type ArenaBalance } from "../../arena/arenaBalance";
import { BalanceSlider } from "./BalanceSlider";

type Group = keyof ArenaBalance;
interface Knob {
  knob: string;
  label: string;
  min: number;
  max: number;
}
interface SliderGroup {
  group: Group;
  title: string;
  cssVar: string;
  knobs: Knob[];
}

const GROUPS: SliderGroup[] = [
  {
    group: "cosmos",
    title: "Cosmos",
    cssVar: "--voie-spock",
    knobs: [
      { knob: "chipCap", label: "Chip / tour (cap)", min: 0, max: 4 },
      { knob: "convergenceDmgCap", label: "Convergence (cap)", min: 2, max: 10 },
      { knob: "intricationCap", label: "Intrication (cap)", min: 2, max: 10 },
      { knob: "calculDiscount", label: "Calcul (−coût sorts)", min: 0, max: 3 },
    ],
  },
  {
    group: "foret",
    title: "Forêt",
    cssVar: "--voie-paper",
    knobs: [
      { knob: "seveHealActive", label: "Soin Sève (cap)", min: 0, max: 3 },
      { knob: "seveHealVerger", label: "Soin Verger (cap)", min: 0, max: 4 },
      { knob: "drainAmount", label: "Drain Vital", min: 1, max: 6 },
      { knob: "secondWindHeal", label: "Second Souffle", min: 0, max: 6 },
      { knob: "photosyntheseHeal", label: "Photosynthèse", min: 0, max: 4 },
    ],
  },
  {
    group: "montagne",
    title: "Montagne",
    cssVar: "--voie-rock",
    knobs: [
      { knob: "strateAtk", label: "Strate +ATK", min: 0, max: 3 },
      { knob: "strateHp", label: "Strate +PV", min: 0, max: 3 },
      { knob: "forteresseAtk", label: "Forteresse +ATK", min: 0, max: 4 },
      { knob: "eboulisPerRock", label: "Éboulis / Pierre", min: 1, max: 4 },
      { knob: "eboulisCap", label: "Éboulis (cap)", min: 4, max: 14 },
    ],
  },
  {
    group: "mirage",
    title: "Mirage",
    cssVar: "--voie-lizard",
    knobs: [
      { knob: "dodgeCapOnSummon", label: "Esquive à l'invoc (cap)", min: 3, max: 8 },
      { knob: "dodgeSpellCap", label: "Esquive sorts (cap)", min: 2, max: 6 },
      { knob: "coupDansLombreCap", label: "Coup dans l'Ombre (cap)", min: 3, max: 12 },
      { knob: "voieLizardDodge", label: "Lézard Voie (charges)", min: 1, max: 4 },
    ],
  },
  {
    group: "tranchant",
    title: "Tranchant",
    cssVar: "--voie-scissors",
    knobs: [
      { knob: "voieScissorsHp", label: "Ciseaux Voie +PV", min: 0, max: 3 },
      { knob: "acuiteAtkCap", label: "Acuité (cap ATK)", min: 0, max: 4 },
    ],
  },
  {
    group: "engine",
    title: "Engine (commun)",
    cssVar: "--neon-cyan",
    knobs: [
      { knob: "cap", label: "Jauge Voie (cap)", min: 1, max: 5 },
      { knob: "risePerCounterWin", label: "Montée / counter", min: 1, max: 3 },
      { knob: "voieAtkBonus", label: "ATK Voie (Spock/Lézard)", min: 0, max: 3 },
      { knob: "trancheAtkPerStack", label: "Tranche ×stack", min: 0, max: 3 },
    ],
  },
];

export function SliderPanel({
  balance,
  onChange,
  onReset,
}: {
  balance: ArenaBalance;
  onChange: (group: Group, knob: string, value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="lab-sliders">
      <div className="lab-sliders-bar">
        <span className="lab-sliders-hint">Bouge un levier → re-simulation auto</span>
        <button className="lab-reset" onClick={onReset}>
          ⟲ Défauts
        </button>
      </div>
      <div className="lab-sliders-grid">
        {GROUPS.map((g) => (
          <div key={g.group} className="lab-slider-group">
            <div className="lab-slider-group-head" style={{ color: `var(${g.cssVar})` }}>
              {g.title}
            </div>
            {g.knobs.map((k) => {
              const grpVals = balance[g.group] as Record<string, number>;
              const defVals = DEFAULT_BALANCE[g.group] as Record<string, number>;
              return (
                <BalanceSlider
                  key={k.knob}
                  label={k.label}
                  value={grpVals[k.knob]}
                  min={k.min}
                  max={k.max}
                  modified={grpVals[k.knob] !== defVals[k.knob]}
                  onChange={(v) => onChange(g.group, k.knob, v)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
