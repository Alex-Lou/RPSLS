/** Scene 15 — RUST — industrial decay: vertical sooty gradient, irregular
 *  dark beams in a sparse lattice, rivets along the joints, sporadic
 *  white-hot sparks flying upward, fine dust grain, slow flicker from a
 *  broken overhead light. Monochrome warm. */
export const RUST_GLSL = `
vec3 rust(vec2 uv, float aspect){
  float t = u_time * 0.08;
  vec3 col = mix(vec3(0.025, 0.018, 0.012), vec3(0.06, 0.035, 0.020),
                 smoothstep(1.0, 0.0, uv.y));

  // Broken-light flicker.
  float flicker = 0.85 + 0.15*sin(u_time*1.7) * step(0.55, hash(vec2(floor(u_time*3.0), 0.0)));
  col *= flicker;

  // Rusty patina noise.
  float patina = fbm(uv*vec2(aspect,1.0)*9.0);
  col += vec3(0.55, 0.28, 0.09) * smoothstep(0.50, 0.90, patina) * 0.22;
  col += vec3(0.42, 0.17, 0.05) * smoothstep(0.65, 1.0, patina) * 0.15;

  // 4 vertical metal BEAMS with rust outlines.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float bx = 0.12 + fi*0.26;
    float perturb = 0.012*sin(uv.y*22.0 + fi*3.7);
    float dx = abs(uv.x - bx - perturb);
    float beamBody = smoothstep(0.035, 0.025, dx);
    float beamEdge = smoothstep(0.055, 0.035, dx) - beamBody;
    col *= mix(vec3(1.0), vec3(0.10, 0.075, 0.045), beamBody);
    col += vec3(0.82, 0.40, 0.10) * beamEdge * 0.50;
    // RIVETS — 5 round bolts along each beam.
    for(int r=0;r<5;r++){
      float fr = float(r);
      float ry = 0.10 + fr*0.21;
      float rd = sqrt((uv.x - bx - perturb)*(uv.x - bx - perturb) * aspect*aspect +
                       (uv.y - ry)*(uv.y - ry));
      float rivet = smoothstep(0.012, 0.0, rd);
      col += vec3(0.65, 0.42, 0.20) * rivet * 0.55;
      col += vec3(0.85, 0.55, 0.25) * smoothstep(0.004, 0.0, rd) * 0.45;
    }
  }

  // Horizontal CROSS-BEAMS.
  float crossA = smoothstep(0.022, 0.015, abs(uv.y - 0.32));
  float crossB = smoothstep(0.022, 0.015, abs(uv.y - 0.78));
  col *= mix(vec3(1.0), vec3(0.10, 0.075, 0.045), crossA + crossB);
  col += vec3(0.78, 0.36, 0.08) * (smoothstep(0.030, 0.022, abs(uv.y - 0.32)) - crossA) * 0.45;
  col += vec3(0.78, 0.36, 0.08) * (smoothstep(0.030, 0.022, abs(uv.y - 0.78)) - crossB) * 0.45;

  // WELDING SPARKS — sporadic bright motes that rise.
  vec2 sp = uv*vec2(aspect,1.0)*vec2(40.0, 30.0);
  sp.y -= u_time*4.5;
  float sparkSeed = hash(floor(sp + vec2(floor(u_time*0.3), 0.0)));
  float spark = exp(-pow(length(fract(sp)-0.5), 2.0)*120.0) *
                step(0.992, sparkSeed);
  float sparkTw = 0.4 + 0.6*sin(u_time*8.0 + sparkSeed*40.0);
  col += vec3(1.0, 0.95, 0.75) * spark * sparkTw * 1.2;
  col += vec3(1.0, 0.55, 0.18) * spark * sparkTw * 0.55;

  // Fine DUST GRAIN.
  float grain = (hash(uv * 2800.0) - 0.5) * 0.035;
  col += vec3(grain);

  // FLOATING DUST PARTICLES.
  vec2 dp = uv*vec2(aspect,1.0)*vec2(60.0, 36.0);
  dp.y -= t*0.5;
  float dustMote = exp(-pow(length(fract(dp)-0.5),2.0)*40.0) *
                   step(0.991, hash(floor(dp)));
  col += vec3(0.55, 0.38, 0.20) * dustMote * 0.30;

  // Heavy vignette.
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.05, 0.03, 0.015) * smoothstep(0.4, 1.0, r);
  return col;
}
`;
