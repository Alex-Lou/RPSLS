import { W, H } from "./dims";

/* ════════════════════ Cyberpunk ════════════════════
   Neon hex grid, holographic HUD, CRT scanline and a glitching frame in
   magenta + cyan. Coded replacement for the old PNG.
*/

export function CyberpunkPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const magenta = "#ff2bd6";
  const cyan = "#22d3ee";
  return (
    <svg {...props}>
      <defs>
        <linearGradient id="cp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0a0a18" />
          <stop offset="60%" stopColor="#0d0820" />
          <stop offset="100%" stopColor="#160a22" />
        </linearGradient>
        <pattern id="cp-hex" width="60" height="52" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
          <path d="M15 1 L45 1 L60 26 L45 51 L15 51 L0 26 Z" fill="none" stroke={cyan} strokeOpacity="0.16" strokeWidth="1.2" />
        </pattern>
        <filter id="cp-glow"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#cp-bg)" />
      <rect width={W} height={H} fill="url(#cp-hex)" />

      {/* Faint horizon glow at the bottom. */}
      <rect x="0" y={H - 280} width={W} height="280" fill={magenta} opacity="0.06" />

      {/* CRT scanline sweeping down. */}
      <rect x="0" width={W} height="3" fill={cyan} opacity={compact ? 0.18 : 0.32}>
        <animate attributeName="y" values="60;940" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values={compact ? "0;0.18;0" : "0;0.34;0"} dur="3s" repeatCount="indefinite" />
      </rect>

      {/* Glitch bars — magenta slivers that blink in and out. */}
      {!compact && [
        { y: 300, w: 220, x: 120, d: "4.5s" },
        { y: 660, w: 180, x: W - 320, d: "5.5s" },
        { y: 470, w: 120, x: W - 240, d: "7s" },
      ].map((g, i) => (
        <rect key={i} x={g.x} y={g.y} width={g.w} height="6" fill={magenta} opacity="0">
          <animate attributeName="opacity" values="0;0;0.8;0" keyTimes="0;0.7;0.78;1" dur={g.d} repeatCount="indefinite" />
        </rect>
      ))}

      {/* Corner HUD brackets. */}
      {[
        { x: 80, y: 80, sx: 1, sy: 1 },
        { x: W - 80, y: 80, sx: -1, sy: 1 },
        { x: W - 80, y: H - 80, sx: -1, sy: -1 },
        { x: 80, y: H - 80, sx: 1, sy: -1 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`} stroke={magenta} strokeWidth="3" strokeOpacity="0.9" fill="none">
          <line x1="0" y1="0" x2="56" y2="0" />
          <line x1="0" y1="0" x2="0" y2="56" />
        </g>
      ))}

      {/* Neon frame — glitchy breathing. */}
      <rect x="44" y="44" width={W - 88} height={H - 88} rx="16" fill="none" stroke={cyan} strokeOpacity="0.8" strokeWidth="2" filter="url(#cp-glow)">
        <animate attributeName="stroke-opacity" values="0.35;0.85;0.35" dur="2.6s" repeatCount="indefinite" />
      </rect>
      <rect x="44" y="44" width={W - 88} height={H - 88} rx="16" fill="none" stroke={cyan} strokeOpacity="0.9" strokeWidth="1.5" />

      {/* HUD readouts. */}
      <g fontFamily='"JetBrains Mono","Consolas",monospace' fontWeight="700">
        <g transform={`translate(${W / 2} 120)`} textAnchor="middle">
          <text fontSize="30" fill={magenta} letterSpacing="10" filter="url(#cp-glow)">NIGHT CITY</text>
          <text fontSize="30" fill="#ff8df0" letterSpacing="10">NIGHT CITY</text>
        </g>
        <text x="100" y={H - 70} fontSize="14" fill={cyan} fillOpacity="0.75">SYS//
          <tspan fill="#7CFC00">ONLINE</tspan>
          <animate attributeName="fill-opacity" values="0.4;0.85;0.4" dur="1.8s" repeatCount="indefinite" />
        </text>
        <text x={W - 230} y={H - 70} fontSize="14" fill={cyan} fillOpacity="0.7">NET·77.0.0.1</text>
      </g>
    </svg>
  );
}
