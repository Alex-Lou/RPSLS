/** QuartzBackdrop — premium SVG/SMIL "mineral" backdrop. Prismatic shards,
 *  procedural hex lattice, spectral rainbow sweep, periodic crystal growth
 *  events. Single WebGL context is reserved for the splash; SMIL pauses
 *  cleanly when hidden. */

import { useEffect, useRef } from "react";
import { QuartzInteractiveLayer } from "./QuartzInteractiveLayer";

/** Prismatic palette + warm gold accents so the canvas reads as luxurious
 *  matter, not a frozen synthetic grid. The cool stops carry the depth; the
 *  warm stops are reserved for fracture traces and one drifting halo so the
 *  composition gains a "lit-from-within" quality. */
const STOPS = {
  ice: "#dbe7ff",        // pale azure
  lavender: "#c8aef0",
  blush: "#f0c2dd",
  warmRose: "#f6a5b8",
  deep: "#4b3a72",       // anchor shadow
  glow: "#fde9ff",       // highlight
  gold: "#fbcf80",       // warm amber accent
  softGold: "#ffeed1",   // gold whisper for fracture interiors
} as const;

/** Twelve crystal shards at fixed positions, three size-tiers (foreground,
 *  mid, background) so the canvas reads as a layered crystal CLUSTER instead
 *  of six floating decals. Positions hand-tuned, not random — each shard sits
 *  in a deliberate composition triangle that doesn't crowd the HUD. */
const SHARDS: Array<{ cx: number; cy: number; size: number; rot: number; delay: number }> = [
  // Foreground hero shards — large, focal.
  { cx: 50, cy: 50, size: 38, rot: 8,   delay: 0.8 },
  { cx: 88, cy: 72, size: 30, rot: -38, delay: 2.6 },
  { cx: 18, cy: 22, size: 26, rot: -14, delay: 0 },
  // Mid layer — supporting crystals.
  { cx: 78, cy: 16, size: 22, rot: 22,  delay: 1.4 },
  { cx: 12, cy: 78, size: 24, rot: 18,  delay: 3.4 },
  { cx: 64, cy: 38, size: 18, rot: -22, delay: 4.0 },
  // Background bed — small crystals, far-field, denser refraction.
  { cx: 32, cy: 12, size: 14, rot: 11,  delay: 2.0 },
  { cx: 92, cy: 30, size: 12, rot: -8,  delay: 5.1 },
  { cx: 4,  cy: 50, size: 13, rot: 36,  delay: 6.0 },
  { cx: 40, cy: 88, size: 14, rot: -28, delay: 4.4 },
  { cx: 70, cy: 92, size: 12, rot: 17,  delay: 5.5 },
  { cx: 26, cy: 60, size: 11, rot: -45, delay: 3.0 },
];

/** Four "growth seed" positions where a crystal periodically GROWS from a
 *  spark of light. Staggered so the canvas always has one forming. */
const SEEDS: Array<{ cx: number; cy: number; rot: number; begin: number }> = [
  { cx: 35, cy: 40, rot: 18,  begin: 0 },
  { cx: 60, cy: 70, rot: -22, begin: 8 },
  { cx: 80, cy: 50, rot: 35,  begin: 16 },
  { cx: 22, cy: 88, rot: -10, begin: 24 },
];

/** Bokeh blobs (8) and lattice trace lines (5) — extracted as consts so the
 *  JSX stays compact and the layout intent is readable. */
const BOKEH = [
  [15, 30, 28, 6, 32], [70, 22, 22, -4, 38], [88, 60, 26, 5, 30], [32, 78, 30, -6, 36],
  [56, 44, 18, 7, 28], [22, 55, 16, -5, 42], [78, 84, 20, 4, 34], [6, 8, 14, 3, 40],
] as const;
const FRACTURES = [
  [0, 40, 100, 0.4, -8,  9,  0],
  [0, 64, 100, 0.5, 14,  12, 1.6],
  [0, 28, 100, 0.3, -22, 11, 3.2],
] as const;
const LATTICE = [
  [0, 14, 100, 22, 13, 0],
  [100, 36, 0, 48, 16, 2.4],
  [0, 58, 100, 66, 14, 4.8],
  [100, 78, 0, 86, 17, 7.0],
  [20, 0, 28, 100, 19, 1.6],
] as const;

