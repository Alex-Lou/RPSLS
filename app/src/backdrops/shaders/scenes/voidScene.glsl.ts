/** Scene 16 — VOID — geometric minimalism: pure black, fine white wireframe
 *  shapes (triangles / squares / circles) appearing and dissolving on a
 *  long cycle (4-6s lifespan, max 3 visible at once), with a single slowly
 *  rotating central reticule that always reads. The ANTI-spectacle. */
export const VOID_SCENE_GLSL = `
vec3 void_scene(vec2 uv, float aspect){
  float t = u_time;
  vec3 col = vec3(0.0);

  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float ang = atan(q.y, q.x);

  // Central reticule.
  float reticule = smoothstep(0.0015, 0.0005, abs(r - 0.12));
  col += vec3(0.50) * reticule;
  float tickAng = mod(ang + t*0.04, 0.7854);
  float tick = smoothstep(0.025, 0.020, abs(tickAng - 0.39))
             * smoothstep(0.015, 0.013, abs(r - 0.115));
  col += vec3(0.85) * tick;

  // 3 emergent shapes — staggered cycles, never overlap in time.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float cycle = mod(t/(5.0 + fi*0.7) + fi*0.3, 1.0);
    float vis = smoothstep(0.15, 0.30, cycle) * smoothstep(0.85, 0.70, cycle);
    if(vis < 0.001) continue;
    float seed = hash(vec2(fi*7.3, floor(t/(5.0 + fi*0.7))));
    vec2 cpos = vec2(0.5 + (seed - 0.5)*1.4,
                      0.5 + (hash(vec2(seed, fi)) - 0.5)*1.4);
    vec2 d = (uv - cpos) * vec2(aspect, 1.0);
    float dd = length(d);
    float shapeAng = atan(d.y, d.x);
    float shape = 0.0;
    if(seed < 0.33){
      // CIRCLE outline.
      float ringR = 0.06 + cycle*0.06;
      shape = smoothstep(0.002, 0.001, abs(dd - ringR));
    } else if(seed < 0.66){
      // EQUILATERAL TRIANGLE outline.
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

  // Very subtle scan line every ~9s.
  float scan = smoothstep(0.002, 0.0, abs(uv.y - fract(t*0.11)));
  col += vec3(0.15) * scan;

  return col;
}
`;
