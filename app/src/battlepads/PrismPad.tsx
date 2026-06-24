import { W, H } from "./dims";

/* Prism — Laboratory of light.
   Deep almost-black background, central white light source with halo, 4
   spectral rays radiating outward and SPLITTING into rainbow components
   (red→orange→yellow→green→blue→violet) with offset bands, photon beads
   following each ray. Scientific & precise. */

const DARK   = "#050510";
const WHITE  = "#ffffff";
const VIOLET = "#8b5cf6";

const SPECTRUM = [
  "#ff2020",  // red
  "#ff7e00",  // orange
  "#ffff00",  // yellow
  "#22ff44",  // green
  "#2080ff",  // blue
  "#b020ff",  // violet
];

export function PrismPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  // 4 rays at 90° spacings.
  const rays = [0, 90, 180, 270];
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="pr-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#0a0a18" />
          <stop offset="100%" stopColor={DARK} />
        </radialGradient>
        <radialGradient id="pr-source" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={WHITE} stopOpacity="1" />
          <stop offset="40%" stopColor={WHITE} stopOpacity="0.55" />
          <stop offset="100%" stopColor={WHITE} stopOpacity="0" />
        </radialGradient>
        <filter id="pr-blur4"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="pr-blur1"><feGaussianBlur stdDeviation="1" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#pr-bg)" />

      {/* Faint scientific grid — very subtle */}
      <g stroke={VIOLET} strokeOpacity="0.05" strokeWidth="0.5">
        {Array.from({ length: 13 }).map((_, i) => (
          <line key={i} x1="0" y1={H * i / 12} x2={W} y2={H * i / 12} />
        ))}
      </g>

      {/* ── SPECTRAL RAYS — 4 rays, each splitting into 6 colour bands ── */}
      <g transform={`translate(${W/2} ${H/2})`}>
        <g>
          {rays.map((angle, ri) => (
            <g key={ri} transform={`rotate(${angle})`}>
              {/* 6 parallel colour bands, offset perpendicular to ray dir */}
              {SPECTRUM.map((color, ci) => {
                const offset = (ci - 2.5) * 2.5;  // spread bands across ~15px
                const fadeStart = 60;
                const fadeEnd = 480;
                return (
                  <g key={ci}>
                    <line x1={fadeStart} y1={offset} x2={fadeEnd} y2={offset}
                          stroke={color} strokeOpacity="0.75" strokeWidth="1.6"
                          filter="url(#pr-blur1)">
                      <animate attributeName="stroke-opacity"
                        values={`${0.45 + ci*0.05};${0.85 - ci*0.05};${0.45 + ci*0.05}`}
                        dur={`${3.5 + ci * 0.2}s`} repeatCount="indefinite" />
                    </line>
                  </g>
                );
              })}
              {/* White lead-in line near source — before the split */}
              <line x1="35" y1="0" x2="65" y2="0"
                    stroke={WHITE} strokeOpacity="0.85" strokeWidth="2"
                    filter="url(#pr-blur1)" />
            </g>
          ))}
          {/* Slow rotation of the entire ray system — 120s per full turn */}
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="120s" repeatCount="indefinite" />
        </g>
      </g>

      {/* ── PHOTON BEADS travelling along each ray outward ── */}
      <g transform={`translate(${W/2} ${H/2})`}>
        {rays.map((angle, ri) => (
          <g key={ri} transform={`rotate(${angle})`}>
            {[0, 1, 2].map((p) => {
              const delay = p * 1.5 + ri * 0.4;
              return (
                <circle key={p} cx="0" cy="0" r="4" fill={WHITE} opacity="0">
                  <animate attributeName="cx" values="60;490" dur="4.5s" begin={`${delay}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;0" dur="4.5s" begin={`${delay}s`} repeatCount="indefinite" />
                  <animate attributeName="r" values="5;2.5" dur="4.5s" begin={`${delay}s`} repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>
        ))}
      </g>

      {/* ── CENTRAL LIGHT SOURCE — bright white-hot point with halo ── */}
      <g transform={`translate(${W/2} ${H/2})`}>
        <circle r="120" fill="url(#pr-source)" opacity="0.6">
          <animate attributeName="r" values="115;130;115" dur="3.4s" repeatCount="indefinite" />
        </circle>
        <circle r="50" fill={WHITE} opacity="0.6" filter="url(#pr-blur4)">
          <animate attributeName="opacity" values="0.45;0.85;0.45" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle r="14" fill={WHITE}>
          <animate attributeName="r" values="12;18;12" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* ── PRISM ICON CENTRAL — small triangular prism behind the source ── */}
      {!compact && (
        <g transform={`translate(${W/2} ${H/2}) scale(1.6)`} opacity="0.18">
          <polygon points="0,-90 78,45 -78,45" fill="none" stroke={VIOLET} strokeWidth="2" />
          <line x1="-78" y1="45" x2="78" y2="45" stroke={VIOLET} strokeWidth="1.5" />
        </g>
      )}

      {/* Diagonal spectral splashes at the corners — small accents */}
      <g opacity="0.35">
        {[
          { x: 200, y: 200, rot: 30 },
          { x: W - 200, y: 200, rot: -30 },
          { x: 200, y: H - 200, rot: -30 },
          { x: W - 200, y: H - 200, rot: 30 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
            {SPECTRUM.map((color, ci) => (
              <line key={ci} x1="-30" y1={ci * 1.5 - 3.75} x2="30" y2={ci * 1.5 - 3.75}
                    stroke={color} strokeOpacity="0.45" strokeWidth="1" />
            ))}
          </g>
        ))}
      </g>

      {/* Frame — thin white outline */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="2"
            fill="none" stroke={WHITE} strokeOpacity="0.20" strokeWidth="1" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="1"
            fill="none" stroke={VIOLET} strokeOpacity="0.18" strokeWidth="0.7"
            strokeDasharray="2 8" />

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Space Grotesk","Inter",sans-serif' fontWeight="600"
              fontSize="29" fill={WHITE} fillOpacity="0.50" letterSpacing="18">
          💎 PRISM
        </text>
      </g>
    </svg>
  );
}
