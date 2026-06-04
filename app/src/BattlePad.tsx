import type { CSSProperties } from "react";
import type { PadId } from "./types";
import { useStore } from "./store";

const W = 1500;
const H = 1000;

// A sine wave wider than the pad so it can slide one wavelength and loop
// seamlessly (used by the Quantum pad's travelling wavefunctions).
const SINE_PATH = (() => {
  let d = "M -300 0";
  for (let x = -300; x <= W + 300; x += 10) {
    const y = Math.sin((x / 300) * Math.PI * 2) * 22;
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  return d;
})();

export function BattlePad({
  padId,
  className,
  style,
  compact = false,
}: {
  padId: PadId;
  className?: string;
  style?: CSSProperties;
  /** When true, pads suppress big animated centerpieces (e.g. the Cosmos
   *  atom orbits) so they read as quiet backdrops behind game content. */
  compact?: boolean;
}) {
  // The only image-based pad left is the player's own uploaded mat.
  const customPadUrl = useStore((s) => s.player.customPadUrl);

  const common = {
    className,
    style,
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "xMidYMid slice" as const,
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (padId) {
    case "chalkboard": return <ChalkboardPad {...common} />;
    case "vintage":    return <VintagePad {...common} />;
    case "cosmos":     return <CosmosPad {...common} compact={compact} />;
    case "galaxy":     return <GalaxyPad {...common} compact={compact} />;
    case "neon":       return <NeonPad {...common} compact={compact} />;
    case "holy":       return <HolyPad {...common} compact={compact} />;
    case "quantum":    return <QuantumPad {...common} compact={compact} />;
    case "cyberpunk":  return <CyberpunkPad {...common} compact={compact} />;
    case "comics":     return <ComicsPad {...common} />;
    case "custom":
      // Uploaded mat, or a graceful coded fallback until one is imported.
      return customPadUrl
        ? <ImagePad src={customPadUrl} {...common} />
        : <CosmosPad {...common} compact={compact} />;
    default:           return <ChalkboardPad {...common} />;
  }
}

/* ════════════════════ ImagePad ════════════════════
   Generic <image>-based playmat. Used for every PNG-driven pad in
   PAD_IMAGES so new image pads cost zero JSX once the file lands.
*/

function ImagePad({ src, ...rest }: { src: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...rest}>
      <image href={src} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}

/* ════════════════════ Chalkboard ════════════════════
   Lab blackboard: chalky frame, scattered equations & doodles
   along the perimeter, empty centre for content.
*/

function ChalkboardPad(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="cb-bg" cx="50%" cy="50%" r="80%">
          <stop offset="0%"   stopColor="#26433c" />
          <stop offset="100%" stopColor="#11201a" />
        </radialGradient>
        <filter id="cb-dust">
          <feTurbulence baseFrequency="0.04" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#cb-bg)" />
      <rect width={W} height={H} filter="url(#cb-dust)" />

      {/* Double chalk frame */}
      <rect x="36" y="36" width={W - 72} height={H - 72} rx="28"
            fill="none" stroke="#e8eee9" strokeOpacity="0.50" strokeWidth="3"
            strokeDasharray="14 6 6 6" />
      <rect x="58" y="58" width={W - 116} height={H - 116} rx="22"
            fill="none" stroke="#e8eee9" strokeOpacity="0.22" strokeWidth="1.2" />

      {/* Title — discreet, top-left in margin */}
      <g fontFamily='"Caveat","Bradley Hand",cursive' fill="#e8eee9">
        <text x="100" y="115" fontSize="32" fillOpacity="0.55"
              transform="rotate(-2 100 115)">5-move logic</text>
        <text x="100" y="145" fontSize="16" fillOpacity="0.35"
              transform="rotate(-2 100 145)">RPSLS lab notes</text>
      </g>

      {/* ─── Perimeter equations & doodles ─── */}
      <g fontFamily='"Caveat","Bradley Hand",cursive' fill="#e8eee9" fillOpacity="0.35">
        {/* top edge */}
        <text x={W / 2 - 60} y="115" fontSize="26" transform={`rotate(-1 ${W/2} 115)`}>Hψ = Eψ</text>
        <text x={W - 320} y="100" fontSize="22" transform={`rotate(2 ${W-320} 100)`}>F = m·a</text>
        <text x={W - 170} y="135" fontSize="24" fillOpacity="0.45">E = mc²</text>

        {/* bottom edge */}
        <text x="110"     y={H - 60} fontSize="22" transform={`rotate(-1 110 ${H-60})`}>∮ B·dl = μ₀I</text>
        <text x={W/2 - 80} y={H - 50} fontSize="22" transform={`rotate(1 ${W/2} ${H-50})`}>∇²ψ + V·ψ = i ℏ ∂t</text>
        <text x={W - 360}  y={H - 60} fontSize="22" transform={`rotate(-2 ${W-360} ${H-60})`}>p = mv</text>

        {/* left edge (rotated vertical) */}
        <text x="40" y={H/2 - 40} fontSize="22" transform={`rotate(-90 40 ${H/2 - 40})`}>∇·E = ρ / ε₀</text>
        <text x="40" y={H/2 + 120} fontSize="22" transform={`rotate(-90 40 ${H/2 + 120})`}>λ = h / p</text>

        {/* right edge (rotated vertical) */}
        <text x={W - 40} y={H/2 - 40} fontSize="22" transform={`rotate(90 ${W-40} ${H/2 - 40})`}>S = k·ln Ω</text>
        <text x={W - 40} y={H/2 + 110} fontSize="22" transform={`rotate(90 ${W-40} ${H/2 + 110})`}>πr² + 2πr</text>
      </g>

      {/* Doodles in the 4 outer corners */}
      <g stroke="#e8eee9" strokeOpacity="0.40" fill="none" strokeWidth="1.8">
        {/* TL atom */}
        <g transform="translate(220 250)">
          <ellipse rx="42" ry="14" />
          <ellipse rx="42" ry="14" transform="rotate(60)" />
          <ellipse rx="42" ry="14" transform="rotate(-60)" />
          <circle r="5" fill="#e8eee9" fillOpacity="0.6" stroke="none" />
        </g>
        {/* TR DNA */}
        <g transform="translate(1290 250)" strokeWidth="2">
          <path d="M 0 -55 Q 22 -28 0 0 T 0 55" />
          <path d="M 22 -55 Q 0 -28 22 0 T 22 55" />
          {[-44, -16, 12, 40].map((y) => (
            <line key={y} x1="2" y1={y} x2="20" y2={y} strokeWidth="1.2" strokeDasharray="3 3" />
          ))}
        </g>
        {/* BL resistor + arrow */}
        <g transform="translate(220 770)" strokeWidth="1.8">
          <line x1="-50" y1="0" x2="-20" y2="0" />
          <polyline points="-20,0 -14,-10 -2,10 10,-10 22,10 30,0" />
          <line x1="30" y1="0" x2="60" y2="0" />
          <text x="-30" y="28" fontFamily='"Caveat",cursive'
                fontSize="16" fill="#e8eee9" fillOpacity="0.55" stroke="none">R</text>
        </g>
        {/* BR π formula in a cloud */}
        <g transform="translate(1280 770)">
          <path d="M -55 0 q 0 -24 24 -24 q 6 -16 22 -16 q 16 0 22 16 q 24 0 24 24 q 0 24 -24 24 q -6 16 -22 16 q -16 0 -22 -16 q -24 0 -24 -24 z"
                strokeWidth="2" />
          <text x="-22" y="7" fontFamily='"Caveat",cursive'
                fontSize="22" fill="#e8eee9" fillOpacity="0.65" stroke="none">π·r²</text>
        </g>
      </g>

      {/* Very faint centre stage hint */}
      <ellipse cx={W/2} cy={H/2 + 20} rx="380" ry="170"
               fill="none" stroke="#e8eee9" strokeOpacity="0.10"
               strokeDasharray="3 9" strokeWidth="1.5" />
    </svg>
  );
}

/* ════════════════════ Vintage ════════════════════
   Felt mat with gold Art Deco frame, ornamental corners,
   clean centre with a discreet medallion watermark.
*/

function VintagePad(props: React.SVGProps<SVGSVGElement>) {
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

/* ════════════════════ Neon Arcade ════════════════════
   Synthwave grid + horizon, neon glow, 80s arcade vibe.
*/

function NeonPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
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
              fontSize="36" letterSpacing="14"
              fill="#ff3df7" filter="url(#neon-glow)">ARCADE</text>
        <text fontFamily='"Inter",sans-serif' fontWeight="800"
              fontSize="36" letterSpacing="14"
              fill="#ff3df7">ARCADE</text>
        <text y="32" fontFamily='"Inter",sans-serif' fontWeight="600"
              fontSize="12" letterSpacing="8" fill="#22d3ee" fillOpacity="0.7">// PRESS START</text>
      </g>

      {/* HUD-style "credits" in corners */}
      <g fontFamily='"JetBrains Mono",monospace' fill="#22d3ee" fillOpacity="0.7">
        <text x="100" y={H - 70} fontSize="13">CR: ∞</text>
        <text x={W - 200} y={H - 70} fontSize="13">HI: 999,999</text>
      </g>
    </svg>
  );
}

