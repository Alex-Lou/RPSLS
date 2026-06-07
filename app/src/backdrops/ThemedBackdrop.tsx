import { useEffect, useRef } from "react";
import { menuFxSuppressed } from "../fx/menuFx";
import { useStore } from "../store/store";

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
 *  - 60fps timestamp gate (capable phones + tablets run buttery smooth;
 *    battery saved by the visibility-hidden pause + the rAF gate itself).
 *  - Silent CSS fallback if WebGL is unavailable.
 *
 * Scenes switch on a cheap `u_scene` int branch. All glows are soft
 * gaussians (no hard white pixels) and animation is continuous + smooth.
 */

export type BackdropScene =
  | "nebula" | "aurora" | "grid" | "galaxy" | "holy" | "quantum" | "casino"
  | "volcanic" | "abyss" | "eclipse" | "phantom" | "emberforge"
  | "tempus" | "storm"
  // ── 2026-06-07 premium lineup (docs/PREMIUM_THEMES.md) ──
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom";

const SCENE_INDEX: Record<BackdropScene, number> = {
  nebula: 0, aurora: 1, grid: 2, galaxy: 3, holy: 4, quantum: 5, casino: 6,
  volcanic: 7, abyss: 8, eclipse: 9, phantom: 10, emberforge: 11,
  tempus: 12, storm: 13,
  coral: 14, rust: 15, void: 16, prism: 17, ink: 18, bloom: 19,
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
uniform float u_swipeMag;  // 0..1 normalised magnitude of last horizontal swipe
uniform float u_swipeAge;  // seconds since the last horizontal swipe ended
uniform float u_intensity; // per-theme FX intensity multiplier (0.4 .. 1.6); 1.0 = shipping look

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
    // depth+0.06 made persp explode right under the horizon → the fract()
    // oscillated faster than the pixel grid = shimmering moiré that reads as
    // jank and costs GPU. A higher floor (0.12) caps the worst-case frequency:
    // smoother, cheaper, same synthwave look.
    float depth = (horizon - uv.y);
    float persp = 1.0 / (depth + 0.12);
    float gx = abs(fract((uv.x - 0.5) * persp * 1.8) - 0.5);
    float gz = abs(fract(u_time * 0.3 + persp * 0.55) - 0.5);
    // Widen the line a hair as it recedes so far lines don't alias to noise.
    float lw = 0.045 + depth * 0.05;
    float lx = smoothstep(lw, 0.0, gx);
    float lz = smoothstep(lw, 0.0, gz);
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

// ── 7 VOLCANIC — cracked obsidian, flowing lava veins, rising embers ──
vec3 volcanic(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*3.0;
  vec3 col = mix(vec3(0.06,0.03,0.02), vec3(0.10,0.05,0.03), fbm(p*2.0));
  float t = u_time*0.08;
  vec2 q = vec2(fbm(p + vec2(t,0.0)), fbm(p + vec2(5.2,1.3) + vec2(0.0,t)));
  float cells = fbm(p + 3.0*q);
  float crack = smoothstep(0.06, 0.0, abs(cells - 0.48));
  float crackW = smoothstep(0.14, 0.0, abs(cells - 0.48));
  col += vec3(1.0,0.27,0.0) * crack * 0.95;
  col += vec3(1.0,0.55,0.08) * crackW * 0.25;
  float pulse = 0.5 + 0.5*sin(u_time*0.6 + cells*8.0);
  col += vec3(0.6,0.08,0.0) * crackW * pulse * 0.3;
  vec2 ep = uv*vec2(aspect,1.0)*vec2(60.0,25.0);
  ep.y -= u_time*0.8;
  float ember = exp(-pow(length(fract(ep)-0.5),2.0)*50.0) * step(0.98, hash(floor(ep)));
  float etw = 0.5+0.5*sin(u_time*3.0+hash(floor(ep))*20.0);
  col += vec3(1.0,0.5,0.1) * ember * etw * 0.7;
  float smoke = fbm(uv*vec2(aspect,1.0)*4.0 + vec2(t*2.0, 0.0)) * smoothstep(0.5, 1.0, uv.y);
  col += vec3(0.15,0.10,0.08) * smoke * 0.3;
  col += softStars(uv, aspect, 0.997, vec3(1.0,0.6,0.3));
  return col;
}

// ── 9 ECLIPSE — total solar eclipse: corona ring, diamond ring, wispy streamers ──
vec3 eclipse(vec2 uv, float aspect){
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float t = u_time * 0.12;

  // Void — near-black with the faintest deep-indigo radial gradient.
  vec3 col = mix(vec3(0.014, 0.011, 0.028), vec3(0.004, 0.004, 0.013),
                 smoothstep(0.0, 1.3, r));

  // ── CORONA RING ──
  // The bright ring at the moon's edge. FBM noise perturbs the radius so
  // the ring reads as irregular streamers, not a perfect circle.
  float ringR = 0.17;
  float coronaNoise = fbm(q * 7.0 + vec2(t * 0.25, t * 0.18)) * 0.5 + 0.5;
  float coronaDist = abs(r - ringR - coronaNoise * 0.055);
  float corona = exp(-coronaDist * 26.0)
               * smoothstep(ringR + 0.012, ringR - 0.012, r);
  float breathe = 0.72 + 0.28 * sin(t * 0.65);
  vec3 coronaCol = mix(vec3(1.0, 0.90, 0.68), vec3(0.88, 0.88, 0.95), coronaNoise);
  col += coronaCol * corona * breathe * 0.52;

  // Wider, fainter outer corona glow.
  float outerCorona = exp(-abs(r - ringR) * 10.0)
                    * smoothstep(ringR + 0.10, ringR - 0.02, r);
  col += vec3(0.50, 0.45, 0.55) * outerCorona * 0.14;

  // ── DIAMOND RING ──
  // One intensely bright spot on the ring — the last ray of sunlight
  // shining through a lunar valley (Baily's beads). Slowly orbits.
  float diamondAngle = t * 0.22;
  vec2 diamondPos = vec2(cos(diamondAngle), sin(diamondAngle)) * ringR;
  float diamondDist = length(q - diamondPos);
  float twinkle = 0.65 + 0.35 * sin(t * 2.1);
  col += vec3(1.0, 0.94, 0.76) * exp(-diamondDist * diamondDist * 380.0) * twinkle * 0.85;

  // Secondary diamond (smaller, opposite hemisphere).
  float d2Angle = diamondAngle + 3.14159 * 0.62;
  vec2 d2Pos = vec2(cos(d2Angle), sin(d2Angle)) * ringR;
  float d2dist = length(q - d2Pos);
  col += vec3(0.75, 0.66, 0.88) * exp(-d2dist * d2dist * 220.0) * 0.28;

  // ── CORONA STREAMERS ──
  // Long wispy radial filaments, animated noise (the streamer pattern
  // ROTATES with time so the texture isn't static anymore).
  float ang = atan(q.y, q.x);
  float streamerNoise = fbm(vec2(ang * 2.8 + t * 0.5, r * 1.8) + t * 0.12);
  float streamer = smoothstep(0.30, ringR + 0.02, r)
                 * smoothstep(0.85, 0.50, r)
                 * (0.45 + 0.55 * streamerNoise);
  col += vec3(0.55, 0.50, 0.62) * streamer * 0.13;

  // ── SOLAR PROMINENCES ──
  // Curved arcs erupting from the ring — slow rotation of 3 distinct
  // bright protrusions that read as plasma loops on the chromosphere.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float promAng = t * 0.18 + fi * 2.094;
    vec2 promPos = vec2(cos(promAng), sin(promAng)) * (ringR + 0.025);
    float promD = length(q - promPos);
    float promPulse = 0.6 + 0.4*sin(u_time*0.9 + fi*1.7);
    col += vec3(1.0, 0.55, 0.20) * exp(-promD*promD * 450.0) * promPulse * 0.6;
    // Outer halo of each prominence (more orange than the corona gold).
    col += vec3(1.0, 0.45, 0.15) * exp(-promD*promD * 80.0) * promPulse * 0.12;
  }

  // ── CORONA BREATH PULSE ──
  // Periodic full-ring bright pulse (~every 11s) so the eclipse "exhales".
  float coronaPulse = smoothstep(0.94, 1.0, sin(u_time*0.28));
  col += coronaCol * corona * coronaPulse * 0.45;

  // ── DIAMOND CASCADE ──
  // Rare event (~every 16s): the diamond ring "explodes" briefly into a
  // burst of light radiating outward. Creates a wow-moment.
  float cascade = smoothstep(0.985, 1.0, sin(u_time*0.20));
  float cascadeGlow = exp(-r*r * 5.0) * cascade;
  col += vec3(1.0, 0.95, 0.78) * cascadeGlow * 0.55;
  // Cascade rays — 8 short bright spokes from centre.
  if(cascade > 0.02){
    for(int k=0;k<8;k++){
      float fk = float(k);
      float rayAng = fk * 0.7854 + diamondAngle*0.5;
      vec2 rayDir = vec2(cos(rayAng), sin(rayAng));
      float along = dot(q, rayDir);
      float across = abs(dot(q, vec2(-rayDir.y, rayDir.x)));
      float ray = smoothstep(0.005, 0.0, across) * smoothstep(0.5, ringR, along);
      col += vec3(1.0, 0.92, 0.74) * ray * cascade * 0.6;
    }
  }

  // ── CONTINUOUS CORONA TURBULENCE ──
  // Visible flame-like fluctuations rolling along the ring at every frame.
  // Implementation: sample FBM along the angular axis WARPED by time, then
  // band-limit to a narrow ring around the corona. Reads as plasma boiling.
  float boilNoise = fbm(vec2(ang*3.5 + t*1.4, r*5.0 - t*0.8));
  float boilBand = exp(-pow((r - ringR - 0.020)*22.0, 2.0));
  col += vec3(1.0, 0.78, 0.30) * boilBand * boilNoise * 0.55;

  // ── ORBITING CORONA EMBERS ──
  // 8 small bright sparks revolve around the ring at varied speeds, each
  // twinkling — visible motion at every moment, no waiting for events.
  for(int i=0;i<8;i++){
    float fi = float(i);
    float emAng = u_time*(0.18 + fi*0.024) + fi*0.785;
    vec2 emPos = vec2(cos(emAng), sin(emAng)) * (ringR + 0.012);
    float emD = length(q - emPos);
    float emTw = 0.55 + 0.45*sin(u_time*2.2 + fi*5.1);
    col += vec3(1.0, 0.88, 0.55) * exp(-emD*emD*620.0) * emTw * 0.55;
  }

  // ── RADIAL HEAT SHIMMER (always-on outward streaks) ──
  // Subtle radial sin wave makes the void around the ring shimmer
  // continuously — never a dead frame.
  float shimmer = 0.5 + 0.5*sin(ang*10.0 + r*22.0 - u_time*1.3);
  col += vec3(0.85, 0.65, 0.30) * shimmer * smoothstep(0.20, 0.45, r) *
         smoothstep(0.75, 0.40, r) * 0.06;

  // ── DUST/STARS ──
  col += softStars(uv, aspect, 0.997, vec3(0.65, 0.75, 0.95))
       * smoothstep(ringR + 0.14, ringR + 0.55, r);

  return col;
}

