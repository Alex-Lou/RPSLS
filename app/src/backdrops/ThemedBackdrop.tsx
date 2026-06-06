import { useEffect, useRef } from "react";

/**
 * ThemedBackdrop — live, hand-coded animated backgrounds on a full-screen
 * WebGL canvas. This is the ONLY background system now (the old PNG themes
 * were retired); the player either picks a coded scene or supplies their
 * own image via the "Custom" option.
 *
 * Perf guards (so it never janks or drains the phone):
 *  - ONE full-screen triangle, one fragment shader. No geometry/textures.
 *  - devicePixelRatio capped at 1.5.
 *  - rAF PAUSES when the app is backgrounded (visibilitychange).
 *  - ~40fps timestamp gate keeps low-end GPUs cool.
 *  - Silent CSS fallback if WebGL is unavailable.
 *
 * Scenes switch on a cheap `u_scene` int branch. All glows are soft
 * gaussians (no hard white pixels) and animation is continuous + smooth.
 */

export type BackdropScene =
  | "nebula" | "aurora" | "grid" | "galaxy" | "holy" | "quantum" | "casino";

export const BACKDROP_META: Record<BackdropScene, { label: string; emoji: string; accent: { from: string; to: string } }> = {
  nebula:  { label: "Nebula",        emoji: "🌌", accent: { from: "#a855f7", to: "#22d3ee" } },
  aurora:  { label: "Aurora",        emoji: "🌠", accent: { from: "#34d399", to: "#8b5cf6" } },
  grid:    { label: "Neon Grid",     emoji: "🌐", accent: { from: "#06b6d4", to: "#f0abfc" } },
  galaxy:  { label: "Galaxy",        emoji: "✨", accent: { from: "#a855f7", to: "#22d3ee" } },
  holy:    { label: "Holy",          emoji: "✝️", accent: { from: "#fbbf24", to: "#6366f1" } },
  quantum: { label: "Quantum",       emoji: "⚛️", accent: { from: "#22d3ee", to: "#3b82f6" } },
  casino:  { label: "Casino Royale", emoji: "🎰", accent: { from: "#10b981", to: "#f5c543" } },
};

const SCENE_INDEX: Record<BackdropScene, number> = {
  nebula: 0, aurora: 1, grid: 2, galaxy: 3, holy: 4, quantum: 5, casino: 6,
};

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform int   u_scene;
uniform vec2  u_touch;     // last touch position, GL coords (y up), in px
uniform float u_touchAge;  // seconds since the last tap → fades the ripple
uniform float u_hold;      // eased press duration 0..~1.2 (0 = released)

const float PI = 3.14159265;

// Hash de Hoskins (hash21) — STABLE en précision mobile (Adreno/Mali). Le
// classique fract(p.x*p.y) perd des bits sur GPU mobile et bande en blocs ;
// celui-ci reste en petites magnitudes (vec3 * 0.1031) -> pas de banding.
float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  // Interpolation QUINTIQUE (C2, dérivée seconde continue) au lieu du cubic
  // smoothstep — supprime le banding de grille du value-noise.
  vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}
// ROTATION DE DOMAINE entre octaves : sans elle, chaque octave s'aligne sur la
// même grille d'axes et, animées, elles s'empilent en "carrés qui bougent".
// La rotation décorrèle les grilles → rendu liquide, sans artefact de bloc.
float fbm(vec2 p){
  float v=0.0, a=0.5;
  mat2 m=mat2(0.80,0.60,-0.60,0.80);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p*2.0+vec2(1.7,9.2); a*=0.5; }
  return v;
}

// Soft, sparse, TINTED star dust (no hard white pixels). Returns a colour add.
vec3 softStars(vec2 uv, float aspect, float density, vec3 tint){
  vec2 sp = uv*vec2(aspect,1.0)*120.0;
  vec2 c = floor(sp);
  float s = hash(c);
  if (s < density) return vec3(0.0);
  vec2 jitter = vec2(hash(c+1.7), hash(c+5.3)) - 0.5;
  float d = length(fract(sp)-0.5 - jitter*0.5);
  float g = exp(-d*d*55.0);
  float tw = 0.55 + 0.45*sin(u_time*1.6 + s*40.0);
  return tint * g * tw * 0.35;
}

