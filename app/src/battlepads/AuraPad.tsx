import { W, H } from "./dims";

/* ════════════════════ Aura ════════════════════
   Theme-reactive playmat: instead of a fixed palette, every colour is driven
   by the live `--theme-primary` / `--theme-secondary` CSS variables, so the
   board automatically dresses itself in whatever theme/background the player
   (or a coin-flipped arena) is running — nebula, holy, casino, any of the 12
   HUD palettes. Distinct shapes (orbital rings, aurora blobs, a flowing
   lattice) keep it recognisable, while a deliberately dark centre vignette
   keeps the lane cards perfectly readable.

   Colours are applied via `style={{ ... }}` (CSS) rather than SVG
   presentation attributes so `var(--theme-*)` resolves reliably in the
   Android WebView.
*/

const P = "var(--theme-primary, #7c5cff)";
const S = "var(--theme-secondary, #2dd4bf)";

export function AuraPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  // Deterministic faint star/mote field for texture (theme-neutral white).
  const motes = (() => {
    const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
    let seed = 99;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 0xffffffff;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 150; i++) {
      pts.push({ x: rng() * W, y: rng() * H, r: 0.5 + rng() * 1.4, o: 0.18 + rng() * 0.4 });
    }
    return pts;
  })();

  return (
    <svg {...props}>
      <defs>
        {/* Base vignette — dark core (for card legibility) tinted toward the
            theme primary at the edges. */}
        <radialGradient id="au-bg" cx="50%" cy="48%" r="75%">
          <stop offset="0%"  stopColor="#05070d" />
          <stop offset="55%" stopColor="#070912" />
          <stop offset="100%" style={{ stopColor: P, stopOpacity: 0.22 }} />
        </radialGradient>
        {/* Two aurora blobs in the theme colours, opposite corners. */}
        <radialGradient id="au-blobA" cx="18%" cy="20%" r="42%">
          <stop offset="0%"  style={{ stopColor: P, stopOpacity: 0.38 }} />
          <stop offset="100%" style={{ stopColor: P, stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id="au-blobB" cx="84%" cy="82%" r="42%">
          <stop offset="0%"  style={{ stopColor: S, stopOpacity: 0.34 }} />
          <stop offset="100%" style={{ stopColor: S, stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id="au-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="45%" style={{ stopColor: P, stopOpacity: 0.6 }} />
          <stop offset="100%" style={{ stopColor: S, stopOpacity: 0 }} />
        </radialGradient>
        <filter id="au-soft"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#au-bg)" />
      <rect width={W} height={H} fill="url(#au-blobA)" />
      <rect width={W} height={H} fill="url(#au-blobB)" />

      {/* Faint mote field. */}
      <g fill="#ffffff">
        {motes.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.r} fillOpacity={m.o}>
            {i % 8 === 0 && (
              <animate attributeName="fill-opacity"
                values={`${m.o};${m.o * 0.3};${m.o}`}
                dur={`${3 + (i % 5) * 0.6}s`} begin={`${(i % 6) * 0.5}s`}
                repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </g>

      {/* Flowing lattice — two slow counter-rotating ring sets in theme hues,
          parked toward the perimeter so the centre stays clear. */}
      <g style={{ stroke: P }} fill="none" strokeOpacity="0.22">
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <ellipse rx="640" ry="300" strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate"
              from="0" to="360" dur="60s" repeatCount="indefinite" />
          </ellipse>
        </g>
      </g>
      <g style={{ stroke: S }} fill="none" strokeOpacity="0.20">
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <ellipse rx="560" ry="380" strokeWidth="2">
            <animateTransform attributeName="transform" type="rotate"
              from="360" to="0" dur="78s" repeatCount="indefinite" />
          </ellipse>
        </g>
      </g>

      {/* Corner flourishes — soft arcs echoing the theme accents. */}
      <g fill="none" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.5">
        <path d="M 70 230 Q 70 70 230 70" style={{ stroke: P }} />
        <path d={`M ${W - 70} ${H - 230} Q ${W - 70} ${H - 70} ${W - 230} ${H - 70}`} style={{ stroke: S }} />
        <path d={`M ${W - 70} 230 Q ${W - 70} 70 ${W - 230} 70`} style={{ stroke: S }} strokeOpacity="0.35" />
        <path d={`M 70 ${H - 230} Q 70 ${H - 70} 230 ${H - 70}`} style={{ stroke: P }} strokeOpacity="0.35" />
      </g>

      {/* Frame in the theme primary. */}
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="26"
            fill="none" style={{ stroke: P }} strokeOpacity="0.3" strokeWidth="2" />

      {/* Breathing centre glow — kept subtle so cards stay readable. */}
      <g transform={`translate(${W / 2} ${H / 2})`}>
        <circle r="120" fill="url(#au-core)" filter="url(#au-soft)" opacity="0.25">
          <animate attributeName="opacity" values="0.14;0.30;0.14" dur="4.6s" repeatCount="indefinite" />
          <animate attributeName="r" values="100;140;100" dur="4.6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Orbiting motes around the centre — suppressed in compact (backdrop)
          mode so they never drift across the lane cards. */}
      {!compact && (
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <g>
            <animateTransform attributeName="transform" type="rotate"
              from="0" to="360" dur="14s" repeatCount="indefinite" />
            <circle cx="300" cy="0" r="8" style={{ fill: P }} />
          </g>
          <g>
            <animateTransform attributeName="transform" type="rotate"
              from="120" to="480" dur="19s" repeatCount="indefinite" />
            <circle cx="360" cy="0" r="7" style={{ fill: S }} />
          </g>
          <g>
            <animateTransform attributeName="transform" type="rotate"
              from="240" to="600" dur="24s" repeatCount="indefinite" />
            <circle cx="240" cy="0" r="6" fill="#ffffff" fillOpacity="0.7" />
          </g>
        </g>
      )}
    </svg>
  );
}