// ── 10 PHANTOM — haunted realm: spectral wisps, drifting eyes, soul mist,
// breath glow, periodic ghost flash. Premium-grade richness in motion.
vec3 phantom(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*2.8;
  float t = u_time*0.055;
  float tFast = u_time*0.18;

  // Multi-layer base: cold lavender void with a slow breath modulation so
  // the WHOLE scene pulses subtly (the realm is "alive").
  float breath = 0.85 + 0.15*sin(u_time*0.35);
  vec3 col = mix(vec3(0.05,0.06,0.10), vec3(0.10,0.13,0.18),
                 smoothstep(0.0,1.0,uv.y)) * breath;

  // Volumetric soul mist — two FBM layers drifting opposite directions.
  // The cross-flow creates organic eddies that read as actual fog.
  float mistA = fbm(p + vec2(t*0.8, t*0.4));
  float mistB = fbm(p*1.4 + vec2(-t*0.5, t*0.9));
  float mist = mistA*0.6 + mistB*0.4;
  col += mix(vec3(0.06,0.10,0.18), vec3(0.16,0.22,0.32), mist) * mist * 0.42;

  // 5 wandering spectral wisps — longer, more dramatic shimmer with
  // FBM-perturbed vertical position so they curl, not just slide.
  for(int i=0;i<5;i++){
    float fi=float(i);
    float yBase = 0.12 + fi*0.18;
    float yPert = 0.06*sin(t*0.5 + fi*2.3) + 0.04*fbm(vec2(uv.x*3.0 + t*0.6, fi));
    float y = yBase + yPert;
    float wisp = exp(-abs(uv.y - y)*5.0);
    float shimmer = 0.55 + 0.45*sin(uv.x*18.0 + t*1.3 + fi*4.0 + mistA*3.0);
    vec3 wispCol = mix(vec3(0.40,0.55,0.68), vec3(0.65,0.78,0.88), fi/4.0);
    col += wispCol * wisp * shimmer * 0.14;
  }

  // 4 spectral tears — silhouettes with drip + GLOW HALO. Each has its own
  // slow drift trajectory + breath.
  for(int i=0;i<4;i++){
    float fi=float(i);
    float tx = 0.16 + fi*0.22 + 0.04*sin(t*0.32 + fi*1.7);
    float ty = 0.48 + 0.20*cos(t*0.45 + fi*2.0);
    float dropR = 0.055 + 0.018*sin(t*0.8 + fi);
    float d = distance(uv, vec2(tx, ty));
    // Filled ghost body + outer halo + inner highlight (3-stop tear).
    float tear = smoothstep(dropR, 0.0, d);
    float halo = smoothstep(dropR*2.2, dropR*1.0, d) - tear;
    col += vec3(0.45,0.62,0.74) * tear * 0.20;
    col += vec3(0.55,0.72,0.86) * halo * 0.10;
    // Vertical drip with FBM shimmer.
    float lineD = abs(uv.x - tx);
    float dripShim = 0.6 + 0.4*sin(uv.y*30.0 + t*2.0 + fi);
    float line = smoothstep(0.010, 0.0, lineD) * smoothstep(ty, 0.30, uv.y);
    col += vec3(0.32,0.48,0.60) * line * dripShim * 0.11;
  }

  // GHOSTLY EYES — two large soft orbs that PERIODICALLY open and close
  // (sin gated by a slower cycle). The blink rhythm makes them feel
  // *alive*, not painted. Reads as "something is watching".
  for(int i=0;i<2;i++){
    float fi=float(i);
    vec2 eyePos = vec2(0.28 + fi*0.44, 0.32 + 0.10*sin(t*0.5+fi*1.3));
    float eyeD = distance(uv*vec2(aspect,1.0), eyePos*vec2(aspect,1.0));
    // Open/close gate: PI-cycle every ~12s, very brief openings.
    float blink = smoothstep(0.94, 1.0, sin(u_time*0.55 + fi*2.7));
    float eyeGlow = exp(-eyeD*eyeD*180.0) * blink;
    // Outer halo when open.
    float eyeAura = exp(-eyeD*eyeD*55.0) * blink * 0.4;
    col += vec3(0.75,0.92,1.00) * eyeGlow * 0.85;
    col += vec3(0.42,0.62,0.80) * eyeAura;
  }

  // GHOST FLASH — periodic full-screen pale luminescence (apparition
  // crossing). ~every 9s, brief & soft so it never disorients.
  float flashCycle = fract(u_time*0.11);
  float flash = smoothstep(0.96, 1.0, flashCycle) * smoothstep(1.0, 0.97, flashCycle);
  col += vec3(0.35,0.52,0.68) * flash * 0.45;

  // Floating soul motes — denser pass with twinkle.
  vec2 mp = uv*vec2(aspect,1.0)*vec2(48.0,28.0); mp.x += t*0.65; mp.y += t*0.35;
  float moteSeed = hash(floor(mp));
  float mote = exp(-pow(length(fract(mp)-0.5),2.0)*32.0) * step(0.97, moteSeed);
  float moteTw = 0.5 + 0.5*sin(u_time*2.5 + moteSeed*30.0);
  col += vec3(0.70,0.84,0.94) * mote * moteTw * 0.18;

  // ── DRIFTING FACE SILHOUETTES (ghost apparitions) ──
  // 3 large soft "head" shapes drift very slowly across the canvas at
  // different y positions. Pale teal hint behind the mist — the realm
  // shows faces only fleetingly, fading in and out.
  for(int i=0;i<3;i++){
    float fi=float(i);
    float fx = fract(0.10 + fi*0.32 + t*0.18);
    vec2 fp = uv - vec2(fx, 0.30 + 0.18*sin(t*0.5+fi*1.8));
    fp.x *= aspect;
    fp.y *= 1.4;
    float fd = length(fp);
    float face = exp(-fd*fd*40.0);
    float fade = 0.5 + 0.5*sin(t*0.42 + fi*2.3);
    col += vec3(0.42,0.62,0.78) * face * fade * 0.22;
    // Eyes within each face — two small voids.
    float lx = fp.x + 0.025;
    float rx = fp.x - 0.025;
    float ey = fp.y + 0.005;
    float eyeL = exp(-(lx*lx + ey*ey)*900.0);
    float eyeR = exp(-(rx*rx + ey*ey)*900.0);
    col -= vec3(0.10,0.14,0.18) * (eyeL+eyeR) * fade * 0.7;
  }

  // ── ORBITAL SOUL ORBS ──
  // 6 small bright orbs slowly orbit a central focal point — pure
  // continuous motion that lives at every frame.
  for(int i=0;i<6;i++){
    float fi=float(i);
    float orbAng = u_time*(0.10 + fi*0.025) + fi*1.047;
    float orbR = 0.18 + fi*0.025;
    vec2 orbPos = vec2(0.5, 0.55) + vec2(cos(orbAng)*orbR/aspect, sin(orbAng)*orbR);
    float od = distance(uv, orbPos);
    float oTw = 0.5 + 0.5*sin(u_time*2.0 + fi*3.7);
    col += vec3(0.70,0.85,1.0) * exp(-od*od*1400.0) * oTw * 0.45;
  }

  // ── CONTINUOUS HORIZONTAL MIST CURTAINS ──
  // 3 long misty horizontal bands floating across at different rates,
  // shimmering. Gives every frame a flowing texture.
  for(int i=0;i<3;i++){
    float fi=float(i);
    float my = 0.18 + fi*0.27;
    float mFlow = uv.x*4.0 + t*(0.7 + fi*0.18);
    float mistShim = fbm(vec2(mFlow, my*4.0)) * 0.5 + 0.5;
    float mistBand = exp(-pow((uv.y - my)*9.0, 2.0));
    col += vec3(0.32,0.42,0.55) * mistBand * mistShim * 0.18;
  }

  // Cold lavender vignette at edges (binds the realm).
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.04,0.05,0.08) * smoothstep(0.55, 0.95, r);
  return col;
}

// ── 11 EMBERFORGE — industrial smithy: forge mouth at TOP, anvil silhouette
//    centre, radial sparks bursting OUTWARD, periodic HAMMER STRIKE flashes,
//    structured geometric heat veins (NOT volcanic FBM rivers), vertical heat
//    columns rising. Differentiates HARD from Volcanic. ──
vec3 emberforge(vec2 uv, float aspect){
  float t = u_time*0.07;
  // Sooty stone forge wall — darker at edges, hint of warmth bouncing.
  vec3 col = mix(vec3(0.05,0.025,0.012), vec3(0.015,0.008,0.004),
                 length((uv-vec2(0.5,0.62))*vec2(aspect,1.0))*1.05);

  // ── FORGE MOUTH AT TOP — glowing yellow-orange furnace opening ──
  // A horizontal half-ellipse glow at the top centre, breathing.
  float bellows = 0.78 + 0.22*sin(u_time*0.55) + 0.08*sin(u_time*1.3);
  vec2 forgeD = (uv - vec2(0.5, 0.92)) * vec2(aspect*0.7, 2.4);
  float forgeMouth = exp(-dot(forgeD, forgeD)*9.0);
  col += vec3(1.0, 0.65, 0.18) * forgeMouth * 0.95 * bellows;
  // Inner white-hot core of the mouth.
  col += vec3(1.0, 0.92, 0.55) * exp(-dot(forgeD, forgeD)*36.0) * 0.75 * bellows;
  // Mouth bottom rim - sharp edge of opening.
  float rim = smoothstep(0.02, 0.0, abs(uv.y - 0.84)) *
              smoothstep(0.18, 0.0, abs(uv.x - 0.5));
  col += vec3(1.0, 0.55, 0.10) * rim * 0.50 * bellows;

  // ── ANVIL SILHOUETTE — dark vertical pillar centre, slight T-shape ──
  vec2 av = (uv - vec2(0.5, 0.32)) * vec2(aspect, 1.0);
  float anvilBody  = smoothstep(0.075, 0.07, abs(av.x)) *
                     smoothstep(0.18, 0.17, abs(av.y - 0.02));
  // Anvil top — wider horizontal slab.
  float anvilTop   = smoothstep(0.135, 0.13, abs(av.x)) *
                     smoothstep(0.022, 0.02, abs(av.y - 0.16));
  float anvilMask = max(anvilBody, anvilTop);
  // Anvil base is solid black — punch through any heat that lit it.
  col *= 1.0 - anvilMask*0.85;
  // Rim glow on the anvil top from forge mouth above.
  float anvilLit = smoothstep(0.14, 0.135, abs(av.x)) *
                   smoothstep(0.005, 0.0, abs(av.y - 0.182));
  col += vec3(1.0, 0.50, 0.12) * anvilLit * bellows * 0.55;

  // ── HAMMER STRIKE EVENTS — rare bright burst at anvil top every ~6s ──
  float strikeCycle = mod(u_time, 6.0);
  float strikeBurst = exp(-strikeCycle*4.5) * smoothstep(6.0, 5.97, strikeCycle);
  // Compact bright flare at the strike point.
  vec2 strikeC = uv - vec2(0.5, 0.50);
  strikeC.x *= aspect;
  float flarePt = exp(-dot(strikeC, strikeC)*220.0);
  col += vec3(1.0, 0.95, 0.65) * flarePt * strikeBurst * 1.6;
  // Expanding shock ring from strike.
  float ringR = strikeCycle*0.25;
  float shockRing = exp(-pow((length(strikeC)-ringR)*8.0, 2.0)) *
                    exp(-strikeCycle*1.2);
  col += vec3(1.0, 0.55, 0.15) * shockRing * 0.55;

  // ── RADIAL SPARK BURST — sparks shooting OUTWARD from strike point ──
  // 12 angular spark rays radiating from anvil top, fed by strike.
  vec2 sd = uv - vec2(0.5, 0.50);
  sd.x *= aspect;
  float sang = atan(sd.y, sd.x);
  float srad = length(sd);
  // Quantize angle into 12 wedges; each wedge gets a unique spark trail.
  float wedge = floor(sang * 12.0 / (2.0*PI) + 0.5);
  float wseed = fract(sin(wedge*23.7 + floor(u_time*0.7)*17.3) * 43758.5);
  // Spark travels outward over time within each strike cycle.
  float strikeT = mod(u_time + wseed*1.3, 1.4);
  float sparkR = strikeT * 0.42;
  float sparkOnRay = exp(-pow((srad - sparkR)*22.0, 2.0));
  // Tight angular: only fire where sang is near wedge centre angle.
  float wedgeCentre = wedge * (2.0*PI) / 12.0;
  float sparkOnAng = exp(-pow((sang - wedgeCentre)*30.0, 2.0));
  float sparkFade = exp(-strikeT*3.5);
  col += vec3(1.0, 0.70, 0.18) * sparkOnRay * sparkOnAng * sparkFade * 0.85;

  // ── VERTICAL HEAT COLUMNS — 4 rising heat shimmer pillars (industrial,
  // not organic). Sin-modulated wavy verticals tinted amber. ──
  float colA = exp(-pow((uv.x - 0.20)*9.0 + sin(uv.y*8.0 + t*2.0)*0.6, 2.0));
  float colB = exp(-pow((uv.x - 0.35)*9.0 + sin(uv.y*7.0 + t*1.8 + 1.3)*0.6, 2.0));
  float colC = exp(-pow((uv.x - 0.65)*9.0 + sin(uv.y*7.5 - t*1.9 + 2.1)*0.6, 2.0));
  float colD = exp(-pow((uv.x - 0.80)*9.0 + sin(uv.y*8.5 - t*2.1 + 3.7)*0.6, 2.0));
  float heatCols = (colA+colB+colC+colD) * smoothstep(0.85, 0.10, uv.y);
  col += vec3(0.85, 0.32, 0.06) * heatCols * 0.18 * bellows;

  // ── STRUCTURED GEOMETRIC HEAT VEINS — orthogonal grid cracks (a forge
  // floor pattern), NOT volcanic FBM lava rivers. ──
  vec2 gp = uv*vec2(aspect,1.0)*8.0 + vec2(0.0, t*0.4);
  vec2 gf = fract(gp) - 0.5;
  float gridX = exp(-pow(gf.x, 2.0)*220.0);
  float gridY = exp(-pow(gf.y, 2.0)*220.0);
  float gridMask = (gridX + gridY) * (0.4 + 0.6*hash(floor(gp)));
  // Only show grid heat in the foreground floor (lower 40%).
  gridMask *= smoothstep(0.45, 0.05, uv.y);
  col += vec3(0.85, 0.30, 0.05) * gridMask * 0.20;

  // ── RISING SPARKS — small bright motes drifting UP fast (vertical
  // industrial chimney effect, not volcanic embers). ──
  vec2 ep = uv*vec2(aspect,1.0)*vec2(40.0,22.0); ep.y -= t*3.2;
  float emberMote = exp(-pow(length(fract(ep)-0.5),2.0)*55.0) *
                    step(0.985, hash(floor(ep)));
  float eTw = 0.45+0.55*sin(t*4.5+hash(floor(ep))*25.0);
  col += vec3(1.0, 0.72, 0.22) * emberMote * eTw * 0.70;

  // ── COPPER HAMMERED TEXTURE — faint metallic dotted noise on floor ──
  float coppr = step(0.94, hash(floor(uv*vec2(aspect,1.0)*70.0)));
  col += vec3(0.30, 0.14, 0.06) * coppr * smoothstep(0.4, 0.0, uv.y) * 0.35;

  // ── SOOT AT THE TOP — darken cleanly above forge mouth so room reads ──
  col *= 1.0 - smoothstep(0.95, 1.0, uv.y)*0.3;

  return col;
}

