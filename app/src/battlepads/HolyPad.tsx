import { W, H } from "./dims";

/* ════════════════════ Holy ════════════════════
   Cathedral light: indigo nave, gilded frame, a slowly rotating rose-window,
   sweeping god-rays from above and gold motes rising. Coded replacement for
   the old PNG so the Holy theme's mat is alive.
*/

export function HolyPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const gold = "#e8c46a";
  const goldDeep = "#b8862f";
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="hp-bg" cx="50%" cy="20%" r="95%">
          <stop offset="0%"  stopColor="#2a2350" />
          <stop offset="45%" stopColor="#16122e" />
          <stop offset="100%" stopColor="#080611" />
        </radialGradient>
        <radialGradient id="hp-halo" cx="50%" cy="10%" r="48%">
          <stop offset="0%"  stopColor="#ffe9a8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hp-gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6e3a6" />
          <stop offset="100%" stopColor={goldDeep} />
        </linearGradient>
        <linearGradient id="hp-ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#ffe9a8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffe9a8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#hp-bg)" />

      {/* God-ray shafts fanning from above — each shimmers on its own clock. */}
      <g style={{ mixBlendMode: "screen" }}>
        {[-40, -22, -6, 10, 26, 42].map((a, i) => (
          <g key={i} transform={`translate(${W / 2} -40) rotate(${a})`}>
            <polygon points="-26,0 26,0 95,1120 -95,1120" fill="url(#hp-ray)">
              <animate attributeName="opacity"
                values={compact ? "0.05;0.14;0.05" : "0.08;0.24;0.08"}
                dur={`${5 + i}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </polygon>
          </g>
        ))}
      </g>

      {/* Warm halo (the light source up high). */}
      <rect width={W} height={H} fill="url(#hp-halo)" />

      {/* Rose window — top centre, very slow rotation. */}
      <g transform={`translate(${W / 2} 210)`} stroke={gold} fill="none">
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="120s" repeatCount="indefinite" />
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            return <line key={i} x1="0" y1="0" x2={Math.cos(ang) * 118} y2={Math.sin(ang) * 118} strokeOpacity="0.28" strokeWidth="1.5" />;
          })}
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (i / 8) * Math.PI * 2;
            return <circle key={i} cx={Math.cos(ang) * 76} cy={Math.sin(ang) * 76} r="20" strokeOpacity="0.4" strokeWidth="1.5" />;
          })}
        </g>
        <circle r="118" strokeOpacity="0.5" strokeWidth="2" />
        <circle r="46" strokeOpacity="0.6" strokeWidth="2" />
        <circle r="8" fill={gold} stroke="none" fillOpacity="0.85" />
      </g>

      {/* Ornate gilded frame. */}
      <rect x="34" y="34" width={W - 68} height={H - 68} rx="26" fill="none" stroke="url(#hp-gold)" strokeWidth="5" />
      <rect x="54" y="54" width={W - 108} height={H - 108} rx="20" fill="none" stroke={gold} strokeOpacity="0.4" strokeWidth="1.5" />
      <rect x="68" y="68" width={W - 136} height={H - 136} rx="16" fill="none" stroke={gold} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 10" />

      {/* Corner crosses. */}
      {[[120, 120], [W - 120, 120], [120, H - 120], [W - 120, H - 120]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} stroke={gold} strokeOpacity="0.5" strokeWidth="3">
          <line x1="0" y1="-26" x2="0" y2="26" />
          <line x1="-18" y1="-7" x2="18" y2="-7" />
        </g>
      ))}

      {/* Gold motes drifting upward toward the light. */}
      {!compact && Array.from({ length: 14 }).map((_, i) => {
        const x = 120 + (i * 97) % (W - 240);
        const dur = 6 + (i % 5);
        const delay = (i % 6) * 1.1;
        return (
          <circle key={i} cx={x} cy={H - 60} r={1.6 + (i % 3) * 0.6} fill="#ffe9a8" opacity="0">
            <animate attributeName="cy" values={`${H - 60};170`} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.7;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Scripture banner. */}
      <g transform={`translate(${W / 2} ${H - 92})`} textAnchor="middle">
        <line x1="-180" y1="0" x2="-70" y2="0" stroke={gold} strokeOpacity="0.5" />
        <line x1="70" y1="0" x2="180" y2="0" stroke={gold} strokeOpacity="0.5" />
        <text fontFamily="Cinzel,Georgia,serif" fontSize="20" fill={gold} fillOpacity="0.7" letterSpacing="8">SANCTVM</text>
      </g>
    </svg>
  );
}
