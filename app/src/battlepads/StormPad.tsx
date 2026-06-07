import { W, H } from "./dims";

/* Storm — Thunderhead, lightning strikes, rain curtains.
   Deep storm-sky base, jagged lightning bolts, falling rain
   streaks, rolling cloud shadows, electric cyan+purple accents. */

const SKY     = "#0a0e1a";
const CLOUD   = "#1a2030";
const BOLT    = "#4af0ff";
const PURPLE  = "#a078ff";
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

      {/* Lightning flash glow — primary bright burst + delayed thunder
          afterglow that decays slower. Same 12s cycle as the bolts. */}
      <rect width={W} height={H} fill="url(#st-flash)" filter="url(#st-blur8)">
        <animate attributeName="opacity"
          values="0;0;0.7;0;0"
          keyTimes="0;0.46;0.48;0.52;1"
          dur="12s" repeatCount="indefinite" />
      </rect>
      {/* Secondary delayed flash — thunder afterglow, longer decay, dimmer. */}
      <rect width={W} height={H} fill="url(#st-flash)" filter="url(#st-blur8)" opacity="0">
        <animate attributeName="opacity"
          values="0;0;0.32;0.18;0"
          keyTimes="0;0.50;0.52;0.58;0.68"
          dur="12s" repeatCount="indefinite" />
      </rect>
      {/* Distant horizon flash — amber-violet pulse at bottom edge. */}
      <rect x="0" y={H - 200} width={W} height="200" fill={PURPLE} fillOpacity="0" filter="url(#st-blur8)">
        <animate attributeName="fill-opacity"
          values="0;0;0.20;0.06;0"
          keyTimes="0;0.78;0.80;0.84;0.92"
          dur="12s" repeatCount="indefinite" />
      </rect>

      {/* Jagged lightning bolts with FORK BRANCHES — three primary bolts at
          staggered times, each with a side branch that fires the same
          micro-window. Inner cyan + outer purple halo for dichroic snap. */}
      <g stroke={BOLT} strokeOpacity="0.55" fill="none" strokeWidth="2" filter="url(#st-blur4)">
        {[
          {
            pts:  "M 380 60 L 350 140 L 370 160 L 330 260 L 360 290 L 310 400",
            fork: "M 370 160 L 410 200 L 388 235 L 425 290",
          },
          {
            pts:  "M 950 40 L 920 120 L 945 135 L 900 230 L 930 260 L 880 370 L 910 390",
            fork: "M 945 135 L 985 175 L 962 210 L 998 260",
          },
          {
            pts:  "M 680 70 L 660 150 L 685 170 L 640 280 L 670 310 L 630 420",
            fork: "M 660 150 L 620 195 L 638 230 L 600 280",
          },
        ].map((b, i) => {
          const dur = 10 + i * 3;
          const begin = `${i * 2}s`;
          return (
            <g key={i}>
              {/* Main bolt. */}
              <path d={b.pts}>
                <animate attributeName="stroke-opacity"
                  values="0;0;0.85;0.1;0"
                  keyTimes="0;0.36;0.38;0.40;1"
                  dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
              </path>
              {/* Outer purple halo of main bolt. */}
              <path d={b.pts} stroke={PURPLE} strokeOpacity="0.3" strokeWidth="5">
                <animate attributeName="stroke-opacity"
                  values="0;0;0.55;0.08;0"
                  keyTimes="0;0.36;0.38;0.40;1"
                  dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
              </path>
              {/* Fork branch — thinner, same timing. */}
              <path d={b.fork} strokeWidth="1.3">
                <animate attributeName="stroke-opacity"
                  values="0;0;0.65;0.08;0"
                  keyTimes="0;0.36;0.385;0.40;1"
                  dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
              </path>
              {/* Strike-point flare on the upper origin of the main bolt. */}
              <circle cx={parseInt(b.pts.split(" ")[1])} cy={parseInt(b.pts.split(" ")[2])}
                r="20" fill={BOLT} fillOpacity="0" filter="url(#st-blur4)">
                <animate attributeName="fill-opacity"
                  values="0;0;0.6;0;0"
                  keyTimes="0;0.36;0.39;0.42;1"
                  dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </g>

      {/* RAIN MOVED OUT OF THE PAD (Alex): the torrential 3-layer rain + wind
          sheet + splash mist/bursts overloaded the mat and fought card
          readability during matches. The rain now lives ONLY in the animated
          backdrop (ThemedBackdrop "storm" scene — falling curtains + touch
          reaction), so the pad stays calm: storm sky, intermittent lightning,
          and the Tesla-coil signature. Do NOT re-add rain here. */}

      {/* ── TESLA COIL EMBLEM — pad signature distinct from the rain/clouds
            of the backdrop. A central circular coil with an electric core,
            radial arc discharges, and 6 voltage marks around the rim. ── */}
      <g transform={`translate(${W/2} ${H/2})`}>
        {/* Outer voltage ring with 12 marks. */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const r1 = 170;
          const r2 = i % 2 === 0 ? 200 : 184;
          return (
            <line key={i}
              x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
              x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
              stroke={BOLT} strokeOpacity="0.30" strokeWidth={i % 2 === 0 ? 2 : 1} />
          );
        })}
        <circle r="170" fill="none" stroke={BOLT} strokeOpacity="0.18" strokeWidth="1" />
        {/* 8 RADIAL ARC DISCHARGES — short zigzag lines radiating outward
            with strobing opacity per group. */}
        {[0,1,2,3,4,5,6,7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          const dur = 1.2 + (i % 3) * 0.3;
          const begin = (i * 0.15).toFixed(2);
          const x1 = Math.cos(a) * 60;
          const y1 = Math.sin(a) * 60;
          const xMid = Math.cos(a) * 90 + Math.sin(a) * 8;
          const yMid = Math.sin(a) * 90 - Math.cos(a) * 8;
          const x2 = Math.cos(a) * 130;
          const y2 = Math.sin(a) * 130;
          return (
            <g key={i}>
              <path d={`M ${x1} ${y1} L ${xMid} ${yMid} L ${x2} ${y2}`}
                stroke={BOLT} strokeOpacity="0" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <animate attributeName="stroke-opacity" values="0;0.85;0;0"
                  keyTimes="0;0.05;0.20;1" dur={`${dur}s`}
                  begin={`${begin}s`} repeatCount="indefinite" />
              </path>
              <path d={`M ${x1} ${y1} L ${xMid} ${yMid} L ${x2} ${y2}`}
                stroke={PURPLE} strokeOpacity="0" strokeWidth="3" fill="none" strokeLinecap="round">
                <animate attributeName="stroke-opacity" values="0;0.4;0;0"
                  keyTimes="0;0.05;0.20;1" dur={`${dur}s`}
                  begin={`${begin}s`} repeatCount="indefinite" />
              </path>
            </g>
          );
        })}
        {/* Inner glowing coil — dark core with pulsing electric ring. */}
        <circle r="55" fill="#040810" />
        <circle r="55" fill="none" stroke={BOLT} strokeOpacity="0.45" strokeWidth="1.5">
          <animate attributeName="r" values="55;60;55" dur="1.4s" repeatCount="indefinite" />
        </circle>
        <circle r="42" fill="none" stroke={PURPLE} strokeOpacity="0.30" strokeWidth="1" strokeDasharray="3 4">
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="12s" repeatCount="indefinite" />
        </circle>
        <circle r="28" fill={BOLT} fillOpacity="0.20">
          <animate attributeName="fill-opacity" values="0.20;0.55;0.20" dur="2.0s" repeatCount="indefinite" />
        </circle>
        {/* White-hot central bead with vertical lightning glyph. */}
        <circle r="10" fill="#fff" fillOpacity="0.55">
          <animate attributeName="fill-opacity" values="0.40;0.95;0.40" dur="1.0s" repeatCount="indefinite" />
        </circle>
        <path d="M -3 -8 L 1 -2 L -1 -1 L 3 7 L -1 1 L 1 0 L -3 -8 Z"
          fill={BOLT} fillOpacity="0.85" />
      </g>

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