// ── 12 TEMPUS — chronomancer's hall: domain-warped sand FBM (continuous
//    swirl), 4 rotating bronze gears (counter-rotating, real teeth),
//    central hourglass glow with cyclic sand build-up + drain, falling
//    grains, zodiac star ring slowly turning, time-fracture chronoshock
//    rings every ~9s, golden particles streaming through the centre. ──
vec3 tempus(vec2 uv, float aspect){
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float ang = atan(q.y, q.x);
  float t = u_time * 0.09;
  float tFast = u_time * 0.32;

  // ── DOMAIN-WARPED SAND BACKGROUND (continuous swirl, NEVER static) ──
  // Sand "winds" sweep across — two FBM passes, each warped by the other
  // so the dunes curl rather than slide. Same trick that gives nebula its
  // liquid feel.
  vec2 p = uv * vec2(aspect, 1.0) * 2.4;
  vec2 q1 = vec2(fbm(p + vec2(t*0.6, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t*0.6)));
  vec2 q2 = vec2(fbm(p + 3.0*q1 + vec2(1.7, 9.2) + t*0.4),
                 fbm(p + 3.0*q1 + vec2(8.3, 2.8) - t*0.4));
  float duneF = fbm(p + 3.5*q2);
  vec3 col = mix(vec3(0.04, 0.025, 0.010), vec3(0.18, 0.10, 0.04),
                 smoothstep(0.20, 0.85, duneF));
  // Bronze undertone where the FBM peaks read warmest.
  col = mix(col, vec3(0.32, 0.18, 0.06), smoothstep(0.55, 0.95, q2.x) * 0.55);
  col = mix(col, vec3(0.45, 0.28, 0.08), smoothstep(0.65, 1.0, q1.y) * 0.30);

  // ── 4 CONCENTRIC GEARS — counter-rotating, real-feeling teeth ──
  // Each gear is a thin annulus modulated by a high-frequency sin wave on
  // the angle (the teeth). Rotation speeds differ + counter-direction so
  // they read as a clockwork system meshed together.
  float gear1 = smoothstep(0.020, 0.0, abs(r - 0.16))
              * (0.55 + 0.45 * abs(sin(ang*16.0 + t*1.0)));
  float gear2 = smoothstep(0.018, 0.0, abs(r - 0.26))
              * (0.55 + 0.45 * abs(sin(ang*22.0 - t*0.7)));
  float gear3 = smoothstep(0.016, 0.0, abs(r - 0.38))
              * (0.50 + 0.50 * abs(sin(ang*28.0 + t*0.5)));
  float gear4 = smoothstep(0.012, 0.0, abs(r - 0.52))
              * (0.50 + 0.50 * abs(sin(ang*36.0 - t*0.35)));
  col += vec3(0.85, 0.55, 0.20) * gear1 * 0.45;
  col += vec3(0.75, 0.48, 0.16) * gear2 * 0.38;
  col += vec3(0.65, 0.40, 0.12) * gear3 * 0.30;
  col += vec3(0.55, 0.32, 0.10) * gear4 * 0.22;

  // ── ZODIAC STAR RING ──
  // 12 bright "constellation marker" sparks evenly placed on the outer
  // ring, slowly rotating, twinkling independently. Reads as a celestial
  // dial in motion.
  float zodiacR = 0.62;
  float zodiacAng = mod(ang - t*0.35, 6.28318);
  float seg = floor(zodiacAng * 12.0 / 6.28318);
  float segCentre = (seg + 0.5) * 6.28318 / 12.0;
  float angDist = abs(zodiacAng - segCentre);
  float zodiacDist = sqrt((r - zodiacR)*(r - zodiacR) + (angDist*zodiacR)*(angDist*zodiacR));
  float zodiacTw = 0.45 + 0.55 * sin(u_time*1.8 + seg*7.3);
  col += vec3(1.0, 0.85, 0.40) * exp(-zodiacDist*zodiacDist*1200.0) * zodiacTw * 0.85;

  // ── CENTRAL HOURGLASS GLOW ──
  // The visual focal point: a warm golden bloom that pulses with the
  // hourglass cycle. Outer halo + inner core, both breathing on offset
  // periods so the centre never sits flat.
  float coreP = 0.65 + 0.35 * sin(u_time*0.70);
  float bloomP = 0.55 + 0.45 * sin(u_time*0.45 + 1.2);
  col += vec3(0.95, 0.65, 0.22) * exp(-r*r*18.0) * coreP * 0.60;
  col += vec3(0.65, 0.40, 0.14) * exp(-r*r*5.0)  * bloomP * 0.30;
  // Inner hot core (white-gold).
  col += vec3(1.0, 0.92, 0.55) * exp(-r*r*120.0) * coreP * 0.55;

  // ── CHRONO-SHOCK RING (periodic event) ──
  // Every ~9s the central hourglass "fractures time" and a bright golden
  // ring rapidly expands outward + dissipates. Big wow moment.
  float chronoCycle = mod(u_time, 9.0);
  float chronoR = chronoCycle * 0.13;
  float chronoRing = exp(-pow((r - chronoR)*22.0, 2.0)) * exp(-chronoCycle*0.55);
  col += vec3(1.0, 0.92, 0.55) * chronoRing * 0.90;
  // Twin slower ghost ring trailing behind.
  float chronoR2 = chronoCycle * 0.085;
  float chronoRing2 = exp(-pow((r - chronoR2)*28.0, 2.0)) * exp(-chronoCycle*0.40);
  col += vec3(0.95, 0.65, 0.22) * chronoRing2 * 0.55;

  // ── FALLING SAND GRAINS ──
  // High-density rapid-fall stream of golden grains. The shower runs
  // top-to-bottom across the whole canvas at varied speeds — this is what
  // sells continuous motion at every pixel.
  vec2 sp = uv*vec2(aspect,1.0)*vec2(55.0, 38.0); sp.y -= tFast;
  float grain = exp(-pow(length(fract(sp)-0.5), 2.0)*55.0)
              * step(0.984, hash(floor(sp)));
  float grainTw = 0.55 + 0.45*sin(u_time*4.0 + hash(floor(sp))*30.0);
  col += vec3(1.0, 0.72, 0.28) * grain * grainTw * 0.85;

  // ── GOLD SAND STREAM AT CENTRE ──
  // A vertical river of bright grains pouring down through the centre
  // (the hourglass neck flow). Always running, brighter than the wide
  // grain shower, ties the eye to the focal point.
  float centreStream = exp(-pow((uv.x - 0.5)*aspect*22.0, 2.0));
  vec2 csp = vec2(uv.x*aspect*8.0, uv.y*32.0 - tFast*1.4);
  float csGrain = exp(-pow(length(fract(csp)-0.5), 2.0)*35.0) *
                  step(0.93, hash(floor(csp)));
  col += vec3(1.0, 0.82, 0.40) * centreStream * csGrain * 1.1;
  // Soft halo around the stream so the eye reads volume, not a line.
  col += vec3(0.85, 0.55, 0.18) * centreStream * 0.18 * coreP;

  // ── BRONZE VIGNETTE that breathes with the centre ──
  col += vec3(0.18, 0.10, 0.04) * (1.0 - smoothstep(0.35, 1.05, r)) * 0.22;
  col -= vec3(0.04, 0.025, 0.012) * smoothstep(0.65, 1.05, r);

  return col;
}

