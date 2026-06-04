import { W, H } from "./dims";

/* ════════════════════ Cosmos ════════════════════
   Deep space backdrop: star field, faint nebulas,
   one tiny pulsar central, decoration only at perimeter.
*/

export function CosmosPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
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
