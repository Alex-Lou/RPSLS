import { W, H } from "./dims";

/* ════════════════════ Nebula ════════════════════
   Deep-space nebula playmat — layered luminous gas clouds in violet,
   magenta and cyan, dense twinkling star field, gossamer dust filaments,
   and a faint central pulsar glow. The core stays dark enough for card
   legibility while the edges bloom with colour.
*/

const V  = "#9333ea"; // violet
const M  = "#e040a0"; // magenta/rose
const C  = "#22d3ee"; // cyan
const D  = "#1a0a2e"; // deep void

export function NebulaPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cx = W / 2;
  const cy = H / 2;

  // Dense star field
  const stars = (() => {
    const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
    let seed = 42;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 0xffffffff; return seed / 0xffffffff; };
    for (let i = 0; i < 180; i++) {
      pts.push({ x: rng() * W, y: rng() * H, r: 0.4 + rng() * 1.6, o: 0.15 + rng() * 0.55 });
    }
    return pts;
  })();

  // Dust filament control points
  const filaments = [
    { y: cy - 120, x0: 80, x1: W - 80, color: V, o: 0.18, w: 140, dur: 22 },
    { y: cy + 60,  x0: 200, x1: W - 100, color: M, o: 0.14, w: 100, dur: 28 },
    { y: cy - 40,  x0: 50,  x1: W - 200, color: C, o: 0.10, w: 80,  dur: 32 },
  ];

  return (
    <svg {...props}>
      <defs>
        {/* Deep void base */}
        <radialGradient id="nb-bg" cx="50%" cy="45%" r="80%">
          <stop offset="0%"  stopColor="#0e0520" />
          <stop offset="50%" stopColor={D} />
          <stop offset="100%" stopColor="#060210" />
        </radialGradient>

        {/* Gas cloud layers */}
        <radialGradient id="nb-cloudA" cx="22%" cy="28%" r="50%">
          <stop offset="0%"  stopColor={V} stopOpacity="0.35" />
          <stop offset="60%" stopColor={V} stopOpacity="0.08" />
          <stop offset="100%" stopColor={V} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nb-cloudB" cx="78%" cy="72%" r="48%">
          <stop offset="0%"  stopColor={M} stopOpacity="0.30" />
          <stop offset="55%" stopColor={M} stopOpacity="0.06" />
          <stop offset="100%" stopColor={M} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nb-cloudC" cx="65%" cy="22%" r="38%">
          <stop offset="0%"  stopColor={C} stopOpacity="0.22" />
          <stop offset="60%" stopColor={C} stopOpacity="0.04" />
          <stop offset="100%" stopColor={C} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nb-cloudD" cx="35%" cy="75%" r="42%">
          <stop offset="0%"  stopColor="#7c3aed" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>

        {/* Central pulsar */}
        <radialGradient id="nb-pulsar" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="25%" stopColor={V} stopOpacity="0.35" />
          <stop offset="60%" stopColor={C} stopOpacity="0.08" />
          <stop offset="100%" stopColor={C} stopOpacity="0" />
        </radialGradient>

        <filter id="nb-soft"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="nb-glow"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="nb-wide"><feGaussianBlur stdDeviation="18" /></filter>
      </defs>

      {/* Base void */}
      <rect width={W} height={H} fill="url(#nb-bg)" />

      {/* Gas cloud layers — slow drift animation */}
      <g>
        <rect width={W} height={H} fill="url(#nb-cloudA)">
          <animateTransform attributeName="transform" type="translate"
            values="0,0; 30,-15; 0,0" dur="40s" repeatCount="indefinite" />
        </rect>
        <rect width={W} height={H} fill="url(#nb-cloudB)">
          <animateTransform attributeName="transform" type="translate"
            values="0,0; -25,20; 0,0" dur="48s" repeatCount="indefinite" />
        </rect>
        <rect width={W} height={H} fill="url(#nb-cloudC)">
          <animateTransform attributeName="transform" type="translate"
            values="0,0; 20,12; 0,0" dur="36s" repeatCount="indefinite" />
        </rect>
        <rect width={W} height={H} fill="url(#nb-cloudD)">
          <animateTransform attributeName="transform" type="translate"
            values="0,0; -15,-18; 0,0" dur="52s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* Dust filaments — horizontal wisps with slow vertical sway */}
      {filaments.map((f, i) => (
        <g key={i} filter="url(#nb-wide)" opacity={f.o}>
          <ellipse cx={(f.x0 + f.x1) / 2} cy={f.y} rx={(f.x1 - f.x0) / 2} ry={f.w / 2} fill={f.color}>
            <animateTransform attributeName="transform" type="translate"
              values={`0,0; 0,${18 + i * 6}; 0,0`} dur={`${f.dur}s`} repeatCount="indefinite" />
          </ellipse>
        </g>
      ))}

      {/* Star field */}
      <g fill="#ffffff">
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fillOpacity={s.o}>
            {i % 6 === 0 && (
              <animate attributeName="fill-opacity"
                values={`${s.o};${s.o * 0.2};${s.o}`}
                dur={`${2.5 + (i % 5) * 0.5}s`} begin={`${(i % 7) * 0.4}s`}
                repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </g>

      {/* Bright feature stars with cross spikes */}
      {[
        { x: 320, y: 180, s: 14 },
        { x: 1120, y: 260, s: 10 },
        { x: 880, y: 780, s: 12 },
        { x: 200, y: 680, s: 9 },
      ].map((star, i) => (
        <g key={i} transform={`translate(${star.x} ${star.y}) scale(1.6)`}>
          <line x1={-star.s} y1="0" x2={star.s} y2="0"
                stroke="#fff" strokeWidth="0.8" strokeOpacity="0.6" />
          <line x1="0" y1={-star.s} x2="0" y2={star.s}
                stroke="#fff" strokeWidth="0.8" strokeOpacity="0.6" />
          <circle r="2" fill="#fff" fillOpacity="0.9" />
          <circle r="6" fill="#fff" fillOpacity="0" filter="url(#nb-glow)">
            <animate attributeName="fill-opacity"
              values="0;0.4;0" dur={`${3 + i * 0.6}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* Central pulsar glow — breathing */}
      {!compact && (
        <g transform={`translate(${cx} ${cy})`}>
          <circle r="80" fill="url(#nb-pulsar)" filter="url(#nb-soft)" opacity="0.25">
            <animate attributeName="opacity" values="0.15;0.35;0.15" dur="5s" repeatCount="indefinite" />
            <animate attributeName="r" values="70;95;70" dur="5s" repeatCount="indefinite" />
          </circle>
          {/* Inner hot spot */}
          <circle r="4" fill="#ffffff" fillOpacity="0.7">
            <animate attributeName="fill-opacity" values="0.5;0.9;0.5" dur="2.8s" repeatCount="indefinite" />
          </circle>
          {/* Faint rays from the pulsar */}
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a}
              x1={Math.cos(a * Math.PI / 180) * 12}
              y1={Math.sin(a * Math.PI / 180) * 12}
              x2={Math.cos(a * Math.PI / 180) * 65}
              y2={Math.sin(a * Math.PI / 180) * 65}
              stroke={V} strokeWidth="1" strokeOpacity="0.15">
              <animate attributeName="stroke-opacity"
                values="0.08;0.22;0.08" dur={`${4 + (a % 3) * 0.5}s`} repeatCount="indefinite" />
            </line>
          ))}
        </g>
      )}

      {/* Ethereal frame — double glow border */}
      <rect x="36" y="36" width={W - 72} height={H - 72} rx="22"
            fill="none" stroke={V} strokeWidth="2" strokeOpacity="0.25" />
      <rect x="50" y="50" width={W - 100} height={H - 100} rx="16"
            fill="none" stroke={C} strokeWidth="0.8" strokeOpacity="0.15"
            strokeDasharray="4 12" />

      {/* Corner nebula wisps */}
      <g fill="none" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3">
        <path d="M 70 200 Q 70 70 200 70" stroke={V} />
        <path d={`M ${W - 70} ${H - 200} Q ${W - 70} ${H - 70} ${W - 200} ${H - 70}`} stroke={M} />
        <path d={`M ${W - 70} 200 Q ${W - 70} 70 ${W - 200} 70`} stroke={C} strokeOpacity="0.2" />
        <path d={`M 70 ${H - 200} Q 70 ${H - 70} 200 ${H - 70}`} stroke={V} strokeOpacity="0.2" />
      </g>

      {/* Drifting luminous motes (non-compact) */}
      {!compact && Array.from({ length: 12 }).map((_, i) => {
        const x = 200 + (i * 97) % 1100;
        const dur = 7 + (i % 4) * 1.5;
        const delay = (i % 5) * 1.0;
        const color = [V, M, C, "#fff"][i % 4];
        return (
          <circle key={i} cx={x} cy={H - 40} r={1 + (i % 3) * 0.6}
                  fill={color} opacity="0">
            <animate attributeName="cy" values={`${H - 40};80`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.5;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </svg>
  );
}
