import { W, H } from "./dims";

/* Phantom — haunted mist, spectral tears, ghost-white wisps.
   Pale lavender-grey base, wandering horizontal mist bands,
   teardrop silhouettes with drip lines, faint floating motes. */

const VOID  = "#0f111a";
const WISP  = "#5a7a9a";
const TEAR  = "#6b8aaa";
const MOTE  = "#a4bccc";
const FRAME = "#4a6078";

export function PhantomPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="ph-bg" cx="50%" cy="40%" r="80%">
          <stop offset="0%"  stopColor="#141722" />
          <stop offset="50%" stopColor={VOID} />
          <stop offset="100%" stopColor="#0a0c12" />
        </radialGradient>
        <filter id="ph-blur8"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="ph-blur3"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#ph-bg)" />

      {/* Wandering mist bands */}
      <g filter="url(#ph-blur8)">
        {[0.14, 0.32, 0.52, 0.70].map((yFrac, i) => (
          <rect key={i} x="-100" y={yFrac * H - 20} width={W + 200} height="40"
                fill={WISP} opacity="0.08">
            <animate attributeName="y"
              values={`${yFrac * H - 20};${yFrac * H - 10 + (i % 2) * 30};${yFrac * H - 20}`}
              dur={`${12 + i * 3}s`} repeatCount="indefinite" />
            <animate attributeName="opacity"
              values="0.04;0.10;0.04"
              dur={`${10 + i * 2}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>

      {/* Spectral teardrops with drip lines */}
      <g filter="url(#ph-blur3)">
        {[
          { x: 320, y: 420, r: 18 },
          { x: 780, y: 480, r: 22 },
          { x: 1180, y: 380, r: 16 },
        ].map((t, i) => (
          <g key={i}>
            <circle cx={t.x} cy={t.y} r={t.r} fill={TEAR} opacity="0.12">
              <animate attributeName="cy" values={`${t.y};${t.y - 15};${t.y}`}
                dur={`${8 + i * 3}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.08;0.16;0.08"
                dur={`${7 + i * 2}s`} repeatCount="indefinite" />
            </circle>
            <line x1={t.x} y1={t.y - t.r} x2={t.x} y2="40"
                  stroke={TEAR} strokeOpacity="0.06" strokeWidth="2">
              <animate attributeName="y1" values={`${t.y - t.r};${t.y - t.r - 12};${t.y - t.r}`}
                dur={`${8 + i * 3}s`} repeatCount="indefinite" />
            </line>
          </g>
        ))}
      </g>

      {/* Faint swirling motes */}
      {!compact && Array.from({ length: 14 }).map((_, i) => {
        const x = 100 + (i * 107) % 1300;
        const y = 80 + (i * 73) % (H - 160);
        return (
          <circle key={i} cx={x} cy={y} r={1.0 + (i % 3) * 0.6}
                  fill={MOTE} opacity="0.12">
            <animate attributeName="cx" values={`${x};${x + 20 - i % 40};${x}`}
              dur={`${9 + (i % 4) * 2}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.05;0.18;0.05"
              dur={`${6 + i}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Frame — cold silver + ghost-white double border */}
      <rect x="44" y="44" width={W - 88} height={H - 88} rx="20"
            fill="none" stroke={FRAME} strokeOpacity="0.14" strokeWidth="1.5" />
      <rect x="58" y="58" width={W - 116} height={H - 116} rx="14"
            fill="none" stroke={MOTE} strokeOpacity="0.07" strokeWidth="0.8"
            strokeDasharray="2 14" />

      {/* Corner sigils */}
      <g stroke={FRAME} strokeOpacity="0.1" fill="none" strokeWidth="1">
        {[
          { x: 80, y: 80 },
          { x: W - 80, y: 80 },
          { x: W - 80, y: H - 80 },
          { x: 80, y: H - 80 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <line x1="-12" y1="-12" x2="12" y2="12" />
            <line x1="-12" y1="12" x2="12" y2="-12" />
            <circle r="5" fill={WISP} fillOpacity="0.08" stroke="none" />
          </g>
        ))}
      </g>

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Cinzel","EB Garamond",serif' fontWeight="400"
              fontSize="18" fill={MOTE} fillOpacity="0.40" letterSpacing="14">
          PHANTOM REALM
        </text>
        <line x1="-80" y1="12" x2="80" y2="12" stroke={FRAME} strokeOpacity="0.08" />
      </g>
    </svg>
  );
}