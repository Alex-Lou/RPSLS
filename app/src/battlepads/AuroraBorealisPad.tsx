import { W, H } from "./dims";

/* ════════════════════ Aurora Borealis ════════════════════
   Arctic night sky — shimmering curtains of green, teal and violet light
   ripple across a star-dusted polar sky. A snow-horizon glow anchors the
   bottom; the centre stays dark for card legibility.
*/

const G  = "#22c55e"; // aurora green
const T  = "#2dd4bf"; // teal
const V  = "#8b5cf6"; // soft violet
const P  = "#c084fc"; // pink-violet edge
const SKY = "#070b18"; // polar night

export function AuroraBorealisPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  // Star field
  const stars = (() => {
    const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
    let seed = 314;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 0xffffffff; return seed / 0xffffffff; };
    for (let i = 0; i < 160; i++) {
      pts.push({ x: rng() * W, y: rng() * (H * 0.7), r: 0.3 + rng() * 1.4, o: 0.12 + rng() * 0.5 });
    }
    return pts;
  })();

  // Aurora curtain wave paths — sinusoidal bands at different heights
  const curtains = [
    { y: 180, amp: 35, freq: 1.8, color: G,  o: 0.28, w: 90,  dur: 18, phase: 0 },
    { y: 260, amp: 28, freq: 2.2, color: T,  o: 0.22, w: 70,  dur: 22, phase: 40 },
    { y: 140, amp: 40, freq: 1.5, color: V,  o: 0.18, w: 80,  dur: 26, phase: 80 },
    { y: 320, amp: 22, freq: 2.6, color: G,  o: 0.15, w: 55,  dur: 20, phase: 120 },
    { y: 200, amp: 32, freq: 2.0, color: P,  o: 0.12, w: 65,  dur: 30, phase: 160 },
  ];

  function curtainPath(c: typeof curtains[0]) {
    let d = `M -50 ${c.y + c.w}`;
    for (let x = -50; x <= W + 50; x += 20) {
      const wave = Math.sin(((x + c.phase) / W) * Math.PI * c.freq) * c.amp;
      d += ` L ${x} ${c.y + wave}`;
    }
    d += ` L ${W + 50} ${c.y + c.w} Z`;
    return d;
  }

  return (
    <svg {...props}>
      <defs>
        {/* Polar night sky */}
        <linearGradient id="ab-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#020510" />
          <stop offset="40%" stopColor={SKY} />
          <stop offset="100%" stopColor="#0c1220" />
        </linearGradient>

        {/* Aurora curtain gradients — top bright, bottom fading */}
        {curtains.map((c, i) => (
          <linearGradient key={i} id={`ab-curt${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={c.color} stopOpacity={String(c.o * 1.6)} />
            <stop offset="40%" stopColor={c.color} stopOpacity={String(c.o)} />
            <stop offset="100%" stopColor={c.color} stopOpacity="0" />
          </linearGradient>
        ))}

        {/* Snow-horizon ambient glow */}
        <radialGradient id="ab-horizon" cx="50%" cy="100%" r="70%">
          <stop offset="0%"  stopColor={T} stopOpacity="0.12" />
          <stop offset="50%" stopColor={G} stopOpacity="0.05" />
          <stop offset="100%" stopColor={G} stopOpacity="0" />
        </radialGradient>

        {/* Overhead aurora glow */}
        <radialGradient id="ab-crown" cx="50%" cy="10%" r="60%">
          <stop offset="0%"  stopColor={G} stopOpacity="0.14" />
          <stop offset="50%" stopColor={T} stopOpacity="0.05" />
          <stop offset="100%" stopColor={T} stopOpacity="0" />
        </radialGradient>

        <filter id="ab-soft"><feGaussianBlur stdDeviation="12" /></filter>
        <filter id="ab-glow"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>

      {/* Sky base */}
      <rect width={W} height={H} fill="url(#ab-sky)" />

      {/* Overhead aurora crown glow */}
      <rect width={W} height={H} fill="url(#ab-crown)">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="8s" repeatCount="indefinite" />
      </rect>

      {/* Aurora curtains — each sways independently */}
      <g filter="url(#ab-soft)">
        {curtains.map((c, i) => (
          <g key={i}>
            <path d={curtainPath(c)} fill={`url(#ab-curt${i})`}>
              <animateTransform attributeName="transform" type="translate"
                values={`0,0; ${30 + i * 8},${-10 - i * 3}; ${-(20 + i * 5)},${8 + i * 2}; 0,0`}
                dur={`${c.dur}s`} repeatCount="indefinite" />
            </path>
          </g>
        ))}
      </g>

      {/* Vertical aurora rays — pillars of light */}
      {!compact && [
        { x: 280,  h: 380, color: G,  o: 0.10, w: 60, dur: 12 },
        { x: 600,  h: 420, color: T,  o: 0.08, w: 50, dur: 16 },
        { x: 950,  h: 360, color: V,  o: 0.07, w: 55, dur: 14 },
        { x: 1200, h: 340, color: G,  o: 0.09, w: 45, dur: 18 },
      ].map((r, i) => (
        <rect key={i} x={r.x - r.w / 2} y={60} width={r.w} height={r.h}
              fill={r.color} opacity={r.o} filter="url(#ab-soft)">
          <animate attributeName="opacity"
            values={`${r.o};${r.o * 2.2};${r.o}`}
            dur={`${r.dur}s`} repeatCount="indefinite" />
          <animate attributeName="height"
            values={`${r.h};${r.h * 1.15};${r.h}`}
            dur={`${r.dur}s`} repeatCount="indefinite" />
        </rect>
      ))}

      {/* Star field */}
      <g fill="#ffffff">
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fillOpacity={s.o}>
            {i % 7 === 0 && (
              <animate attributeName="fill-opacity"
                values={`${s.o};${s.o * 0.15};${s.o}`}
                dur={`${2.8 + (i % 4) * 0.6}s`} begin={`${(i % 6) * 0.5}s`}
                repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </g>

      {/* Horizon snow glow */}
      <rect width={W} height={H} fill="url(#ab-horizon)" />
      <rect x="0" y={H - 80} width={W} height="80"
            fill="url(#ab-horizon)" opacity="0.6" />

      {/* Frosty mountain silhouette at the bottom */}
      <path
        d={`M 0 ${H} L 0 ${H - 50} L 120 ${H - 90} L 260 ${H - 55} L 380 ${H - 110}
            L 500 ${H - 65} L 620 ${H - 95} L 760 ${H - 50} L 900 ${H - 80}
            L 1040 ${H - 60} L 1160 ${H - 100} L 1300 ${H - 55} L 1420 ${H - 75}
            L ${W} ${H - 45} L ${W} ${H} Z`}
        fill="#0a0f1a" fillOpacity="0.7"
      />
      <path
        d={`M 0 ${H} L 0 ${H - 30} L 180 ${H - 60} L 340 ${H - 35} L 500 ${H - 70}
            L 680 ${H - 40} L 850 ${H - 55} L 1020 ${H - 30} L 1200 ${H - 50}
            L 1350 ${H - 35} L ${W} ${H - 25} L ${W} ${H} Z`}
        fill="#060a14" fillOpacity="0.85"
      />

      {/* Faint snow shimmer on peaks */}
      {[380, 620, 1160].map((px, i) => (
        <circle key={i} cx={px} cy={H - 105 + i * 10} r="3" fill="#fff" fillOpacity="0">
          <animate attributeName="fill-opacity"
            values="0;0.35;0" dur={`${4 + i}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Ethereal arctic frame */}
      <rect x="38" y="38" width={W - 76} height={H - 76} rx="20"
            fill="none" stroke={T} strokeWidth="1.5" strokeOpacity="0.2" />
      <rect x="52" y="52" width={W - 104} height={H - 104} rx="14"
            fill="none" stroke={G} strokeWidth="0.8" strokeOpacity="0.12"
            strokeDasharray="3 14" />

      {/* Corner frost crystals */}
      {[
        { x: 80, y: 80 },
        { x: W - 80, y: 80 },
        { x: W - 80, y: H - 80 },
        { x: 80, y: H - 80 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`} stroke={T} strokeOpacity="0.25" strokeWidth="1" fill="none">
          {[0, 60, 120].map((a) => (
            <line key={a}
              x1={Math.cos(((a + i * 90) * Math.PI) / 180) * 6}
              y1={Math.sin(((a + i * 90) * Math.PI) / 180) * 6}
              x2={Math.cos(((a + i * 90) * Math.PI) / 180) * 28}
              y2={Math.sin(((a + i * 90) * Math.PI) / 180) * 28} />
          ))}
          <circle r="4" fill={T} fillOpacity="0.15" />
        </g>
      ))}

      {/* Rising aurora motes (non-compact) */}
      {!compact && Array.from({ length: 10 }).map((_, i) => {
        const x = 150 + (i * 127) % 1200;
        const dur = 8 + (i % 3) * 2;
        const delay = (i % 4) * 1.2;
        const color = [G, T, V][i % 3];
        return (
          <circle key={i} cx={x} cy={H - 120} r={1.2 + (i % 3) * 0.5}
                  fill={color} opacity="0">
            <animate attributeName="cy" values={`${H - 120};60`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.45;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </svg>
  );
}
