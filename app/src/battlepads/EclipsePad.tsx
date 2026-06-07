import { W, H } from "./dims";

/* ════════════════════ Eclipse ════════════════════
   Total solar eclipse — onyx void, concentric gold rings,
   diamond-ring flash orbiting the corona, slow breathing
   glow, sacred-geometry outer frame. Dark centre stays
   legible for card placement.
*/

const VOID  = "#04040c"; // deep near-black
const GOLD  = "#d4a745"; // corona gold
const PALE  = "#ebdfc0"; // diamond ring white-gold
const BRONZE = "#a07c3c"; // outer ring muted gold
const INDIGO = "#1a1840"; // subtle deep halo
const FROST  = "#bebcce"; // cold silver accent

export function EclipsePad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        {/* Void base — deepest onyx centre, faint indigo toward edges */}
        <radialGradient id="ec-bg" cx="50%" cy="50%" r="75%">
          <stop offset="0%"  stopColor={VOID} />
          <stop offset="60%" stopColor="#070612" />
          <stop offset="100%" stopColor="#0c0a1a" />
        </radialGradient>

        {/* Corona ring gradient — bright gold at the luminous edge, fading outward */}
        <radialGradient id="ec-corona" cx="50%" cy="50%" r="50%">
          <stop offset="32%" stopColor={VOID} stopOpacity="0" />
          <stop offset="48%" stopColor={GOLD}  stopOpacity="0.0" />
          <stop offset="53%" stopColor={PALE}  stopOpacity="0.55" />
          <stop offset="60%" stopColor={GOLD}  stopOpacity="0.35" />
          <stop offset="72%" stopColor={BRONZE} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BRONZE} stopOpacity="0" />
        </radialGradient>

        {/* Diamond ring flare — tight radial highlight orbiting the ring */}
        <radialGradient id="ec-diamond" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="28%" stopColor={PALE}   stopOpacity="0.70" />
          <stop offset="65%" stopColor={GOLD}   stopOpacity="0.18" />
          <stop offset="100%" stopColor={GOLD}  stopOpacity="0" />
        </radialGradient>

        {/* Outer glow aura — very faint mauve-indigo omnidirectional wash */}
        <radialGradient id="ec-aura" cx="50%" cy="50%" r="60%">
          <stop offset="45%" stopColor="#2a2250" stopOpacity="0" />
          <stop offset="65%" stopColor="#2a2250" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#1a1840" stopOpacity="0.03" />
        </radialGradient>

        {/* Filters */}
        <filter id="ec-blur4"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="ec-blur12"><feGaussianBlur stdDeviation="12" /></filter>
        <filter id="ec-blur24"><feGaussianBlur stdDeviation="24" /></filter>
      </defs>

      {/* ── Void base ── */}
      <rect width={W} height={H} fill="url(#ec-bg)" />

      {/* ── Outer aura (very faint halo) ── */}
      <rect width={W} height={H} fill="url(#ec-aura)" filter="url(#ec-blur24)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="7s" repeatCount="indefinite" />
      </rect>

      {/* ── Corona ring (painted on a big disc with a hole cut via gradient) ── */}
      <rect width={W} height={H} fill="url(#ec-corona)" filter="url(#ec-blur12)">
        <animate attributeName="opacity"
          values="0.7;1;0.7" dur="5.5s" repeatCount="indefinite" />
      </rect>

      {/* ── Diamond ring orbiter — bright spot rotating around the ring ── */}
      <g>
        <circle r="22" fill="url(#ec-diamond)" filter="url(#ec-blur4)">
          <animateMotion dur="14s" repeatCount="indefinite"
            path={`M ${W/2 - 165} ${H/2} a 165 110 0 1 0 330 0 a 165 110 0 1 0 -330 0`} />
          <animate attributeName="opacity"
            values="0.55;1;0.55" dur="4.2s" repeatCount="indefinite" />
        </circle>
        {/* Smaller opposite bead — Baily's beads offset */}
        <circle r="9" fill={PALE} fillOpacity="0.45" filter="url(#ec-blur4)">
          <animateMotion dur="14s" repeatCount="indefinite" begin="5.5s"
            path={`M ${W/2 - 165} ${H/2} a 165 110 0 1 0 330 0 a 165 110 0 1 0 -330 0`} />
          <animate attributeName="opacity"
            values="0.25;0.55;0.25" dur="5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* ── Radial golden streamers — thin rays emanating from the ring.
            24 lines split across 4 sub-groups of 6 (every 4th line shares
            a phase). One `<animate>` per group instead of one per line:
            24 SMIL animations → 4. The cross-group offsets preserve the
            "rippling wave" feel — different phases mean the eye still
            reads a moving rotation, but the compositor only tracks 4
            stroke-opacity tweens. */}
      <g stroke={GOLD} strokeOpacity="0.07" fill="none" strokeWidth="1">
        {[0, 1, 2, 3].map((phase) => {
          // Group "phase" owns indices i where i % 4 === phase.
          // Animation duration + delay vary per phase so the 4 waves
          // don'\''t lock-step.
          const dur = 8 + (phase % 3) * 2;
          const delay = phase * 2.1;
          return (
            <g key={phase}>
              {Array.from({ length: 6 }).map((_, j) => {
                const i = j * 4 + phase;
                const a = (i / 24) * Math.PI * 2;
                const cx = W / 2;
                const cy = H / 2;
                const rx = 175;
                const ry = 120;
                const x1 = cx + Math.cos(a) * rx;
                const y1 = cy + Math.sin(a) * ry;
                const x2 = cx + Math.cos(a) * (rx + 180);
                const y2 = cy + Math.sin(a) * (ry + 120);
                return <line key={j} x1={x1} y1={y1} x2={x2} y2={y2} />;
              })}
              <animate attributeName="stroke-opacity"
                values="0.04;0.12;0.04"
                dur={`${dur}s`} begin={`${delay}s`}
                repeatCount="indefinite" />
            </g>
          );
        })}
      </g>

      {/* ── Concentric sacred-geometry rings (Art Déco eclipse arc) ── */}
      <g fill="none" transform={`translate(${W/2} ${H/2})`}>
        {[
          { rx: 185, ry: 130, sw: 1.5, o: 0.10, d: "6 10" },
          { rx: 200, ry: 142, sw: 0.8, o: 0.06, d: "2 14" },
        ].map((r, i) => (
          <ellipse key={i} rx={r.rx} ry={r.ry}
            stroke={GOLD} strokeWidth={r.sw} strokeOpacity={r.o}
            strokeDasharray={r.d}>
            <animate attributeName="stroke-opacity"
              values={`${r.o};${r.o * 1.8};${r.o}`}
              dur={`${6 + i * 2}s`} repeatCount="indefinite" />
          </ellipse>
        ))}
      </g>

      {/* ── Corner compass rose marks (N/S/E/W solar alignment) ── */}
      <g stroke={GOLD} strokeOpacity="0.16" fill="none" strokeWidth="1.2">
        {[
          { x: W / 2, y: 60 },    // North
          { x: W / 2, y: H - 60 }, // South
          { x: 60, y: H / 2 },    // West
          { x: W - 60, y: H / 2 }, // East
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <line x1="-14" y1="0" x2="14" y2="0" />
            <line x1="0" y1="-14" x2="0" y2="14" />
            <circle r="5" fill={GOLD} fillOpacity="0.12" stroke="none" />
            {[45, 135, 225, 315].map((deg) => (
              <line key={deg}
                x1={Math.cos((deg * Math.PI) / 180) * 8}
                y1={Math.sin((deg * Math.PI) / 180) * 8}
                x2={Math.cos((deg * Math.PI) / 180) * 22}
                y2={Math.sin((deg * Math.PI) / 180) * 22}
                strokeOpacity="0.06" />
            ))}
            <animate attributeName="stroke-opacity"
              values="0.12;0.28;0.12"
              dur={`${4 + i * 0.7}s`} repeatCount="indefinite" />
          </g>
        ))}
      </g>

      {/* ── Slow-breathing centre glow ── */}
      <g transform={`translate(${W/2} ${H/2})`}>
        <circle r="100" fill={INDIGO} fillOpacity="0.06" filter="url(#ec-blur24)">
          <animate attributeName="r" values="90;110;90" dur="6s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.04;0.08;0.04" dur="6s" repeatCount="indefinite" />
        </circle>
        <circle r="45" fill={GOLD} fillOpacity="0.04" filter="url(#ec-blur12)">
          <animate attributeName="r" values="40;50;40" dur="4.5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* ── Discreet floating stellar motes ── */}
      {!compact && Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2 + 0.5;
        const dist = 220 + i * 30;
        const cx = W / 2 + Math.cos(angle) * dist;
        const cy = H / 2 + Math.sin(angle) * dist * 0.72;
        return (
          <circle key={i} cx={cx} cy={cy} r={1.2 + i * 0.3}
                  fill={FROST} fillOpacity="0.25"
                  filter="url(#ec-blur4)">
            <animate attributeName="fill-opacity"
              values="0.12;0.35;0.12"
              dur={`${3 + i * 0.6}s`} begin={`${i * 0.8}s`}
              repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* ── CELESTIAL SEAL — 8-pointed star signature, distinct from the
            corona ring of the matching backdrop. Reads as "this is the
            Eclipse PAD" even without context: gold 8-point star + central
            small diamond + outer dotted dial. ── */}
      <g transform={`translate(${W/2} ${H/2})`}>
        {/* Outer dial — 24 small dots around a 230-radius circle. */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
          return (
            <circle key={i}
              cx={Math.cos(a) * 230}
              cy={Math.sin(a) * 230}
              r={i % 6 === 0 ? 2.5 : 1.4}
              fill={GOLD} fillOpacity={i % 6 === 0 ? 0.45 : 0.20} />
          );
        })}
        {/* 8-pointed star — long alternating with short. */}
        {[0,1,2,3,4,5,6,7].map((i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const len = i % 2 === 0 ? 95 : 55;
          const w = i % 2 === 0 ? 9 : 6;
          const px = Math.cos(a) * len;
          const py = Math.sin(a) * len;
          const pxIn = Math.cos(a) * 12;
          const pyIn = Math.sin(a) * 12;
          // Perpendicular for the spear base.
          const perpX = -Math.sin(a) * w;
          const perpY = Math.cos(a) * w;
          return (
            <polygon key={i}
              points={`${px},${py} ${pxIn+perpX},${pyIn+perpY} ${pxIn-perpX},${pyIn-perpY}`}
              fill={GOLD} fillOpacity={i % 2 === 0 ? 0.30 : 0.18} />
          );
        })}
        {/* Inner diamond bead. */}
        <circle r="12" fill={PALE} fillOpacity="0.55" />
        <circle r="6" fill="#fff" fillOpacity="0.85" />
      </g>

      {/* ── Frame — double gold + silver geometric border ── */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="22"
            fill="none" stroke={GOLD} strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="56" y="56" width={W - 112} height={H - 112} rx="16"
            fill="none" stroke={FROST} strokeOpacity="0.08" strokeWidth="0.8"
            strokeDasharray="3 12" />

      {/* ── Arching eclipse label above corona ── */}
      <g transform={`translate(${W/2} ${H/2 - 155})`} textAnchor="middle">
        <text fontFamily='"Cinzel","EB Garamond",serif' fontWeight="600"
              fontSize="19" fill={GOLD} fillOpacity="0.50" letterSpacing="12">
          TOTAL ECLIPSE
        </text>
        <line x1="-90" y1="14" x2="90" y2="14" stroke={GOLD} strokeOpacity="0.10"
              strokeWidth="0.6" />
      </g>

      {/* ── Lower sigil ── */}
      <g transform={`translate(${W/2} ${H/2 + 200})`} textAnchor="middle">
        <text fontFamily='"JetBrains Mono","Consolas",monospace' fontWeight="500"
              fontSize="11" fill={BRONZE} fillOpacity="0.30" letterSpacing="5">
          CORONA · DIAMOND · UMBRA
        </text>
      </g>
    </svg>
  );
}