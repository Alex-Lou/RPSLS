import { W, H } from "./dims";

/* ════════════════════ Abyss ════════════════════
   Deep-ocean playmat — dark abyssal water with bioluminescent jellyfish,
   drifting light particles, faint caustic ripples, and a mysterious
   light shaft from above. Indigo-to-black palette with teal and
   magenta bioluminescence accents.
*/

const DEEP = "#040818"; // abyss black-blue
const TEAL = "#00e5c8"; // bioluminescent teal
const GLOW = "#6040c0"; // deep purple
const PINK = "#ff40a0"; // jellyfish pink
const BEAM = "#1a4080"; // light shaft

export function AbyssPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cx = W / 2;

  // Floating plankton / bioluminescent particles
  const particles = (() => {
    const pts: Array<{ x: number; y: number; r: number; delay: number; dur: number; color: string }> = [];
    let seed = 53;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 0xffffffff; return seed / 0xffffffff; };
    for (let i = 0; i < (compact ? 25 : 70); i++) {
      pts.push({
        x: rng() * W,
        y: rng() * H,
        r: 0.5 + rng() * 2.5,
        delay: rng() * 15,
        dur: 8 + rng() * 14,
        color: rng() > 0.6 ? TEAL : rng() > 0.4 ? "#80d0ff" : PINK,
      });
    }
    return pts;
  })();

  // Jellyfish positions
  const jellyfish = compact ? [] : [
    { x: 280, y: 340, scale: 0.8, color: PINK, dur: 18, delay: 0 },
    { x: 1100, y: 280, scale: 0.6, color: TEAL, dur: 22, delay: 4 },
    { x: 700, y: 580, scale: 0.5, color: "#a060ff", dur: 20, delay: 8 },
  ];

  return (
    <svg {...props}>
      <defs>
        {/* Deep ocean gradient */}
        <linearGradient id="ab-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#081028" />
          <stop offset="40%" stopColor={DEEP} />
          <stop offset="100%" stopColor="#020410" />
        </linearGradient>

        {/* Light shaft from surface */}
        <linearGradient id="ab-shaft" x1="0.45" y1="0" x2="0.55" y2="1">
          <stop offset="0%"  stopColor={BEAM} stopOpacity="0.25" />
          <stop offset="40%" stopColor={BEAM} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </linearGradient>

        {/* Bioluminescence glow filter */}
        <filter id="ab-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
        <filter id="ab-glowSm" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>

        {/* Caustic ripple texture */}
        <filter id="ab-caustic">
          <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="12" result="turb">
            <animate attributeName="seed" values="12;25;12" dur="16s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="turb" scale="8" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Jellyfish body gradient */}
        {jellyfish.map((j, i) => (
          <radialGradient key={`jg-${i}`} id={`ab-jelly-${i}`} cx="50%" cy="30%" r="55%">
            <stop offset="0%"  stopColor={j.color} stopOpacity="0.5" />
            <stop offset="70%" stopColor={j.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        ))}

        {/* Deep glow */}
        <radialGradient id="ab-deepGlow" cx="50%" cy="60%" r="55%">
          <stop offset="0%"  stopColor={GLOW} stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={W} height={H} fill="url(#ab-bg)" />

      {/* Deep purple ambient glow */}
      <rect width={W} height={H} fill="url(#ab-deepGlow)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="10s" repeatCount="indefinite" />
      </rect>

      {/* Light shaft from above */}
      <polygon
        points={`${cx - 100},0 ${cx + 120},0 ${cx + 200},${H} ${cx - 180},${H}`}
        fill="url(#ab-shaft)"
        opacity="0.4"
      >
        <animate attributeName="opacity" values="0.3;0.5;0.3" dur="7s" repeatCount="indefinite" />
      </polygon>

      {/* Caustic light patterns on the upper portion */}
      <rect
        x="0" y="0" width={W} height={H * 0.5}
        fill="#2060a0"
        opacity="0.04"
        filter="url(#ab-caustic)"
      />

      {/* Jellyfish */}
      {jellyfish.map((j, i) => (
        <g key={`jf-${i}`} transform={`translate(${j.x},${j.y}) scale(${j.scale})`}>
          {/* Body dome */}
          <ellipse cx="0" cy="0" rx="55" ry="40" fill={`url(#ab-jelly-${i})`} filter="url(#ab-glow)">
            <animate attributeName="ry" values="38;44;38" dur={`${j.dur * 0.3}s`} repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="0" cy="0" rx="40" ry="30" fill={j.color} opacity="0.25">
            <animate attributeName="ry" values="28;34;28" dur={`${j.dur * 0.3}s`} repeatCount="indefinite" />
          </ellipse>
          {/* Trailing tentacles */}
          {[-20, -8, 5, 18].map((tx, ti) => (
            <line
              key={`t-${ti}`}
              x1={tx} y1="35" x2={tx + (ti % 2 === 0 ? 8 : -8)} y2="120"
              stroke={j.color}
              strokeWidth="1.5"
              opacity="0.3"
              strokeLinecap="round"
            >
              <animate
                attributeName="x2"
                values={`${tx - 12};${tx + 12};${tx - 12}`}
                dur={`${3 + ti * 0.5}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="y2"
                values="115;130;115"
                dur={`${3.5 + ti * 0.3}s`}
                repeatCount="indefinite"
              />
            </line>
          ))}
          {/* Whole jellyfish drifts */}
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`${j.x},${j.y};${j.x + 30},${j.y - 40};${j.x - 20},${j.y + 20};${j.x},${j.y}`}
            dur={`${j.dur}s`}
            begin={`${j.delay}s`}
            repeatCount="indefinite"
            additive="sum"
          />
        </g>
      ))}

      {/* Bioluminescent particles */}
      {particles.map((p, i) => (
        <circle
          key={`bp-${i}`}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={p.color}
          opacity="0"
          filter="url(#ab-glowSm)"
        >
          <animate
            attributeName="opacity"
            values="0;0.7;0.5;0"
            dur={`${p.dur}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values={`${p.y};${p.y - 60 - p.r * 15};${p.y - 30};${p.y}`}
            dur={`${p.dur}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cx"
            values={`${p.x};${p.x + (i % 2 === 0 ? 15 : -10)};${p.x + (i % 2 === 0 ? -8 : 12)};${p.x}`}
            dur={`${p.dur * 0.8}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Bubble stream — a few tiny rising bubbles */}
      {!compact && [cx - 200, cx + 150, cx - 50].map((bx, i) => (
        <g key={`bub-${i}`}>
          {[0, 1, 2].map((bi) => (
            <circle
              key={`b-${bi}`}
              cx={bx + bi * 8}
              cy={H}
              r={2 + bi}
              fill="none"
              stroke="#80c0e0"
              strokeWidth="0.8"
              opacity="0.2"
            >
              <animate
                attributeName="cy"
                from={H + 10}
                to={-10}
                dur={`${10 + i * 3 + bi * 2}s`}
                begin={`${i * 2 + bi * 3}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cx"
                values={`${bx + bi * 8};${bx + bi * 8 + 15};${bx + bi * 8 - 10};${bx + bi * 8}`}
                dur={`${6 + bi}s`}
                begin={`${i * 2 + bi * 3}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.25;0.2;0"
                dur={`${10 + i * 3 + bi * 2}s`}
                begin={`${i * 2 + bi * 3}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      ))}

      {/* Vignette */}
      <radialGradient id="ab-vig" cx="50%" cy="50%" r="70%">
        <stop offset="35%" stopColor="transparent" />
        <stop offset="100%" stopColor="#010208" stopOpacity="0.65" />
      </radialGradient>
      <rect width={W} height={H} fill="url(#ab-vig)" />
    </svg>
  );
}
