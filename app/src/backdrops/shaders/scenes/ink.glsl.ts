/** Scene 18 — INK — sumi-e: warm bone-paper background with grain + fibre,
 *  a few broad black brush strokes appearing and slowly fading, faint ink
 *  bleed where strokes settle, a small red seal in the bottom-right corner. */
export const INK_GLSL = `
vec3 ink(vec2 uv, float aspect){
  float t = u_time * 0.18;
  // Paper background — warm bone with fibre + cloud shading.
  vec3 paper = vec3(0.96, 0.93, 0.85);
  float fibre = sin(uv.y*180.0 + sin(uv.x*30.0)*0.5) * 0.025;
  paper -= vec3(fibre);
  float cloud = fbm(uv*vec2(aspect,1.0)*2.5);
  paper -= vec3(0.04, 0.05, 0.06) * smoothstep(0.40, 0.85, cloud);
  float grain = (hash(uv * 1500.0) - 0.5) * 0.025;
  paper += vec3(grain);

  vec3 col = paper;

  // 3 brush strokes, ~6s cycle each, staggered.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float cycle = mod(u_time/6.5 + fi*0.42, 1.0);
    float wet = smoothstep(0.0, 0.18, cycle);
    float dry = smoothstep(0.55, 1.0, cycle);
    float life = wet * (1.0 - dry);
    if(life < 0.005) continue;
    float strokeY = 0.22 + fi*0.30;
    float curveX = uv.x;
    float baseY = strokeY + 0.06*sin(curveX*6.0 + fi*1.7);
    float dist = abs(uv.y - baseY);
    float pressure = sin(curveX * 3.14159) * 0.7 + 0.3;
    float draw = step(curveX, wet*1.05);
    float thickness = pressure * 0.022 * life * draw;
    float stroke = smoothstep(thickness, thickness*0.55, dist);
    float bleed = smoothstep(thickness*3.5, thickness*1.5, dist) - stroke;
    col = mix(col, vec3(0.06, 0.04, 0.05), stroke * 0.92);
    col = mix(col, vec3(0.20, 0.16, 0.18), bleed * 0.30 * life);
  }

  // RED SEAL in the bottom-right.
  vec2 sealC = vec2(0.88, 0.08);
  vec2 sd = (uv - sealC) * vec2(aspect, 1.0);
  float seal = step(abs(sd.x), 0.035) * step(abs(sd.y), 0.035);
  float glyphV = step(abs(sd.x), 0.005) * step(abs(sd.y), 0.025);
  float glyphH = step(abs(sd.y), 0.005) * step(abs(sd.x), 0.025);
  float sealShape = seal - (glyphV + glyphH);
  col = mix(col, vec3(0.80, 0.10, 0.10), sealShape * 0.95);

  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.04, 0.05, 0.06) * smoothstep(0.55, 1.05, r);

  // Reference t so the uniform isn't dead-stripped.
  col += vec3(0.0) * t;
  return col;
}
`;