// ── 0 NEBULA — warped FBM clouds, softer & deeper than before ──
vec3 nebula(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*2.2; float t=u_time*0.045;
  vec2 q = vec2(fbm(p+vec2(0.0,t)), fbm(p+vec2(5.2,1.3)-vec2(0.0,t)));
  vec2 r = vec2(fbm(p+4.0*q+vec2(1.7,9.2)+t*0.4), fbm(p+4.0*q+vec2(8.3,2.8)-t*0.4));
  float f = fbm(p+4.0*r);
  vec3 col = mix(vec3(0.02,0.03,0.09), vec3(0.26,0.13,0.52), smoothstep(0.0,0.6,f));
  col = mix(col, vec3(0.78,0.25,0.64), smoothstep(0.35,0.9,r.x));
  col = mix(col, vec3(0.20,0.78,0.92), smoothstep(0.55,1.0,q.y)*0.4);
  col += softStars(uv, aspect, 0.992, vec3(0.85,0.9,1.0));
  return col;
}

// ── 1 AURORA — broad, defined curtains. Less flicker, more body. ──
vec3 aurora(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.02,0.05,0.12), vec3(0.06,0.02,0.14), uv.y);
  for(int i=0;i<3;i++){
    float fi=float(i);
    // Slow, broad waving band; low-frequency so curtains read clearly.
    float band = 0.45 + 0.16*sin(uv.x*2.2 + u_time*0.35 + fi*2.1)
                      + 0.06*sin(uv.x*4.5 - u_time*0.18 + fi);
    float d = abs(uv.y - band);
    // Soft body (tighter than before so it doesn't wash the whole sky).
    float glow = smoothstep(0.16, 0.0, d); glow = glow*glow;
    // CRISP bright ridge along the curtain centre — gives a defined edge
    // instead of a uniform blur.
    float ridge = smoothstep(0.022, 0.0, d);
    // Vertical filament streaks running through the curtain (the real
    // "northern lights" texture) — animated, high-frequency, readable.
    float streak = 0.55 + 0.45*sin(uv.x*70.0 + u_time*0.9 + fi*3.0);
    vec3 tint = mix(vec3(0.16,0.95,0.55), vec3(0.55,0.35,1.0), fi/2.0);
    col += tint * glow * streak * (0.42 + 0.12*sin(u_time*0.5 + fi*1.7));
    col += tint * ridge * 0.85;
  }
  col += softStars(uv, aspect, 0.994, vec3(0.8,0.95,1.0)) * step(0.45, uv.y);
  return col;
}

// ── 2 NEON GRID — synthwave floor + horizon sun + scanlines ──
vec3 grid(vec2 uv, float aspect){
  float horizon = 0.46;
  // Sky: indigo at the top fading to a warm magenta band at the horizon.
  vec3 col = mix(vec3(0.05,0.01,0.12), vec3(0.22,0.04,0.26), smoothstep(1.0, horizon, uv.y));

  if(uv.y > horizon){
    // ── Upper half: synthwave sun with horizontal scan stripes ──
    // Aspect-correct distance so the sun is a round disc.
    vec2 q = (uv - vec2(0.5, horizon + 0.15)) * vec2(aspect, 1.0);
    float sd = length(q);
    float disc = smoothstep(0.175, 0.16, sd);
    // Vertical gradient inside the sun: gold on top → magenta at the base.
    vec3 sunCol = mix(vec3(1.0,0.86,0.32), vec3(1.0,0.22,0.55),
                      smoothstep(horizon + 0.02, horizon + 0.30, uv.y));
    // Horizontal stripes carve the lower part of the disc (classic synthwave).
    float stripe = step(0.42, fract((uv.y - horizon) * 26.0));
    float lower  = smoothstep(horizon + 0.15, horizon + 0.01, uv.y);
    disc *= mix(1.0, stripe, lower);
    col += sunCol * disc * 1.35;
    // Soft glow halo around the sun.
    col += mix(vec3(1.0,0.55,0.30), vec3(1.0,0.30,0.62), uv.x) * smoothstep(0.42, 0.0, sd) * 0.22;
    // Sparse stars high in the sky.
    col += softStars(uv, aspect, 0.994, vec3(0.9,0.85,1.0)) * smoothstep(horizon + 0.18, 1.0, uv.y);
  } else {
    // ── Lower half: neon perspective floor grid ──
    float depth = (horizon - uv.y);
    float persp = 1.0 / (depth + 0.06);
    float gx = abs(fract((uv.x - 0.5) * persp * 1.8) - 0.5);
    float gz = abs(fract(u_time * 0.3 + persp * 0.55) - 0.5);
    float lx = smoothstep(0.045, 0.0, gx);
    float lz = smoothstep(0.045, 0.0, gz);
    float line = max(lx, lz);
    vec3 neon = mix(vec3(0.10,0.92,1.0), vec3(1.0,0.22,0.85), uv.x);
    col += neon * line * (0.4 + depth * 2.6);
    col += neon * 0.04 * depth;                       // faint floor ambience
  }
  // Bright horizon line where floor meets sky.
  col += vec3(1.0,0.55,0.9) * smoothstep(0.014, 0.0, abs(uv.y - horizon)) * 0.7;
  return col;
}

