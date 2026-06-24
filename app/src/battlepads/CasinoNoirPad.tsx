import { W, H } from "./dims";

/* ════════════════════ Casino Noir ════════════════════
   Monte-Carlo midnight — black velvet & warm gold. An Art Deco medallion
   rotates at the centre; the four card suits sit as gilded filigree in the
   corners; drifting gold bokeh and a slow conical shimmer add life. The
   interior stays deliberately dark so lane cards read clearly.
*/

const G  = "#d4a843";      // warm gold
const GL = "#f5d77e";      // gold highlight
const GD = "#8c6a1e";      // gold deep/shadow
const BG = "#0a0a0e";      // near-black base
const MID = "#12111a";     // charcoal mid-tone

export function CasinoNoirPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  const cx = W / 2;
  const cy = H / 2;

  // Deterministic bokeh motes
  const bokeh = (() => {
    const pts: Array<{ x: number; y: number; r: number; o: number; d: number }> = [];
    let seed = 777;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 0xffffffff; return seed / 0xffffffff; };
    for (let i = 0; i < 24; i++) {
      pts.push({
        x: 100 + rng() * (W - 200),
        y: 100 + rng() * (H - 200),
        r: 4 + rng() * 12,
        o: 0.04 + rng() * 0.10,
        d: 5 + rng() * 6,
      });
    }
    return pts;
  })();

  // Deco sunray angles for corner medallions
  const rays = Array.from({ length: 9 }, (_, i) => (i * 10));

  return (
    <svg {...props}>
      <defs>
        {/* Dark radial base */}
        <radialGradient id="cn-bg" cx="50%" cy="50%" r="78%">
          <stop offset="0%"  stopColor={MID} />
          <stop offset="55%" stopColor={BG} />
          <stop offset="100%" stopColor="#050507" />
        </radialGradient>

        {/* Gold radial for the centre medallion */}
        <radialGradient id="cn-med" cx="50%" cy="38%" r="50%">
          <stop offset="0%"  stopColor={GL} stopOpacity="0.9" />
          <stop offset="50%" stopColor={G}  stopOpacity="0.7" />
          <stop offset="100%" stopColor={GD} stopOpacity="0.3" />
        </radialGradient>

        {/* Conical shimmer — a wide ellipse that sweeps across the board */}
        <radialGradient id="cn-shimmer" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={GL} stopOpacity="0.06" />
          <stop offset="60%" stopColor={G}  stopOpacity="0.02" />
          <stop offset="100%" stopColor={G}  stopOpacity="0" />
        </radialGradient>

        {/* Bokeh blur */}
        <filter id="cn-blur"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="cn-glow"><feGaussianBlur stdDeviation="4" /></filter>

        {/* Gold stroke pattern for inner frame */}
        <linearGradient id="cn-gold-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor={GL} />
          <stop offset="50%" stopColor={G} />
          <stop offset="100%" stopColor={GD} />
        </linearGradient>
      </defs>

      {/* ── Base ── */}
      <rect width={W} height={H} fill="url(#cn-bg)" />

      {/* Fine noise texture (subtle felt-like dot pattern) */}
      <defs>
        <pattern id="cn-noise" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.4" fill="#fff" fillOpacity="0.03" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#cn-noise)" />

      {/* ── Conical shimmer sweep ── */}
      <g transform={`translate(${cx} ${cy})`}>
        <ellipse rx="700" ry="400" fill="url(#cn-shimmer)">
          <animateTransform attributeName="transform" type="rotate"
            from="0" to="360" dur="28s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* ── Art Deco triple frame ── */}
      <rect x="30" y="30" width={W - 60} height={H - 60} rx="24"
            fill="none" stroke="url(#cn-gold-stroke)" strokeWidth="4" strokeOpacity="0.7" />
      <rect x="48" y="48" width={W - 96} height={H - 96} rx="18"
            fill="none" stroke={G} strokeWidth="1.2" strokeOpacity="0.4" />
      <rect x="60" y="60" width={W - 120} height={H - 120} rx="14"
            fill="none" stroke={G} strokeWidth="0.8" strokeOpacity="0.18"
            strokeDasharray="3 10" />

      {/* ── Corner filigree suit symbols ── */}
      {([
        { x: 110,     y: 110,     suit: "♠", rot: 0 },
        { x: W - 110, y: 110,     suit: "♥", rot: 0 },
        { x: W - 110, y: H - 110, suit: "♦", rot: 0 },
        { x: 110,     y: H - 110, suit: "♣", rot: 0 },
      ] as const).map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y})`}>
          {/* Deco sunray burst behind the suit */}
          <g stroke={G} fill="none" strokeWidth="1.2" strokeOpacity="0.3">
            {rays.map((a) => (
              <line key={a} x1="0" y1="0"
                    x2={Math.cos(((a + (i * 90)) * Math.PI) / 180) * 50}
                    y2={Math.sin(((a + (i * 90)) * Math.PI) / 180) * 50} />
            ))}
            <circle r="52" strokeOpacity="0.15" />
          </g>
          {/* Suit glyph */}
          <text textAnchor="middle" dominantBaseline="central"
                fontFamily='"Times New Roman",serif' fontSize="77"
                fill={G} fillOpacity="0.6">{c.suit}</text>
          {/* Slow pulsing glow */}
          <circle r="36" fill={G} fillOpacity="0" filter="url(#cn-glow)">
            <animate attributeName="fill-opacity"
              values="0;0.08;0" dur={`${4 + i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* ── Centre Art Deco medallion (suppressed in compact) ── */}
      {!compact && (
        <g transform={`translate(${cx} ${cy}) scale(1.6)`}>
          <g>
            <animateTransform attributeName="transform" type="rotate"
              from="0" to="360" dur="50s" repeatCount="indefinite" />
            {/* Outer ornate ring */}
            <circle r="110" fill="none" stroke={G} strokeWidth="2.5" strokeOpacity="0.5" />
            <circle r="100" fill="none" stroke={G} strokeWidth="1" strokeOpacity="0.25"
                    strokeDasharray="4 6" />
            {/* 12 deco notches around the ring */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const x1 = Math.cos(a) * 90;
              const y1 = Math.sin(a) * 90;
              const x2 = Math.cos(a) * 108;
              const y2 = Math.sin(a) * 108;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke={G} strokeWidth="2" strokeOpacity="0.45" />;
            })}
            {/* Inner medallion face */}
            <circle r="80" fill="url(#cn-med)" opacity="0.22" />
            <circle r="80" fill="none" stroke={GL} strokeWidth="1.5" strokeOpacity="0.35" />
            {/* Central diamond shape */}
            <path d="M 0 -42 L 28 0 L 0 42 L -28 0 Z"
                  fill="none" stroke={GL} strokeWidth="1.8" strokeOpacity="0.5" />
            <path d="M 0 -28 L 18 0 L 0 28 L -18 0 Z"
                  fill={GL} fillOpacity="0.08" />
            {/* Hub dot */}
            <circle r="5" fill={GL} fillOpacity="0.5" />
          </g>
          {/* Static soft halo behind the rotating medallion */}
          <circle r="120" fill={G} fillOpacity="0" filter="url(#cn-blur)">
            <animate attributeName="fill-opacity"
              values="0.04;0.10;0.04" dur="5.2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* ── Drifting gold bokeh ── */}
      {bokeh.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r}
                fill={i % 3 === 0 ? GL : G} fillOpacity={b.o}
                filter="url(#cn-blur)">
          <animate attributeName="cy"
            values={`${b.y};${b.y - 30 - (i % 4) * 10};${b.y}`}
            dur={`${b.d}s`} repeatCount="indefinite" />
          <animate attributeName="fill-opacity"
            values={`${b.o};${b.o * 1.8};${b.o}`}
            dur={`${b.d}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* ── Floating chip sparkles (non-compact only) ── */}
      {!compact && Array.from({ length: 8 }).map((_, i) => {
        const x = 350 + (i * 107) % 800;
        const dur = 6 + (i % 3) * 1.5;
        const delay = (i % 4) * 1.1;
        return (
          <circle key={i} cx={x} cy={H - 60} r={1.2 + (i % 3) * 0.5}
                  fill={GL} opacity="0">
            <animate attributeName="cy" values={`${H - 60};120`}
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.55;0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* ── Top banner ── */}
      <g transform={`translate(${cx} 108)`} textAnchor="middle">
        <line x1="-240" y1="0" x2="-100" y2="0" stroke={G} strokeWidth="1" strokeOpacity="0.5" />
        <line x1="100"  y1="0" x2="240"  y2="0" stroke={G} strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="-88" cy="0" r="2.5" fill={G} fillOpacity="0.6" />
        <circle cx="88"  cy="0" r="2.5" fill={G} fillOpacity="0.6" />
        <text fontFamily="Cinzel,Georgia,serif" fontSize="32" fill={GL}
              fillOpacity="0.85" letterSpacing="12">CASINO NOIR</text>
      </g>

      {/* ── Bottom banner ── */}
      <g transform={`translate(${cx} ${H - 78})`} textAnchor="middle">
        <line x1="-180" y1="0" x2="-70" y2="0" stroke={G} strokeWidth="0.8" strokeOpacity="0.4" />
        <line x1="70"   y1="0" x2="180"  y2="0" stroke={G} strokeWidth="0.8" strokeOpacity="0.4" />
        <text fontFamily="Cinzel,Georgia,serif" fontSize="21" fill={G}
              fillOpacity="0.6" letterSpacing="8">MONTE-CARLO</text>
      </g>
    </svg>
  );
}
