import { W, H } from "./dims";

/* Rust — Industrial decline.
   Sooty vertical gradient, metal beams with rivets, oxide patina noise,
   sporadic welding sparks, slow flickering overhead light, fine dust
   grain via SVG filter. Monochrome warm. */

const SOOT    = "#050302";
const PATINA  = "#1a0e05";
const ORANGE  = "#d2691e";  // primary
const BROWN   = "#8b4513";  // secondary
const HOT     = "#ff9460";
const STEEL   = "#3a2a1c";

export function RustPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <linearGradient id="ru-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={SOOT} />
          <stop offset="50%" stopColor="#0d0703" />
          <stop offset="100%" stopColor={PATINA} />
        </linearGradient>
        <radialGradient id="ru-flicker" cx="50%" cy="22%" r="55%">
          <stop offset="0%"  stopColor={HOT} stopOpacity="0.18" />
          <stop offset="60%" stopColor={ORANGE} stopOpacity="0.06" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
        <filter id="ru-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.18  0 0 0 0 0.10  0 0 0 0 0.04  0 0 0 0.5 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="ru-blur2"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#ru-bg)" />

      {/* Overhead light flicker — top-down warm pulse */}
      <rect width={W} height={H} fill="url(#ru-flicker)">
        <animate attributeName="opacity" values="0.75;0.95;0.55;0.92;0.78"
          keyTimes="0;0.18;0.42;0.71;1" dur="3.6s" repeatCount="indefinite" />
      </rect>

      {/* Rust patina background — full-canvas oxide noise */}
      <rect width={W} height={H} filter="url(#ru-grain)" opacity="0.4" />

      {/* ── HORIZONTAL CROSS BEAMS — heavy industrial scaffolding ── */}
      <g>
        {[200, 800].map((y, i) => (
          <g key={i}>
            <rect x="0" y={y} width={W} height="38" fill={STEEL} />
            <rect x="0" y={y - 3} width={W} height="4" fill={ORANGE} opacity="0.55" />
            <rect x="0" y={y + 37} width={W} height="4" fill={BROWN} opacity="0.7" />
            {/* Rivets along the beams */}
            {Array.from({ length: 14 }).map((_, j) => (
              <circle key={j} cx={60 + j * 110} cy={y + 19} r="6" fill={ORANGE} opacity="0.75">
                <animate attributeName="opacity" values="0.55;0.85;0.55" dur={`${3 + (j % 3)}s`} begin={`${j * 0.2}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        ))}
      </g>

      {/* ── VERTICAL METAL BEAMS — 4 columns with riveted edges ── */}
      <g>
        {[180, 580, 980, 1340].map((x, i) => (
          <g key={i}>
            <rect x={x - 18} y="0" width="36" height={H} fill={STEEL} />
            <rect x={x - 21} y="0" width="3" height={H} fill={BROWN} opacity="0.75" />
            <rect x={x + 18} y="0" width="3" height={H} fill={ORANGE} opacity="0.55" />
            {/* Rivets — 6 per beam */}
            {Array.from({ length: 6 }).map((_, j) => (
              <circle key={j} cx={x} cy={70 + j * 165} r="5.5" fill={ORANGE} opacity="0.7" />
            ))}
          </g>
        ))}
      </g>

      {/* ── WELDING SPARKS — sporadic bright dots launching upward ── */}
      <g>
        {Array.from({ length: 8 }).map((_, i) => {
          const x = 200 + i * 160;
          const y = 600 - (i % 3) * 50;
          const dur = 0.6 + (i % 4) * 0.15;
          const delay = i * 0.7;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3.5" fill="#ffffff">
                <animate attributeName="cy" values={`${y};${y - 120};${y - 220}`} dur={`${dur}s`} begin={`${delay}s;sparkLoop.end+${delay}s`} id={i === 0 ? "sparkLoop" : undefined} fill="freeze" />
                <animate attributeName="opacity" values="0;1;0" dur={`${dur}s`} begin={`${delay}s;sparkLoop.end+${delay}s`} fill="freeze" />
                <animate attributeName="r" values="4;3;1" dur={`${dur}s`} begin={`${delay}s;sparkLoop.end+${delay}s`} fill="freeze" />
              </circle>
              {/* Hot orange trail */}
              <circle cx={x} cy={y} r="6" fill={HOT} opacity="0.5">
                <animate attributeName="cy" values={`${y};${y - 80}`} dur={`${dur * 1.2}s`} begin={`${delay}s;sparkLoop.end+${delay}s`} fill="freeze" />
                <animate attributeName="opacity" values="0;0.7;0" dur={`${dur * 1.2}s`} begin={`${delay}s;sparkLoop.end+${delay}s`} fill="freeze" />
              </circle>
            </g>
          );
        })}
      </g>

      {/* Floating DUST PARTICLES */}
      <g fill={BROWN} opacity="0.35">
        {Array.from({ length: 22 }).map((_, i) => {
          const x = (i * 71) % W;
          const y = (i * 137) % H;
          const dur = 12 + (i % 5) * 2;
          return (
            <circle key={i} cx={x} cy={y} r={1.5 + (i % 3) * 0.5}>
              <animate attributeName="cy" values={`${y};${y - H};${y}`} dur={`${dur}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.4;0" dur={`${dur}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>

      {/* ── CENTRAL EMBLEM — Industrial gear with chain links ── */}
      {!compact && (
        <g transform={`translate(${W/2} ${H/2})`}>
          {/* Outer gear teeth */}
          <g>
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * 360;
              return (
                <rect key={i} x="-12" y="-180" width="24" height="35"
                      fill={BROWN} opacity="0.75"
                      transform={`rotate(${a})`} />
              );
            })}
          </g>
          {/* Gear body */}
          <circle r="155" fill={STEEL} stroke={ORANGE} strokeOpacity="0.55" strokeWidth="3" />
          <circle r="120" fill="none" stroke={BROWN} strokeOpacity="0.6" strokeWidth="2" strokeDasharray="6 8" />
          {/* Inner hub */}
          <circle r="50" fill={SOOT} stroke={ORANGE} strokeOpacity="0.7" strokeWidth="2" />
          {/* Bolt heads */}
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <circle key={i} cx={Math.cos(a) * 90} cy={Math.sin(a) * 90}
                      r="9" fill={ORANGE} opacity="0.7" />
            );
          })}
          {/* Centre bolt */}
          <circle r="14" fill={BROWN} />
          <circle r="6" fill={ORANGE} opacity="0.85">
            <animate attributeName="opacity" values="0.55;1;0.55" dur="2.4s" repeatCount="indefinite" />
          </circle>
          {/* Slow rotation */}
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="90s" repeatCount="indefinite" additive="sum" />
        </g>
      )}

      {/* Frame */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="6"
            fill="none" stroke={BROWN} strokeOpacity="0.45" strokeWidth="2" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="3"
            fill="none" stroke={ORANGE} strokeOpacity="0.18" strokeWidth="1"
            strokeDasharray="2 6" />

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Bebas Neue","Rajdhani",sans-serif' fontWeight="400"
              fontSize="26" fill={ORANGE} fillOpacity="0.55" letterSpacing="22">
          🏭 RUST
        </text>
      </g>
    </svg>
  );
}
