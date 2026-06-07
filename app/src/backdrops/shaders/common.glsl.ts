/**
 * Shared GLSL header for every scene: precision pragma, uniforms, hash /
 * noise / fbm / softStars utilities. Concatenated at the top of FRAG by
 * shaders/index.ts.
 *
 * GLSL ES 1.00 safe:
 *  - hash21 (Hoskins) — stable on Adreno/Mali; the classic fract(p.x*p.y)
 *    bands in blocks because mobile GPUs lose precision on large products.
 *  - Quintic interpolation in noise() — C2-continuous, kills the grid
 *    banding the cubic smoothstep produces when value-noise is animated.
 *  - Per-octave domain rotation in fbm() — without it animated octaves
 *    align on the same axes and stack into "marching squares" artifacts.
 */
export const COMMON_GLSL = `
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

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}
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
`;