export function QuartzBackdrop() {
  const ref = useRef<SVGSVGElement | null>(null);

  // Slow-pause when the tab is hidden — matches the project-wide pattern of
  // pausing SMIL off-screen to spare phone battery.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onVis = () => {
      if (document.hidden) el.pauseAnimations();
      else el.unpauseAnimations();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <defs>
        {/* Pearl base — soft warm-cool wash. */}
        <radialGradient id="qz-base" cx="50%" cy="48%" r="70%">
          <stop offset="0%"  stopColor={STOPS.glow} stopOpacity="0.9" />
          <stop offset="40%" stopColor={STOPS.blush} stopOpacity="0.55" />
          <stop offset="80%" stopColor={STOPS.lavender} stopOpacity="0.6" />
          <stop offset="100%" stopColor={STOPS.deep} stopOpacity="0.95" />
        </radialGradient>

        {/* Crystal gradient — sharp highlight at the top, deep at the base. */}
        <linearGradient id="qz-shard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={STOPS.glow} stopOpacity="0.95" />
          <stop offset="35%" stopColor={STOPS.ice} stopOpacity="0.7" />
          <stop offset="70%" stopColor={STOPS.lavender} stopOpacity="0.55" />
          <stop offset="100%" stopColor={STOPS.deep} stopOpacity="0.85" />
        </linearGradient>

        {/* Inner facet — slimmer, brighter — sells the refraction. */}
        <linearGradient id="qz-facet" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="50%" stopColor={STOPS.blush} stopOpacity="0.3" />
          <stop offset="100%" stopColor={STOPS.warmRose} stopOpacity="0.1" />
        </linearGradient>

        {/* The shard shape — hexagonal sliver tip-up. Reused via <use>. */}
        <symbol id="qz-shape" viewBox="-10 -16 20 32">
          <path d="M 0 -16 L 7 -6 L 6 12 L -6 12 L -7 -6 Z" fill="url(#qz-shard)" />
          <path d="M 0 -14 L 4 -6 L 3 10 L -3 10 L -4 -6 Z" fill="url(#qz-facet)" />
        </symbol>

        {/* Prism streak — diagonal band of refracted colour. */}
        <linearGradient id="qz-prism" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%"   stopColor="#a0d4ff" stopOpacity="0" />
          <stop offset="40%"  stopColor="#c8aef0" stopOpacity="0.35" />
          <stop offset="60%"  stopColor="#f6a5b8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffe2a0" stopOpacity="0" />
        </linearGradient>

        {/* Warm drifting halo — the centre of "lit-from-within". */}
        <radialGradient id="qz-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={STOPS.softGold} stopOpacity="0.7" />
          <stop offset="40%"  stopColor={STOPS.gold} stopOpacity="0.35" />
          <stop offset="100%" stopColor={STOPS.gold} stopOpacity="0" />
        </radialGradient>

        {/* Soft bokeh blob — used 8× at varied positions for depth behind shards. */}
        <radialGradient id="qz-bokeh" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={STOPS.glow} stopOpacity="0.45" />
          <stop offset="60%" stopColor={STOPS.lavender} stopOpacity="0.15" />
          <stop offset="100%" stopColor={STOPS.lavender} stopOpacity="0" />
        </radialGradient>

        {/* Fracture trace — sells matter cracked by inner light. */}
        <linearGradient id="qz-fracture" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={STOPS.softGold} stopOpacity="0" />
          <stop offset="50%"  stopColor={STOPS.softGold} stopOpacity="0.9" />
          <stop offset="100%" stopColor={STOPS.softGold} stopOpacity="0" />
        </linearGradient>

        {/* Spectral rainbow band — full prism dispersion across a swept arc.
            Used for a slow refraction rainbow that paints across the canvas
            when light passes through the central crystal cluster. */}
        <linearGradient id="qz-spectrum" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#ff5577" stopOpacity="0" />
          <stop offset="15%" stopColor="#ff8a55" stopOpacity="0.35" />
          <stop offset="30%" stopColor="#ffd96a" stopOpacity="0.45" />
          <stop offset="45%" stopColor="#9fea8b" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#7fcfff" stopOpacity="0.40" />
          <stop offset="75%" stopColor="#b487f0" stopOpacity="0.40" />
          <stop offset="90%" stopColor="#e0a8ff" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Caustic ring — bright ring of refracted light, used as halo
            around a growing crystal "birth" event. */}
        <radialGradient id="qz-caustic" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={STOPS.glow} stopOpacity="0" />
          <stop offset="48%" stopColor={STOPS.glow} stopOpacity="0.0" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="65%" stopColor={STOPS.warmRose} stopOpacity="0.35" />
          <stop offset="100%" stopColor={STOPS.warmRose} stopOpacity="0" />
        </radialGradient>

        {/* Mineral vein — interior crystalline lattice traces. */}
        <linearGradient id="qz-lattice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={STOPS.glow} stopOpacity="0.4" />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor={STOPS.lavender} stopOpacity="0.4" />
        </linearGradient>

        {/* Twin-color facet — pink/blue dichroism for premium "spectrolite" feel. */}
        <linearGradient id="qz-dichroic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#a0d4ff" stopOpacity="0.55" />
          <stop offset="50%" stopColor={STOPS.glow} stopOpacity="0.9" />
          <stop offset="100%" stopColor={STOPS.warmRose} stopOpacity="0.55" />
        </linearGradient>

        {/* Hex lattice prism — used as overlay weave to add procedural
            crystalline grain across the entire canvas. */}
        <pattern id="qz-hex" x="0" y="0" width="14" height="12" patternUnits="userSpaceOnUse">
          <path d="M 7 0 L 14 4 L 14 12 L 7 16 L 0 12 L 0 4 Z"
                fill="none" stroke={STOPS.glow} strokeOpacity="0.06" strokeWidth="0.15" />
        </pattern>
      </defs>

      {/* Base wash. */}
      <rect width="100" height="100" fill="url(#qz-base)" />

      {/* Layer A — depth bokeh: 8 soft blobs parallax behind shards. */}
      <g opacity="0.7">
        {BOKEH.map(([cx, cy, r, dx, dur], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="url(#qz-bokeh)">
            <animate attributeName="cx" values={`${cx};${cx + dx};${cx}`}
              dur={`${dur}s`} repeatCount="indefinite" />
            <animate attributeName="r" values={`${r};${r * 1.15};${r}`}
              dur={`${dur * 0.8}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>

      {/* Layer B — one warm halo that drifts in a slow ellipse: the "lit from
          within" centre. Big radius + soft gold = injects matter + warmth
          against the cool base. */}
      <g transform="translate(50 50)">
        <ellipse rx="40" ry="32" fill="url(#qz-warm)" opacity="0.85">
          <animateTransform attributeName="transform" type="translate"
            values="-8 -4; 10 6; -8 -4" dur="22s" repeatCount="indefinite" />
          <animate attributeName="rx" values="40;46;40" dur="14s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Layer C — 3 hairline fractures pulse like veins of fire inside ice. */}
      {FRACTURES.map(([x, y, w, h, rot, dur, delay], i) => (
        <g key={i} transform={`rotate(${rot} 50 50)`}>
          <rect x={x} y={y} width={w} height={h} fill="url(#qz-fracture)">
            <animate attributeName="opacity" values="0.0;0.85;0.0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </rect>
        </g>
      ))}

      {/* Two slow prismatic streaks crossing — pure SMIL, no JS. */}
      <g opacity="0.65">
        <rect x="-40" y="32" width="180" height="14" fill="url(#qz-prism)" transform="rotate(-12 50 50)">
          <animateTransform attributeName="transform" type="translate"
            values="-30 0; 30 0; -30 0" dur="22s" repeatCount="indefinite" />
        </rect>
        <rect x="-40" y="62" width="180" height="10" fill="url(#qz-prism)" transform="rotate(8 50 50)">
          <animateTransform attributeName="transform" type="translate"
            values="30 0; -30 0; 30 0" dur="28s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* Slow SPECTRAL RAINBOW SWEEP — full prism band passes across the canvas
          every 18s, rotating slightly each pass. The single most "luxury"
          read of the scene. */}
      <g opacity="0.55">
        <rect x="-60" y="44" width="220" height="4" fill="url(#qz-spectrum)"
              transform="rotate(-18 50 50)">
          <animateTransform attributeName="transform" type="translate"
            values="-40 0; 40 0; -40 0" dur="18s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0; 0.7; 0.7; 0"
            keyTimes="0; 0.25; 0.75; 1" dur="18s" repeatCount="indefinite" />
        </rect>
        <rect x="-60" y="52" width="220" height="3" fill="url(#qz-spectrum)"
              transform="rotate(-18 50 50)" opacity="0.55">
          <animateTransform attributeName="transform" type="translate"
            values="-44 0; 44 0; -44 0" dur="18s" begin="0.4s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* PROCEDURAL HEX LATTICE OVERLAY — full-canvas pattern wash. The pattern
          itself is static, but a slow translate + opacity breath sells matter
          on a finer scale than shards alone could. */}
      <g opacity="0.6">
        <rect x="-10" y="-10" width="120" height="120" fill="url(#qz-hex)">
          <animateTransform attributeName="transform" type="translate"
            values="0 0; 7 -5; 0 0" dur="44s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.45; 0.7; 0.45"
            dur="14s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* INNER LATTICE TRACES — 5 diagonal pulse lines sell "matter glowing
          from within" without filters. */}
      <g opacity="0.65">
        {LATTICE.map(([x1, y1, x2, y2, dur, delay], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="url(#qz-lattice)" strokeWidth="0.25" strokeOpacity="0">
            <animate attributeName="stroke-opacity" values="0; 0.6; 0"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </line>
        ))}
      </g>

      {/* The six crystal shards. Each grows from a seed (scale 0 → 1), then
          rotates very slowly + breathes in scale — the impression is of
          living crystal, not static decals. */}
      {SHARDS.map((s, i) => (
        <g key={i} transform={`translate(${s.cx} ${s.cy}) rotate(${s.rot})`}>
          <g opacity="0">
            <animate attributeName="opacity" values="0; 0.95; 0.85; 0.95" keyTimes="0; 0.25; 0.7; 1"
              dur={`${14 + i * 0.7}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="rotate"
              values="-6; 6; -6" dur={`${24 + i * 2}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
            <use href="#qz-shape" width={s.size} height={s.size * 1.6}
              x={-s.size / 2} y={-s.size * 0.8}>
              <animate attributeName="opacity" values="0.0; 1.0; 0.92; 1.0"
                dur={`${14 + i * 0.7}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
            </use>
            {/* Inner shimmer highlight scanning down the shard. */}
            <line x1={-s.size * 0.4} y1={-s.size * 0.7} x2={s.size * 0.4} y2={-s.size * 0.7}
              stroke="#ffffff" strokeWidth="0.4" strokeLinecap="round" opacity="0.7">
              <animate attributeName="y1" values={`${-s.size * 0.7};${s.size * 0.6};${-s.size * 0.7}`}
                dur={`${8 + i}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
              <animate attributeName="y2" values={`${-s.size * 0.7};${s.size * 0.6};${-s.size * 0.7}`}
                dur={`${8 + i}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.8;0" dur={`${8 + i}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
            </line>
          </g>
        </g>
      ))}

      {/* GROWING CRYSTAL SEEDS — every ~32s a new crystal grows from a seed
          point with a caustic flash, 4 seeds staggered 8s. */}
      {SEEDS.map((s, i) => (
        <g key={`seed-${i}`} transform={`translate(${s.cx} ${s.cy})`}>
          <circle r="3" fill="url(#qz-caustic)" opacity="0">
            <animate attributeName="r" values="2; 22; 30" keyTimes="0; 0.4; 1"
              dur="6s" begin={`${s.begin}s; 32s; 64s; 96s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0; 0.95; 0" keyTimes="0; 0.3; 1"
              dur="6s" begin={`${s.begin}s; 32s; 64s; 96s`} repeatCount="indefinite" />
          </circle>
          <g transform={`rotate(${s.rot})`} opacity="0">
            <use href="#qz-shape" width="16" height="26" x="-8" y="-13" />
            <animateTransform attributeName="transform" type="scale"
              values="0; 0.15; 1.05; 1; 1; 0" keyTimes="0; 0.15; 0.32; 0.5; 0.9; 1"
              dur="32s" begin={`${s.begin}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0; 1; 1; 1; 0"
              keyTimes="0; 0.15; 0.5; 0.9; 1" dur="32s"
              begin={`${s.begin}s`} repeatCount="indefinite" />
          </g>
          {/* 12 radial dichroic prism sparks at peak growth. */}
          {Array.from({ length: 12 }).map((_, j) => {
            const ang = (j / 12) * Math.PI * 2;
            return (
              <line key={j} x1="0" y1="0"
                x2={Math.cos(ang) * 8} y2={Math.sin(ang) * 8}
                stroke="url(#qz-dichroic)" strokeWidth="0.4"
                strokeOpacity="0" strokeLinecap="round">
                <animate attributeName="stroke-opacity" values="0; 0.9; 0"
                  keyTimes="0; 0.05; 0.18" dur="32s"
                  begin={`${s.begin + 1.6}s`} repeatCount="indefinite" />
              </line>
            );
          })}
        </g>
      ))}

      {/* Layered drifting motes — denser pass (16) with mixed white + gold
          tones so the air reads as alive instead of vacuum. */}
      <g opacity="0.65">
        {Array.from({ length: 16 }).map((_, i) => {
          const x = 4 + i * 6 + (i % 3);
          const dur = 16 + (i % 5) * 4;
          const r = 0.45 + ((i * 7) % 5) * 0.18;
          const tone = i % 4 === 0 ? STOPS.gold : i % 3 === 0 ? STOPS.softGold : "#ffffff";
          return (
            <circle key={i} cx={x} cy="110" r={r} fill={tone}>
              <animate attributeName="cy" values="110;-10"
                dur={`${dur}s`} begin={`${i * 0.7}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.85;0"
                dur={`${dur}s`} begin={`${i * 0.7}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>

      {/* Edge vignette — soft dim toward the corners so the HUD stays legible
          regardless of which crystal a shard is sitting under. */}
      <radialGradient id="qz-vignette" cx="50%" cy="50%" r="75%">
        <stop offset="60%"  stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
      </radialGradient>
      <rect width="100" height="100" fill="url(#qz-vignette)" />
    </svg>
  );
}

/** Self-positioning wrapper: renders the SVG fill + the optional interactive
 *  layer in a relative container. Used by App.tsx to keep the layer pinned
 *  to the backdrop region (not the whole window). */
export function QuartzBackdropWithLayer({ interactive = false }: { interactive?: boolean }) {
  return (
    <div className="absolute inset-0">
      <QuartzBackdrop />
      <QuartzInteractiveLayer enabled={interactive} />
    </div>
  );
}
