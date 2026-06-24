import { W, H } from "./dims";

/* ════════════════════ Casino Royale ════════════════════
   Emerald felt + gold Art Déco frame, a slowly spinning roulette wheel
   in one corner, fanned playing cards in the other, a stack of chips
   and a polished diamond accent. All coded, all animated.
*/

export function CasinoPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const gold = "#f0c14b";
  const goldLight = "#fde79a";
  const goldDeep = "#a07418";
  const feltTop = "#0f5a3c";
  const feltDeep = "#0a3d29";
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="ca-bg" cx="50%" cy="50%" r="82%">
          <stop offset="0%"  stopColor={feltTop} />
          <stop offset="62%" stopColor={feltDeep} />
          <stop offset="100%" stopColor="#051f15" />
        </radialGradient>
        <pattern id="ca-felt" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.55" fill="#000" fillOpacity="0.16" />
        </pattern>
        <linearGradient id="ca-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={goldLight} />
          <stop offset="55%" stopColor={gold} />
          <stop offset="100%" stopColor={goldDeep} />
        </linearGradient>
        <radialGradient id="ca-chip-r" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ff7a7a" />
          <stop offset="100%" stopColor="#8b0f0f" />
        </radialGradient>
        <radialGradient id="ca-chip-b" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#7aa8ff" />
          <stop offset="100%" stopColor="#102a6b" />
        </radialGradient>
        <radialGradient id="ca-chip-g" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a0e6c4" />
          <stop offset="100%" stopColor="#0a4a2e" />
        </radialGradient>
        <radialGradient id="ca-chip-w" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cccccc" />
        </radialGradient>
        <radialGradient id="ca-diamond" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#bef0ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7fd4ff" stopOpacity="0" />
        </radialGradient>
        <filter id="ca-glow"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#ca-bg)" />
      <rect width={W} height={H} fill="url(#ca-felt)" />

      {/* Slow warm chandelier wash from the top centre */}
      <ellipse cx={W / 2} cy="0" rx={W * 0.7} ry="320"
               fill="#ffd989" opacity="0.10" />

      {/* ── Art Déco gilded frame ── */}
      <rect x="34" y="34" width={W - 68} height={H - 68} rx="28"
            fill="none" stroke="url(#ca-gold)" strokeWidth="5" />
      <rect x="54" y="54" width={W - 108} height={H - 108} rx="22"
            fill="none" stroke={gold} strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="68" y="68" width={W - 136} height={H - 136} rx="18"
            fill="none" stroke={gold} strokeOpacity="0.22" strokeWidth="1"
            strokeDasharray="2 8" />

      {/* Corner Art Déco sunbursts */}
      {[
        { x: 110,     y: 110,     r: 0 },
        { x: W - 110, y: 110,     r: 90 },
        { x: W - 110, y: H - 110, r: 180 },
        { x: 110,     y: H - 110, r: 270 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}
           stroke={gold} fill="none" strokeWidth="2" strokeOpacity="0.78">
          {[0, 15, 30, 45, 60, 75, 90].map((a) => (
            <line key={a} x1="0" y1="0"
                  x2={Math.cos((a * Math.PI) / 180) * 60}
                  y2={Math.sin((a * Math.PI) / 180) * 60} />
          ))}
          <path d="M 60 0 A 60 60 0 0 1 0 60" />
          <path d="M 48 0 A 48 48 0 0 1 0 48" strokeOpacity="0.55" />
          <circle cx="0" cy="0" r="6" fill={gold} stroke="none" />
        </g>
      ))}

      {/* ── Roulette wheel — top-left, slow continuous spin ── */}
      <g transform="translate(290 290) scale(1.6)">
        <g>
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur={compact ? "32s" : "20s"} repeatCount="indefinite" />
          {/* Outer wood ring */}
          <circle r="120" fill="#7a3a17" />
          <circle r="120" fill="none" stroke={gold} strokeWidth="3" strokeOpacity="0.85" />
          <circle r="112" fill="none" stroke={goldDeep} strokeWidth="1.5" strokeOpacity="0.6" />
          {/* 18 alternating pockets (red/black + 2 green) */}
          {Array.from({ length: 18 }).map((_, i) => {
            const a0 = (i / 18) * Math.PI * 2;
            const a1 = ((i + 1) / 18) * Math.PI * 2;
            const r0 = 108, r1 = 70;
            const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0;
            const x1 = Math.cos(a1) * r0, y1 = Math.sin(a1) * r0;
            const x2 = Math.cos(a1) * r1, y2 = Math.sin(a1) * r1;
            const x3 = Math.cos(a0) * r1, y3 = Math.sin(a0) * r1;
            const isGreen = i === 0 || i === 9;
            const fill = isGreen ? "#0a8a4e" : (i % 2 === 0 ? "#1a1a1a" : "#a01818");
            return (
              <path key={i}
                d={`M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`}
                fill={fill} stroke={gold} strokeOpacity="0.4" strokeWidth="0.8" />
            );
          })}
          {/* Inner hub */}
          <circle r="68" fill="#0e2218" />
          <circle r="68" fill="none" stroke={gold} strokeWidth="2.2" strokeOpacity="0.85" />
          <circle r="58" fill="none" stroke={gold} strokeWidth="0.8" strokeOpacity="0.5"
                  strokeDasharray="2 4" />
          {/* 8 hub spokes */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1={Math.cos(a * Math.PI / 180) * 60}
                          y1={Math.sin(a * Math.PI / 180) * 60}
                          x2={Math.cos(a * Math.PI / 180) * 12}
                          y2={Math.sin(a * Math.PI / 180) * 12}
                          stroke={gold} strokeOpacity="0.55" strokeWidth="1.5" />
          ))}
          <circle r="10" fill={gold} />
          <circle r="4" fill={goldDeep} />
        </g>
        {/* Static ball pocket marker */}
        <circle cx="0" cy="-100" r="5" fill="#ffffff" stroke={goldDeep} strokeWidth="1.5" />
        {/* Subtle outer glow */}
        <circle r="125" fill="none" stroke={gold} strokeOpacity="0.25" strokeWidth="4"
                filter="url(#ca-glow)" />
      </g>

      {/* ── Fanned playing cards — top-right ── */}
      <g transform="translate(1200 290) scale(1.6)">
        {[-18, -6, 6, 18].map((deg, idx) => (
          <g key={idx} transform={`rotate(${deg})`}>
            <rect x="-50" y="-80" width="100" height="148" rx="10"
                  fill="#ffffff" stroke={goldDeep} strokeWidth="1.5" />
            <rect x="-44" y="-74" width="88" height="136" rx="7"
                  fill="none" stroke="#dc2626" strokeOpacity="0.25" strokeWidth="1" />
            {/* Suit symbol — varies per card */}
            {idx === 0 && (
              <text x="0" y="14" textAnchor="middle"
                    fontFamily='"Times New Roman",serif' fontSize="58"
                    fill="#dc2626">♥</text>
            )}
            {idx === 1 && (
              <text x="0" y="14" textAnchor="middle"
                    fontFamily='"Times New Roman",serif' fontSize="58"
                    fill="#0b0d12">♠</text>
            )}
            {idx === 2 && (
              <text x="0" y="14" textAnchor="middle"
                    fontFamily='"Times New Roman",serif' fontSize="58"
                    fill="#dc2626">♦</text>
            )}
            {idx === 3 && (
              <text x="0" y="14" textAnchor="middle"
                    fontFamily='"Times New Roman",serif' fontSize="58"
                    fill="#0b0d12">♣</text>
            )}
            {/* Corner letters */}
            <text x="-42" y="-58" fontFamily='"Inter",sans-serif'
                  fontSize="16" fontWeight="800"
                  fill={idx === 0 || idx === 2 ? "#dc2626" : "#0b0d12"}>A</text>
            <text x="42" y="62" textAnchor="end" fontFamily='"Inter",sans-serif'
                  fontSize="16" fontWeight="800"
                  fill={idx === 0 || idx === 2 ? "#dc2626" : "#0b0d12"}>A</text>
          </g>
        ))}
      </g>

      {/* ── Chip stack — bottom-left, gentle bounce ── */}
      <g transform="translate(280 770) scale(1.6)">
        <g>
          {!compact && (
            <animateTransform attributeName="transform" type="translate"
              values="0,0; 0,-3; 0,0" dur="3.4s" repeatCount="indefinite" />
          )}
          {/* Stack from bottom to top */}
          {[
            { y:   0, g: "ca-chip-w" },
            { y: -14, g: "ca-chip-g" },
            { y: -28, g: "ca-chip-b" },
            { y: -42, g: "ca-chip-r" },
            { y: -56, g: "ca-chip-w" },
            { y: -70, g: "ca-chip-b" },
            { y: -84, g: "ca-chip-r" },
          ].map((c, i) => (
            <g key={i} transform={`translate(0 ${c.y})`}>
              <ellipse cx="0" cy="6" rx="56" ry="14" fill="rgba(0,0,0,0.45)" />
              <ellipse cx="0" cy="0" rx="56" ry="14" fill={`url(#${c.g})`} />
              <ellipse cx="0" cy="0" rx="56" ry="14" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
              {/* 6 white pip dashes around the rim */}
              {Array.from({ length: 6 }).map((_, k) => {
                const a = (k / 6) * Math.PI * 2;
                const x = Math.cos(a) * 56;
                const y = Math.sin(a) * 14;
                return <rect key={k} x={x - 3} y={y - 1.5} width="6" height="3" fill="#ffffff" fillOpacity="0.7" />;
              })}
            </g>
          ))}
          {/* Top face shine */}
          <ellipse cx="0" cy="-84" rx="56" ry="14" fill="url(#ca-chip-r)" />
          <ellipse cx="0" cy="-86" rx="36" ry="8" fill="#ffffff" fillOpacity="0.18" />
        </g>
      </g>

      {/* ── Diamond accent — bottom-right, slow twinkle ── */}
      <g transform="translate(1220 780) scale(1.6)">
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values="-6;6;-6" dur="6s" repeatCount="indefinite" />
          <path d="M 0 -60 L 42 -10 L 26 50 L -26 50 L -42 -10 Z"
                fill="#b8eaff" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M 0 -60 L 42 -10 L 0 -10 Z" fill="#ffffff" fillOpacity="0.7" />
          <path d="M -42 -10 L 0 -10 L -26 50 Z" fill="#ffffff" fillOpacity="0.32" />
          <path d="M 42 -10 L 0 -10 L 26 50 Z" fill="#ffffff" fillOpacity="0.12" />
        </g>
        <circle r="90" fill="url(#ca-diamond)" opacity="0.5">
          <animate attributeName="opacity" values="0.25;0.65;0.25" dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Drifting gold sparkles in the open centre */}
      {!compact && Array.from({ length: 10 }).map((_, i) => {
        const x = 520 + (i * 67) % 460;
        const dur = 4 + (i % 4);
        const delay = (i % 5) * 0.7;
        return (
          <circle key={i} cx={x} cy={H - 80} r={1.6 + (i % 3) * 0.4} fill="#ffe9a8" opacity="0">
            <animate attributeName="cy" values={`${H - 80};160`} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.7;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Top banner */}
      <g transform={`translate(${W / 2} 122)`} textAnchor="middle">
        <line x1="-260" y1="0" x2="-110" y2="0" stroke={gold} strokeWidth="1.2" />
        <line x1="110"  y1="0" x2="260"  y2="0" stroke={gold} strokeWidth="1.2" />
        <circle cx="-94" cy="0" r="3" fill={gold} />
        <circle cx="94"  cy="0" r="3" fill={gold} />
        <text fontFamily="Cinzel,Georgia,serif" fontSize="22" fill={goldLight}
              fillOpacity="0.9" letterSpacing="14">CASINO ROYALE</text>
      </g>

      {/* Bottom banner */}
      <g transform={`translate(${W / 2} ${H - 88})`} textAnchor="middle">
        <line x1="-200" y1="0" x2="-80" y2="0" stroke={gold} strokeWidth="1" />
        <line x1="80"   y1="0" x2="200"  y2="0" stroke={gold} strokeWidth="1" />
        <text fontFamily="Cinzel,Georgia,serif" fontSize="14" fill={gold}
              fillOpacity="0.7" letterSpacing="10">MAISON · MMXXVI</text>
      </g>
    </svg>
  );
}
