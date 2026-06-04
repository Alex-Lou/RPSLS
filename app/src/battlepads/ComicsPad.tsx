import { W, H } from "./dims";

/* ════════════════════ Comics ════════════════════
   Pop-art comic page: halftone yellow/red, black outlines,
   onomatopoeia bursts in the corners.
*/

export function ComicsPad(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      <defs>
        <linearGradient id="cm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#fffbe6" />
          <stop offset="100%" stopColor="#ffe680" />
        </linearGradient>
        <pattern id="cm-halftone" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="2.6" fill="#ef4444" fillOpacity="0.35" />
        </pattern>
        <pattern id="cm-halftone-2" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="10" cy="10" r="2.4" fill="#0b0d12" fillOpacity="0.15" />
        </pattern>
        <radialGradient id="cm-burst-yellow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#fff44f" />
          <stop offset="100%" stopColor="#ffba00" />
        </radialGradient>
        <radialGradient id="cm-burst-red" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ff6b6b" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#cm-bg)" />
      <rect width={W} height={H} fill="url(#cm-halftone)" />
      <rect width={W} height={H} fill="url(#cm-halftone-2)" />

      {/* Heavy black outer frame, like a comic page border */}
      <rect x="30" y="30" width={W - 60} height={H - 60} rx="14"
            fill="none" stroke="#0b0d12" strokeWidth="10" />
      <rect x="55" y="55" width={W - 110} height={H - 110} rx="8"
            fill="none" stroke="#0b0d12" strokeWidth="3" />

      {/* Speed lines radiating from center to give the "panel action" feel */}
      <g stroke="#0b0d12" strokeOpacity="0.18" strokeWidth="3">
        {Array.from({ length: 30 }).map((_, i) => {
          const angle = (i / 30) * Math.PI * 2;
          const x1 = W / 2 + Math.cos(angle) * 350;
          const y1 = H / 2 + Math.sin(angle) * 250;
          const x2 = W / 2 + Math.cos(angle) * 1200;
          const y2 = H / 2 + Math.sin(angle) * 1200;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      {/* Onomatopoeia bursts in corners */}
      {/* BAM! — top left */}
      <g transform="translate(210 200) rotate(-12)">
        <path
          d="M -130 -40 L -90 -60 L -50 -50 L -10 -75 L 30 -55 L 70 -78 L 110 -50 L 140 -28 L 130 5 L 145 32 L 110 50 L 70 60 L 30 50 L -10 70 L -50 55 L -90 65 L -130 40 L -150 10 L -135 -10 Z"
          fill="url(#cm-burst-yellow)" stroke="#0b0d12" strokeWidth="6" strokeLinejoin="round"
        />
        <text x="0" y="14" textAnchor="middle"
              fontFamily='"Impact","Arial Black",sans-serif'
              fontSize="56" fontWeight="900" fill="#dc2626"
              stroke="#0b0d12" strokeWidth="3" paintOrder="stroke fill"
              letterSpacing="4">BAM!</text>
      </g>

      {/* POW! — bottom right */}
      <g transform="translate(1290 820) rotate(8)">
        <path
          d="M -130 -40 L -90 -60 L -50 -50 L -10 -75 L 30 -55 L 70 -78 L 110 -50 L 140 -28 L 130 5 L 145 32 L 110 50 L 70 60 L 30 50 L -10 70 L -50 55 L -90 65 L -130 40 L -150 10 L -135 -10 Z"
          fill="url(#cm-burst-red)" stroke="#0b0d12" strokeWidth="6" strokeLinejoin="round"
        />
        <text x="0" y="14" textAnchor="middle"
              fontFamily='"Impact","Arial Black",sans-serif'
              fontSize="56" fontWeight="900" fill="#fff44f"
              stroke="#0b0d12" strokeWidth="3" paintOrder="stroke fill"
              letterSpacing="4">POW!</text>
      </g>

      {/* ZAP! — top right (smaller) */}
      <g transform="translate(1280 200) rotate(15)">
        <polygon
          points="-60,-30 -25,-50 -35,-15 0,-25 -10,5 25,-5 5,25 40,15 15,45 -15,30 -45,40 -30,15 -55,5"
          fill="url(#cm-burst-yellow)" stroke="#0b0d12" strokeWidth="5" strokeLinejoin="round"
        />
        <text x="-6" y="10" textAnchor="middle"
              fontFamily='"Impact","Arial Black",sans-serif'
              fontSize="34" fontWeight="900" fill="#0b0d12"
              letterSpacing="2">ZAP!</text>
      </g>

      {/* Sound dots accents */}
      <g fill="#0b0d12">
        {[[400, 350, 6], [430, 380, 4], [380, 410, 5],
          [950, 700, 6], [990, 680, 4], [930, 730, 5]
         ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>

      {/* Panel border at very edge (the "page" feeling) */}
      <rect x="6" y="6" width={W - 12} height={H - 12} rx="20"
            fill="none" stroke="#0b0d12" strokeWidth="3" strokeOpacity="0.4" />
    </svg>
  );
}
