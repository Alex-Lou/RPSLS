import { W, H } from "./dims";

/* ════════════════════ Vintage ════════════════════
   Felt mat with gold Art Deco frame, ornamental corners,
   clean centre with a discreet medallion watermark.
*/

export function VintagePad(props: React.SVGProps<SVGSVGElement>) {
  const gold = "#d4a548";
  const goldLight = "#f1d68a";
  const felt = "#3a0e10";
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="v-bg" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#5a1a1c" />
          <stop offset="100%" stopColor={felt} />
        </radialGradient>
        <pattern id="v-felt" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.5" fill="#000" fillOpacity="0.18" />
        </pattern>
        <linearGradient id="v-gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="100%" stopColor={gold} />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#v-bg)" />
      <rect width={W} height={H} fill="url(#v-felt)" />

      {/* Ornate frame */}
      <rect x="32" y="32" width={W - 64} height={H - 64} rx="30"
            fill="none" stroke="url(#v-gold)" strokeWidth="5" />
      <rect x="54" y="54" width={W - 108} height={H - 108} rx="24"
            fill="none" stroke={gold} strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="68" y="68" width={W - 136} height={H - 136} rx="20"
            fill="none" stroke={gold} strokeOpacity="0.20" strokeWidth="1" strokeDasharray="2 8" />

      {/* Art Deco fans in 4 corners */}
      {[
        { x: 100,     y: 100,     r: 0,   s: 1 },
        { x: W - 100, y: 100,     r: 90,  s: 1 },
        { x: W - 100, y: H - 100, r: 180, s: 1 },
        { x: 100,     y: H - 100, r: 270, s: 1 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r}) scale(${c.s})`}
           stroke={gold} fill="none" strokeWidth="2">
          {[0, 12, 24, 36, 48, 60, 72, 84].map((a) => (
            <line key={a} x1="0" y1="0"
                  x2={Math.cos((a * Math.PI) / 180) * 72}
                  y2={Math.sin((a * Math.PI) / 180) * 72} />
          ))}
          <path d="M 72 0 A 72 72 0 0 1 0 72" />
          <path d="M 60 0 A 60 60 0 0 1 0 60" strokeOpacity="0.55" />
          <circle cx="0" cy="0" r="7" fill={gold} stroke="none" />
        </g>
      ))}

      {/* Top banner */}
      <g transform={`translate(${W/2} 110)`} textAnchor="middle">
        <line x1="-220" y1="0" x2="-90" y2="0" stroke={gold} strokeWidth="1.2" />
        <line x1="90"   y1="0" x2="220"  y2="0" stroke={gold} strokeWidth="1.2" />
        <circle cx="-75" cy="0" r="3" fill={gold} />
        <circle cx="75"  cy="0" r="3" fill={gold} />
        <text fontFamily="Georgia,serif" fontSize="22" fill={goldLight}
              fillOpacity="0.85" letterSpacing="12">GENTLEMAN'S WAGER</text>
      </g>

      {/* Bottom banner */}
      <g transform={`translate(${W/2} ${H - 105})`} textAnchor="middle">
        <line x1="-160" y1="0" x2="-70" y2="0" stroke={gold} strokeWidth="1" />
        <line x1="70"   y1="0" x2="160" y2="0" stroke={gold} strokeWidth="1" />
        <text fontFamily="Georgia,serif" fontSize="14" fill={gold}
              fillOpacity="0.70" letterSpacing="8">EST · MMXXIV</text>
      </g>

      {/* Subtle centre medallion (watermark) */}
      <g transform={`translate(${W/2} ${H/2 + 10})`}>
        <circle r="200" fill="none" stroke={gold} strokeOpacity="0.10" strokeWidth="1" />
        <circle r="180" fill="none" stroke={gold} strokeOpacity="0.08" strokeWidth="1" strokeDasharray="2 6" />
        {/* 5-pointed star to nod at the 5 moves */}
        <path d="M 0 -60 L 14 -18 L 58 -18 L 22 6 L 36 48 L 0 22 L -36 48 L -22 6 L -58 -18 L -14 -18 Z"
              fill="none" stroke={gold} strokeOpacity="0.18" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
