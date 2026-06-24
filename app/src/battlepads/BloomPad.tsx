import { W, H } from "./dims";

/* Bloom — Infinite garden.
   Sky-blue → mint gradient (LIGHT), falling petals in spiral, growing vines
   from the bottom, fireflies drifting, opening flowers, butterflies. The
   most JOYFUL pad. */

const SKY     = "#b8d4e3";
const GROUND  = "#c8e6c9";
const PINK    = "#ff7eb3";
const GREEN   = "#81c784";
const YELLOW  = "#ffd54f";
const PETAL   = "#ffb7b2";
const STEM    = "#5e8a5e";

export function BloomPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <linearGradient id="bl-bg" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"  stopColor={SKY} />
          <stop offset="60%" stopColor="#d2e7d8" />
          <stop offset="100%" stopColor={GROUND} />
        </linearGradient>
        <radialGradient id="bl-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#fff3c8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff3c8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bl-firefly" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={YELLOW} stopOpacity="0.95" />
          <stop offset="100%" stopColor={YELLOW} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#bl-bg)" />

      {/* Warm sun upper-right */}
      <circle cx={W * 0.82} cy="180" r="240" fill="url(#bl-sun)" />

      {/* Slow drifting cloud wisps */}
      <g fill="#ffffff" opacity="0.55">
        <ellipse cx="200" cy="180" rx="120" ry="20">
          <animate attributeName="cx" values="200;-100;200" dur="30s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="900" cy="240" rx="140" ry="22">
          <animate attributeName="cx" values="900;1700;900" dur="40s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* ── 5 VINES growing from the bottom edge ── */}
      <g stroke={STEM} strokeWidth="6" strokeLinecap="round" fill="none">
        {[
          { x: 200, dur: 9, sway: 30 },
          { x: 480, dur: 11, sway: 25 },
          { x: 760, dur: 8, sway: 35 },
          { x: 1040, dur: 12, sway: 28 },
          { x: 1320, dur: 10, sway: 32 },
        ].map((v, i) => (
          <g key={i}>
            <path d={`M ${v.x} ${H} Q ${v.x + v.sway} ${H * 0.7} ${v.x} ${H * 0.4} T ${v.x} ${H * 0.18}`}
                  strokeDasharray="900" strokeDashoffset="900">
              <animate attributeName="stroke-dashoffset" values="900;0;0;900"
                       keyTimes="0;0.3;0.85;1" dur={`${v.dur}s`} repeatCount="indefinite" />
            </path>
            {/* Leaves along the vine */}
            {[0.7, 0.5, 0.3].map((yFrac, lj) => (
              <ellipse key={lj} cx={v.x + (lj % 2 === 0 ? -22 : 22)} cy={H * yFrac}
                       rx="20" ry="9" fill={GREEN} stroke="none"
                       transform={`rotate(${(lj % 2 === 0 ? -30 : 30)} ${v.x} ${H * yFrac})`}>
                <animate attributeName="opacity" values="0;0;1;0"
                         keyTimes={`0;${0.3 + lj * 0.05};${0.5 + lj * 0.05};1`}
                         dur={`${v.dur}s`} repeatCount="indefinite" />
              </ellipse>
            ))}
            {/* Flower at the tip */}
            <g transform={`translate(${v.x} ${H * 0.18}) scale(1.6)`}>
              {Array.from({ length: 5 }).map((_, p) => {
                const a = (p / 5) * 360;
                return (
                  <ellipse key={p} cx="0" cy="-22" rx="14" ry="22"
                           fill={i % 2 === 0 ? PINK : PETAL} opacity="0.92"
                           transform={`rotate(${a})`}>
                    <animate attributeName="opacity"
                             values="0;0;0.9;0"
                             keyTimes={`0;${0.55 + p * 0.015};${0.7 + p * 0.015};1`}
                             dur={`${v.dur}s`} repeatCount="indefinite" />
                  </ellipse>
                );
              })}
              <circle r="9" fill={YELLOW}>
                <animate attributeName="opacity" values="0;0;1;0"
                         keyTimes="0;0.65;0.8;1" dur={`${v.dur}s`} repeatCount="indefinite" />
              </circle>
            </g>
          </g>
        ))}
      </g>

      {/* ── FALLING PETALS — drifting from the top in spiral trajectories ── */}
      <g>
        {Array.from({ length: 16 }).map((_, i) => {
          const x = 50 + (i * 91) % (W - 100);
          const dur = 9 + (i % 5) * 1.3;
          const delay = (i * 0.4) % 6;
          const color = i % 2 === 0 ? PINK : PETAL;
          return (
            <g key={i}>
              <ellipse cx={x} cy="-30" rx="8" ry="14" fill={color} opacity="0.85">
                <animate attributeName="cy" values="-30;1050" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="cx" values={`${x};${x + 60};${x - 40};${x + 30};${x}`}
                         dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.85;0.85;0"
                         keyTimes="0;0.1;0.85;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${x} 0`} to={`720 ${x} 0`}
                  dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
              </ellipse>
            </g>
          );
        })}
      </g>

      {/* ── FIREFLIES — pulsing yellow dots in brownian drift ── */}
      <g>
        {Array.from({ length: 10 }).map((_, i) => {
          const x = 100 + (i * 140) % (W - 100);
          const y = 350 + ((i * 79) % 350);
          const dur = 4 + (i % 4) * 0.8;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="14" fill="url(#bl-firefly)">
                <animate attributeName="cx" values={`${x};${x + 60};${x - 40};${x + 40};${x}`}
                         dur={`${dur * 2}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${y};${y - 40};${y + 30};${y - 20};${y}`}
                         dur={`${dur * 2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;1;0.3" dur={`${dur}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="3" fill={YELLOW}>
                <animate attributeName="cx" values={`${x};${x + 60};${x - 40};${x + 40};${x}`}
                         dur={`${dur * 2}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${y};${y - 40};${y + 30};${y - 20};${y}`}
                         dur={`${dur * 2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.55;1;0.55" dur={`${dur}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </g>

      {/* ── BUTTERFLIES — 2 small ones cruise on sin paths ── */}
      <g fill={PINK}>
        <g>
          <ellipse cx="-5" cy="0" rx="13" ry="22" />
          <ellipse cx="5" cy="0" rx="13" ry="22" />
          <circle cx="0" cy="0" r="3" fill={INK_COLOR()} />
          <animateTransform attributeName="transform" type="translate"
            values={`${-50} ${H*0.4}; ${W + 50} ${H*0.35}; ${-50} ${H*0.4}`}
            dur="25s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0;0"
                   keyTimes="0;0.05;0.45;0.5;1" dur="25s" repeatCount="indefinite" />
        </g>
        <g>
          <ellipse cx="-5" cy="0" rx="13" ry="22" fill={YELLOW} />
          <ellipse cx="5" cy="0" rx="13" ry="22" fill={YELLOW} />
          <circle cx="0" cy="0" r="3" fill={INK_COLOR()} />
          <animateTransform attributeName="transform" type="translate"
            values={`${W + 50} ${H*0.6}; ${-50} ${H*0.55}; ${W + 50} ${H*0.6}`}
            dur="32s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0;0"
                   keyTimes="0;0.05;0.45;0.5;1" dur="32s" repeatCount="indefinite" />
        </g>
      </g>

      {/* ── CENTRAL CROWNING FLOWER — large bloom emblem ── */}
      {!compact && (
        <g transform={`translate(${W/2} ${H/2}) scale(1.6)`}>
          {/* 8 outer petals */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * 360;
            return (
              <ellipse key={i} cx="0" cy="-100" rx="32" ry="65"
                       fill={PINK} opacity="0.85" transform={`rotate(${a})`}>
                <animate attributeName="opacity" values="0.65;0.95;0.65"
                         dur={`${3 + (i % 4) * 0.4}s`} begin={`${i * 0.15}s`}
                         repeatCount="indefinite" />
              </ellipse>
            );
          })}
          {/* 8 inner petals (smaller, lighter) */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * 360 + 22.5;
            return (
              <ellipse key={i} cx="0" cy="-58" rx="20" ry="38"
                       fill={PETAL} opacity="0.85" transform={`rotate(${a})`} />
            );
          })}
          {/* Centre */}
          <circle r="32" fill={YELLOW} opacity="0.95">
            <animate attributeName="r" values="28;36;28" dur="3.4s" repeatCount="indefinite" />
          </circle>
          <circle r="10" fill="#ff6b3a">
            <animate attributeName="opacity" values="0.75;1;0.75" dur="2.0s" repeatCount="indefinite" />
          </circle>
          {/* Slow rotation */}
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="80s" repeatCount="indefinite" additive="sum" />
        </g>
      )}

      {/* Frame — soft green pastel */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="20"
            fill="none" stroke={GREEN} strokeOpacity="0.55" strokeWidth="2" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="14"
            fill="none" stroke={PINK} strokeOpacity="0.32" strokeWidth="1"
            strokeDasharray="6 14" />

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Playfair Display","Inter",serif' fontStyle="italic"
              fontSize="35" fill={STEM} fillOpacity="0.65" letterSpacing="12">
          🌸 Bloom Garden
        </text>
      </g>
    </svg>
  );
}

// Small helper so the dark dot eyes on the butterflies aren't a fixed inline.
function INK_COLOR() { return "#1a1a1a"; }
