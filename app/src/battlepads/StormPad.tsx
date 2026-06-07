import { W, H } from "./dims";

/* Storm — Thunderhead, lightning strikes, rain curtains.
   Deep storm-sky base, jagged lightning bolts, falling rain
   streaks, rolling cloud shadows, electric cyan+purple accents. */

const SKY     = "#0a0e1a";
const CLOUD   = "#1a2030";
const BOLT    = "#4af0ff";
const PURPLE  = "#a078ff";
const RAIN    = "#60c0e0";
const FRAME   = "#4080b0";

export function StormPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="st-bg" cx="50%" cy="30%" r="80%">
          <stop offset="0%"  stopColor="#0e1422" />
          <stop offset="40%" stopColor={SKY} />
          <stop offset="100%" stopColor="#040810" />
        </radialGradient>
        <radialGradient id="st-flash" cx="50%" cy="40%" r="40%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="50%" stopColor={BOLT} stopOpacity="0.06" />
          <stop offset="100%" stopColor={BOLT} stopOpacity="0" />
        </radialGradient>
        <filter id="st-blur8"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="st-blur4"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#st-bg)" />

      {/* Rolling cloud shadows — horizontal dark bands drifting */}
      <g fill={CLOUD} opacity="0.25" filter="url(#st-blur8)">
        {[0.12, 0.22, 0.35].map((yFrac, i) => (
          <rect key={i} x="-100" y={yFrac * H - 15} width={W + 200} height="60"
                fill={CLOUD} opacity="0.3">
            <animate attributeName="x"
              values="-100;200;-100" dur={`${18 + i * 4}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>

      {/* Lightning flash glow — brief bright burst, every 12 s. Compressed
          from a 20-keyframe values list to a 4-step keyTimes-precise spike
          (0 → 0.7 → 0 inside 4 % of the cycle), same visual, ~5× less SMIL
          parsing work at mount. */}
      <rect width={W} height={H} fill="url(#st-flash)" filter="url(#st-blur8)">
        <animate attributeName="opacity"
          values="0;0;0.7;0;0"
          keyTimes="0;0.46;0.48;0.52;1"
          dur="12s" repeatCount="indefinite" />
      </rect>

      {/* Jagged lightning bolts — same compression. Each bolt fires once per
          cycle; cycle length staggered per bolt so they never co-fire. The
          previous 30-keyframe `values` strings parsed for nothing. */}
      <g stroke={BOLT} strokeOpacity="0.55" fill="none" strokeWidth="2" filter="url(#st-blur4)">
        {[
          { x: 380, pts: "M 380 60 L 350 140 L 370 160 L 330 260 L 360 290 L 310 400" },
          { x: 950, pts: "M 950 40 L 920 120 L 945 135 L 900 230 L 930 260 L 880 370 L 910 390" },
          { x: 680, pts: "M 680 70 L 660 150 L 685 170 L 640 280 L 670 310 L 630 420" },
        ].map((b, i) => {
          const dur = 10 + i * 3;
          const begin = `${i * 2}s`;
          return (
            <g key={i}>
              <path d={b.pts}>
                <animate attributeName="stroke-opacity"
                  values="0;0;0.65;0.1;0"
                  keyTimes="0;0.36;0.38;0.40;1"
                  dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
              </path>
              <path d={b.pts} stroke={PURPLE} strokeOpacity="0.3" strokeWidth="3">
                <animate attributeName="stroke-opacity"
                  values="0;0;0.4;0.06;0"
                  keyTimes="0;0.36;0.38;0.40;1"
                  dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
              </path>
            </g>
          );
        })}
      </g>

      {/* Falling rain streaks */}
      {!compact && Array.from({ length: 30 }).map((_, i) => {
        const x = 30 + (i * 51) % 1450;
        const delay = (i % 7) * 1.4;
        const dur = 1.2 + (i % 3) * 0.4;
        const h = 30 + (i % 4) * 15;
        return (
          <line key={i} x1={x} y1={60} x2={x + 4} y2={60 + h}
                stroke={RAIN} strokeOpacity="0.15" strokeWidth="1.2"
                strokeLinecap="round">
            <animate attributeName="y1" values={`${60 - h};${H + 40}`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="y2" values={`${60};${H + 40 + h}`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0;0.18;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </line>
        );
      })}

      {/* Frame — electric cyan double border */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="20"
            fill="none" stroke={FRAME} strokeOpacity="0.22" strokeWidth="1.8" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="14"
            fill="none" stroke={BOLT} strokeOpacity="0.1" strokeWidth="0.8"
            strokeDasharray="4 12">
        <animate attributeName="stroke-opacity" values="0.06;0.16;0.06"
          dur="8s" repeatCount="indefinite" />
      </rect>

      {/* Corner bolt sigils */}
      <g stroke={BOLT} strokeOpacity="0.12" fill="none" strokeWidth="1.2">
        {[
          { x: 76, y: 76 },
          { x: W - 76, y: 76 },
          { x: W - 76, y: H - 76 },
          { x: 76, y: H - 76 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <line x1="-12" y1="-8" x2="-4" y2="2" />
            <line x1="-4" y1="2" x2="-8" y2="8" />
            <line x1="-8" y1="8" x2="0" y2="12" />
          </g>
        ))}
      </g>

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Orbitron","Rajdhani",sans-serif' fontWeight="600"
              fontSize="18" fill={BOLT} fillOpacity="0.38" letterSpacing="13">
          ⚡ TEMPEST FURY
        </text>
        <line x1="-80" y1="12" x2="80" y2="12" stroke={FRAME} strokeOpacity="0.12" />
      </g>
    </svg>
  );
}