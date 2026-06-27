/** Un slider néon réutilisable. Valeur en mono sans glow (lisible). Marqueur
 *  « modifié » quand la valeur s'écarte du défaut moteur. */
export function BalanceSlider({
  label,
  value,
  min,
  max,
  modified,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  modified: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lab-slider">
      <span className="lab-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={`lab-slider-val${modified ? " modified" : ""}`}>{value}</span>
    </label>
  );
}