/* ════════════════════ Comics ════════════════════
   Pop-art comic page: halftone yellow/red, black outlines,
   onomatopoeia bursts in the corners.
*/

function ComicsPad(props: React.SVGProps<SVGSVGElement>) {
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

/* ════════════════════ Cosmos ════════════════════
   Deep space backdrop: star field, faint nebulas,
   one tiny pulsar central, decoration only at perimeter.
*/

function CosmosPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const stars = (() => {
    const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 0xffffffff;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 260; i++) {
      pts.push({
        x: rng() * W,
        y: rng() * H,
        r: 0.4 + rng() * 1.3,
        o: 0.30 + rng() * 0.55,
      });
    }
    return pts;
  })();

  return (
    <svg {...props}>
      <defs>
        <radialGradient id="cs-bg" cx="50%" cy="50%" r="80%">
          <stop offset="0%"  stopColor="#0d1438" />
          <stop offset="55%" stopColor="#070a1e" />
          <stop offset="100%" stopColor="#03050e" />
        </radialGradient>
        <radialGradient id="cs-nebula" cx="15%" cy="85%" r="40%">
          <stop offset="0%"  stopColor="#8b5cf6" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cs-nebula2" cx="90%" cy="15%" r="35%">
          <stop offset="0%"  stopColor="#22d3ee" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cs-pulsar" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#7c5cff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <filter id="cs-glow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#cs-bg)" />
      <rect width={W} height={H} fill="url(#cs-nebula)" />
      <rect width={W} height={H} fill="url(#cs-nebula2)" />

      {/* Stars — every 9th one slowly twinkles (cheap, staggered). */}
      <g>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r}
                  fill="#ffffff" fillOpacity={s.o}>
            {i % 9 === 0 && (
              <animate attributeName="fill-opacity"
                       values={`${s.o};${s.o * 0.25};${s.o}`}
                       dur={`${2.4 + (i % 5) * 0.7}s`}
                       begin={`${(i % 7) * 0.4}s`}
                       repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </g>

      {/* Lone shooting star drifting across the upper sky. */}
      <g opacity={compact ? 0.5 : 0.9}>
        <line x1="-80" y1="0" x2="-10" y2="22" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <circle cx="0" cy="28" r="3.5" fill="#ffffff" />
        <animateTransform attributeName="transform" type="translate"
          values="200,80; 1300,360" dur="7s" begin="1s"
          repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="7s" begin="1s" repeatCount="indefinite" />
      </g>

      {/* ── Galaxy spirals ── */}
      <g stroke="#bea5ff" fill="none" strokeOpacity="0.32">
        <g transform="translate(180 230) rotate(-15)">
          <path d="M 0 0 Q 30 -20 60 -5 T 110 25 Q 120 60 85 75 T 20 90 Q -30 80 -45 35 T -10 -25" strokeWidth="2" />
          <circle r="3" fill="#ffffff" fillOpacity="0.7" stroke="none" />
        </g>
        <g transform="translate(1300 780) rotate(160) scale(0.85)">
          <path d="M 0 0 Q 30 -20 60 -5 T 110 25 Q 120 60 85 75 T 20 90 Q -30 80 -45 35 T -10 -25" strokeWidth="2" />
          <circle r="3" fill="#ffffff" fillOpacity="0.7" stroke="none" />
        </g>
      </g>

      {/* ── Bohr atom (hydrogen), TL near top */}
      <g transform="translate(330 200)" stroke="#a7e9ff" fill="none" strokeOpacity="0.45">
        <ellipse rx="56" ry="20" strokeWidth="1.6" />
        <ellipse rx="56" ry="20" strokeWidth="1.6" transform="rotate(60)" />
        <ellipse rx="56" ry="20" strokeWidth="1.6" transform="rotate(-60)" />
        <circle r="6" fill="#ffffff" fillOpacity="0.8" stroke="none" />
        {/* Electron */}
        <circle cx="56" cy="0" r="3" fill="#88e2ff" stroke="none" />
        <text x="0" y="50" textAnchor="middle"
              fontFamily="Inter,sans-serif" fontSize="13" fill="#a7e9ff" fillOpacity="0.55"
              letterSpacing="2" stroke="none">H · n=1</text>
      </g>

      {/* ── Saturn-like ringed planet, BR */}
      <g transform="translate(1180 760)">
        <ellipse rx="68" ry="14" stroke="#d8b878" strokeOpacity="0.55" strokeWidth="2.5" fill="none" />
        <ellipse rx="58" ry="11" stroke="#d8b878" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
        <circle r="26" fill="#cba36a" fillOpacity="0.55" />
        <ellipse rx="68" ry="14" stroke="#d8b878" strokeOpacity="0.55" strokeWidth="2.5" fill="none"
                 transform="scale(1,-1)" clipPath="inset(50% 0 0 0)" />
        <path d="M -68 0 A 68 14 0 0 1 68 0" fill="none" stroke="#d8b878" strokeOpacity="0.7" strokeWidth="2.5" />
        <text x="0" y="46" textAnchor="middle"
              fontFamily="Inter,sans-serif" fontSize="12" fill="#d8b878" fillOpacity="0.6"
              letterSpacing="2">Ø 116k km</text>
      </g>

      {/* ── Black-hole accretion disc, TR */}
      <g transform="translate(1140 240)">
        <circle r="22" fill="#000" />
        <circle r="22" fill="none" stroke="#ff9a3c" strokeOpacity="0.6" strokeWidth="3" />
        <ellipse rx="46" ry="14" stroke="#ff9a3c" strokeOpacity="0.4" strokeWidth="2" fill="none" />
        <ellipse rx="60" ry="18" stroke="#ff9a3c" strokeOpacity="0.22" strokeWidth="1.5" fill="none" strokeDasharray="3 5" />
        <text x="0" y="46" textAnchor="middle"
              fontFamily="Inter,sans-serif" fontSize="12" fill="#ff9a3c" fillOpacity="0.55"
              letterSpacing="2">R_s ≈ 2GM/c²</text>
      </g>

      {/* ── Small constellation, BL */}
      <g transform="translate(320 800)" stroke="#cfe8ff" strokeOpacity="0.50" fill="#ffffff" fillOpacity="0.85">
        <line x1="0" y1="0" x2="40" y2="-30" strokeWidth="1" />
        <line x1="40" y1="-30" x2="90" y2="-15" strokeWidth="1" />
        <line x1="90" y1="-15" x2="120" y2="20" strokeWidth="1" />
        <line x1="120" y1="20" x2="80" y2="50" strokeWidth="1" />
        <line x1="80" y1="50" x2="30" y2="40" strokeWidth="1" />
        <line x1="30" y1="40" x2="0" y2="0" strokeWidth="1" />
        <circle cx="0"   cy="0"   r="2.5" stroke="none" />
        <circle cx="40"  cy="-30" r="3"   stroke="none" />
        <circle cx="90"  cy="-15" r="2.5" stroke="none" />
        <circle cx="120" cy="20"  r="3"   stroke="none" />
        <circle cx="80"  cy="50"  r="2.5" stroke="none" />
        <circle cx="30"  cy="40"  r="2.5" stroke="none" />
      </g>

      {/* ── Comet trails ── */}
      <g stroke="#a7e9ff" strokeOpacity="0.55" fill="none">
        <path d="M 700 90 Q 800 110 920 80" strokeWidth="2" strokeDasharray="14 8" />
        <circle cx="920" cy="80" r="4" fill="#ffffff" stroke="none" />
      </g>
      <g stroke="#a7e9ff" strokeOpacity="0.45" fill="none">
        <path d="M 720 920 Q 620 900 560 940" strokeWidth="1.5" strokeDasharray="10 6" />
        <circle cx="560" cy="940" r="3" fill="#ffffff" stroke="none" />
      </g>

      {/* ── Scientific labels along borders ── */}
      <g fontFamily='"JetBrains Mono","Consolas",monospace' fill="#a7e9ff" fillOpacity="0.45">
        <text x="80"        y={H/2 - 60} fontSize="14" transform={`rotate(-90 80 ${H/2 - 60})`}>c = 2.998 × 10⁸ m·s⁻¹</text>
        <text x="80"        y={H/2 + 130} fontSize="14" transform={`rotate(-90 80 ${H/2 + 130})`}>λ Hα = 656 nm</text>
        <text x={W - 70}    y={H/2 - 70} fontSize="14" transform={`rotate(90 ${W-70} ${H/2 - 70})`}>T_CMB = 2.725 K</text>
        <text x={W - 70}    y={H/2 + 130} fontSize="14" transform={`rotate(90 ${W-70} ${H/2 + 130})`}>M_⊙ = 1.989·10³⁰ kg</text>
        <text x={W/2 - 240} y={H - 60} fontSize="13">z = 1.42</text>
        <text x={W/2 + 110} y={H - 60} fontSize="13">G = 6.674 × 10⁻¹¹</text>
      </g>

      {/* Frame */}
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="24"
            fill="none" stroke="#88e2ff" strokeOpacity="0.32" strokeWidth="2" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="20"
            fill="none" stroke="#88e2ff" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="2 10" />

      {/* Subtle centre pulsar — slow breathing glow. */}
      <g transform={`translate(${W/2} ${H/2 + 10})`}>
        <circle r="28" fill="url(#cs-pulsar)" filter="url(#cs-glow)" opacity="0.35">
          <animate attributeName="opacity" values="0.18;0.45;0.18" dur="3.8s" repeatCount="indefinite" />
          <animate attributeName="r" values="24;32;24" dur="3.8s" repeatCount="indefinite" />
        </circle>
        <circle r="6" fill="#ffffff" fillOpacity="0.55" />
      </g>

      {/* ── Animated atom centerpiece (matches the landing page #demo) ──
           3 orbits at 0°/60°/-60°, one electron each, animateMotion paths.
           Suppressed when the pad is rendered as a backdrop (compact) so the
           orbiting electrons don't drift across the lane content. */}
      {!compact && (
        <g transform={`translate(${W/2} ${H/2 + 10})`}>
          <g transform="rotate(0)">
            <ellipse cx="0" cy="0" rx="180" ry="55" fill="none" stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="2" />
            <circle r="9" fill="#a78bfa">
              <animateMotion dur="4.2s" repeatCount="indefinite"
                path="M -180,0 a 180,55 0 1,0 360,0 a 180,55 0 1,0 -360,0" />
            </circle>
          </g>
          <g transform="rotate(60)">
            <ellipse cx="0" cy="0" rx="180" ry="55" fill="none" stroke="#5eead4" strokeOpacity="0.55" strokeWidth="2" />
            <circle r="9" fill="#5eead4">
              <animateMotion dur="5.5s" repeatCount="indefinite"
                path="M -180,0 a 180,55 0 1,1 360,0 a 180,55 0 1,1 -360,0" />
            </circle>
          </g>
          <g transform="rotate(-60)">
            <ellipse cx="0" cy="0" rx="180" ry="55" fill="none" stroke="#f0abfc" strokeOpacity="0.55" strokeWidth="2" />
            <circle r="9" fill="#f0abfc">
              <animateMotion dur="6.8s" repeatCount="indefinite"
                path="M -180,0 a 180,55 0 1,0 360,0 a 180,55 0 1,0 -360,0" />
            </circle>
          </g>
        </g>
      )}

      {/* Title — top center */}
      <g transform={`translate(${W/2} 120)`} textAnchor="middle">
        <line x1="-220" y1="-2" x2="-100" y2="-2" stroke="#88e2ff" strokeOpacity="0.25" />
        <line x1="100"  y1="-2" x2="220"  y2="-2" stroke="#88e2ff" strokeOpacity="0.25" />
        <text fontFamily='"Inter",sans-serif' fontWeight="600"
              fontSize="22" fill="#cfe8ff" fillOpacity="0.70" letterSpacing="14">
          INTERSTELLAR DUEL
        </text>
      </g>
    </svg>
  );
}

