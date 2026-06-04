// Shared playmat canvas dimensions (the SVG viewBox every pad draws into)
// plus the travelling sine path used by the Quantum pad. Extracted from the
// old monolithic BattlePad.tsx so each pad component can live in its own file.
export const W = 1500;
export const H = 1000;

// A sine wave wider than the pad so it can slide one wavelength and loop
// seamlessly (used by the Quantum pad's travelling wavefunctions).
export const SINE_PATH = (() => {
  let d = "M -300 0";
  for (let x = -300; x <= W + 300; x += 10) {
    const y = Math.sin((x / 300) * Math.PI * 2) * 22;
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  return d;
})();
