import { W, H } from "./dims";

/* ════════════════════ Neon Arcade ════════════════════
   Synthwave grid + horizon, neon glow, 80s arcade vibe.
*/

export function NeonPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <linearGradient id="neon-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0a0226" />
          <stop offset="55%" stopColor="#1a0540" />
          <stop offset="100%" stopColor="#330d3a" />
        </linearGradient>
        <linearGradient id="neon-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#ff3df7" />
          <stop offset="40%" stopColor="#ff7adf" />
          <stop offset="80%" stopColor="#ffb84d" />
        </linearGradient>
        <linearGradient id="neon-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#1a0540" stopOpacity="0" />
          <stop offset="80%" stopColor="#1a0540" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1a0540" stopOpacity="1" />
        </linearGradient>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#neon-bg)" />

      {/* Distant sun (semi-circle on horizon) */}
      <g transform={`translate(${W / 2} 470)`}>
        {/* Pulsing halo behind the sun — slow neon breath. */}
        <circle r="300" fill="url(#neon-sun)" opacity="0.18" filter="url(#neon-glow)">
          <animate attributeName="opacity" values="0.10;0.30;0.10" dur="4.2s" repeatCount="indefinite" />
        </circle>
        <circle r="220" fill="url(#neon-sun)" opacity="0.85" />
        {/* Horizontal slits cutting through sun */}
        {[20, 60, 100, 140, 180].map((y, i) => (
          <rect key={i} x="-220" y={y} width="440" height={6 + i * 1.5} fill="#1a0540" />
        ))}
      </g>

      {/* Top sky stars */}
      <g fill="#ffffff" fillOpacity="0.8">
        {[[140, 80, 1.6], [320, 50, 1.2], [510, 140, 1], [780, 80, 1.4], [1010, 60, 1.1],
          [1180, 120, 1.5], [1380, 90, 1], [220, 180, 0.9], [930, 200, 1.1], [1280, 230, 1.2]
         ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>

      {/* Grid floor — perspective lines */}
      <g stroke="#ff3df7" strokeOpacity="0.55" strokeWidth="2">
        {/* Vertical lines converging to vanishing point */}
        {[-7, -5, -3, -2, -1, 0, 1, 2, 3, 5, 7].map((i) => {
          const vpX = W / 2;
          const vpY = 480;
          const baseX = vpX + i * 120;
          return (
            <line key={`v${i}`} x1={baseX} y1={H + 50} x2={vpX} y2={vpY} />
          );
        })}
      </g>
      <g stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="2">
        {/* Horizontal lines getting denser toward the horizon */}
        {[520, 565, 615, 675, 745, 820, 905, H].map((y, i) => (
          <line key={`h${i}`} x1="-100" y1={y} x2={W + 100} y2={y} />
        ))}
      </g>

      {/* Scanline sweeping down the grid floor — that retro CRT pulse. */}
      <rect x="0" width={W} height="4" fill="#7df9ff" opacity={compact ? 0.18 : 0.3}>
        <animate attributeName="y" values="500;1000" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="opacity"
                 values={compact ? "0;0.18;0" : "0;0.35;0"} dur="3.6s" repeatCount="indefinite" />
      </rect>
      {/* Top fade above horizon to keep grid from showing in the sky */}
      <rect x="0" y="0" width={W} height="480" fill="url(#neon-fade)" opacity="0" />

      {/* Frame neon */}
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="20"
            fill="none" stroke="#ff3df7" strokeOpacity="0.9" strokeWidth="2"
            filter="url(#neon-glow)">
        <animate attributeName="stroke-opacity" values="0.45;0.95;0.45" dur="2.8s" repeatCount="indefinite" />
      </rect>
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="20"
            fill="none" stroke="#ff3df7" strokeOpacity="0.9" strokeWidth="2" />
      <rect x="55" y="55" width={W - 110} height={H - 110} rx="14"
            fill="none" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="1.5" />

      {/* Corner brackets */}
      {[
        { x: 80, y: 80, sx: 1, sy: 1 },
        { x: W - 80, y: 80, sx: -1, sy: 1 },
        { x: W - 80, y: H - 80, sx: -1, sy: -1 },
        { x: 80, y: H - 80, sx: 1, sy: -1 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}
           stroke="#22d3ee" strokeWidth="3" strokeOpacity="0.9" fill="none">
          <line x1="0" y1="0" x2="50" y2="0" />
          <line x1="0" y1="0" x2="0" y2="50" />
        </g>
      ))}

      {/* Title */}
      <g transform={`translate(${W / 2} 120)`} textAnchor="middle">
        <text fontFamily='"Inter",sans-serif' fontWeight="800"
              fontSize="58" letterSpacing="14"
              fill="#ff3df7" filter="url(#neon-glow)">ARCADE</text>
        <text fontFamily='"Inter",sans-serif' fontWeight="800"
              fontSize="58" letterSpacing="14"
              fill="#ff3df7">ARCADE</text>
        <text y="44" fontFamily='"Inter",sans-serif' fontWeight="600"
              fontSize="19" letterSpacing="8" fill="#22d3ee" fillOpacity="0.7">// PRESS START</text>
      </g>

      {/* HUD-style "credits" in corners */}
      <g fontFamily='"JetBrains Mono",monospace' fill="#22d3ee" fillOpacity="0.7">
        <text x="100" y={H - 70} fontSize="21">CR: ∞</text>
        <text x={W - 260} y={H - 70} fontSize="21">HI: 999,999</text>
      </g>
    </svg>
  );
}
