import { W, H } from "./dims";

/* Emberforge — dwarven smithy, molten ember rivers, hammered copper.
   Deep forge coal base, winding orange/amber vein cracks, pulsing
   heat breath, rising ember motes, hammered anvil texture at edges. */

const COAL   = "#0a0604";
const EMBER  = "#ff6a14";
const AMBER  = "#ff9426";
const HEAT   = "#cc2503";
const COPPER = "#6b3a20";
const FRAME  = "#a05a30";

export function EmberforgePad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="ef-bg" cx="50%" cy="45%" r="70%">
          <stop offset="0%"  stopColor="#120805" />
          <stop offset="45%" stopColor={COAL} />
          <stop offset="100%" stopColor="#040201" />
        </radialGradient>
        <radialGradient id="ef-heat" cx="50%" cy="30%" r="35%">
          <stop offset="0%"  stopColor={HEAT} stopOpacity="0.18" />
          <stop offset="60%" stopColor={EMBER} stopOpacity="0.04" />
          <stop offset="100%" stopColor={EMBER} stopOpacity="0" />
        </radialGradient>
        <filter id="ef-blur6"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="ef-blur3"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#ef-bg)" />

      {/* Forge heat aura at top-centre */}
      <rect width={W} height={H} fill="url(#ef-heat)" filter="url(#ef-blur6)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
      </rect>

      {/* Molten ember veins — winding cracks glowing orange */}
      <g fill="none" strokeLinecap="round" filter="url(#ef-blur3)">
        {[
          "M 80 600 Q 200 580 350 620 T 600 590 T 850 640 T 1100 580 T 1400 620",
          "M 100 720 Q 280 680 450 740 T 700 700 T 950 750 T 1250 690 T 1420 730",
          "M 200 340 Q 400 310 550 360 T 800 320 T 1050 370 T 1300 340",
          "M 150 480 Q 350 450 500 500 T 750 460 T 1000 510 T 1350 470",
          "M 60 850 Q 250 810 420 860 T 680 820 T 920 870 T 1200 830 T 1480 860",
        ].map((d, i) => (
          <g key={i}>
            <path d={d} stroke={AMBER} strokeOpacity="0.08" strokeWidth="3">
              <animate attributeName="stroke-opacity"
                values="0.04;0.14;0.04"
                dur={`${5 + i * 0.8}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </path>
            <path d={d} stroke={EMBER} strokeOpacity="0.06" strokeWidth="5">
              <animate attributeName="stroke-opacity"
                values="0.02;0.10;0.02"
                dur={`${4 + i * 1.2}s`} begin={`${i * 0.7}s`} repeatCount="indefinite" />
            </path>
          </g>
        ))}
      </g>

      {/* Pulsing forge breath — central glow */}
      <g transform={`translate(${W/2} ${H/2 - 20})`}>
        <circle r="120" fill={EMBER} fillOpacity="0.03" filter="url(#ef-blur6)">
          <animate attributeName="r" values="100;140;100" dur="3.5s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.02;0.05;0.02" dur="3.5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* ANVIL SILHOUETTE — dark T-shaped block centre, lit by forge from above. */}
      <g transform={`translate(${W/2} ${H/2 + 40})`}>
        {/* Anvil body — vertical post. */}
        <rect x="-60" y="-50" width="120" height="100" rx="6" fill="#040201" stroke={COPPER} strokeOpacity="0.20" strokeWidth="1.5" />
        {/* Anvil top — wider slab. */}
        <rect x="-100" y="-80" width="200" height="34" rx="6" fill="#080302" stroke={COPPER} strokeOpacity="0.25" strokeWidth="1.5" />
        {/* Heat glow on the anvil's struck top edge. */}
        <rect x="-95" y="-84" width="190" height="3" fill={AMBER} fillOpacity="0.35" filter="url(#ef-blur3)">
          <animate attributeName="fill-opacity" values="0.25;0.65;0.25" dur="3.2s" repeatCount="indefinite" />
        </rect>
        {/* Periodic HAMMER STRIKE flash — bright pulse + shock ring + radial sparks. */}
        <g>
          {/* Ground-zero flash dot. */}
          <circle cx="0" cy="-82" r="14" fill="#ffeacc" fillOpacity="0" filter="url(#ef-blur3)">
            <animate attributeName="fill-opacity"
              values="0;0;0.95;0.3;0;0"
              keyTimes="0;0.46;0.50;0.55;0.62;1"
              dur="5.5s" repeatCount="indefinite" />
          </circle>
          {/* Expanding shock ring. */}
          <circle cx="0" cy="-82" r="10" fill="none" stroke={AMBER} strokeWidth="2" strokeOpacity="0">
            <animate attributeName="r" values="6;6;120" keyTimes="0;0.48;0.85" dur="5.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0;0;0.85;0" keyTimes="0;0.48;0.52;0.85" dur="5.5s" repeatCount="indefinite" />
          </circle>
          {/* 8 outward sparks. */}
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const x2 = Math.cos(ang) * 130;
            const y2 = -82 + Math.sin(ang) * 130;
            return (
              <line key={i} x1="0" y1="-82" x2={x2} y2={y2}
                stroke={AMBER} strokeOpacity="0" strokeWidth="1.4" strokeLinecap="round">
                <animate attributeName="stroke-opacity"
                  values="0;0;0.85;0"
                  keyTimes="0;0.48;0.55;0.78"
                  dur="5.5s" repeatCount="indefinite" />
              </line>
            );
          })}
        </g>
      </g>

      {/* Rising ember motes */}
      {!compact && Array.from({ length: 16 }).map((_, i) => {
        const x = 120 + (i * 93) % 1300;
        const delay = (i % 5) * 0.6;
        const dur = 5 + (i % 3) * 2;
        return (
          <circle key={i} cx={x} cy={H - 60} r={1 + (i % 3) * 0.8}
                  fill={i % 4 === 0 ? AMBER : EMBER} opacity="0">
            <animate attributeName="cy" values={`${H - 60};${60 + i * 8};${H - 60}`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.5;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Hammered copper texture — angular noise at the edges */}
      <g fill="none" stroke={COPPER} strokeOpacity="0.06">
        {Array.from({ length: 40 }).map((_, i) => {
          const a = (i / 40) * Math.PI * 2;
          const r = 380 + (i % 5) * 25;
          const cx = W / 2 + Math.cos(a) * r;
          const cy = H / 2 + Math.sin(a) * r * 0.65;
          const angle = (i * 17) * Math.PI / 180;
          const len = 12 + (i % 3) * 8;
          return (
            <line key={i}
              x1={cx} y1={cy}
              x2={cx + Math.cos(angle) * len} y2={cy + Math.sin(angle) * len}
              strokeWidth="0.6">
              <animate attributeName="stroke-opacity"
                values="0.03;0.08;0.03"
                dur={`${7 + (i % 4)}s`} begin={`${i * 0.2}s`} repeatCount="indefinite" />
            </line>
          );
        })}
      </g>

      {/* Frame — copper + gold double border */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="20"
            fill="none" stroke={FRAME} strokeOpacity="0.20" strokeWidth="1.8" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="14"
            fill="none" stroke={AMBER} strokeOpacity="0.08" strokeWidth="0.8"
            strokeDasharray="4 12" />

      {/* Corner anvil marks */}
      <g stroke={FRAME} strokeOpacity="0.14" fill="none" strokeWidth="1.2">
        {[
          { x: 76, y: 76 },
          { x: W - 76, y: 76 },
          { x: W - 76, y: H - 76 },
          { x: 76, y: H - 76 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <rect x="-10" y="-10" width="20" height="20" fill="none" />
            <line x1="-7" y1="0" x2="7" y2="0" />
            <line x1="0" y1="-7" x2="0" y2="7" />
          </g>
        ))}
      </g>

      {/* Title — fonts match the HUD palette (Bebas + Rajdhani) so the
          Emberforge set reads as one identity across pad + HUD. The original
          Cinzel here clashed against the bold display family driving the
          rest of the surfaces. */}
      <g transform={`translate(${W/2} 112)`} textAnchor="middle">
        <text fontFamily='"Bebas Neue","Rajdhani",Impact,sans-serif' fontWeight="700"
              fontSize="22" fill={AMBER} fillOpacity="0.45" letterSpacing="14">
          EMBER FORGE
        </text>
        <line x1="-70" y1="14" x2="70" y2="14" stroke={FRAME} strokeOpacity="0.12"
              strokeWidth="0.8" />
      </g>
    </svg>
  );
}