// ── 13 STORM — tempest fury: VORTEX storm cell, 4 simultaneous fork bolts,
//    ground reflection glow, sheet-rain wind sweep, thunder shake, rolling
//    domain-warped thunderheads, multiple flash beats per cycle. Continuous
//    motion at every pixel + a strike feels SEISMIC. ──
vec3 storm(vec2 uv, float aspect){
  float t = u_time*0.085;
  float wind = sin(u_time*0.35);
  // Deep thunderhead sky — slow vertical sway tinted by wind direction.
  float skySway = 0.90 + 0.10*sin(u_time*0.3);
  vec3 col = mix(vec3(0.025,0.035,0.10), vec3(0.05,0.07,0.18),
                 smoothstep(0.0,1.0,uv.y)) * skySway;

  // ── VORTEX STORM CELL — rotating clouds at the centre ──
  // A rotation field offsets the cloud sampling positions so the
  // thunderheads SWIRL around the centre instead of just sliding. This is
  // the single most "weather is alive" change.
  vec2 c = uv - vec2(0.5, 0.55);
  c.x *= aspect;
  float r = length(c);
  float swirl = atan(c.y, c.x) + (0.35 / max(r, 0.12)) * sin(u_time*0.18);
  vec2 swirlUV = vec2(0.5 + cos(swirl)*r/aspect, 0.55 + sin(swirl)*r);
  // Two FBM cloud layers WARPED by the swirl — heavy continuous churn.
  float cloudA = fbm(vec2(swirlUV.x*5.5 + t*0.6, swirlUV.y*4.0 + t*0.3));
  float cloudB = fbm(vec2(uv.x*9.0 - t*0.85 + wind*0.4, uv.y*3.2 + 0.7));
  col += vec3(0.08,0.10,0.18) * cloudA * smoothstep(0.0,0.85,uv.y) * 0.55;
  col += vec3(0.04,0.06,0.13) * cloudB * smoothstep(0.0,0.55,uv.y) * 0.30;
  // Bright dramatic cloud peaks where the FBM stacks — readable storm
  // tops glowing from internal lightning.
  float peaks = smoothstep(0.65, 0.95, cloudA);
  col += vec3(0.18,0.22,0.36) * peaks * smoothstep(0.0,0.85,uv.y) * 0.50;

  // ── DISTANT HORIZON SHEET LIGHTNING ──
  float horizon = smoothstep(0.30, 0.0, uv.y);
  float horizonPulse = smoothstep(0.92, 1.0, sin(u_time*0.42));
  col += vec3(0.50,0.32,0.70) * horizon * horizonPulse * 0.45;
  // CONTINUOUS soft horizon shimmer (wind on the horizon) — never sits flat.
  col += vec3(0.20,0.18,0.35) * horizon * (0.55 + 0.45*sin(u_time*0.9 + uv.x*8.0)) * 0.12;

  // ── PRIMARY + SECONDARY FLASH ──
  // Faster cycle (every ~4.5s) + each cycle gives THREE beats: lead flash,
  // mid afterglow, late strobe — sells "active storm" not a clock.
  float flashCycle = fract(t*0.22);
  float flash = smoothstep(0.86, 0.91, flashCycle) * smoothstep(0.99, 0.92, flashCycle);
  float aftFlash = smoothstep(0.55, 0.58, flashCycle) * smoothstep(0.66, 0.59, flashCycle);
  float strobe = smoothstep(0.30, 0.32, flashCycle) * smoothstep(0.36, 0.32, flashCycle) * 0.6;
  col += vec3(0.65,0.75,1.0) * flash * exp(-length(uv-0.5)*0.5) * 0.45;
  col += vec3(0.40,0.55,0.85) * aftFlash * 0.30;
  col += vec3(0.55,0.65,0.95) * strobe * 0.22;

  // ── 4 BOLTS firing simultaneously on flash ──
  // Each bolt is a jagged near-vertical filament (sin offsets give the
  // crooked zigzag). Different X locations, different jitter frequencies
  // — feels like the whole front sheet is sparking at once.
  float bolt1x = 0.18 + 0.04*sin(u_time*0.4);
  float bolt2x = 0.42 + 0.06*cos(u_time*0.35 + 1.7);
  float bolt3x = 0.66 + 0.05*sin(u_time*0.30 + 3.1);
  float bolt4x = 0.82 + 0.03*cos(u_time*0.55 + 0.6);
  float bolt1 = smoothstep(0.012,0.0, abs(uv.x - bolt1x - 0.030*sin(uv.y*15.0)));
  float bolt2 = smoothstep(0.011,0.0, abs(uv.x - bolt2x - 0.025*sin(uv.y*19.0 + 1.5)));
  float bolt3 = smoothstep(0.010,0.0, abs(uv.x - bolt3x - 0.022*sin(uv.y*23.0 + 0.8)));
  float bolt4 = smoothstep(0.009,0.0, abs(uv.x - bolt4x - 0.028*sin(uv.y*17.0 + 2.4)));
  // Bolt 1 + 3 have fork branches.
  float fork1 = smoothstep(0.008,0.0, abs(uv.x - bolt1x - 0.10 - 0.02*sin(uv.y*22.0)))
              * smoothstep(0.55, 0.30, uv.y);
  float fork3 = smoothstep(0.008,0.0, abs(uv.x - bolt3x + 0.09 + 0.018*sin(uv.y*20.0)))
              * smoothstep(0.50, 0.28, uv.y);
  // Bolt brightness: primary glow + bluish core.
  col += vec3(0.60,0.85,1.0) * bolt1 * flash * smoothstep(0.0,0.90,uv.y) * 1.05;
  col += vec3(0.65,0.80,1.0) * bolt2 * flash * smoothstep(0.0,0.85,uv.y) * 0.90;
  col += vec3(0.70,0.85,1.0) * bolt3 * aftFlash * smoothstep(0.0,0.85,uv.y) * 1.05;
  col += vec3(0.55,0.75,0.95) * bolt4 * strobe * smoothstep(0.0,0.80,uv.y) * 0.85;
  col += vec3(0.55,0.80,1.0) * fork1 * flash * 0.65;
  col += vec3(0.65,0.80,1.0) * fork3 * aftFlash * 0.65;
  // Bolt OUTER GLOW — purple halo so bolts feel volumetric, not pencils.
  col += vec3(0.50,0.30,0.85) * (bolt1+bolt2)*flash*0.30;
  col += vec3(0.55,0.35,0.90) * bolt3*aftFlash*0.35;
  // Strike point bursts at the BASE of bolt 1 + 3 (where they "hit").
  float hit1 = exp(-pow((uv.x-bolt1x)*aspect*9.0,2.0) - pow((uv.y-0.05)*8.0,2.0));
  float hit3 = exp(-pow((uv.x-bolt3x)*aspect*9.0,2.0) - pow((uv.y-0.05)*8.0,2.0));
  col += vec3(1.0,0.95,0.85) * hit1 * flash * 1.4;
  col += vec3(1.0,0.95,0.85) * hit3 * aftFlash * 1.4;

  // ── CLOUD ILLUMINATION ──
  col += vec3(0.30,0.45,0.80) * cloudA * flash * smoothstep(0.0,0.65,uv.y) * 0.45;
  col += vec3(0.25,0.35,0.65) * cloudA * aftFlash * smoothstep(0.0,0.65,uv.y) * 0.25;

  // ── GROUND REFLECTION ──
  // The bottom 12% lights up cyan when a bolt fires (the ground catching
  // the flash). Cheap fake but reads HARD as wet pavement.
  float ground = smoothstep(0.12, 0.0, uv.y);
  col += vec3(0.30,0.45,0.85) * ground * flash * 1.0;
  col += vec3(0.25,0.35,0.70) * ground * aftFlash * 0.6;

  // ── RAIN — 3 layers parallax + wind shear ──
  vec2 rp = uv*vec2(aspect,1.0)*vec2(40.0,75.0); rp.x -= t*3.4 + wind*0.3;
  float rain = smoothstep(0.93,0.96, fract(rp.x + rp.y*0.32 + wind*0.5))
             * step(0.965, hash(floor(rp)));
  col += vec3(0.30,0.45,0.65) * rain * 0.18;
  col += vec3(0.55,0.70,0.95) * rain * flash * 0.50;
  vec2 rp2 = uv*vec2(aspect,1.0)*vec2(60.0,50.0); rp2.x -= t*1.7;
  float rain2 = smoothstep(0.92,0.95, fract(rp2.x + rp2.y*0.22 + wind*0.3))
              * step(0.96, hash(floor(rp2)));
  col += vec3(0.35,0.50,0.70) * rain2 * 0.12;
  vec2 rp3 = uv*vec2(aspect,1.0)*vec2(28.0,90.0); rp3.x -= t*4.5;
  float rain3 = smoothstep(0.94,0.97, fract(rp3.x + rp3.y*0.40))
              * step(0.97, hash(floor(rp3)));
  col += vec3(0.45,0.60,0.85) * rain3 * 0.10;

  // ── SHEET-RAIN WIND SWEEP — slow translucent vertical band crossing ──
  // Reads as a heavy curtain of rain advancing across the foreground.
  float sweepX = fract(u_time*0.06 + wind*0.05);
  float sweep = exp(-pow((uv.x - sweepX)*aspect*2.8, 2.0))
              * smoothstep(0.0, 0.5, uv.y) * smoothstep(0.9, 0.3, uv.y);
  col += vec3(0.20,0.28,0.42) * sweep * 0.22;

  // ── RAIN MIST CURTAIN at top of view ──
  float mistBand = fbm(uv*vec2(aspect,1.0)*vec2(8.0,3.0) + vec2(t*1.5,0.0));
  col += vec3(0.13,0.18,0.30) * mistBand * smoothstep(0.85, 1.0, uv.y) * 0.45;

  return col;
}

// ── 8 ABYSS — deep ocean, bioluminescent glow, jellyfish silhouettes ──
vec3 abyss(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.01,0.02,0.06), vec3(0.03,0.06,0.14), uv.y);
  float t = u_time*0.12;
  vec2 cp = uv*vec2(aspect,1.0)*5.0;
  float caustic = 0.0;
  for(int i=0;i<3;i++){
    float fi=float(i);
    caustic += noise(cp*2.0 + vec2(t*(0.8+fi*0.3), t*(0.5-fi*0.2)));
  }
  caustic = caustic/3.0;
  col += vec3(0.08,0.25,0.45) * pow(caustic, 2.5) * smoothstep(0.3, 1.0, uv.y) * 0.4;
  float shaft = smoothstep(0.18, 0.0, abs(uv.x - 0.48 + 0.03*sin(t))) * uv.y;
  col += vec3(0.06,0.15,0.30) * shaft * 0.35;
  vec2 bp = uv*vec2(aspect,1.0)*vec2(80.0,40.0); bp.y += t*2.0;
  float bSeed = hash(floor(bp));
  float alive = step(0.975, bSeed);
  vec2 bj = vec2(hash(floor(bp)+1.7), hash(floor(bp)+5.3)) - 0.5;
  float bd = length(fract(bp)-0.5 - bj*0.4);
  float abg = exp(-bd*bd*60.0) * alive;
  float btw = 0.4 + 0.6*sin(u_time*2.0 + bSeed*30.0);
  vec3 bCol = mix(vec3(0.0,0.9,0.8), vec3(1.0,0.25,0.63), step(0.5, fract(bSeed*7.0)));
  col += bCol * abg * btw * 0.55;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 jc = vec2(0.25+fi*0.25 + 0.08*sin(t*0.7+fi*2.1),
                   0.35+fi*0.15 + 0.10*cos(t*0.5+fi*1.7));
    vec2 jp = (uv - jc)*vec2(aspect,1.0); jp.y *= 1.3;
    float jr = length(jp);
    vec3 jCol = mix(vec3(1.0,0.3,0.65), vec3(0.0,0.9,0.8), fi/2.0);
    col += jCol * exp(-jr*jr*120.0) * 0.22;
    float tent = smoothstep(0.01,0.0, abs(jp.x + 0.003*sin(jp.y*60.0-t*3.0)))
               * smoothstep(jc.y-0.02, jc.y-0.15, uv.y) * smoothstep(jc.y-0.22, jc.y-0.12, uv.y);
    col += jCol * tent * 0.10;
  }
  vec2 bb = uv*vec2(aspect,1.0)*vec2(30.0,60.0); bb.y -= t*4.0;
  float bubble = smoothstep(0.42,0.40, length(fract(bb)-0.5)) * step(0.993, hash(floor(bb)));
  col += vec3(0.3,0.6,0.8) * bubble * 0.15;
  return col;
}

// ── 14 CORAL — bioluminescent reef: warm radial gradient (turquoise top
//   → coral-red bottom), domain-warped organic coral shapes, pulsating
//   anemones, schools of bright micro-fish (motes) sweeping across, slow
//   rising bubbles. The WARMEST scene of the catalogue. ──
vec3 coral(vec2 uv, float aspect){
  float t = u_time * 0.08;
  vec2 p = uv * vec2(aspect, 1.0) * 2.0;

  // Water depth gradient — turquoise deep at the top, coral-warm shallows
  // at the bottom. Inverted from usual ocean palettes so the warmth reads.
  vec3 col = mix(vec3(0.04, 0.085, 0.155), vec3(0.10, 0.025, 0.04),
                 smoothstep(0.0, 1.0, uv.y));

  // Caustic-light shimmer: cheap two-octave noise drifting in opposite
  // directions, lit teal where the field swells.
  float causticA = fbm(p*1.6 + vec2(t*0.6, 0.0));
  float causticB = fbm(p*1.2 + vec2(-t*0.4, t*0.3));
  float caustic = (causticA + causticB) * 0.5;
  col += vec3(0.20, 0.78, 0.72) * smoothstep(0.45, 0.85, caustic) * 0.18;

  // Domain-warped coral colony — FBM-of-FBM gives the gnarled organic
  // outline. Painted coral-pink → orange where the field is densest.
  vec2 q1 = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t*0.5)));
  vec2 q2 = vec2(fbm(p + 3.0*q1 + vec2(1.7, 9.2) + t*0.3),
                 fbm(p + 3.0*q1 + vec2(8.3, 2.8) - t*0.3));
  float reef = fbm(p + 3.5*q2);
  // Coral mostly in the lower half — they grow from the floor up.
  float reefMask = reef * smoothstep(0.05, 0.65, uv.y);
  col += vec3(1.0, 0.42, 0.42) * smoothstep(0.55, 0.95, reefMask) * 0.50;
  col += vec3(1.0, 0.62, 0.30) * smoothstep(0.70, 1.05, reefMask) * 0.35;
  // Coral CRESTS — bright edges where the FBM peaks.
  float reefCrest = smoothstep(0.86, 1.0, reefMask);
  col += vec3(1.0, 0.88, 0.65) * reefCrest * 0.30;

  // 5 bioluminescent anemones — pulsing cyan-green discs anchored on the
  // reef field. Pulse periods staggered so the scene never blinks in unison.
  for(int i=0;i<5;i++){
    float fi = float(i);
    vec2 ac = vec2(0.18 + fi*0.165 + 0.02*sin(t*0.6 + fi),
                   0.42 + 0.20*sin(t*0.4 + fi*1.3));
    float ad = distance(uv, ac);
    float pulse = 0.5 + 0.5*sin(u_time*(0.9 + fi*0.13) + fi*1.7);
    float anemone = exp(-ad*ad*900.0);
    float halo = exp(-ad*ad*140.0);
    col += vec3(0.30, 1.0, 0.80) * anemone * pulse * 0.65;
    col += vec3(0.10, 0.65, 0.55) * halo * pulse * 0.18;
  }

  // SCHOOLS of fish — bright micro-motes that move TOGETHER in waves.
  // Two schools moving in opposite directions, both with a slow vertical
  // wobble so they "swim" rather than slide.
  for(int s=0;s<2;s++){
    float fs = float(s);
    float drift = fract(t*(0.35 + fs*0.15) + fs*0.5);
    vec2 sp = uv*vec2(aspect,1.0)*vec2(70.0,36.0);
    sp.x -= drift*4.0 - fs*2.0;
    sp.y += sin(u_time*1.2 + sp.x*0.3 + fs*2.0)*0.08;
    float fishSeed = hash(floor(sp));
    float fish = exp(-pow(length(fract(sp)-0.5),2.0)*55.0) *
                 step(0.985, fishSeed);
    float fTw = 0.5 + 0.5*sin(u_time*3.0 + fishSeed*30.0);
    vec3 fishCol = mix(vec3(1.0, 0.85, 0.55), vec3(0.55, 1.0, 0.85), fs);
    col += fishCol * fish * fTw * 0.85;
  }

  // Rising BUBBLES — slow vertical drift, sparse so they read as bubbles
  // not noise. Slight horizontal sway from a sin offset.
  vec2 bp = uv*vec2(aspect,1.0)*vec2(28.0,55.0);
  bp.y -= t*3.5;
  bp.x += sin(bp.y*0.25 + t*1.5)*0.08;
  float bubbleSeed = hash(floor(bp));
  float bubble = smoothstep(0.45,0.42, length(fract(bp)-0.5)) *
                 step(0.992, bubbleSeed);
  col += vec3(0.55, 0.92, 0.95) * bubble * 0.30;

  // SOFT GOD-RAYS from the surface — gentle vertical shafts to sell depth.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float rx = 0.25 + fi*0.25 + 0.03*sin(t*0.4 + fi);
    float dx = abs(uv.x - rx);
    float ray = exp(-dx*aspect*7.0) * smoothstep(1.0, 0.2, uv.y);
    col += vec3(0.25, 0.55, 0.60) * ray * 0.10;
  }

  // Vignette — deeper edges, like looking through a window into the reef.
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.04, 0.03, 0.04) * smoothstep(0.55, 1.05, r);
  return col;
}

