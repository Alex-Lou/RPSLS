import { W, H, SINE_PATH } from "./dims";

/* ════════════════════ Quantum ════════════════════
   Physics lab table: faint grid, travelling wavefunctions on the edges,
   electron orbits spinning in each corner, drifting particles and a soft
   reactor core. Coded replacement for the old PNG.
*/

export function QuantumPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cyan = "#5eead4";
  const blue = "#60a5fa";
  const orbits = [
    { x: 240, y: 240, d: 5 },
    { x: W - 240, y: 240, d: 6.5 },
    { x: 240, y: H - 240, d: 7 },
    { x: W - 240, y: H - 240, d: 5.8 },
  ];
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="qp-bg" cx="50%" cy="50%" r="85%">
          <stop offset="0%"  stopColor="#0b1733" />
          <stop offset="55%" stopColor="#070d20" />
          <stop offset="100%" stopColor="#03060f" />
        </radialGradient>
        <radialGradient id="qp-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#a5f3fc" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <filter id="qp-glow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#qp-bg)" />

      {/* Faint lab grid */}
      <g stroke={blue} strokeOpacity="0.07" strokeWidth="1">
        {Array.from({ length: 15 }).map((_, i) => <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2={H} />)}
        {Array.from({ length: 10 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 100} x2={W} y2={i * 100} />)}
      </g>

      {/* Travelling wavefunctions along top & bottom. */}
      {[150, H - 150].map((y, idx) => (
        <g key={idx} transform={`translate(0 ${y})`} stroke={idx === 0 ? cyan : blue} fill="none"
           strokeWidth="2" strokeOpacity={compact ? 0.28 : 0.42}>
          <path d={SINE_PATH}>
            <animateTransform attributeName="transform" type="translate"
              from="0,0" to="-300,0" dur={`${idx === 0 ? 6 : 8}s`} repeatCount="indefinite" />
          </path>
        </g>
      ))}

      {/* Corner electron orbits. */}
      {orbits.map((o, i) => (
        <g key={i} transform={`translate(${o.x} ${o.y})`}>
          <ellipse rx="120" ry="44" fill="none" stroke={cyan} strokeOpacity="0.3" strokeWidth="1.5" />
          <ellipse rx="120" ry="44" fill="none" stroke={blue} strokeOpacity="0.3" strokeWidth="1.5" transform="rotate(60)" />
          <ellipse rx="120" ry="44" fill="none" stroke="#a78bfa" strokeOpacity="0.25" strokeWidth="1.5" transform="rotate(-60)" />
          <circle r="7" fill="url(#qp-core)" />
          <circle r="4" fill={cyan}>
            <animateMotion dur={`${o.d}s`} repeatCount="indefinite"
              path="M -120,0 a 120,44 0 1,0 240,0 a 120,44 0 1,0 -240,0" />
          </circle>
        </g>
      ))}

      {/* Drifting particles. */}
      {!compact && Array.from({ length: 18 }).map((_, i) => {
        const x = 80 + (i * 83) % (W - 160);
        const y = 120 + (i * 137) % (H - 240);
        const d = 4 + (i % 6);
        return (
          <circle key={i} cx={x} cy={y} r={1.6} fill="#a5f3fc" opacity="0.4">
            <animate attributeName="opacity" values="0.1;0.7;0.1" dur={`${d}s`} begin={`${(i % 5) * 0.6}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Frame */}
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="22" fill="none" stroke={cyan} strokeOpacity="0.4" strokeWidth="2" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="16" fill="none" stroke={blue} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 10" />

      {/* Equation labels along the edges. */}
      <g fontFamily='"JetBrains Mono","Consolas",monospace' fill={cyan} fillOpacity="0.4">
        <text x="92" y={H / 2} fontSize="22" transform={`rotate(-90 92 ${H / 2})`}>iℏ ∂ψ/∂t = Ĥψ</text>
        <text x={W - 72} y={H / 2} fontSize="22" transform={`rotate(90 ${W - 72} ${H / 2})`}>Δx·Δp ≥ ℏ/2</text>
        <text x={W / 2} y="118" fontSize="21" textAnchor="middle">|ψ⟩ = α|0⟩ + β|1⟩</text>
      </g>

      {/* Soft reactor core (mostly hidden by the in-game vignette). */}
      <g transform={`translate(${W / 2} ${H / 2})`}>
        <circle r="40" fill="url(#qp-core)" filter="url(#qp-glow)" opacity="0.3">
          <animate attributeName="opacity" values="0.15;0.4;0.15" dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
