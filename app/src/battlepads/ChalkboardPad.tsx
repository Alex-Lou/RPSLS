import { W, H } from "./dims";

/* ════════════════════ Chalkboard ════════════════════
   Lab blackboard: chalky frame, scattered equations & doodles
   along the perimeter, empty centre for content.
*/

export function ChalkboardPad(props: React.SVGProps<SVGSVGElement>) {
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