// ── 15 RUST — industrial decay: vertical sooty gradient, irregular dark
//   beams arranged in a sparse lattice, rivets along the joints, sporadic
//   white-hot sparks flying upward, fine dust grain over the whole frame,
//   slow flicker from a broken overhead light. Monochrome warm. ──
vec3 rust(vec2 uv, float aspect){
  float t = u_time * 0.08;
  // Base: very dark warm umbra, slightly lighter at the bottom (floor lit
  // by the faint flicker above).
  vec3 col = mix(vec3(0.025, 0.018, 0.012), vec3(0.06, 0.035, 0.020),
                 smoothstep(1.0, 0.0, uv.y));

  // Broken-light flicker — slow random brightness shift on the whole frame
  // (sin × hashed step gives a "spotty" flicker, not a smooth sine).
  float flicker = 0.85 + 0.15*sin(u_time*1.7) * step(0.55, hash(vec2(floor(u_time*3.0), 0.0)));
  col *= flicker;

  // Rusty patina noise across the whole field — high-frequency oxide
  // pattern in burnt-orange that breaks the flat darkness.
  float patina = fbm(uv*vec2(aspect,1.0)*9.0);
  col += vec3(0.55, 0.28, 0.09) * smoothstep(0.50, 0.90, patina) * 0.22;
  col += vec3(0.42, 0.17, 0.05) * smoothstep(0.65, 1.0, patina) * 0.15;

  // 4 vertical metal BEAMS — irregular edges from sin perturbation. Each
  // beam has a rust outline + dark body so they read as STRUCTURE, not
  // bands.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float bx = 0.12 + fi*0.26;
    float perturb = 0.012*sin(uv.y*22.0 + fi*3.7);
    float dx = abs(uv.x - bx - perturb);
    float beamBody = smoothstep(0.035, 0.025, dx);
    float beamEdge = smoothstep(0.055, 0.035, dx) - beamBody;
    // Dark beam body (subtract from the base).
    col *= mix(vec3(1.0), vec3(0.10, 0.075, 0.045), beamBody);
    // Rust edge along the beam.
    col += vec3(0.82, 0.40, 0.10) * beamEdge * 0.50;
    // RIVETS — 5 round bolts along each beam.
    for(int r=0;r<5;r++){
      float fr = float(r);
      float ry = 0.10 + fr*0.21;
      float rd = sqrt((uv.x - bx - perturb)*(uv.x - bx - perturb) * aspect*aspect +
                       (uv.y - ry)*(uv.y - ry));
      float rivet = smoothstep(0.012, 0.0, rd);
      // Bright rivet head with darker shadow ring.
      col += vec3(0.65, 0.42, 0.20) * rivet * 0.55;
      col += vec3(0.85, 0.55, 0.25) * smoothstep(0.004, 0.0, rd) * 0.45;
    }
  }

  // Horizontal CROSS-BEAMS — two heavy bands at fixed heights with rust
  // texture along their edge. Industrial scaffolding feel.
  float crossA = smoothstep(0.022, 0.015, abs(uv.y - 0.32));
  float crossB = smoothstep(0.022, 0.015, abs(uv.y - 0.78));
  col *= mix(vec3(1.0), vec3(0.10, 0.075, 0.045), crossA + crossB);
  col += vec3(0.78, 0.36, 0.08) * (smoothstep(0.030, 0.022, abs(uv.y - 0.32)) - crossA) * 0.45;
  col += vec3(0.78, 0.36, 0.08) * (smoothstep(0.030, 0.022, abs(uv.y - 0.78)) - crossB) * 0.45;

  // WELDING SPARKS — sporadic bright motes that appear and rise. The hash
  // gate on a moving grid makes them feel like one-shot events, not motes.
  vec2 sp = uv*vec2(aspect,1.0)*vec2(40.0, 30.0);
  sp.y -= u_time*4.5;
  float sparkSeed = hash(floor(sp + vec2(floor(u_time*0.3), 0.0)));
  float spark = exp(-pow(length(fract(sp)-0.5), 2.0)*120.0) *
                step(0.992, sparkSeed);
  float sparkTw = 0.4 + 0.6*sin(u_time*8.0 + sparkSeed*40.0);
  col += vec3(1.0, 0.95, 0.75) * spark * sparkTw * 1.2;
  col += vec3(1.0, 0.55, 0.18) * spark * sparkTw * 0.55;

  // Fine DUST GRAIN — high-frequency hash adds grit, mandatory for the
  // industrial-decay vibe. Anything cleaner reads as a stage set.
  float grain = (hash(uv * 2800.0) - 0.5) * 0.035;
  col += vec3(grain);

  // FLOATING DUST PARTICLES drifting in the slow flicker light.
  vec2 dp = uv*vec2(aspect,1.0)*vec2(60.0, 36.0);
  dp.y -= t*0.5;
  float dustMote = exp(-pow(length(fract(dp)-0.5),2.0)*40.0) *
                   step(0.991, hash(floor(dp)));
  col += vec3(0.55, 0.38, 0.20) * dustMote * 0.30;

  // Heavy vignette — this is a decaying space, the eye should be pulled
  // toward the centre.
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.05, 0.03, 0.015) * smoothstep(0.4, 1.0, r);
  return col;
}

// ── 16 VOID — geometric minimalism: pure black, fine white wireframe
//   shapes (triangles / squares / circles) appearing and dissolving on a
//   long cycle (4-6s lifespan, max 3 visible at once), with a single
//   slowly-rotating central reticule that always reads. The ANTI-spectacle. ──
vec3 void_scene(vec2 uv, float aspect){
  float t = u_time;
  vec3 col = vec3(0.0);

  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float ang = atan(q.y, q.x);

  // Central reticule — a faint thin ring with 8 small ticks, slowly
  // rotating. The only PERSISTENT element so the scene never reads as
  // "is the canvas dead?".
  float reticule = smoothstep(0.0015, 0.0005, abs(r - 0.12));
  col += vec3(0.50) * reticule;
  // 8 tick marks every 45°.
  float tickAng = mod(ang + t*0.04, 0.7854);
  float tick = smoothstep(0.025, 0.020, abs(tickAng - 0.39))
             * smoothstep(0.015, 0.013, abs(r - 0.115));
  col += vec3(0.85) * tick;

  // 3 emergent shapes — each shape has its own slow cycle, never overlaps
  // with another in time. Position and type pseudo-random per cycle.
  for(int i=0;i<3;i++){
    float fi = float(i);
    // Cycle period 5 + i*0.7 seconds, offset so they don't sync.
    float cycle = mod(t/(5.0 + fi*0.7) + fi*0.3, 1.0);
    // Lifespan window: visible 0.15–0.85 of the cycle (faded in/out).
    float vis = smoothstep(0.15, 0.30, cycle) * smoothstep(0.85, 0.70, cycle);
    if(vis < 0.001) continue;
    // Pseudo-random position per cycle.
    float seed = hash(vec2(fi*7.3, floor(t/(5.0 + fi*0.7))));
    vec2 cpos = vec2(0.5 + (seed - 0.5)*1.4,
                      0.5 + (hash(vec2(seed, fi)) - 0.5)*1.4);
    // Shape type: triangle / circle / line based on seed bucket.
    vec2 d = (uv - cpos) * vec2(aspect, 1.0);
    float dd = length(d);
    float shapeAng = atan(d.y, d.x);
    float shape = 0.0;
    if(seed < 0.33){
      // CIRCLE outline — pulses once.
      float ringR = 0.06 + cycle*0.06;
      shape = smoothstep(0.002, 0.001, abs(dd - ringR));
    } else if(seed < 0.66){
      // EQUILATERAL TRIANGLE outline — rotating slowly.
      float side = 0.08;
      float a3 = mod(shapeAng + cycle*1.2 + 1.57, 6.2832);
      float seg = mod(a3, 2.094);
      float distToEdge = abs(dd * cos(seg - 1.047) - side*0.866);
      shape = smoothstep(0.002, 0.001, distToEdge) *
              step(dd, side*1.05);
    } else {
      // HORIZONTAL LINE that draws itself across.
      float lineY = cpos.y;
      float lineProgress = smoothstep(0.15, 0.45, cycle) - smoothstep(0.55, 0.85, cycle);
      shape = smoothstep(0.0015, 0.0005, abs(uv.y - lineY)) *
              step(uv.x, cpos.x + lineProgress*0.4) *
              step(cpos.x - lineProgress*0.4, uv.x);
    }
    col += vec3(0.95) * shape * vis;
  }

  // Very subtle scan line across the whole canvas every ~9s — reminds the
  // viewer that this isn't a static black rectangle.
  float scan = smoothstep(0.002, 0.0, abs(uv.y - fract(t*0.11)));
  col += vec3(0.15) * scan;

  return col;
}

// ── 17 PRISM — laboratory of light: deep almost-black with a tiny radial
//   bloom at the centre (light source), 3-4 rays radiating outward and
//   SPLITTING into spectral bands (red→orange→yellow→green→blue→violet)
//   along their length, slow rotation, scientific feel. ──
vec3 prism(vec2 uv, float aspect){
  float t = u_time * 0.05;
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float ang = atan(q.y, q.x);

  // Almost-black backdrop with a barely-perceptible bluish bias.
  vec3 col = mix(vec3(0.015, 0.018, 0.030), vec3(0.005, 0.005, 0.012),
                 smoothstep(0.0, 1.0, r));

  // CENTRAL LIGHT SOURCE — bright white-hot point with soft outer halo.
  float source = exp(-r*r*420.0);
  float halo = exp(-r*r*22.0);
  col += vec3(1.0) * source * 0.95;
  col += vec3(0.85, 0.88, 1.0) * halo * 0.28;

  // 4 SPECTRAL RAYS at 90° spacings, slowly rotating. Each ray is a thin
  // angular wedge; ALONG the ray we sample a "wavelength" that selects a
  // colour from the visible spectrum so the ray fades through R→V as it
  // travels outward.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float rayAng = fi * 1.5708 + t*0.5;
    float aDelta = abs(mod(ang - rayAng + 3.14159, 6.28318) - 3.14159);
    // Tight angular window: only the ray's narrow wedge lights up.
    float angBand = exp(-aDelta*aDelta*1800.0);
    // Wavelength normalised along the ray (0 = source, 1 = far edge).
    float wl = clamp(r / 0.55, 0.0, 1.0);
    // Spectral lookup — 6 stops blended for the rainbow split.
    vec3 spectrum;
    if(wl < 0.18) spectrum = mix(vec3(1.0), vec3(1.0, 0.20, 0.20), wl/0.18);
    else if(wl < 0.36) spectrum = mix(vec3(1.0, 0.20, 0.20), vec3(1.0, 0.55, 0.0), (wl-0.18)/0.18);
    else if(wl < 0.54) spectrum = mix(vec3(1.0, 0.55, 0.0), vec3(1.0, 1.0, 0.0), (wl-0.36)/0.18);
    else if(wl < 0.72) spectrum = mix(vec3(1.0, 1.0, 0.0), vec3(0.20, 1.0, 0.30), (wl-0.54)/0.18);
    else if(wl < 0.90) spectrum = mix(vec3(0.20, 1.0, 0.30), vec3(0.20, 0.45, 1.0), (wl-0.72)/0.18);
    else spectrum = mix(vec3(0.20, 0.45, 1.0), vec3(0.65, 0.20, 1.0), (wl-0.90)/0.10);
    // Brightness fades along the ray (the source is the hottest spot).
    float bright = exp(-wl*1.8);
    col += spectrum * angBand * bright * 0.95;
  }

  // PHOTON BEADS — small bright dots that travel ALONG each ray outward,
  // staggered so the eye reads them as flowing particles.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float rayAng = fi * 1.5708 + t*0.5;
    vec2 rayDir = vec2(cos(rayAng), sin(rayAng));
    // 3 photons per ray, staggered phase.
    for(int p=0;p<3;p++){
      float fp = float(p);
      float ph = fract(u_time*0.5 + fp*0.33 + fi*0.17);
      vec2 pPos = rayDir * ph * 0.55;
      float pd = distance(q, pPos);
      col += vec3(1.0) * exp(-pd*pd*1200.0) * 0.85;
    }
  }

  // Outer FAINT SPECTRAL HALO around the source so the splitting reads
  // even at low brightness.
  float farHalo = smoothstep(0.55, 0.20, r);
  col += vec3(0.20, 0.18, 0.45) * farHalo * 0.06;

  return col;
}

