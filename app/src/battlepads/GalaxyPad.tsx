import { W, H } from "./dims";

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

export function GalaxyPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <radialGradient id="gx-bg" cx="50%" cy="50%" r="80%">
          <stop offset="0%"  stopColor="#1a1140" />
          <stop offset="55%" stopColor="#0c0922" />
          <stop offset="100%" stopColor="#04030d" />
        </radialGradient>
        {/* Disc glow — softer, slightly tinted so it doesn't wash the centre.
            The colour stops animate (purple → cyan → rose → purple) to drive
            the whole-pad colour cycle requested by Alex. */}
        <radialGradient id="gx-disc" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#a78bfa" stopOpacity="0.32">
            <animate attributeName="stop-color"
              values="#a78bfa;#7dd3fc;#f0abfc;#a78bfa" dur="22s" repeatCount="indefinite" />
          </stop>
          <stop offset="45%" stopColor="#6d28d9" stopOpacity="0.16">
            <animate attributeName="stop-color"
              values="#6d28d9;#0e7490;#a21caf;#6d28d9" dur="22s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#5b21b6" stopOpacity="0" />
        </radialGradient>
        {/* Core — far less bright and tinted (no pure-white burnout). The
            inner stop cycles colours so the bulge breathes hue instead of just
            brightness. */}
        <radialGradient id="gx-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#d8b4fe" stopOpacity="0.62">
            <animate attributeName="stop-color"
              values="#d8b4fe;#a5f3fc;#fbcfe8;#fcd34d;#d8b4fe" dur="18s" repeatCount="indefinite" />
          </stop>
          <stop offset="45%" stopColor="#7c3aed" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <filter id="gx-glow"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#gx-bg)" />

      {/* Scattered far stars */}
      <g fill="#ffffff">
        {Array.from({ length: 90 }).map((_, i) => {
          const x = (i * 167) % W;
          const y = (i * 97) % H;
          const o = 0.18 + ((i * 13) % 10) / 22;
          return (
            <circle key={i} cx={x} cy={y} r={(i % 3) * 0.5 + 0.5} fillOpacity={o}>
              {i % 8 === 0 && (
                <animate attributeName="fill-opacity" values={`${o};${o * 0.3};${o}`} dur={`${3 + (i % 4)}s`} begin={`${(i % 5) * 0.5}s`} repeatCount="indefinite" />
              )}
            </circle>
          );
        })}
      </g>

      {/* The galaxy itself — disc glow + rotating arms + soft bulge. */}
      <g transform={`translate(${W / 2} ${H / 2 + 10})`}>
        <ellipse rx="430" ry="260" fill="url(#gx-disc)" />
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360"
            dur={compact ? "120s" : "75s"} repeatCount="indefinite" />
          {/* Arm stars: ⅕ swap colours on a slow cycle so the spiral hue evolves
              instead of being a static violet/blue field. */}
          {GALAXY_ARMS.map((s, i) => {
            const tint = i % 5 === 0;
            return (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fillOpacity={s.o * 0.85}
                      fill={tint ? "#f0abfc" : "#c7d2fe"}>
                {tint && (
                  <animate attributeName="fill"
                    values="#f0abfc;#7dd3fc;#fbcfe8;#a5f3fc;#f0abfc"
                    dur="16s" begin={`${(i * 0.07) % 6}s`} repeatCount="indefinite" />
                )}
              </circle>
            );
          })}
        </g>
        {/* Soft bulge — capped at 60% opacity so it never burns the centre. */}
        <circle r="62" fill="url(#gx-core)" filter="url(#gx-glow)" opacity="0.55">
          <animate attributeName="opacity" values="0.45;0.62;0.45" dur="4.6s" repeatCount="indefinite" />
        </circle>
        {/* Tiny core pinprick — keeps a focal point without flooding light. */}
        <circle r="5" fill="#fde68a" fillOpacity="0.55" />
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
