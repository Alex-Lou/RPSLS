import { W, H } from "./dims";

/* Ink — Sumi-e calligraphy.
   Warm bone paper background with fibre texture, 3 brush strokes that
   write themselves and slowly dry (fade out), a red seal in the bottom
   right corner, faint corner ageing. LIGHT scene. */

const PAPER = "#f5f0e8";
const PAPER_DARK = "#e8e0d2";
const INK   = "#1a1a1a";
const INK_FAINT = "#8c8c8c";
const SEAL  = "#cc1f1f";

export function InkPad({ compact = false, ...props }: React.SVGProps<SVGSVGElement> & { compact?: boolean }) {
  return (
    <svg {...props}>
      <defs>
        <filter id="ip-paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="3.5" numOctaves="2" seed="11" />
          <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.50  0 0 0 0 0.42  0 0 0 0.10 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="ip-bleed" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <radialGradient id="ip-bg" cx="50%" cy="40%" r="80%">
          <stop offset="0%"  stopColor={PAPER} />
          <stop offset="100%" stopColor={PAPER_DARK} />
        </radialGradient>
      </defs>

      {/* Paper base */}
      <rect width={W} height={H} fill="url(#ip-bg)" />

      {/* Paper grain (turbulence) overlay */}
      <rect width={W} height={H} filter="url(#ip-paper)" opacity="0.6" />

      {/* Paper fibres — long shallow horizontal lines */}
      <g stroke={INK_FAINT} strokeOpacity="0.08" strokeWidth="0.7">
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 64 + 20} x2={W} y2={i * 64 + 28} />
        ))}
      </g>

      {/* ── BRUSH STROKES — 3 strokes that draw themselves L→R then fade ──
            Each stroke uses stroke-dashoffset trick for the "writing" effect
            and decreasing opacity for the "drying" effect. */}
      <g>
        {/* Stroke 1 — broad sweep across the upper third */}
        <g>
          {/* Ink bleed halo behind the stroke */}
          <path d="M 200 280 Q 500 260 800 320 T 1300 290"
                fill="none" stroke={INK} strokeWidth="46" strokeLinecap="round"
                opacity="0.25" filter="url(#ip-bleed)"
                strokeDasharray="1300" strokeDashoffset="1300">
            <animate attributeName="stroke-dashoffset" values="1300;0;0;0;1300"
                     keyTimes="0;0.18;0.55;0.88;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.25;0.18;0;0"
                     keyTimes="0;0.20;0.65;0.95;1" dur="11s" repeatCount="indefinite" />
          </path>
          {/* Main stroke */}
          <path d="M 200 280 Q 500 260 800 320 T 1300 290"
                fill="none" stroke={INK} strokeWidth="28" strokeLinecap="round"
                strokeDasharray="1300" strokeDashoffset="1300">
            <animate attributeName="stroke-dashoffset" values="1300;0;0;0;1300"
                     keyTimes="0;0.18;0.55;0.88;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.95;0.78;0.0;0"
                     keyTimes="0;0.20;0.65;0.95;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="stroke-width" values="32;24;18"
                     keyTimes="0;0.55;1" dur="11s" repeatCount="indefinite" />
          </path>
        </g>

        {/* Stroke 2 — diagonal sweep middle */}
        <g>
          <path d="M 280 600 Q 700 480 1100 580"
                fill="none" stroke={INK} strokeWidth="34" strokeLinecap="round"
                opacity="0.22" filter="url(#ip-bleed)"
                strokeDasharray="900" strokeDashoffset="900">
            <animate attributeName="stroke-dashoffset" values="900;900;0;0;0;900"
                     keyTimes="0;0.30;0.50;0.78;0.97;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;0.22;0.16;0;0"
                     keyTimes="0;0.30;0.52;0.78;0.97;1" dur="11s" repeatCount="indefinite" />
          </path>
          <path d="M 280 600 Q 700 480 1100 580"
                fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round"
                strokeDasharray="900" strokeDashoffset="900">
            <animate attributeName="stroke-dashoffset" values="900;900;0;0;0;900"
                     keyTimes="0;0.30;0.50;0.78;0.97;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;0.92;0.72;0;0"
                     keyTimes="0;0.30;0.52;0.78;0.97;1" dur="11s" repeatCount="indefinite" />
          </path>
        </g>

        {/* Stroke 3 — short accent stroke (a single character mark) */}
        <g>
          <path d="M 850 780 Q 920 720 990 790 T 1100 800"
                fill="none" stroke={INK} strokeWidth="22" strokeLinecap="round"
                opacity="0.20" filter="url(#ip-bleed)"
                strokeDasharray="350" strokeDashoffset="350">
            <animate attributeName="stroke-dashoffset" values="350;350;350;0;0;350"
                     keyTimes="0;0.45;0.65;0.78;0.97;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;0;0.20;0;0"
                     keyTimes="0;0.45;0.65;0.80;0.97;1" dur="11s" repeatCount="indefinite" />
          </path>
          <path d="M 850 780 Q 920 720 990 790 T 1100 800"
                fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round"
                strokeDasharray="350" strokeDashoffset="350">
            <animate attributeName="stroke-dashoffset" values="350;350;350;0;0;350"
                     keyTimes="0;0.45;0.65;0.78;0.97;1" dur="11s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;0;0.90;0;0"
                     keyTimes="0;0.45;0.65;0.80;0.97;1" dur="11s" repeatCount="indefinite" />
          </path>
        </g>
      </g>

      {/* ── CENTRAL ENSO CIRCLE — a hand-drawn zen circle ──
            A nearly-closed circle, slightly imperfect, in faint dry ink. */}
      {!compact && (
        <g transform={`translate(${W/2} ${H/2})`}>
          <path d="M 150 -40 A 180 180 0 1 1 -130 -120"
                fill="none" stroke={INK} strokeWidth="14" strokeOpacity="0.32"
                strokeLinecap="round" />
          {/* Tiny brush splash at the end */}
          <circle cx="-130" cy="-120" r="6" fill={INK} opacity="0.45" />
        </g>
      )}

      {/* ── RED SEAL (bottom-right) — the artist's signature ── */}
      <g transform={`translate(${W - 200} ${H - 160})`}>
        <rect x="-55" y="-55" width="110" height="110" rx="6"
              fill={SEAL} opacity="0.92" />
        {/* Glyph: two horizontal strokes + a vertical (resemble 印) */}
        <line x1="-30" y1="-25" x2="30" y2="-25" stroke={PAPER} strokeWidth="6" />
        <line x1="-30" y1="0" x2="30" y2="0" stroke={PAPER} strokeWidth="6" />
        <line x1="-30" y1="25" x2="30" y2="25" stroke={PAPER} strokeWidth="6" />
        <line x1="0" y1="-40" x2="0" y2="40" stroke={PAPER} strokeWidth="6" />
        {/* Subtle texture noise inside the seal */}
        <rect x="-55" y="-55" width="110" height="110" rx="6"
              fill="none" stroke={PAPER} strokeOpacity="0.20" strokeWidth="2" strokeDasharray="2 3" />
      </g>

      {/* Corner ageing — slight darker patches */}
      <g fill={PAPER_DARK} opacity="0.40">
        <ellipse cx="80" cy="80" rx="180" ry="120" />
        <ellipse cx={W - 80} cy="80" rx="160" ry="100" />
        <ellipse cx="80" cy={H - 80} rx="170" ry="110" />
      </g>

      {/* Frame — single thin ink line */}
      <rect x="42" y="42" width={W - 84} height={H - 84} rx="0"
            fill="none" stroke={INK} strokeOpacity="0.30" strokeWidth="1.2" />

      {/* Title */}
      <g transform={`translate(${W/2} 115)`} textAnchor="middle">
        <text fontFamily='"EB Garamond","Cormorant Garamond",serif' fontStyle="italic"
              fontSize="22" fill={INK} fillOpacity="0.55" letterSpacing="10">
          🖋 Sumi-e
        </text>
      </g>
    </svg>
  );
}