// ── 3 GALAXY — rotating spiral arms + bright core + nova bursts ──
vec3 galaxy(vec2 uv, float aspect){
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.2;
  float r = length(p);
  float a = atan(p.y, p.x);
  // Rotating 2-arm spiral.
  float spiral = a + r*3.2 - u_time*0.18;
  float arms = 0.5 + 0.5*cos(spiral*2.0);
  arms = pow(arms, 2.6);                             // sharper, higher-contrast arms
  arms *= smoothstep(1.5, 0.05, r);                  // fade outward
  // Dust sampled in WARPED CARTESIAN space (not raw polar) so it no longer
  // bands into blocky seams along the angular grid — liquid swirl.
  vec2 warp = p*2.6 + 0.5*vec2(cos(spiral), sin(spiral));
  float dust = fbm(warp - u_time*0.06);
  vec3 col = vec3(0.012,0.013,0.045);
  // Contrast the dust harder (was a muddy mid-mix) so the arms read crisply.
  float dustc = smoothstep(0.35, 0.85, dust);
  col += mix(vec3(0.20,0.08,0.50), vec3(0.30,0.70,1.0), dustc) * arms * 0.95;
  // Bright crisp filament threading the arm crest — the defined "lane" of
  // stars that makes the spiral legible instead of a soft smear.
  float crest = smoothstep(0.78, 0.99, 0.5 + 0.5*cos(spiral*2.0));
  col += vec3(0.85,0.88,1.0) * crest * smoothstep(1.3, 0.12, r) * 0.16;
  // Discreet core — a soft glow, NOT a flashy ball, kept dim so the menu cards
  // on top stay readable.
  col += vec3(0.65,0.55,0.92) * exp(-r*r*6.0) * 0.30;
  col += vec3(0.45,0.30,0.80) * exp(-r*r*1.8) * 0.10;
  // Gentle breathing twinkle right at the eye — subtle, never a strobe.
  float tw = 0.5 + 0.5*sin(u_time*0.9);
  col += vec3(0.85,0.80,1.0) * exp(-r*r*48.0) * (0.18 + 0.16*tw);
  col += softStars(uv, aspect, 0.990, vec3(0.9,0.92,1.0));
  return col;
}

// ── 4 HOLY — descending god-rays, warm gold over cathedral indigo ──
vec3 holy(vec2 uv, float aspect){
  vec3 base = mix(vec3(0.05,0.05,0.12), vec3(0.02,0.02,0.07), uv.y);
  // Light shafts from the top: vertical bands modulated by a slow noise,
  // brightest near the top, fading down.
  float shaft = 0.0;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float x = 0.2 + fi*0.2 + 0.04*sin(u_time*0.3 + fi);
    float w = 0.06 + 0.02*sin(u_time*0.2 + fi*2.0);
    float dx = abs(uv.x - x);
    float band = smoothstep(w, 0.0, dx);          // soft volumetric body
    float core = smoothstep(w*0.32, 0.0, dx);     // CRISP bright shaft core
    shaft += band*0.55 + core*0.9;
  }
  shaft *= smoothstep(1.0, 0.1, uv.y);                 // top-down fade
  // Drifting dust striations across the shafts → visible volumetric light
  // instead of flat soft bands.
  shaft *= 0.72 + 0.28*sin(uv.y*90.0 - u_time*1.1);
  vec3 gold = vec3(1.0, 0.82, 0.42);
  vec3 col = base + gold * shaft * 0.32;
  // Floating motes drifting up.
  vec2 mp = uv*vec2(aspect,1.0)*vec2(40.0, 18.0); mp.y += u_time*0.4;
  float mote = exp(-pow(length(fract(mp)-0.5),2.0)*40.0) * step(0.97, hash(floor(mp)));
  col += gold * mote * 0.5;
  // Soft indigo halo centre.
  col += vec3(0.3,0.3,0.7) * exp(-distance(uv,vec2(0.5,0.32))*2.0) * 0.12;
  return col;
}

