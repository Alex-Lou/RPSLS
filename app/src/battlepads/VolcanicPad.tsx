import { W, H } from "./dims";

/* ════════════════════ Volcanic ════════════════════
   Obsidian-and-lava playmat — cracked basalt surface with molten veins,
   ember particles rising, a deep magma glow beneath, and faint
   volcanic ash drifting. Dark enough for card legibility with fiery
   accents at the seams.
*/

const LAVA  = "#ff4500"; // orange-red
const EMBER = "#ff8c00"; // amber
const ASH   = "#1a1012"; // dark basalt
const GLOW  = "#c0280a"; // deep magma

export function VolcanicPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cx = W / 2;
  const cy = H / 2;

  // Ember particles
  const embers = (() => {
    const pts: Array<{ x: number; y: number; r: number; delay: number; dur: number }> = [];
    let seed = 137;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 0xffffffff; return seed / 0xffffffff; };
    for (let i = 0; i < (compact ? 20 : 55); i++) {
      pts.push({
        x: rng() * W,
        y: cy + (rng() - 0.3) * H * 0.8,
        r: 0.6 + rng() * 2.2,
        delay: rng() * 12,
        dur: 6 + rng() * 10,
      });
    }
    return pts;
  })();

  // Lava cracks — irregular polyline paths across the surface
  const cracks = [
    `M80,${cy - 80} Q300,${cy - 140} 520,${cy - 60} T900,${cy - 100} T1380,${cy - 50}`,
    `M200,${cy + 120} Q500,${cy + 60} 750,${cy + 150} T1100,${cy + 80} T1420,${cy + 130}`,
    `M60,${cy + 20} Q350,${cy + 40} 600,${cy - 20} T1000,${cy + 50}`,
    `M400,${cy - 200} Q550,${cy - 100} 700,${cy - 180} T1050,${cy - 140}`,
    `M150,${cy + 220} Q380,${cy + 280} 650,${cy + 200} T1200,${cy + 250}`,
  ];

  return (
    <svg {...props}>
      <defs>
        {/* Dark basalt base */}
        <radialGradient id="vl-bg" cx="50%" cy="50%" r="75%">
          <stop offset="0%"  stopColor="#1c1210" />
          <stop offset="60%" stopColor={ASH} />
          <stop offset="100%" stopColor="#0a0605" />
        </radialGradient>

        {/* Magma underglow */}
        <radialGradient id="vl-magma" cx="50%" cy="55%" r="65%">
          <stop offset="0%"  stopColor={GLOW} stopOpacity="0.22" />
          <stop offset="50%" stopColor={LAVA} stopOpacity="0.06" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Lava crack glow filter */}
        <filter id="vl-crackGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
        </filter>
        <filter id="vl-crackCore" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>

        {/* Ember glow */}
        <radialGradient id="vl-ember">
          <stop offset="0%"  stopColor={EMBER} stopOpacity="0.9" />
          <stop offset="60%" stopColor={LAVA} stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Ash drift filter */}
        <filter id="vl-ash" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
        </filter>

        {/* Surface texture noise — subtle volcanic rock grain */}
        <filter id="vl-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="n" />
          <feColorMatrix type="saturate" values="0" in="n" result="g" />
          <feBlend in="SourceGraphic" in2="g" mode="overlay" />
        </filter>
      </defs>

      {/* Background */}
      <rect width={W} height={H} fill="url(#vl-bg)" />
      <rect width={W} height={H} fill="url(#vl-magma)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="8s" repeatCount="indefinite" />
      </rect>

      {/* Rock grain texture */}
      <rect width={W} height={H} fill="url(#vl-bg)" filter="url(#vl-grain)" opacity="0.15" />

      {/* Lava cracks — outer glow */}
      {cracks.map((d, i) => (
        <path
          key={`cg-${i}`}
          d={d}
          fill="none"
          stroke={LAVA}
          strokeWidth={compact ? 8 : 14}
          strokeLinecap="round"
          opacity="0.35"
          filter="url(#vl-crackGlow)"
        >
          <animate attributeName="opacity" values="0.25;0.45;0.25" dur={`${5 + i * 1.3}s`} repeatCount="indefinite" />
        </path>
      ))}

      {/* Lava cracks — bright core */}
      {cracks.map((d, i) => (
        <path
          key={`cc-${i}`}
          d={d}
          fill="none"
          stroke={EMBER}
          strokeWidth={compact ? 2 : 3.5}
          strokeLinecap="round"
          opacity="0.8"
          filter="url(#vl-crackCore)"
        >
          <animate attributeName="opacity" values="0.6;1;0.6" dur={`${4 + i * 0.9}s`} repeatCount="indefinite" />
          <animate attributeName="stroke" values={`${EMBER};${LAVA};${EMBER}`} dur={`${6 + i}s`} repeatCount="indefinite" />
        </path>
      ))}

      {/* Rising ember particles */}
      {embers.map((e, i) => (
        <circle
          key={`em-${i}`}
          cx={e.x}
          cy={e.y}
          r={e.r}
          fill="url(#vl-ember)"
        >
          <animate
            attributeName="cy"
            from={e.y}
            to={e.y - 250 - e.r * 40}
            dur={`${e.dur}s`}
            begin={`${e.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.9;0.7;0"
            dur={`${e.dur}s`}
            begin={`${e.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cx"
            values={`${e.x};${e.x + (i % 2 === 0 ? 20 : -15)};${e.x + (i % 2 === 0 ? -10 : 12)};${e.x}`}
            dur={`${e.dur * 0.7}s`}
            begin={`${e.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Ash drift — faint grey particles floating across */}
      {!compact && Array.from({ length: 18 }, (_, i) => {
        const seed = i * 31 + 7;
        const y = (seed * 17) % H;
        const r = 1 + (seed % 3);
        const dur = 14 + (seed % 12);
        return (
          <circle
            key={`ash-${i}`}
            cx={-20}
            cy={y}
            r={r}
            fill="#8a7a6a"
            opacity="0.12"
            filter="url(#vl-ash)"
          >
            <animate attributeName="cx" from={-20} to={W + 20} dur={`${dur}s`} begin={`${(seed % 10)}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${y};${y - 30};${y + 20};${y}`} dur={`${dur * 0.8}s`} begin={`${(seed % 10)}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Central magma pulse */}
      <ellipse cx={cx} cy={cy} rx="350" ry="200" fill={GLOW} opacity="0.05">
        <animate attributeName="opacity" values="0.03;0.08;0.03" dur="6s" repeatCount="indefinite" />
        <animate attributeName="rx" values="340;370;340" dur="6s" repeatCount="indefinite" />
      </ellipse>

      {/* Vignette darken edges */}
      <radialGradient id="vl-vig" cx="50%" cy="50%" r="70%">
        <stop offset="40%" stopColor="transparent" />
        <stop offset="100%" stopColor="#050302" stopOpacity="0.6" />
      </radialGradient>
      <rect width={W} height={H} fill="url(#vl-vig)" />
    </svg>
  );
}
