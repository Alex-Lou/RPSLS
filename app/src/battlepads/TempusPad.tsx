import { W, H } from "./dims";

/* Tempus — Sands of time, ancient gears, sepia warmth.
   Sand-dune base, rotating gear silhouettes, falling grains,
   hourglass centre with flowing sand, bronze frame. */

const SAND   = "#1a1208";
const SEPIA  = "#b8956a";
const BRONZE = "#8b6914";
const GOLD   = "#d4a76a";

export function TempusPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="tp-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0%"  stopColor="#221a10" />
          <stop offset="50%" stopColor={SAND} />
          <stop offset="100%" stopColor="#0a0703" />
        </radialGradient>
        <radialGradient id="tp-hour" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={GOLD} stopOpacity="0.18" />
          <stop offset="60%" stopColor={SEPIA} stopOpacity="0.06" />
          <stop offset="100%" stopColor={SEPIA} stopOpacity="0" />
        </radialGradient>
        <filter id="tp-blur6"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="tp-blur3"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#tp-bg)" />

      {/* Ancient gear silhouettes — slowly rotating in the background */}
      <g transform={`translate(${W/2} ${H/2})`}>
        {[
          { r: 220, teeth: 18, o: 0.06, dur: 40 },
          { r: 160, teeth: 12, o: 0.04, dur: 28 },
        ].map((g, i) => {
          const pts: string[] = [];
          for (let j = 0; j < g.teeth; j++) {
            const a = (j / g.teeth) * Math.PI * 2;
            const innerR = g.r * 0.82;
            const outerR = g.r;
            pts.push(`${Math.cos(a) * outerR},${Math.sin(a) * outerR}`);
            const midA = a + Math.PI / g.teeth;
            pts.push(`${Math.cos(midA) * innerR},${Math.sin(midA) * innerR}`);
          }
          return (
            <g key={i}>
              <circle r={g.r * 0.82} fill="none" stroke={SEPIA} strokeOpacity={g.o} strokeWidth="1.5">
                <animateTransform attributeName="transform" type="rotate"
                  from={`${i * 30}`} to={`${i * 30 + (i === 0 ? 360 : -360)}`}
                  dur={`${g.dur}s`} repeatCount="indefinite" />
              </circle>
              <polygon points={pts.join(" ")} fill="none" stroke={SEPIA} strokeOpacity={g.o * 0.7} strokeWidth="1">
                <animateTransform attributeName="transform" type="rotate"
                  from={`${i * 30}`} to={`${i * 30 + (i === 0 ? 360 : -360)}`}
                  dur={`${g.dur}s`} repeatCount="indefinite" />
              </polygon>
            </g>
          );
        })}
      </g>

      {/* Sand dunes — horizontal wave bands across bottom */}
      <g fill={SAND} opacity="0.4">
        {[0.6, 0.72, 0.84].map((yFrac, i) => (
          <path key={i}
            d={`M 0 ${yFrac * H + i * 10} Q ${W/4} ${yFrac * H - 15 + i * 8} ${W/2} ${yFrac * H + i * 5} T ${W} ${yFrac * H + i * 12} L ${W} ${H} L 0 ${H} Z`}
            fill={SEPIA} fillOpacity={`${0.06 + i * 0.03}`}>
            <animate attributeName="d"
              values={`M 0 ${yFrac * H + i * 10} Q ${W/4} ${yFrac * H - 15 + i * 8} ${W/2} ${yFrac * H + i * 5} T ${W} ${yFrac * H + i * 12} L ${W} ${H} L 0 ${H} Z;M 0 ${yFrac * H + i * 10 + 8} Q ${W/4} ${yFrac * H - 15 + i * 8 + 5} ${W/2} ${yFrac * H + i * 5 - 3} T ${W} ${yFrac * H + i * 12 + 8} L ${W} ${H} L 0 ${H} Z;M 0 ${yFrac * H + i * 10} Q ${W/4} ${yFrac * H - 15 + i * 8} ${W/2} ${yFrac * H + i * 5} T ${W} ${yFrac * H + i * 12} L ${W} ${H} L 0 ${H} Z`}
              dur={`${12 + i * 3}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>

      {/* Hourglass glow at centre */}
      <rect width={W} height={H} fill="url(#tp-hour)" filter="url(#tp-blur6)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="5s" repeatCount="indefinite" />
      </rect>

      {/* CENTRAL HOURGLASS — premium centerpiece. Two stacked trapezoids
          meeting at a narrow neck, faint glow inside, and a stream of sand
          flowing through the neck. */}
      <g transform={`translate(${W/2} ${H/2 - 10}) scale(1.6)`}>
        {/* Hourglass outer frame — bronze stroke. */}
        <path d="M -70 -90 L 70 -90 L 70 -80 L 10 -10 L 10 10 L 70 80 L 70 90 L -70 90 L -70 80 L -10 10 L -10 -10 L -70 -80 Z"
              fill="none" stroke={BRONZE} strokeOpacity="0.40" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Inner gold trace for premium accent. */}
        <path d="M -68 -88 L 68 -88 L 8 -10 L 8 10 L 68 88 L -68 88 L -8 10 L -8 -10 Z"
              fill="none" stroke={GOLD} strokeOpacity="0.18" strokeWidth="0.6" strokeDasharray="4 6" />
        {/* Top chamber sand body — fills to draining. */}
        <path d="M -64 -84 L 64 -84 L 6 -10 L -6 -10 Z" fill={SEPIA} fillOpacity="0.20">
          <animate attributeName="fill-opacity" values="0.25;0.10;0.25" dur="22s" repeatCount="indefinite" />
        </path>
        {/* Bottom chamber sand body — fills as top drains. */}
        <path d="M -6 10 L 6 10 L 64 84 L -64 84 Z" fill={SEPIA} fillOpacity="0.10">
          <animate attributeName="fill-opacity" values="0.10;0.28;0.10" dur="22s" repeatCount="indefinite" />
        </path>
        {/* Inner warm glow at the neck. */}
        <circle r="14" fill={GOLD} fillOpacity="0.20" filter="url(#tp-blur3)">
          <animate attributeName="fill-opacity" values="0.15;0.30;0.15" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Flowing sand stream through the neck — multiple small dots falling. */}
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} r="1.5" cx="0" cy="-10" fill={GOLD} opacity="0">
            <animate attributeName="cy" values="-10;80"
              dur="1.4s" begin={`${i * 0.22}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.85;0"
              dur="1.4s" begin={`${i * 0.22}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Sand pile at the bottom — small triangle growing. */}
        <path d="M -20 84 L 20 84 L 0 70 Z" fill={GOLD} fillOpacity="0.30">
          <animate attributeName="fill-opacity" values="0.20;0.45;0.20" dur="11s" repeatCount="indefinite" />
        </path>
      </g>

      {/* CLOCK FACE NUMERALS — 12 Roman-numeral marks around a large circle,
          slowly rotating; the entire ring fades in/out so it reads as a
          ghosted timepiece around the hourglass. */}
      <g transform={`translate(${W/2} ${H/2 - 10})`} fontFamily='"Cinzel","EB Garamond",serif'
         fontSize="22" fill={SEPIA} fillOpacity="0.18" textAnchor="middle">
        <animateTransform attributeName="transform" type="rotate"
          values="0;360" dur="120s" repeatCount="indefinite" additive="sum" />
        <animate attributeName="fill-opacity" values="0.10;0.24;0.10" dur="9s" repeatCount="indefinite" />
        {["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"].map((n, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const r = 220;
          return (
            <text key={i} x={Math.cos(a) * r} y={Math.sin(a) * r + 5}>
              {n}
            </text>
          );
        })}
      </g>

      {/* Clock HANDS — slow rotating bronze pointers anchored at hourglass centre. */}
      <g transform={`translate(${W/2} ${H/2 - 10})`} stroke={BRONZE} strokeLinecap="round" fill="none">
        {/* Hour hand. */}
        <line x1="0" y1="0" x2="0" y2="-80" strokeWidth="2.5" strokeOpacity="0.22">
          <animateTransform attributeName="transform" type="rotate"
            values="0;360" dur="600s" repeatCount="indefinite" />
        </line>
        {/* Minute hand. */}
        <line x1="0" y1="0" x2="0" y2="-120" strokeWidth="1.5" strokeOpacity="0.16">
          <animateTransform attributeName="transform" type="rotate"
            values="0;360" dur="100s" repeatCount="indefinite" />
        </line>
      </g>

      {/* Falling sand grains */}
      {!compact && Array.from({ length: 20 }).map((_, i) => {
        const x = 100 + (i * 73) % 1300;
        const delay = (i % 6) * 0.8;
        const dur = 4 + (i % 3) * 1.5;
        return (
          <circle key={i} cx={x} cy={H / 2 - 40} r={0.7 + (i % 3) * 0.4}
                  fill={GOLD} opacity="0">
            <animate attributeName="cy" values={`${H/2 - 40};${H/2 + 160}`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.4;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Frame — bronze + gold double border */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="20"
            fill="none" stroke={BRONZE} strokeOpacity="0.22" strokeWidth="1.8" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="14"
            fill="none" stroke={GOLD} strokeOpacity="0.08" strokeWidth="0.8"
            strokeDasharray="3 12" />

      {/* Corner hourglass miniatures */}
      <g stroke={SEPIA} strokeOpacity="0.15" fill="none" strokeWidth="1">
        {[
          { x: 76, y: 76 },
          { x: W - 76, y: 76 },
          { x: W - 76, y: H - 76 },
          { x: 76, y: H - 76 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(1.6)`}>
            <line x1="-8" y1="-12" x2="8" y2="-12" />
            <line x1="-8" y1="12" x2="8" y2="12" />
            <line x1="-3" y1="-12" x2="-3" y2="12" />
            <line x1="3" y1="-12" x2="3" y2="12" />
          </g>
        ))}
      </g>

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Cinzel","EB Garamond",serif' fontWeight="400"
              fontSize="19" fill={SEPIA} fillOpacity="0.45" letterSpacing="15">
          TEMPUS AETERNUM
        </text>
        <line x1="-90" y1="12" x2="90" y2="12" stroke={BRONZE} strokeOpacity="0.10" />
      </g>
    </svg>
  );
}