// ── 18 INK — sumi-e: warm bone-paper background with grain + fibre, a few
//   broad black brush strokes appearing and slowly fading, faint ink bleed
//   where strokes settle, a small red seal in the bottom-right corner that
//   stays visible. CLAIR scene — text rendered on a paper-tone backdrop. ──
vec3 ink(vec2 uv, float aspect){
  float t = u_time * 0.18;
  // Paper background — warm bone with a fibre texture and faint cloud
  // shading so it never reads as a flat white rectangle.
  vec3 paper = vec3(0.96, 0.93, 0.85);
  // Paper fibre — long shallow horizontal scratches at low opacity.
  float fibre = sin(uv.y*180.0 + sin(uv.x*30.0)*0.5) * 0.025;
  paper -= vec3(fibre);
  // Subtle vignette and cloud shading from large-scale FBM.
  float cloud = fbm(uv*vec2(aspect,1.0)*2.5);
  paper -= vec3(0.04, 0.05, 0.06) * smoothstep(0.40, 0.85, cloud);
  // Paper grain — fine speckle.
  float grain = (hash(uv * 1500.0) - 0.5) * 0.025;
  paper += vec3(grain);

  vec3 col = paper;

  // 3 brush strokes — each has a cycle ~6s, fades in (wet) then dries +
  // fades out (slowly absorbed). Strokes are gently curving paths with
  // pressure (thickness) variation along the length.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float cycle = mod(u_time/6.5 + fi*0.42, 1.0);
    float wet = smoothstep(0.0, 0.18, cycle);
    float dry = smoothstep(0.55, 1.0, cycle);
    float life = wet * (1.0 - dry);
    if(life < 0.005) continue;
    // Stroke baseline — a slow sine curve across the canvas.
    float strokeY = 0.22 + fi*0.30;
    float curveX = uv.x;
    float baseY = strokeY + 0.06*sin(curveX*6.0 + fi*1.7);
    float dist = abs(uv.y - baseY);
    // Pressure: thicker in the middle, thinner at the ends.
    float pressure = sin(curveX * 3.14159) * 0.7 + 0.3;
    // Stroke draws itself L-to-R as wet rises (0..1).
    float draw = step(curveX, wet*1.05);
    float thickness = pressure * 0.022 * life * draw;
    float stroke = smoothstep(thickness, thickness*0.55, dist);
    // INK BLEED — a soft halo around the stroke (the paper drinking).
    float bleed = smoothstep(thickness*3.5, thickness*1.5, dist) - stroke;
    col = mix(col, vec3(0.06, 0.04, 0.05), stroke * 0.92);
    col = mix(col, vec3(0.20, 0.16, 0.18), bleed * 0.30 * life);
  }

  // RED SEAL in the bottom-right — small square with rounded glyph
  // strokes. Always present (the artist signed the piece).
  vec2 sealC = vec2(0.88, 0.08);
  vec2 sd = (uv - sealC) * vec2(aspect, 1.0);
  float seal = step(abs(sd.x), 0.035) * step(abs(sd.y), 0.035);
  // Glyph: a simple cross inside the seal.
  float glyphV = step(abs(sd.x), 0.005) * step(abs(sd.y), 0.025);
  float glyphH = step(abs(sd.y), 0.005) * step(abs(sd.x), 0.025);
  float sealShape = seal - (glyphV + glyphH);
  col = mix(col, vec3(0.80, 0.10, 0.10), sealShape * 0.95);

  // Faint ageing — corner darkening like an old scroll.
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.04, 0.05, 0.06) * smoothstep(0.55, 1.05, r);

  // Reference t so the uniform isn't dead-stripped (animation comes from
  // the wet-stroke cycle that already uses u_time directly).
  col += vec3(0.0) * t;
  return col;
}

