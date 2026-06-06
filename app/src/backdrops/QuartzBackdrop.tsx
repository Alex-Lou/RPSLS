/**
 * QuartzBackdrop — premium animated background, SVG/SMIL only.
 *
 * Distinct from every other backdrop in the app (no nebula, no neon grid, no
 * lava). The aesthetic is **mineral**: prismatic shards that grow + slowly
 * rotate, faint refraction streaks washing across, a soft pearlescent base.
 * Cool pastels (lavender + blush + ice) — meant to read as glacial luxury.
 *
 * SVG/SMIL chosen over WebGL deliberately:
 *   1. The app already runs ONE WebGL context (SplashShader) — adding another
 *      would crash mid-range GPUs.
 *   2. SMIL pauses cleanly when the tab is hidden + when paired with the
 *      offscreen-pause hook, costing zero battery off-view.
 *   3. The pad set (also Quartz) uses the same primitives, so the pieces
 *      feel of-a-piece.
 */

import { useEffect, useRef } from "react";

/** Cool prismatic palette — not interchangeable with existing themes. */
const STOPS = {
  ice: "#dbe7ff",      // pale azure
  lavender: "#c8aef0",
  blush: "#f0c2dd",
  warmRose: "#f6a5b8",
  deep: "#4b3a72",     // anchor shadow
  glow: "#fde9ff",     // highlight
} as const;

/** Six crystal shards at fixed positions — count picked so the canvas stays
 *  composed (not a noise field). Positions hand-tuned, not random. */
const SHARDS: Array<{ cx: number; cy: number; size: number; rot: number; delay: number }> = [
  { cx: 18, cy: 22, size: 26, rot: -14, delay: 0 },
  { cx: 78, cy: 16, size: 22, rot: 22,  delay: 1.4 },
  { cx: 88, cy: 72, size: 30, rot: -38, delay: 2.6 },
  { cx: 12, cy: 78, size: 24, rot: 18,  delay: 3.4 },
  { cx: 50, cy: 50, size: 38, rot: 8,   delay: 0.8 },
  { cx: 64, cy: 38, size: 18, rot: -22, delay: 4.0 },
];

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
      </defs>

      {/* Base wash. */}
      <rect width="100" height="100" fill="url(#qz-base)" />

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

      {/* Soft dust motes drifting up — kept sparse so they read as light,
          not as snow. Eight motes total, randomised periods, looping forever. */}
      <g opacity="0.55">
        {Array.from({ length: 8 }).map((_, i) => {
          const x = 8 + i * 11;
          const dur = 18 + (i % 4) * 5;
          return (
            <circle key={i} cx={x} cy="110" r="0.7" fill="#ffffff">
              <animate attributeName="cy" values="110;-10" dur={`${dur}s`} begin={`${i * 1.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.9;0" dur={`${dur}s`} begin={`${i * 1.4}s`} repeatCount="indefinite" />
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
