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
  | "tempus" | "storm";

const SCENE_INDEX: Record<BackdropScene, number> = {
  nebula: 0, aurora: 1, grid: 2, galaxy: 3, holy: 4, quantum: 5, casino: 6,
  volcanic: 7, abyss: 8, eclipse: 9, phantom: 10, emberforge: 11,
  tempus: 12, storm: 13,
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

  // ── SUBTLE STARS ──
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

// ── 12 TEMPUS — sands of time, ancient gears, sepia hourglass dunes ──
vec3 tempus(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*3.0;
  float t = u_time*0.06;
  // Warm sepia sand void.
  vec3 col = mix(vec3(0.10,0.06,0.03), vec3(0.04,0.03,0.01), length(uv-0.5)*1.2);
  // Sand grain texture — high-frequency FBM in warm tones.
  float sand = fbm(p*2.5 + vec2(t*0.3, t*0.2));
  col += vec3(0.30,0.18,0.08) * sand * 0.25;
  // Rotating gear shadow — circular FBM arcs.
  float ang = atan((uv.y-0.5)*aspect, uv.x-0.5);
  float gearR = length((uv-0.5)*vec2(aspect,1.0));
  float teeth = abs(sin(ang*12.0 + t*0.4))*0.5+0.5;
  float gear = smoothstep(0.22, 0.20, gearR) * smoothstep(0.32, 0.30, gearR) * teeth;
  col += vec3(0.45,0.28,0.12) * gear * 0.16;
  // Second gear counter-rotating.
  float teeth2 = abs(sin(ang*8.0 - t*0.28))*0.5+0.5;
  float gear2 = smoothstep(0.42, 0.40, gearR) * smoothstep(0.52, 0.50, gearR) * teeth2;
  col += vec3(0.35,0.20,0.08) * gear2 * 0.10;
  // Hourglass glow at the centre — warm golden bloom breathing.
  col += vec3(0.55,0.35,0.12) * exp(-gearR*gearR*18.0) * (0.4+0.2*sin(t*0.9));
  // Falling sand grains — sparse dots dropping down.
  vec2 sp = uv*vec2(aspect,1.0)*vec2(50.0,35.0); sp.y -= t*1.8;
  float grain = exp(-pow(length(fract(sp)-0.5),2.0)*40.0) * step(0.988, hash(floor(sp)));
  col += vec3(0.60,0.38,0.18) * grain * 0.28;
  // Faint bronze vignette.
  col += vec3(0.15,0.08,0.03) * (1.0 - smoothstep(0.3,1.0, gearR)) * 0.2;
  return col;
}

// ── 13 STORM — tempest fury, lightning, rain curtains, rolling clouds ──
vec3 storm(vec2 uv, float aspect){
  float t = u_time*0.07;
  // Deep thunderhead sky — darkest at bottom, lighter toward top. Adds a
  // slow horizontal sway so the entire sky pulses with wind tension.
  float skySway = 0.92 + 0.08*sin(u_time*0.3);
  vec3 col = mix(vec3(0.03,0.04,0.10), vec3(0.06,0.08,0.16),
                 smoothstep(0.0,1.0,uv.y)) * skySway;

  // ROLLING THUNDERHEADS — two FBM cloud layers at different scales and
  // drift directions for parallax depth.
  float cloudA = fbm(vec2(uv.x*5.0 + t*0.5, uv.y*4.0));
  float cloudB = fbm(vec2(uv.x*9.0 - t*0.8, uv.y*3.0 + 0.7));
  col += vec3(0.07,0.09,0.16) * cloudA * smoothstep(0.0,0.7,uv.y) * 0.4;
  col += vec3(0.04,0.06,0.12) * cloudB * smoothstep(0.0,0.5,uv.y) * 0.25;

  // DISTANT HORIZON LIGHTNING — soft amber-violet glow pulsing at the
  // bottom (you "see" lightning beyond the horizon you can't reach).
  float horizon = smoothstep(0.3, 0.0, uv.y);
  float horizonPulse = smoothstep(0.95, 1.0, sin(u_time*0.42));
  col += vec3(0.45,0.30,0.65) * horizon * horizonPulse * 0.35;

  // PRIMARY LIGHTNING FLASH — full screen white-purple burst, ~every 6s.
  float flashCycle = fract(t*0.15);
  float flash = smoothstep(0.92,0.96, flashCycle) * smoothstep(1.0,0.96, flashCycle);
  flash += smoothstep(0.48,0.50, flashCycle) * smoothstep(0.52,0.48, flashCycle) * 0.5;
  col += vec3(0.6,0.7,1.0) * flash * exp(-length(uv-0.5)*0.5) * 0.35;

  // SECONDARY DELAYED FLASH — thunder afterglow, 40% intensity, slight delay.
  float aftFlash = smoothstep(0.61, 0.63, flashCycle) * smoothstep(0.66, 0.63, flashCycle);
  col += vec3(0.40,0.55,0.85) * aftFlash * 0.25;

  // BOLTS — 3 lightning bolts now, each at a TIME-VARYING x position so they
  // don't always strike in the same place. Each has its own duty cycle.
  // Bolt #1 — main bolt, follows flashCycle.
  float bolt1x = 0.30 + 0.06*sin(u_time*0.4);
  float bolt1 = smoothstep(0.014,0.0, abs(uv.x - bolt1x - 0.025*sin(uv.y*14.0)));
  // Branch fork — a smaller offshoot mid-way.
  float bolt1Fork = smoothstep(0.010,0.0, abs(uv.x - bolt1x - 0.12 - 0.02*sin(uv.y*22.0)))
                  * smoothstep(0.55, 0.30, uv.y);
  col += vec3(0.55,0.80,1.0) * bolt1 * flash * smoothstep(0.0,0.85,uv.y) * 0.85;
  col += vec3(0.55,0.80,1.0) * bolt1Fork * flash * smoothstep(0.0,0.55,uv.y) * 0.55;

  // Bolt #2 — secondary, different x, different cycle.
  float bolt2x = 0.62 + 0.08*cos(u_time*0.35 + 1.7);
  float bolt2 = smoothstep(0.012,0.0, abs(uv.x - bolt2x - 0.03*sin(uv.y*11.0 + 1.5)));
  col += vec3(0.65,0.75,1.0) * bolt2 * flash * smoothstep(0.0,0.80,uv.y) * 0.75;

  // Bolt #3 — appears only on the AFTERGLOW flash (the answering strike).
  float bolt3x = 0.45 + 0.10*sin(u_time*0.25 + 3.1);
  float bolt3 = smoothstep(0.011,0.0, abs(uv.x - bolt3x - 0.024*sin(uv.y*16.0 + 0.8)));
  col += vec3(0.70,0.85,1.0) * bolt3 * aftFlash * smoothstep(0.0,0.85,uv.y) * 0.80;

  // CLOUD ILLUMINATION — when a bolt strikes, the clouds near it light up
  // cyan from within. Adds the volumetric "lightning revealing the storm".
  col += vec3(0.30,0.45,0.75) * cloudA * flash * smoothstep(0.0,0.6,uv.y) * 0.30;

  // RAIN LAYER 1 — fast diagonal streaks.
  vec2 rp = uv*vec2(aspect,1.0)*vec2(45.0,80.0); rp.x -= t*3.0;
  float rain = smoothstep(0.94,0.96, fract(rp.x + rp.y*0.3)) * step(0.97, hash(floor(rp)));
  col += vec3(0.25,0.40,0.60) * rain * 0.14;
  // Rain is BRIGHTER during flash (illuminated drops).
  col += vec3(0.45,0.65,0.85) * rain * flash * 0.30;

  // RAIN LAYER 2 — slower, denser, more sparse highlights.
  vec2 rp2 = uv*vec2(aspect,1.0)*vec2(60.0,50.0); rp2.x -= t*1.5;
  float rain2 = smoothstep(0.92,0.95, fract(rp2.x + rp2.y*0.2)) * step(0.96, hash(floor(rp2)));
  col += vec3(0.30,0.45,0.65) * rain2 * 0.10;

  // RAIN MIST — heavy curtain at the bottom for atmospheric depth.
  float mistBand = fbm(uv*vec2(aspect,1.0)*vec2(8.0,3.0) + vec2(t*1.5,0.0));
  col += vec3(0.12,0.18,0.28) * mistBand * smoothstep(0.8, 1.0, uv.y) * 0.45;

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
      // Eclipse → a golden flare burst at the touch point, like a second
      // diamond ring flaring on contact.
      col += vec3(1.0,0.88,0.55) * sin(td*32.0 - age*6.0) * exp(-td*4.2) * exp(-age*2.0) * 0.55;
      col += vec3(1.0,0.95,0.75) * exp(-td*td*55.0) * exp(-age*1.6) * 0.7;
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