// ── 5 QUANTUM — smooth electric plasma + drifting energy nodes ──
vec3 quantum(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0);
  float t = u_time*0.4;
  // Classic layered plasma — all smooth sines, zero hard pixels.
  float v = sin(p.x*6.0 + t)
          + sin((p.y*6.0 + t)*1.1)
          + sin((p.x*4.0 + p.y*5.0 + t)*0.9)
          + sin(length(p-0.5)*10.0 - t*1.3);
  v *= 0.25;
  vec3 col = mix(vec3(0.02,0.05,0.12), vec3(0.10,0.55,0.85), 0.5+0.5*v);
  col = mix(col, vec3(0.2,0.85,1.0), smoothstep(0.5,1.0, 0.5+0.5*sin(v*PI)));
  // CRISP electric filaments — thin bright arcs traced where the plasma field
  // crosses zero. Turns the soft blob plasma into legible energy lines.
  float field = sin(p.x*9.0 + sin(p.y*7.0 + t)*2.2 + t)
              + sin(p.y*8.0 - sin(p.x*6.0 - t)*2.0 - t*1.2);
  float fil = smoothstep(0.10, 0.0, abs(field));
  col += vec3(0.55,1.0,1.0) * fil * 0.6;
  // A few drifting energy nodes (soft bright orbs).
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 c = vec2(0.5+0.34*sin(t*0.7+fi*2.1), 0.5+0.30*cos(t*0.5+fi*1.7));
    col += vec3(0.5,0.95,1.0) * exp(-distance(p,c)*distance(p,c)*60.0) * 0.4;
  }
  return col;
}

