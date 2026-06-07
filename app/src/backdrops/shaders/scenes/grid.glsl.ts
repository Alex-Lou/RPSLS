/** Scene 2 — NEON GRID — synthwave floor + horizon sun + scanlines. */
export const GRID_GLSL = `
vec3 grid(vec2 uv, float aspect){
  float horizon = 0.46;
  vec3 col = mix(vec3(0.05,0.01,0.12), vec3(0.22,0.04,0.26), smoothstep(1.0, horizon, uv.y));

  if(uv.y > horizon){
    vec2 q = (uv - vec2(0.5, horizon + 0.15)) * vec2(aspect, 1.0);
    float sd = length(q);
    float disc = smoothstep(0.175, 0.16, sd);
    vec3 sunCol = mix(vec3(1.0,0.86,0.32), vec3(1.0,0.22,0.55),
                      smoothstep(horizon + 0.02, horizon + 0.30, uv.y));
    float stripe = step(0.42, fract((uv.y - horizon) * 26.0));
    float lower  = smoothstep(horizon + 0.15, horizon + 0.01, uv.y);
    disc *= mix(1.0, stripe, lower);
    col += sunCol * disc * 1.35;
    col += mix(vec3(1.0,0.55,0.30), vec3(1.0,0.30,0.62), uv.x) * smoothstep(0.42, 0.0, sd) * 0.22;
    col += softStars(uv, aspect, 0.994, vec3(0.9,0.85,1.0)) * smoothstep(horizon + 0.18, 1.0, uv.y);
  } else {
    // depth+0.06 → fract() oscillated faster than the pixel grid = moiré that
    // reads as jank and costs GPU. depth+0.12 caps the worst-case frequency.
    float depth = (horizon - uv.y);
    float persp = 1.0 / (depth + 0.12);
    float gx = abs(fract((uv.x - 0.5) * persp * 1.8) - 0.5);
    float gz = abs(fract(u_time * 0.3 + persp * 0.55) - 0.5);
    float lw = 0.045 + depth * 0.05;
    float lx = smoothstep(lw, 0.0, gx);
    float lz = smoothstep(lw, 0.0, gz);
    float line = max(lx, lz);
    vec3 neon = mix(vec3(0.10,0.92,1.0), vec3(1.0,0.22,0.85), uv.x);
    col += neon * line * (0.4 + depth * 2.6);
    col += neon * 0.04 * depth;
  }
  col += vec3(1.0,0.55,0.9) * smoothstep(0.014, 0.0, abs(uv.y - horizon)) * 0.7;
  return col;
}
`;
