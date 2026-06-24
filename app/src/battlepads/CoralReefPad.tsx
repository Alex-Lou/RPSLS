import { W, H } from "./dims";

/* Coral — Bioluminescent reef.
   Warm turquoise→coral gradient base, undulating coral silhouettes at the
   bottom, pulsing anemone discs, drifting fish school across the centre,
   slow rising bubbles, central concentric anemone emblem. */

const DEEP    = "#0a1628";  // turquoise depth
const WARM    = "#1a0a0a";  // coral floor
const CORAL   = "#ff6b6b";  // primary
const TEAL    = "#4ecdc4";  // secondary
const GLOW    = "#aef2e8";
const PEACH   = "#ffb39a";

export function CoralReefPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <linearGradient id="cr-bg" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"  stopColor="#08111f" />
          <stop offset="55%" stopColor={DEEP} />
          <stop offset="100%" stopColor={WARM} />
        </linearGradient>
        <radialGradient id="cr-anem" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={GLOW} stopOpacity="0.95" />
          <stop offset="60%" stopColor={TEAL} stopOpacity="0.45" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cr-coral-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={CORAL} stopOpacity="0.7" />
          <stop offset="100%" stopColor={CORAL} stopOpacity="0" />
        </radialGradient>
        <filter id="cr-blur4"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="cr-blur8"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#cr-bg)" />

      {/* Soft caustic bands at the top — slow drifting */}
      <g opacity="0.18">
        {[0.10, 0.22, 0.34].map((y, i) => (
          <ellipse key={i} cx={W/2} cy={H*y} rx={W*0.65} ry="40" fill={TEAL} filter="url(#cr-blur8)">
            <animate attributeName="cx" values={`${W/2 - 80};${W/2 + 80};${W/2 - 80}`} dur={`${14 + i*3}s`} repeatCount="indefinite" />
          </ellipse>
        ))}
      </g>

      {/* CORAL silhouettes along the bottom — 5 organic shapes that bob */}
      <g>
        {[
          { x: 180, scale: 1.0, dur: 6.0, color: CORAL },
          { x: 420, scale: 1.3, dur: 7.5, color: PEACH },
          { x: 720, scale: 1.1, dur: 6.8, color: CORAL },
          { x: 1020, scale: 1.25, dur: 8.2, color: PEACH },
          { x: 1320, scale: 0.95, dur: 7.0, color: CORAL },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${H - 60}) scale(${c.scale})`} opacity="0.78">
            {/* Soft glow halo */}
            <circle cx="0" cy="-60" r="120" fill="url(#cr-coral-glow)" />
            {/* Coral branches — organic blob */}
            <path d="M 0 0 C -40 -120 -80 -160 -50 -240 C -20 -180 20 -210 35 -260 C 50 -200 75 -180 60 -120 C 90 -150 110 -100 80 -50 Z"
                  fill={c.color} opacity="0.85">
              <animateTransform attributeName="transform" type="rotate"
                from="-1.5" to="1.5" dur={`${c.dur}s`} repeatCount="indefinite" additive="sum" />
            </path>
            <path d="M -20 -10 C -30 -80 -60 -120 -40 -200 C -10 -150 15 -180 25 -220 Z"
                  fill={c.color} opacity="0.55" />
          </g>
        ))}
      </g>

      {/* 5 ANEMONES — pulsing bioluminescent discs */}
      <g>
        {[
          { x: 280, y: 360, dur: 2.8 },
          { x: 520, y: 460, dur: 3.4 },
          { x: 780, y: 380, dur: 2.6 },
          { x: 1040, y: 440, dur: 3.1 },
          { x: 1240, y: 350, dur: 2.9 },
        ].map((a, i) => (
          <g key={i} transform={`translate(${a.x} ${a.y})`}>
            <circle r="55" fill="url(#cr-anem)">
              <animate attributeName="r" values="48;62;48" dur={`${a.dur}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.50;0.95;0.50" dur={`${a.dur}s`} repeatCount="indefinite" />
            </circle>
            <circle r="14" fill={GLOW} opacity="0.85">
              <animate attributeName="opacity" values="0.55;1;0.55" dur={`${a.dur}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </g>

      {/* SCHOOL OF FISH — group of bright motes drifting across */}
      <g opacity="0.85">
        {Array.from({ length: 18 }).map((_, i) => {
          const ang = (i / 18) * Math.PI * 2;
          const r = 60 + (i % 5) * 12;
          const x = Math.cos(ang) * r;
          const y = Math.sin(ang) * r * 0.4;
          return (
            <ellipse key={i} cx={x} cy={y} rx="4" ry="2.2" fill={GLOW}>
              <animate attributeName="opacity" values="0.4;1;0.4" dur={`${1.5 + (i % 4) * 0.3}s`} repeatCount="indefinite" begin={`${i * 0.05}s`} />
            </ellipse>
          );
        })}
        <animateTransform attributeName="transform" type="translate"
          values={`${-200} ${H*0.55}; ${W + 200} ${H*0.48}; ${-200} ${H*0.55}`}
          dur="22s" repeatCount="indefinite" />
      </g>

      {/* RISING BUBBLES */}
      <g fill={GLOW} opacity="0.55">
        {Array.from({ length: 14 }).map((_, i) => {
          const x = 80 + i * 110;
          const dur = 6 + (i % 4) * 1.3;
          const r = 4 + (i % 3) * 2;
          return (
            <circle key={i} cx={x} cy={H + 20} r={r}>
              <animate attributeName="cy" values={`${H + 20};-30`} dur={`${dur}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="cx" values={`${x};${x + 30};${x};${x - 30};${x}`} dur={`${dur}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.6;0.6;0" keyTimes="0;0.1;0.85;1" dur={`${dur}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>

      {/* ── CENTRAL ANEMONE EMBLEM (the signature) ──
            12 radial petals + bright core, slow rotation. */}
      {!compact && (
        <g transform={`translate(${W/2} ${H/2}) scale(1.6)`}>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * 360;
            return (
              <g key={i} transform={`rotate(${a})`}>
                <ellipse cx="0" cy="-90" rx="14" ry="50" fill={CORAL} opacity="0.55">
                  <animate attributeName="opacity" values="0.35;0.75;0.35" dur="3.4s" begin={`${i * 0.12}s`} repeatCount="indefinite" />
                </ellipse>
              </g>
            );
          })}
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="48s" repeatCount="indefinite" additive="sum" />
          <circle r="55" fill="url(#cr-anem)" />
          <circle r="22" fill={GLOW}>
            <animate attributeName="r" values="18;26;18" dur="2.2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Double frame — soft turquoise outer + coral inner */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="20"
            fill="none" stroke={TEAL} strokeOpacity="0.30" strokeWidth="1.8" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="14"
            fill="none" stroke={CORAL} strokeOpacity="0.18" strokeWidth="0.8"
            strokeDasharray="6 14" />

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"Playfair Display","Cormorant Garamond",serif' fontWeight="600"
              fontSize="32" fill={GLOW} fillOpacity="0.45" letterSpacing="14">
          🪸 CORAL REEF
        </text>
      </g>
    </svg>
  );
}