// ── 6 CASINO ROYALE — emerald felt + Art Déco gold rays + drifting bokeh ──
vec3 casino(vec2 uv, float aspect){
  // Deep emerald felt — radial gradient darkening toward the edges.
  float r = distance(uv, vec2(0.5));
  vec3 felt = mix(vec3(0.045, 0.32, 0.21), vec3(0.012, 0.075, 0.052),
                  smoothstep(0.0, 0.9, r));
  // Tiny felt grain — high-frequency speckle keeps the table from looking flat.
  float grain = (hash(uv * 2400.0) - 0.5) * 0.05;
  felt += grain;
  // Soft warm halo from the chandeliers overhead (top-third bloom).
  felt += vec3(1.0, 0.78, 0.32) * exp(-pow((uv.y - 0.08) * 2.2, 2.0)) * 0.18;
  // Gold ray fan from the centre — slow sweep, Art Déco accent.
  vec2 p = uv - 0.5; p.x *= aspect;
  float ang = atan(p.y, p.x);
  float rays = 0.5 + 0.5 * cos(ang * 16.0 + u_time * 0.18);
  rays *= smoothstep(0.55, 0.0, length(p));
  felt += vec3(0.96, 0.78, 0.36) * rays * 0.10;
  // Drifting bokeh sparkles (chip glints + chandelier reflections).
  vec2 sp = uv * vec2(aspect, 1.0) * 40.0;
  vec2 c = floor(sp + vec2(0.0, u_time * 0.18));
  float s = hash(c);
  if (s > 0.985) {
    vec2 j = vec2(hash(c + 1.7), hash(c + 5.3)) - 0.5;
    float d = length(fract(sp + vec2(0.0, u_time * 0.18)) - 0.5 - j * 0.4);
    float g = exp(-d * d * 70.0);
    float tw = 0.6 + 0.4 * sin(u_time * 1.8 + s * 35.0);
    felt += vec3(1.0, 0.88, 0.5) * g * tw * 0.55;
  }
  return felt;
}

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  float aspect = u_res.x/u_res.y;
  vec3 col;
  if(u_scene==1) col = aurora(uv, aspect);
  else if(u_scene==2) col = grid(uv, aspect);
  else if(u_scene==3) col = galaxy(uv, aspect);
  else if(u_scene==4) col = holy(uv, aspect);
  else if(u_scene==5) col = quantum(uv, aspect);
  else if(u_scene==6) col = casino(uv, aspect);
  else col = nebula(uv, aspect);

  // ── Per-scene touch interaction ──────────────────────────────────────
  // The backdrop reacts to the finger differently per scene. Skipped once
  // the tap is old and nothing is held (cheap early-out via the multipliers).
  {
    vec2 tuv = u_touch / u_res;
    float age = u_touchAge;
    float td = length((uv - tuv) * vec2(aspect, 1.0));   // aspect-correct distance
    if (u_scene == 2) {
      // Neon Grid → the touched spot lights up pink and fades like a piano key.
      col += vec3(1.0,0.30,0.72) * exp(-td*td*55.0) * exp(-age*3.2) * 1.6;
    } else if (u_scene == 5) {
      // Quantum → a liquid ripple radiating from the fingertip.
      col += vec3(0.45,0.92,1.0) * sin(td*42.0 - age*9.0) * exp(-td*5.5) * exp(-age*2.2) * 0.7;
    } else if (u_scene == 4) {
      // Holy → a golden glitch square that materialises while held and slowly
      // undoes itself on release (u_hold eases up, then down).
      float h = clamp(u_hold, 0.0, 1.0);
      float sz = 0.03 + h*0.11;
      vec2 d2 = abs(uv - tuv) * vec2(aspect, 1.0);
      float sq = smoothstep(sz, sz*0.78, max(d2.x, d2.y));
      float glitch = step(0.5, fract(uv.y*70.0 + u_time*4.0));
      col += vec3(1.0,0.82,0.36) * sq * (0.45 + 0.55*glitch) * smoothstep(0.0,0.04,h);
    } else {
      // Galaxy / Nebula / Aurora / Casino → a soft universal ripple.
      col += vec3(0.80,0.85,1.0) * sin(td*26.0 - age*7.0) * exp(-td*4.8) * exp(-age*2.6) * 0.35;
    }
  }

  float vig = distance(uv, vec2(0.5));
  col *= mix(1.04, 0.58, smoothstep(0.2,0.95,vig));
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.92)), 1.0);
}
`;

export function ThemedBackdrop({ scene }: { scene: BackdropScene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // Latest scene, readable from the frame loop and the context-restore path
  // WITHOUT re-running the GL-setup effect (which is what caused the grey
  // screen — see the long note below).
  const sceneRef = useRef<BackdropScene>(scene);
  sceneRef.current = scene;
  // Live GL handles so the scene-change effect can poke the uniform directly.
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const uSceneRef = useRef<WebGLUniformLocation | null>(null);

  // GL setup runs ONCE per mount (deps: []). It used to depend on [scene],
  // so every theme change tore the context down (loseContext) and then
  // re-getContext()'d the SAME <canvas> — but a canvas whose context was
  // explicitly lost hands back a DEAD context, so all draws silently no-op
  // and you're left staring at a grey/white rectangle. Now the context lives
  // for the whole mount; switching scenes only updates a uniform.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const MIN_DT = 1000 / 60; // 60fps target — smoother, more "liquid" feel (was 40)
    let gl: WebGLRenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uTouch: WebGLUniformLocation | null = null;
    let uTouchAge: WebGLUniformLocation | null = null;
    let uHold: WebGLUniformLocation | null = null;
    let running = false;
    let start = performance.now();
    let last = 0;
    // Touch state for the per-scene backdrop interaction.
    let touchX = -1e6, touchY = -1e6, touchDownAt = -1e6, hold = 0;
    let pressing = false;

    const resize = () => {
      if (!gl) return;
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
      }
    };

    const compile = (type: number, src: string) => {
      if (!gl) return null;
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.error("[ThemedBackdrop] shader error", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    // Build (or, after a context-restore, REBUILD) every GL resource bound to
    // the live context. Returns false on any failure → CSS fallback shows.
    const buildGL = (): boolean => {
      gl =
        (canvas.getContext("webgl", { alpha: false, antialias: false, depth: false }) as WebGLRenderingContext | null) ??
        (canvas.getContext("experimental-webgl", { alpha: false }) as WebGLRenderingContext | null);
      if (!gl) return false;
      glRef.current = gl;
      resize();
      vs = compile(gl.VERTEX_SHADER, VERT);
      fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      prog = gl.createProgram()!;
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);

      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aLoc = gl.getAttribLocation(prog, "a");
      gl.enableVertexAttribArray(aLoc);
      gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

      uRes = gl.getUniformLocation(prog, "u_res");
      uTime = gl.getUniformLocation(prog, "u_time");
      uTouch = gl.getUniformLocation(prog, "u_touch");
      uTouchAge = gl.getUniformLocation(prog, "u_touchAge");
      uHold = gl.getUniformLocation(prog, "u_hold");
      const uScene = gl.getUniformLocation(prog, "u_scene");
      uSceneRef.current = uScene;
      gl.uniform1i(uScene, SCENE_INDEX[sceneRef.current]);

      // Paint one solid backdrop-coloured frame immediately so the canvas
      // never flashes an uninitialised (white/grey) framebuffer before the
      // first animated tick lands.
      gl.clearColor(0.043, 0.051, 0.071, 1); // #0b0d12
      gl.clear(gl.COLOR_BUFFER_BIT);
      return true;
    };

    const frame = (now: number) => {
      if (!running) return;
      if (gl && !gl.isContextLost() && now - last >= MIN_DT) {
        const dt = (now - last) / 1000;
        last = now;
        // Ease the press value up while held, down on release (Holy square etc.).
        if (pressing) hold = Math.min(1.2, hold + dt / 0.8);
        else hold = Math.max(0, hold - dt / 1.1);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.uniform2f(uTouch, touchX, touchY);
        gl.uniform1f(uTouchAge, (now - touchDownAt) / 1000);
        gl.uniform1f(uHold, hold);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    const startLoop = () => {
      if (running) return;
      running = true; last = 0;
      rafRef.current = requestAnimationFrame(frame);
    };
    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };

    // Context-loss recovery. preventDefault() is MANDATORY — without it the
    // browser refuses to fire `webglcontextrestored`, so the canvas stays a
    // dead grey/white rectangle forever. Mobile GPUs drop contexts on memory
    // pressure / returning from background / hitting the live-context cap.
    const onLost = (e: Event) => { e.preventDefault(); stopLoop(); };
    const onRestored = () => {
      if (buildGL()) { start = performance.now(); startLoop(); }
    };
    canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
    canvas.addEventListener("webglcontextrestored", onRestored as EventListener, false);
    window.addEventListener("resize", resize);

    // Touch interaction → feed finger position (GL y-up) + press state to the
    // shader. Listened on window since the canvas is pointer-events:none.
    const setTouch = (e: PointerEvent) => {
      touchX = e.clientX * dpr;
      touchY = canvas.height - e.clientY * dpr;
    };
    const onTDown = (e: PointerEvent) => { setTouch(e); touchDownAt = performance.now(); pressing = true; startLoop(); };
    const onTMove = (e: PointerEvent) => { if (pressing) setTouch(e); };
    const onTUp = () => { pressing = false; };
    window.addEventListener("pointerdown", onTDown, { passive: true });
    window.addEventListener("pointermove", onTMove, { passive: true });
    window.addEventListener("pointerup", onTUp, { passive: true });
    window.addEventListener("pointercancel", onTUp, { passive: true });

    const onVis = () => { if (document.hidden) stopLoop(); else startLoop(); };
    document.addEventListener("visibilitychange", onVis);

    if (buildGL()) startLoop();

    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onTDown);
      window.removeEventListener("pointermove", onTMove);
      window.removeEventListener("pointerup", onTUp);
      window.removeEventListener("pointercancel", onTUp);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onRestored as EventListener);
      if (gl) {
        gl.deleteProgram(prog); gl.deleteBuffer(buf);
        gl.deleteShader(vs); gl.deleteShader(fs);
        // Drop the context only on a REAL unmount (the <canvas> leaves the
        // DOM and is discarded), never on a scene change. This keeps the
        // anti-accumulation guard from v0.4.33 without the grey-screen
        // regression it introduced.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      glRef.current = null;
      uSceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene switch → just re-point the uniform on the live context. No teardown,
  // no new context. If the context is currently lost, the restore path reads
  // sceneRef and applies the right scene when it rebuilds.
  useEffect(() => {
    const gl = glRef.current;
    const uScene = uSceneRef.current;
    if (gl && uScene && !gl.isContextLost()) {
      gl.uniform1i(uScene, SCENE_INDEX[scene]);
    }
  }, [scene]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: "#0b0d12" }}>
      <canvas ref={canvasRef} aria-hidden className="w-full h-full block" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 40%, rgba(5,7,11,0.5) 100%)" }}
      />
    </div>
  );
}