// ── 19 BLOOM — infinite garden. Fully rewritten for CRISP, REALISTIC
//   flowers: petal width follows sin(u*PI) so tips taper to zero naturally
//   (no hard cutoff = no "coupees"). All edges are smoothstep (no gaussian
//   blur). Extra atmospheric layers: cloud wisps, grass, dappled sunlight.
//   GLSL ES 1.00 safe: no continue, no float ternaries, no exponent
//   literals, constant loop bounds only. ──
vec3 bloom(vec2 uv, float aspect){
  float t = u_time;
  float intensityK = clamp(u_intensity, 0.0, 2.0);

  // ── SKY-TO-MEADOW ── warm pastel gradient, clean, no banding.
  vec3 col = mix(vec3(0.72, 0.84, 0.94), vec3(0.82, 0.92, 0.80),
                 smoothstep(0.0, 1.0, uv.y));

  // Warm sun glow upper-right.
  float sd = length((uv - vec2(0.78, 0.14)) * vec2(aspect, 1.0));
  col += vec3(1.0, 0.97, 0.82) * exp(-sd*sd*5.5) * 0.20;

  // ── CLOUD WISPS ── elongated ellipses drifting slowly.
  for(int i=0; i<2; i++){
    float fi = float(i);
    float cx = fract(0.22 + fi*0.45 + t*0.006*(1.0 + fi*0.5));
    float cy = 0.10 + fi*0.06;
    vec2 cd = (uv - vec2(cx, cy)) * vec2(aspect, 1.0);
    float cloud = smoothstep(0.14, 0.0, abs(cd.x))
                * smoothstep(0.013, 0.0, abs(cd.y));
    col = mix(col, vec3(1.0, 1.0, 0.98), cloud * 0.28);
  }

  // ── GRASS ── wavy top edge, darker base for depth.
  float grassTop = 0.86 + 0.018*sin(uv.x*35.0 + t*0.2)
                        + 0.010*sin(uv.x*58.0 - t*0.15);
  float grassMask = smoothstep(grassTop + 0.015, grassTop - 0.005, uv.y);
  col = mix(col, vec3(0.42, 0.66, 0.36), grassMask * 0.50);
  col = mix(col, vec3(0.30, 0.52, 0.26),
            smoothstep(0.94, 1.0, uv.y) * grassMask * 0.50);

  // ── FIVE VINES with crisp realistic flowers (BloomPad quality) ──
  for(int i=0; i<5; i++){
    float fi = float(i);
    float vx = 0.10 + fi*0.195;
    float growH = 0.38 + 0.10*sin(t*0.08 + fi*1.3) + fi*0.018;

    // Early-out guard: only process pixels near the vine.
    if(uv.y <= growH + 0.06){

      // ── STEM: crisp two-tone line with gentle sway ──
      float sway = 0.030*sin(uv.y*6.0 + fi*1.8 + t*0.12);
      float stemX = vx + sway;
      float stemDx = abs(uv.x - stemX) * aspect;
      float stemFade = smoothstep(growH + 0.002, growH - 0.02, uv.y)
                     * smoothstep(1.01, 0.94, uv.y);
      // Smoothstep edges (NOT gaussian blur).
      float stemO = smoothstep(0.0045, 0.0025, stemDx);
      float stemI = smoothstep(0.0020, 0.0008, stemDx);
      col = mix(col, vec3(0.34, 0.58, 0.32), stemO * stemFade * 0.65);
      col = mix(col, vec3(0.24, 0.46, 0.26), stemI * stemFade * 0.80);

      // ── LEAVES: 2 per vine, with central vein highlight ──
      for(int l=0; l<2; l++){
        float fl = float(l);
        float ly = growH + (1.0 - growH) * (0.30 + fl*0.30);
        float leafVis = smoothstep(growH + 0.005, growH - 0.01, ly);
        if(leafVis > 0.01){
          float side = sign(mod(fl + fi, 2.0) - 0.5);
          float lx = stemX + side * 0.025;
          vec2 ld = (uv - vec2(lx, ly)) * vec2(aspect, 1.0);
          float tiltA = side * 0.65;
          float cs = cos(tiltA);
          float sn = sin(tiltA);
          float rx = ld.x*cs - ld.y*sn;
          float ry = ld.x*sn + ld.y*cs;
          // Teardrop leaf with crisp smoothstep edge.
          float leafR = rx*rx*1000.0 + ry*ry*4500.0;
          float leaf = smoothstep(1.3, 0.5, leafR);
          col = mix(col, vec3(0.38, 0.64, 0.34), leaf * 0.78 * leafVis);
          // Central vein highlight.
          float vein = smoothstep(0.004, 0.001, abs(ry))
                     * smoothstep(-0.002, 0.005, rx)
                     * smoothstep(0.030, 0.018, rx);
          col = mix(col, vec3(0.52, 0.76, 0.44),
                    vein * leaf * leafVis * 0.40);
        }
      }

      // ── FLOWER: 5 teardrop petals, ZERO halo, crisp edges ──
      vec2 fc = vec2(stemX, growH);
      vec2 fd = (uv - fc) * vec2(aspect, 1.0);
      float fdist = length(fd);
      float bPulse = 0.92 + 0.08*sin(u_time*0.7 + fi*1.6);

      // Per-vine petal colour (if/else — no float ternaries).
      vec3 pCol = vec3(1.0, 0.55, 0.72);
      if(fi < 0.5){
        pCol = vec3(1.0, 0.50, 0.68);
      } else if(fi < 1.5){
        pCol = vec3(1.0, 0.72, 0.58);
      } else if(fi < 2.5){
        pCol = vec3(0.96, 0.68, 0.86);
      } else if(fi < 3.5){
        pCol = vec3(1.0, 0.82, 0.48);
      }

      // Five petals — width = sin(uu*PI) tapers to ZERO at tip.
      // No hard cutoff needed: the width naturally rounds the tip.
      float petalMask = 0.0;
      for(int k=0; k<5; k++){
        float fk = float(k);
        float pang = fk * 1.2566 + fi * 0.52 + 1.5708;
        vec2 pdir = vec2(cos(pang), sin(pang));
        vec2 perp = vec2(-pdir.y, pdir.x);
        float along = dot(fd, pdir);
        float across = dot(fd, perp);

        // Petal SDF: teardrop shape.
        float pLen = 0.050;
        float uu = clamp(along / pLen, 0.0, 1.0);
        // sin(uu*PI): 0 at base, 1 at mid, 0 at tip.
        // (1-0.22*uu) narrows the tip for a teardrop look.
        float halfW = pLen*0.30 * sin(uu*PI) * (1.0 - 0.22*uu);

        // Crisp smoothstep edge (NOT gaussian blur).
        float inP = smoothstep(halfW + 0.0028, halfW - 0.0005, abs(across))
                  * smoothstep(-0.002, 0.005, along);
        petalMask = max(petalMask, inP);
      }

      // Apply petals — flat colour + subtle surface sheen.
      col = mix(col, pCol, petalMask * 0.93 * bPulse);
      col += vec3(1.0, 0.98, 0.94) * petalMask*petalMask * 0.16;

      // Yellow centre disc (crisp smoothstep, not a gaussian blob).
      float cDisc = smoothstep(0.014, 0.010, fdist) * bPulse;
      col = mix(col, vec3(1.0, 0.88, 0.38), cDisc * 0.95);
      // Stamen ring — darker annulus around centre.
      float stRing = smoothstep(0.013, 0.011, fdist)
                   * smoothstep(0.007, 0.009, fdist);
      col = mix(col, vec3(0.58, 0.40, 0.16), stRing * 0.40);
      // Pistil — dark centre dot.
      float pistil = smoothstep(0.005, 0.003, fdist);
      col = mix(col, vec3(0.42, 0.28, 0.10), pistil * 0.50);
    }
  }

  // ── FALLING PETALS — crisp spinning ellipses ──
  for(int i=0; i<14; i++){
    float fi = float(i);
    if(fi <= intensityK * 9.0){
      float lane = fract(fi*0.137 + sin(fi*1.7)*0.21);
      float phase = fract(u_time*0.07 + fi*0.18);
      float px = lane + 0.07*sin(phase*6.28 + fi);
      float py = 1.0 - phase * 1.14;
      vec2 pp = (uv - vec2(px, py)) * vec2(aspect, 1.0);
      float spinAng = phase * 9.0 + fi;
      float cs = cos(spinAng);
      float sn = sin(spinAng);
      float rx = pp.x*cs - pp.y*sn;
      float ry = pp.x*sn + pp.y*cs;
      // Crisp mini-petal with smoothstep (not gaussian).
      float petalR = rx*rx*2600.0 + ry*ry*7000.0;
      float petal = smoothstep(1.4, 0.4, petalR);
      vec3 fpc = mix(vec3(1.0, 0.58, 0.72), vec3(1.0, 0.84, 0.90), lane);
      col = mix(col, fpc, petal * 0.72);
    }
  }

  // ── FIREFLIES — sharp bright core, tiny warm glow ──
  for(int i=0; i<8; i++){
    float fi = float(i);
    float fx = 0.10 + fi*0.105 + 0.04*sin(u_time*0.55 + fi*1.3);
    float fy = 0.20 + 0.42*(fi/8.0) + 0.035*cos(u_time*0.75 + fi*2.1);
    vec2 ffd = (uv - vec2(fx, fy)) * vec2(aspect, 1.0);
    float ffdist = length(ffd);
    float ffP = max(0.45 + 0.55*sin(u_time*1.9 + fi*4.7), 0.0);
    float core = smoothstep(0.004, 0.002, ffdist);
    float glow = exp(-ffdist*ffdist*10000.0);
    col += vec3(1.0, 0.93, 0.50) * (core*0.80 + glow*0.30) * ffP;
  }

  // ── DAPPLED SUNLIGHT on grass ──
  for(int i=0; i<3; i++){
    float fi = float(i);
    float dx = 0.15 + fi*0.28 + 0.03*sin(t*0.08 + fi*2.2);
    float dy = 0.92 + 0.025*sin(fi*3.1);
    vec2 dd = (uv - vec2(dx, dy)) * vec2(aspect, 1.0);
    float spk = exp(-dot(dd,dd)*800.0);
    float flk = 0.55 + 0.45*sin(t*0.3 + fi*1.8);
    col += vec3(1.0, 0.98, 0.80) * spk * flk * 0.10 * grassMask;
  }

  return col;
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
  else if(u_scene==7) col = volcanic(uv, aspect);
  else if(u_scene==8) col = abyss(uv, aspect);
  else if(u_scene==9) col = eclipse(uv, aspect);
  else if(u_scene==10) col = phantom(uv, aspect);
  else if(u_scene==11) col = emberforge(uv, aspect);
  else if(u_scene==12) col = tempus(uv, aspect);
  else if(u_scene==13) col = storm(uv, aspect);
  else if(u_scene==14) col = coral(uv, aspect);
  else if(u_scene==15) col = rust(uv, aspect);
  else if(u_scene==16) col = void_scene(uv, aspect);
  else if(u_scene==17) col = prism(uv, aspect);
  else if(u_scene==18) col = ink(uv, aspect);
  else if(u_scene==19) col = bloom(uv, aspect);
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
    } else if (u_scene == 7) {
      // Volcanic → lava eruption burst from the tap point.
      col += vec3(1.0,0.35,0.0) * exp(-td*td*40.0) * exp(-age*2.0) * 1.4;
      col += vec3(1.0,0.7,0.2) * sin(td*30.0 - age*8.0) * exp(-td*5.0) * exp(-age*2.5) * 0.5;
    } else if (u_scene == 8) {
      // Abyss → bioluminescent pulse radiating outward.
      col += vec3(0.0,0.9,0.8) * sin(td*35.0 - age*6.0) * exp(-td*4.0) * exp(-age*2.8) * 0.5;
      col += vec3(1.0,0.3,0.65) * exp(-td*td*60.0) * exp(-age*1.8) * 0.6;
    } else if (u_scene == 9) {
      // Eclipse → TAP: small diamond bead glint at touch (subtle, NEVER blinds).
      //   LONG-PRESS: corona breathes around the touch point (the eclipse
      //   "exhales" with the held finger).
      //   SWIPE (u_swipeDx): drags a golden trail across the screen.
      float h9 = clamp(u_hold, 0.0, 1.0);
      // Tap: tight golden glint (subtle).
      col += vec3(1.0,0.92,0.65) * exp(-td*td*90.0) * exp(-age*2.8) * 0.45;
      // Hold: corona ring growth at touch, breathing.
      float coronaH = smoothstep(0.012,0.0, abs(td - 0.04 - h9*0.10));
      col += vec3(1.0,0.78,0.35) * coronaH * h9 * (0.65 + 0.35*sin(u_time*2.5)) * 0.50;
      // Swipe: a horizontal trail of light across the canvas (dx-driven).
      float trail9 = exp(-abs((uv.y - tuv.y))*aspect*9.0) * smoothstep(0.0,0.5,u_swipeMag);
      col += vec3(1.0,0.80,0.35) * trail9 * exp(-u_swipeAge*1.5) * 0.30;
    } else if (u_scene == 10) {
      // Phantom → TAP: subtle ghost glow (gentle).
      //   LONG-PRESS: a soul orb MATERIALISES at the touch, growing with hold.
      //   SWIPE: parts the mist sideways like curtains in a haunted hall.
      float h10 = clamp(u_hold, 0.0, 1.0);
      // Tap: gentle pale halo.
      col += vec3(0.85,0.92,1.0) * exp(-td*td*60.0) * exp(-age*1.8) * 0.42;
      // Hold: bright orb GROWS with hold + outer glow.
      float orbR = 0.025 + h10*0.06;
      float orb = exp(-pow((td - 0.0)*1.0, 2.0) / (orbR*orbR));
      col += vec3(0.95,0.98,1.0) * orb * h10 * (0.65 + 0.20*sin(u_time*2.0)) * 0.45;
      col += vec3(0.55,0.75,0.95) * exp(-td*td*20.0) * h10 * 0.20;
      // Swipe: a parting curtain — soft horizontal band of bright pixels.
      float partY = exp(-pow((uv.y - tuv.y)*aspect*4.5, 2.0));
      col += vec3(0.70,0.85,1.0) * partY * smoothstep(0.0,0.6,u_swipeMag) *
             exp(-u_swipeAge*1.3) * 0.25;
    } else if (u_scene == 11) {
      // Emberforge → TAP: gentle ember pop (no blinding spark).
      //   LONG-PRESS: forge mouth at the touch WIDENS + brightens (you fan
      //   the coals with your finger). The longer you hold, the bigger the
      //   blaze.
      //   SWIPE: trail of sparks follows the finger horizontally.
      float h11 = clamp(u_hold, 0.0, 1.0);
      col += vec3(1.0,0.65,0.20) * exp(-td*td*80.0) * exp(-age*2.5) * 0.55;
      // Hold: a bright forge mouth grows under the touch (warm radial).
      float forgeR = 0.04 + h11*0.14;
      float forge = exp(-td*td / (forgeR*forgeR));
      col += vec3(1.0,0.55,0.10) * forge * h11 * (0.55 + 0.25*sin(u_time*4.0)) * 0.55;
      col += vec3(1.0,0.85,0.45) * exp(-td*td*200.0) * h11 * 0.40;
      // Swipe: spark trail (smaller bright dots floating along the swipe).
      float trailE = exp(-abs(uv.y - tuv.y)*aspect*12.0);
      col += vec3(1.0,0.70,0.15) * trailE * smoothstep(0.0,0.5,u_swipeMag) *
             exp(-u_swipeAge*1.8) * 0.30;
    } else if (u_scene == 12) {
      // Tempus → TAP: small sepia ripple (calm).
      //   LONG-PRESS: time SLOWS — bronze glow grows at touch, edges of the
      //   canvas darken slightly (time fracture).
      //   SWIPE: sand sweeps in the direction of the swipe (dust trail).
      float h12 = clamp(u_hold, 0.0, 1.0);
      col += vec3(0.85,0.55,0.20) * exp(-td*td*55.0) * exp(-age*2.0) * 0.42;
      // Hold: bronze glow + dusk haze.
      float fract12 = smoothstep(0.020,0.0, abs(td - h12*0.18));
      col += vec3(0.85,0.55,0.20) * fract12 * h12 * 0.45;
      col += vec3(0.95,0.78,0.32) * exp(-td*td*22.0) * h12 * 0.20;
      // Slight darkening at edges when held (time fracture).
      col -= vec3(0.04,0.025,0.012) * h12 * smoothstep(0.5, 1.05, length((uv-0.5)*vec2(aspect,1.0)));
      // Swipe: horizontal dust band.
      float sandTr = exp(-abs(uv.y - tuv.y)*aspect*7.0);
      col += vec3(0.75,0.45,0.18) * sandTr * smoothstep(0.0,0.5,u_swipeMag) *
             exp(-u_swipeAge*1.4) * 0.22;
    } else if (u_scene == 13) {
      // Storm → TAP: gentle cloud illumination (no full lightning).
      //   LONG-PRESS: a bolt CHARGES — bright spot at finger + intensifies →
      //   when released (age starts climbing), the bolt STRIKES.
      //   SWIPE: rain visibly DRIVEN in the swipe direction (wind).
      float h13 = clamp(u_hold, 0.0, 1.0);
      // Tap: soft cyan cloud illumination at touch.
      col += vec3(0.30,0.55,0.85) * exp(-td*td*30.0) * exp(-age*2.5) * 0.50;
      // Hold: charging glow at finger.
      col += vec3(0.55,0.75,1.0) * exp(-td*td*180.0) * h13 * (0.55 + 0.25*sin(u_time*8.0)) * 0.55;
      // Release strike: only fires when age is fresh AND came after a charge.
      float boltDist = abs((uv.x - tuv.x) * aspect);
      float boltMask = exp(-boltDist * 60.0) * smoothstep(1.0, tuv.y, uv.y);
      col += vec3(0.55,0.85,1.0) * boltMask * smoothstep(0.0,0.05,age) *
             exp(-age*5.0) * 0.85;
      col += vec3(0.95,0.95,0.85) * exp(-td*td*100.0) * exp(-age*5.0) * 0.65;
      // Swipe: wind-driven rain band (visible bright band drifting with swipe).
      float windBand = exp(-abs(uv.y - tuv.y)*aspect*5.0);
      col += vec3(0.55,0.70,0.95) * windBand * smoothstep(0.0,0.4,u_swipeMag) *
             exp(-u_swipeAge*1.3) * 0.22;
    } else if (u_scene == 14) {
      // Coral → TAP: anemone-style pulsing ring at the touch + tiny brightening.
      //   LONG-PRESS: a glowing anemone GROWS under the finger (bioluminescent
      //   focal point you "wake up" by holding).
      //   SWIPE: school of fish DARTS in the direction (bright wake band).
      float h14 = clamp(u_hold, 0.0, 1.0);
      // Tap: bright cyan-green focal point.
      col += vec3(0.30,1.0,0.80) * exp(-td*td*220.0) * exp(-age*2.5) * 0.85;
      // Tap: expanding ring pulse.
      float coralRing = smoothstep(0.012, 0.0, abs(td - 0.04 - age*0.18));
      col += vec3(0.70,1.0,0.92) * coralRing * exp(-age*1.6) * 0.55;
      // Hold: growing anemone with petals.
      float anR = 0.04 + h14*0.10;
      float anemone = exp(-td*td / (anR*anR));
      col += vec3(0.30,1.0,0.80) * anemone * h14 * (0.55 + 0.25*sin(u_time*3.5)) * 0.60;
      // Hold: 8 angular petals around the held centre.
      float ang14 = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
      float petalLobes = 0.55 + 0.45*cos(ang14*8.0);
      float anHalo = exp(-td*td*60.0) * petalLobes;
      col += vec3(1.0,0.45,0.45) * anHalo * h14 * 0.35;
      // Swipe: bright horizontal wake — fish school darting through.
      float fishWake = exp(-abs(uv.y - tuv.y)*aspect*9.0);
      col += vec3(1.0,0.92,0.65) * fishWake * smoothstep(0.0,0.4,u_swipeMag) *
             exp(-u_swipeAge*1.5) * 0.30;
    } else if (u_scene == 15) {
      // Rust → TAP: a bright welding flash + hot ember at touch.
      //   LONG-PRESS: a forge mouth GLOWS under the finger (you "stoke" it).
      //   SWIPE: a shower of sparks streaks across following the swipe.
      float h15 = clamp(u_hold, 0.0, 1.0);
      // Tap: hot orange flash.
      col += vec3(1.0,0.55,0.10) * exp(-td*td*85.0) * exp(-age*3.0) * 0.85;
      // Tap: white-hot bead at the centre.
      col += vec3(1.0,0.95,0.78) * exp(-td*td*420.0) * exp(-age*2.5) * 0.95;
      // Hold: rusty glow growing.
      float forgeR15 = 0.05 + h15*0.13;
      float forge15 = exp(-td*td / (forgeR15*forgeR15));
      col += vec3(0.95,0.45,0.10) * forge15 * h15 * (0.55 + 0.20*sin(u_time*5.0)) * 0.55;
      // Hold: bright inner glow.
      col += vec3(1.0,0.85,0.45) * exp(-td*td*250.0) * h15 * 0.45;
      // Swipe: shower of orange-amber particles along the swipe band.
      float sparkBand = exp(-abs(uv.y - tuv.y)*aspect*8.0);
      // Modulate by a high-frequency sin so the band reads as discrete sparks.
      sparkBand *= 0.5 + 0.5*sin(uv.x*aspect*60.0 + u_time*8.0);
      col += vec3(1.0,0.70,0.20) * sparkBand * smoothstep(0.0,0.4,u_swipeMag) *
             exp(-u_swipeAge*1.6) * 0.45;
    } else if (u_scene == 16) {
      // Void → TAP: a clean white reticule expands and fades (direct
      //   "interaction with motifs" Alex asked for — touching the void leaves
      //   a precise geometric trace).
      //   LONG-PRESS: a hexagram materialises around the finger, intensifying.
      //   SWIPE: a sharp white line traces the swipe path.
      float h16 = clamp(u_hold, 0.0, 1.0);
      // Tap: small bright dot.
      col += vec3(1.0) * exp(-td*td*1200.0) * exp(-age*3.5) * 1.0;
      // Tap: expanding crosshair lines (NS + EW).
      float reticule16 = smoothstep(0.001, 0.0, abs(td - 0.025 - age*0.08));
      col += vec3(1.0) * reticule16 * exp(-age*1.8) * 0.85;
      // Hold: 6-pointed star polygon around the finger.
      float angV = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
      float starWedge = abs(sin(angV*3.0));
      float starR = 0.06 + h16*0.10;
      float starLine = smoothstep(0.001, 0.0, abs(td - starR*starWedge));
      col += vec3(1.0) * starLine * h16 * 0.95;
      // Hold: pure white inner bead.
      col += vec3(1.0) * exp(-td*td*600.0) * h16 * 0.55;
      // Swipe: sharp horizontal line through the finger Y.
      float swipeLine = smoothstep(0.001, 0.0, abs(uv.y - tuv.y));
      col += vec3(1.0) * swipeLine * smoothstep(0.0,0.3,u_swipeMag) *
             exp(-u_swipeAge*1.4) * 0.85;
    } else if (u_scene == 17) {
      // Prism → TAP: a quick spectral burst at the touch (light prism flash).
      //   LONG-PRESS: a rainbow ring grows around the finger.
      //   SWIPE: a spectral trail (rainbow band) follows.
      float h17 = clamp(u_hold, 0.0, 1.0);
      // Tap: white-hot bead.
      col += vec3(1.0) * exp(-td*td*1100.0) * exp(-age*2.5) * 1.0;
      // Tap: small rainbow halo around it.
      float prismAng = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
      float halo17 = exp(-td*td*200.0) * exp(-age*1.5);
      vec3 rb = vec3(0.5 + 0.5*sin(prismAng*3.0 + 0.0),
                     0.5 + 0.5*sin(prismAng*3.0 + 2.09),
                     0.5 + 0.5*sin(prismAng*3.0 + 4.18));
      col += rb * halo17 * 0.85;
      // Hold: a spectral ring at constant radius (the prism ring "wakes").
      float spRingR = 0.10 + h17*0.06;
      float spRing = exp(-pow((td - spRingR)*28.0, 2.0));
      col += rb * spRing * h17 * 0.85;
      // Swipe: rainbow trail along the swipe axis.
      float prismBand = exp(-abs(uv.y - tuv.y)*aspect*7.0);
      // Modulate along x with spectral hue cycling for "rainbow band" reading.
      vec3 trailRB = vec3(0.5 + 0.5*sin(uv.x*aspect*22.0 + 0.0),
                          0.5 + 0.5*sin(uv.x*aspect*22.0 + 2.09),
                          0.5 + 0.5*sin(uv.x*aspect*22.0 + 4.18));
      col += trailRB * prismBand * smoothstep(0.0,0.35,u_swipeMag) *
             exp(-u_swipeAge*1.4) * 0.45;
    } else if (u_scene == 18) {
      // Ink → TAP: a black ink blot lands and bleeds outward.
      //   LONG-PRESS: a stroke "draws itself" outward from the finger.
      //   SWIPE: an ink stroke trail along the swipe path.
      float h18 = clamp(u_hold, 0.0, 1.0);
      // Tap: dark central drop.
      col = mix(col, vec3(0.06, 0.04, 0.05), exp(-td*td*350.0) * exp(-age*1.8) * 0.85);
      // Tap: paper-soak halo (lighter ink around the drop).
      col = mix(col, vec3(0.30, 0.25, 0.28), exp(-td*td*60.0) * exp(-age*1.2) * 0.18);
      // Hold: stroke ring grows.
      float strokeR18 = 0.03 + h18*0.10;
      float stroke18 = smoothstep(0.006, 0.0, abs(td - strokeR18));
      col = mix(col, vec3(0.05, 0.03, 0.04), stroke18 * h18 * 0.85);
      // Swipe: ink trail along the swipe axis.
      float inkBand = smoothstep(0.012, 0.0, abs(uv.y - tuv.y));
      col = mix(col, vec3(0.06, 0.04, 0.05),
                inkBand * smoothstep(0.0,0.3,u_swipeMag) * exp(-u_swipeAge*1.5) * 0.85);
    } else if (u_scene == 19) {
      // Bloom → TAP: a 5-petal flower blooms briefly at the finger (the
      //   shader companion to the PremiumTouchLayer's draggable petal — the
      //   petal floats above this bloom).
      //   LONG-PRESS: the flower stays open and pulses with the held finger.
      //   SWIPE: pollen / petal trail follows the swipe.
      float h19 = clamp(u_hold, 0.0, 1.0);
      // Bloom flower: 5-petal lobes around the touch.
      float angB = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
      float lobesB = 0.55 + 0.45*cos(angB*5.0);
      float bloomR = 0.07 + h19*0.06;
      float bloomFlower = smoothstep(bloomR, bloomR*0.35, td) * lobesB;
      // Colour cycles slowly so consecutive taps feel varied.
      float hueT = u_time*0.4;
      vec3 bloomCol = vec3(0.5 + 0.5*sin(hueT + 0.0),
                           0.5 + 0.5*sin(hueT + 2.09),
                           0.5 + 0.5*sin(hueT + 4.18));
      // Saturated petal pink — clamp the bloomCol mix toward warm pink.
      bloomCol = mix(vec3(1.0, 0.55, 0.75), bloomCol, 0.4);
      col = mix(col, bloomCol, bloomFlower * exp(-age*1.2) * (0.85 + h19*0.15));
      // Bright yellow centre.
      col = mix(col, vec3(1.0, 0.92, 0.40), exp(-td*td*1800.0) * (exp(-age*1.5) + h19*0.5) * 0.95);
      // Swipe: pollen trail (yellow dotted band).
      float pollenBand = exp(-abs(uv.y - tuv.y)*aspect*6.0);
      pollenBand *= 0.4 + 0.6*sin(uv.x*aspect*45.0 + u_time*3.0);
      col += vec3(1.0, 0.85, 0.45) * pollenBand * smoothstep(0.0,0.35,u_swipeMag) *
             exp(-u_swipeAge*1.4) * 0.32;
    } else {
      // Galaxy / Nebula / Aurora / Casino → a soft universal ripple.
      col += vec3(0.80,0.85,1.0) * sin(td*26.0 - age*7.0) * exp(-td*4.8) * exp(-age*2.6) * 0.35;
    }
  }

  float vig = distance(uv, vec2(0.5));
  // Light scenes (ink, bloom, void) don't get the heavy edge darkening —
  // it greys out paper / sky / the deliberate void in a way that fights
  // the theme's identity. They already paint their own subtler ambience.
  if (u_scene == 16 || u_scene == 18 || u_scene == 19) {
    col *= mix(1.0, 0.92, smoothstep(0.4, 0.95, vig));
  } else {
    col *= mix(1.04, 0.58, smoothstep(0.2,0.95,vig));
  }
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
  // Player intensity for the active scene's premium set (storm/coral/…).
  // Lives in a ref so the frame loop reads the live value without re-running
  // the GL setup effect on every slider tick.
  const intensity = useStore((s) => s.player.premiumIntensity?.[scene] ?? 1.0);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

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
    const MIN_DT = 1000 / 60; // 60fps — capable devices run smooth; battery saved by visibility pause
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
    let uSwipeMag: WebGLUniformLocation | null = null;
    let uSwipeAge: WebGLUniformLocation | null = null;
    let uIntensity: WebGLUniformLocation | null = null;
    let running = false;
    let start = performance.now();
    let last = 0;
    // Touch state for the per-scene backdrop interaction.
    let touchX = -1e6, touchY = -1e6, touchDownAt = -1e6, hold = 0;
    let pressing = false;
    // Swipe detection — horizontal-dominant move that DOESN'T conflict with
    // vertical scroll. Recorded on pointer move; magnitude normalised to
    // [0,1] over half a viewport width.
    let downX = 0, downY = 0, swipeMag = 0, swipeEndedAt = -1e6;
    const SWIPE_TRIGGER_PX = 36;  // dead-zone before counting as swipe
    let swipeArmed = false;

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
      uSwipeMag = gl.getUniformLocation(prog, "u_swipeMag");
      uSwipeAge = gl.getUniformLocation(prog, "u_swipeAge");
      uIntensity = gl.getUniformLocation(prog, "u_intensity");
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
        gl.uniform1f(uSwipeMag, swipeMag);
        gl.uniform1f(uSwipeAge, (now - swipeEndedAt) / 1000);
        gl.uniform1f(uIntensity, intensityRef.current);
        // Swipe magnitude fades to zero gradually so the trail tail dies out.
        swipeMag = Math.max(0, swipeMag - dt * 1.2);
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

    // Touch interaction → feed finger position (GL y-up) + press state + swipe
    // magnitude to the shader. Listened on window since the canvas is
    // pointer-events:none. Swipe detection: arms only when horizontal motion
    // dominates vertical (|dx| > |dy|*1.2) AND exceeds a dead-zone. This way
    // a vertical scroll on a menu list NEVER triggers a backdrop swipe.
    const setTouch = (e: PointerEvent) => {
      touchX = e.clientX * dpr;
      touchY = canvas.height - e.clientY * dpr;
    };
    const onTDown = (e: PointerEvent) => {
      // NEVER react to touch during a match (classic / ranked / constellation /
      // training). Match surfaces call useNoMenuFx() → menuFxSuppressed() is
      // true; the playmat is for playing, not for painting backdrop ripples.
      if (menuFxSuppressed()) return;
      setTouch(e);
      touchDownAt = performance.now();
      pressing = true;
      downX = e.clientX;
      downY = e.clientY;
      swipeArmed = false;
      startLoop();
    };
    const onTMove = (e: PointerEvent) => {
      if (menuFxSuppressed()) { pressing = false; return; }
      if (pressing) {
        setTouch(e);
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (!swipeArmed && Math.abs(dx) > SWIPE_TRIGGER_PX &&
            Math.abs(dx) > Math.abs(dy) * 1.2) {
          swipeArmed = true;
        }
        if (swipeArmed) {
          // Magnitude rises with absolute horizontal displacement, capped at
          // half-viewport-width for a clean [0,1] range. Sign isn't tracked
          // — the shader uses magnitude only (per-scene direction is implicit).
          swipeMag = Math.min(1, Math.abs(dx) / (window.innerWidth * 0.5));
        }
      }
    };
    const onTUp = () => {
      pressing = false;
      if (swipeArmed) swipeEndedAt = performance.now();
      swipeArmed = false;
    };
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
