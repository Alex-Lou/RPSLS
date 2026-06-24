import { W, H } from "./dims";

/* Void — Geometric minimalism.
   Pure black background, a single fine white triangle slowly rotating in
   the centre, occasional ring pulses and traversing lines. Maximum
   negative space — the ANTI-spectacle pad. */

const BLACK = "#000000";
const WHITE = "#ffffff";
const FAINT = "#666666";

export function VoidPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <rect width={W} height={H} fill={BLACK} />

      {/* Subtle radial gradient at the center to indicate focus */}
      <defs>
        <radialGradient id="vd-bg" cx="50%" cy="50%" r="40%">
          <stop offset="0%"  stopColor="#080808" />
          <stop offset="100%" stopColor={BLACK} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#vd-bg)" />

      {/* Slow grid lines — barely visible, give scale */}
      <g stroke={FAINT} strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={i} x1="0" y1={H * (i + 1) / 6} x2={W} y2={H * (i + 1) / 6} />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={i} x1={W * (i + 1) / 8} y1="0" x2={W * (i + 1) / 8} y2={H} />
        ))}
      </g>

      {/* Crosshair guides — minimal, fade in slowly */}
      <g stroke={FAINT} strokeOpacity="0.12" strokeWidth="1">
        <line x1="0" y1={H/2} x2={W} y2={H/2}>
          <animate attributeName="stroke-opacity" values="0.05;0.15;0.05" dur="11s" repeatCount="indefinite" />
        </line>
        <line x1={W/2} y1="0" x2={W/2} y2={H}>
          <animate attributeName="stroke-opacity" values="0.05;0.15;0.05" dur="13s" repeatCount="indefinite" />
        </line>
      </g>

      {/* Horizontal traversing line — every ~15s a line crosses the canvas */}
      <line x1="-100" y1={H * 0.3} x2={-50} y2={H * 0.3}
            stroke={WHITE} strokeOpacity="0.5" strokeWidth="1">
        <animate attributeName="x1" values="-100;1500" dur="6s" begin="2s;line1.end+9s" id="line1" fill="freeze" />
        <animate attributeName="x2" values="-50;1550" dur="6s" begin="2s;line1.end+9s" fill="freeze" />
        <animate attributeName="stroke-opacity" values="0;0.6;0" dur="6s" begin="2s;line1.end+9s" fill="freeze" />
      </line>

      {/* Vertical traversing line — staggered with the horizontal one */}
      <line x1={W * 0.7} y1="-50" x2={W * 0.7} y2="0"
            stroke={WHITE} strokeOpacity="0.5" strokeWidth="1">
        <animate attributeName="y1" values="-50;1000" dur="7s" begin="8s;line2.end+11s" id="line2" fill="freeze" />
        <animate attributeName="y2" values="0;1050" dur="7s" begin="8s;line2.end+11s" fill="freeze" />
        <animate attributeName="stroke-opacity" values="0;0.5;0" dur="7s" begin="8s;line2.end+11s" fill="freeze" />
      </line>

      {/* Concentric ring pulse — appears every ~10s, expands and fades */}
      <circle cx={W/2} cy={H/2} r="40" fill="none"
              stroke={WHITE} strokeOpacity="0.7" strokeWidth="1.2">
        <animate attributeName="r" values="40;320" dur="4s" begin="5s;ring1.end+6s" id="ring1" fill="freeze" />
        <animate attributeName="stroke-opacity" values="0;0.7;0" dur="4s" begin="5s;ring1.end+6s" fill="freeze" />
      </circle>

      {/* ── CENTRAL TRIANGLE — the signature, slowly rotating ──
            Equilateral, fine white stroke, no fill. Rotates 360° in 60s. */}
      <g transform={`translate(${W/2} ${H/2})`}>
       <g transform="scale(1.6)">
        <g>
          {/* Outer triangle */}
          <polygon points="0,-160 138.6,80 -138.6,80"
                   fill="none" stroke={WHITE} strokeOpacity="0.85" strokeWidth="1.5" />
          {/* Inner triangle (offset rotation) */}
          {!compact && (
            <polygon points="0,80 -138.6,-80 138.6,-80"
                     fill="none" stroke={WHITE} strokeOpacity="0.30" strokeWidth="1" />
          )}
          {/* Centre dot — barely visible breathing pulse */}
          <circle r="3" fill={WHITE}>
            <animate attributeName="r" values="3;5;3" dur="3.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.55;1;0.55" dur="3.2s" repeatCount="indefinite" />
          </circle>
          {/* Three corner marker dots */}
          <circle cx="0" cy="-160" r="2.5" fill={WHITE} opacity="0.85" />
          <circle cx="138.6" cy="80" r="2.5" fill={WHITE} opacity="0.85" />
          <circle cx="-138.6" cy="80" r="2.5" fill={WHITE} opacity="0.85" />
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="60s" repeatCount="indefinite" />
        </g>
       </g>
      </g>

      {/* Frame — single white thin line */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="0"
            fill="none" stroke={WHITE} strokeOpacity="0.20" strokeWidth="1" />

      {/* Title — tight monospaced */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"JetBrains Mono","Space Mono",monospace' fontWeight="500"
              fontSize="25.6" fill={WHITE} fillOpacity="0.45" letterSpacing="20">
          ◼ VOID
        </text>
      </g>
    </svg>
  );
}
