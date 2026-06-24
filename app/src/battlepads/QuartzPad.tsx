import { W, H } from "./dims";

/* ════════════════════ Quartz (premium) ════════════════════
   Crystalline playmat — pale prismatic shards arranged in a soft hexagonal
   compass, slow rotation, two refraction streaks crossing the felt. Distinct
   from every other pad: no cosmic dust, no neon grid, no card-table felt
   pattern. Reads as glacial luxury.
*/

const ICE = "#dbe7ff";
const LAV = "#c8aef0";
const BLU = "#f0c2dd";
const ROSE = "#f6a5b8";
const DEEP = "#3b2c5a";
const GLOW = "#fde9ff";

export function QuartzPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cx = W / 2;
  const cy = H / 2;
  // Six shards on a hexagonal ring around the centre — the centre stays
  // empty so cards laid down have a calm reading area.
  const ring = Array.from({ length: 6 }).map((_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const r = compact ? 280 : 360;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rot: (180 / Math.PI) * a + 90 };
  });

  return (
    <svg {...props} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="qpad-bg" cx="50%" cy="48%" r="75%">
          <stop offset="0%"  stopColor={GLOW} stopOpacity="0.95" />
          <stop offset="35%" stopColor={BLU}  stopOpacity="0.6" />
          <stop offset="75%" stopColor={LAV}  stopOpacity="0.65" />
          <stop offset="100%" stopColor={DEEP} stopOpacity="1" />
        </radialGradient>

        <linearGradient id="qpad-shard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={GLOW} stopOpacity="0.95" />
          <stop offset="40%" stopColor={ICE}  stopOpacity="0.75" />
          <stop offset="80%" stopColor={LAV}  stopOpacity="0.6" />
          <stop offset="100%" stopColor={DEEP} stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="qpad-facet" x1="0.35" y1="0" x2="0.65" y2="1">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={ROSE}  stopOpacity="0.15" />
        </linearGradient>

        <linearGradient id="qpad-prism" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%"   stopColor="#a0d4ff" stopOpacity="0" />
          <stop offset="40%"  stopColor={LAV}     stopOpacity="0.35" />
          <stop offset="60%"  stopColor={ROSE}    stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffe2a0" stopOpacity="0" />
        </linearGradient>

        {/* Shard shape — same tip-up hexagonal sliver as the backdrop. */}
        <symbol id="qpad-shape" viewBox="-10 -16 20 32">
          <path d="M 0 -16 L 7 -6 L 6 12 L -6 12 L -7 -6 Z" fill="url(#qpad-shard)" />
          <path d="M 0 -14 L 4 -6 L 3 10 L -3 10 L -4 -6 Z" fill="url(#qpad-facet)" />
        </symbol>

        <radialGradient id="qpad-centre" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={GLOW} stopOpacity="0.55" />
          <stop offset="100%" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>

        {/* Warm halo — matches the backdrop's drifting gold so the set reads
            as one cohesive piece across bg + pad. */}
        <radialGradient id="qpad-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffeed1" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#fbcf80" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fbcf80" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Felt base — pearl wash. */}
      <rect width={W} height={H} fill="url(#qpad-bg)" />

      {/* Warm drifting halo behind the central glow — adds matter / warmth. */}
      <g transform={`translate(${cx} ${cy})`}>
        <ellipse rx={compact ? 380 : 480} ry={compact ? 260 : 320} fill="url(#qpad-warm)" opacity="0.9">
          <animateTransform attributeName="transform" type="translate"
            values="-30 -20; 40 28; -30 -20" dur="34s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Two slow prism streaks — same rhythm as the backdrop so set parts
          feel of-a-piece. */}
      <g opacity="0.55">
        <rect x={-W * 0.4} y={H * 0.32} width={W * 1.8} height={H * 0.14}
          fill="url(#qpad-prism)" transform={`rotate(-10 ${cx} ${cy})`}>
          <animateTransform attributeName="transform" type="translate"
            values={`${-W * 0.25} 0; ${W * 0.25} 0; ${-W * 0.25} 0`}
            dur="26s" repeatCount="indefinite" />
        </rect>
        <rect x={-W * 0.4} y={H * 0.62} width={W * 1.8} height={H * 0.1}
          fill="url(#qpad-prism)" transform={`rotate(8 ${cx} ${cy})`}>
          <animateTransform attributeName="transform" type="translate"
            values={`${W * 0.25} 0; ${-W * 0.25} 0; ${W * 0.25} 0`}
            dur="34s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* Centre crystal — soft glow so the play area feels "consecrated". */}
      <g>
        <circle cx={cx} cy={cy} r={compact ? 130 : 170} fill="url(#qpad-centre)">
          <animate attributeName="r" values={`${compact ? 120 : 160};${compact ? 145 : 195};${compact ? 120 : 160}`}
            dur="6.4s" repeatCount="indefinite" />
        </circle>
        <use href="#qpad-shape" width={compact ? 160 : 224} height={compact ? 256 : 352}
          x={-(compact ? 80 : 112)} y={-(compact ? 128 : 176)}
          transform={`translate(${cx} ${cy})`} opacity="0.55">
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="120s" repeatCount="indefinite" />
        </use>
      </g>

      {/* The six surrounding shards — slow counter-rotation + breathing. */}
      {ring.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}>
          <g opacity="0.85">
            <animateTransform attributeName="transform" type="rotate"
              values="-5; 5; -5" dur={`${22 + i * 1.5}s`} repeatCount="indefinite" begin={`${i * 0.7}s`} />
            <use href="#qpad-shape" width={compact ? 176 : 240} height={compact ? 280 : 384}
              x={-(compact ? 88 : 120)} y={-(compact ? 144 : 192)}>
              <animate attributeName="opacity" values="0.7;1;0.7" dur={`${8 + i}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </use>
            {/* Highlight scan along each shard. */}
            <line x1={-(compact ? 22 : 30)} y1="-100" x2={(compact ? 22 : 30)} y2="-100"
              stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7">
              <animate attributeName="y1" values="-100;120;-100" dur={`${10 + i}s`} begin={`${i * 0.8}s`} repeatCount="indefinite" />
              <animate attributeName="y2" values="-100;120;-100" dur={`${10 + i}s`} begin={`${i * 0.8}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.9;0" dur={`${10 + i}s`} begin={`${i * 0.8}s`} repeatCount="indefinite" />
            </line>
          </g>
        </g>
      ))}

      {/* Soft edge vignette to anchor the cards visually. */}
      <radialGradient id="qpad-vignette" cx="50%" cy="50%" r="80%">
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
      </radialGradient>
      <rect width={W} height={H} fill="url(#qpad-vignette)" />
    </svg>
  );
}