/* ════════════════════ Holy ════════════════════
   Cathedral light: indigo nave, gilded frame, a slowly rotating rose-window,
   sweeping god-rays from above and gold motes rising. Coded replacement for
   the old PNG so the Holy theme's mat is alive.
*/

function HolyPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
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

/* ════════════════════ Quantum ════════════════════
   Physics lab table: faint grid, travelling wavefunctions on the edges,
   electron orbits spinning in each corner, drifting particles and a soft
   reactor core. Coded replacement for the old PNG.
*/

function QuantumPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cyan = "#5eead4";
  const blue = "#60a5fa";
  const orbits = [
    { x: 240, y: 240, d: 5 },
    { x: W - 240, y: 240, d: 6.5 },
    { x: 240, y: H - 240, d: 7 },
    { x: W - 240, y: H - 240, d: 5.8 },
  ];
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="qp-bg" cx="50%" cy="50%" r="85%">
          <stop offset="0%"  stopColor="#0b1733" />
          <stop offset="55%" stopColor="#070d20" />
          <stop offset="100%" stopColor="#03060f" />
        </radialGradient>
        <radialGradient id="qp-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#a5f3fc" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <filter id="qp-glow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#qp-bg)" />

      {/* Faint lab grid */}
      <g stroke={blue} strokeOpacity="0.07" strokeWidth="1">
        {Array.from({ length: 15 }).map((_, i) => <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2={H} />)}
        {Array.from({ length: 10 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 100} x2={W} y2={i * 100} />)}
      </g>

      {/* Travelling wavefunctions along top & bottom. */}
      {[150, H - 150].map((y, idx) => (
        <g key={idx} transform={`translate(0 ${y})`} stroke={idx === 0 ? cyan : blue} fill="none"
           strokeWidth="2" strokeOpacity={compact ? 0.28 : 0.42}>
          <path d={SINE_PATH}>
            <animateTransform attributeName="transform" type="translate"
              from="0,0" to="-300,0" dur={`${idx === 0 ? 6 : 8}s`} repeatCount="indefinite" />
          </path>
        </g>
      ))}

      {/* Corner electron orbits. */}
      {orbits.map((o, i) => (
        <g key={i} transform={`translate(${o.x} ${o.y})`}>
          <ellipse rx="120" ry="44" fill="none" stroke={cyan} strokeOpacity="0.3" strokeWidth="1.5" />
          <ellipse rx="120" ry="44" fill="none" stroke={blue} strokeOpacity="0.3" strokeWidth="1.5" transform="rotate(60)" />
          <ellipse rx="120" ry="44" fill="none" stroke="#a78bfa" strokeOpacity="0.25" strokeWidth="1.5" transform="rotate(-60)" />
          <circle r="7" fill="url(#qp-core)" />
          <circle r="4" fill={cyan}>
            <animateMotion dur={`${o.d}s`} repeatCount="indefinite"
              path="M -120,0 a 120,44 0 1,0 240,0 a 120,44 0 1,0 -240,0" />
          </circle>
        </g>
      ))}

      {/* Drifting particles. */}
      {!compact && Array.from({ length: 18 }).map((_, i) => {
        const x = 80 + (i * 83) % (W - 160);
        const y = 120 + (i * 137) % (H - 240);
        const d = 4 + (i % 6);
        return (
          <circle key={i} cx={x} cy={y} r={1.6} fill="#a5f3fc" opacity="0.4">
            <animate attributeName="opacity" values="0.1;0.7;0.1" dur={`${d}s`} begin={`${(i % 5) * 0.6}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Frame */}
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="22" fill="none" stroke={cyan} strokeOpacity="0.4" strokeWidth="2" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="16" fill="none" stroke={blue} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 10" />

      {/* Equation labels along the edges. */}
      <g fontFamily='"JetBrains Mono","Consolas",monospace' fill={cyan} fillOpacity="0.4">
        <text x="92" y={H / 2} fontSize="14" transform={`rotate(-90 92 ${H / 2})`}>iℏ ∂ψ/∂t = Ĥψ</text>
        <text x={W - 72} y={H / 2} fontSize="14" transform={`rotate(90 ${W - 72} ${H / 2})`}>Δx·Δp ≥ ℏ/2</text>
        <text x={W / 2} y="118" fontSize="13" textAnchor="middle">|ψ⟩ = α|0⟩ + β|1⟩</text>
      </g>

      {/* Soft reactor core (mostly hidden by the in-game vignette). */}
      <g transform={`translate(${W / 2} ${H / 2})`}>
        <circle r="40" fill="url(#qp-core)" filter="url(#qp-glow)" opacity="0.3">
          <animate attributeName="opacity" values="0.15;0.4;0.15" dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

/* ════════════════════ Galaxy ════════════════════
   A tilted spiral galaxy: two logarithmic arms of stars turning slowly
   around a bright bulge. Distinct from Cosmos (a starfield with planets) —
   here the whole disc rotates as one piece.
*/

// Pre-computed spiral-arm stars (relative to the disc centre), so the heavy
// trig runs once at module load rather than every render.
const GALAXY_ARMS = (() => {
  const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
  const armCount = 2;
  const perArm = 100;
  for (let a = 0; a < armCount; a++) {
    const phase = (a / armCount) * Math.PI * 2;
    for (let i = 0; i < perArm; i++) {
      const t = i / perArm;
      const theta = phase + t * Math.PI * 3.0;     // ~1.5 turns
      const rad = 34 + t * 360;
      const jx = ((i * 53) % 19) - 9;
      const jy = ((i * 31) % 19) - 9;
      pts.push({
        x: Math.cos(theta) * rad + jx,
        y: Math.sin(theta) * rad * 0.6 + jy,        // squash → tilted disc
        r: 0.6 + (1 - t) * 2.0,
        o: 0.22 + (1 - t) * 0.6,
      });
    }
  }
  return pts;
})();

function GalaxyPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="gx-bg" cx="50%" cy="50%" r="80%">
          <stop offset="0%"  stopColor="#1a1140" />
          <stop offset="55%" stopColor="#0c0922" />
          <stop offset="100%" stopColor="#04030d" />
        </radialGradient>
        <radialGradient id="gx-disc" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#c4b5fd" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#7c3aed" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gx-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#ffd9a8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f0abfc" stopOpacity="0" />
        </radialGradient>
        <filter id="gx-glow"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#gx-bg)" />

      {/* Scattered far stars */}
      <g fill="#ffffff">
        {Array.from({ length: 90 }).map((_, i) => {
          const x = (i * 167) % W;
          const y = (i * 97) % H;
          const o = 0.2 + ((i * 13) % 10) / 18;
          return (
            <circle key={i} cx={x} cy={y} r={(i % 3) * 0.5 + 0.5} fillOpacity={o}>
              {i % 8 === 0 && (
                <animate attributeName="fill-opacity" values={`${o};${o * 0.3};${o}`} dur={`${3 + (i % 4)}s`} begin={`${(i % 5) * 0.5}s`} repeatCount="indefinite" />
              )}
            </circle>
          );
        })}
      </g>

      {/* The galaxy itself — disc glow + rotating arms + bright bulge. */}
      <g transform={`translate(${W / 2} ${H / 2 + 10})`}>
        <ellipse rx="430" ry="260" fill="url(#gx-disc)" />
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360"
            dur={compact ? "120s" : "75s"} repeatCount="indefinite" />
          {GALAXY_ARMS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 5 === 0 ? "#f0abfc" : "#dbeafe"} fillOpacity={s.o} />
          ))}
        </g>
        {/* Bright bulge */}
        <circle r="70" fill="url(#gx-core)" filter="url(#gx-glow)">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle r="9" fill="#ffffff" fillOpacity="0.9" />
      </g>

      {/* Frame */}
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="24" fill="none" stroke="#c4b5fd" strokeOpacity="0.32" strokeWidth="2" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="18" fill="none" stroke="#f0abfc" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="2 10" />

      {/* Title */}
      <g transform={`translate(${W / 2} 116)`} textAnchor="middle">
        <text fontFamily='"Inter",sans-serif' fontWeight="600" fontSize="22" fill="#e9d5ff" fillOpacity="0.7" letterSpacing="14">
          SPIRAL ARENA
        </text>
      </g>
    </svg>
  );
}

/* ════════════════════ Cyberpunk ════════════════════
   Neon hex grid, holographic HUD, CRT scanline and a glitching frame in
   magenta + cyan. Coded replacement for the old PNG.
*/

function CyberpunkPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
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
