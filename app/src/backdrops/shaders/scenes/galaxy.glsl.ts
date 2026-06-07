/** Scene 3 — GALAXY — rotating spiral arms + bright core + nova bursts. */
export const GALAXY_GLSL = `
vec3 galaxy(vec2 uv, float aspect){
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.2;
  float r = length(p);
  float a = atan(p.y, p.x);
  float spiral = a + r*3.2 - u_time*0.18;
  float arms = 0.5 + 0.5*cos(spiral*2.0);
  arms = pow(arms, 2.6);
  arms *= smoothstep(1.5, 0.05, r);
  vec2 warp = p*2.6 + 0.5*vec2(cos(spiral), sin(spiral));
  float dust = fbm(warp - u_time*0.06);
  vec3 col = vec3(0.012,0.013,0.045);
  float dustc = smoothstep(0.35, 0.85, dust);
  col += mix(vec3(0.20,0.08,0.50), vec3(0.30,0.70,1.0), dustc) * arms * 0.95;
  float crest = smoothstep(0.78, 0.99, 0.5 + 0.5*cos(spiral*2.0));
  col += vec3(0.85,0.88,1.0) * crest * smoothstep(1.3, 0.12, r) * 0.16;
  col += vec3(0.65,0.55,0.92) * exp(-r*r*6.0) * 0.30;
  col += vec3(0.45,0.30,0.80) * exp(-r*r*1.8) * 0.10;
  float tw = 0.5 + 0.5*sin(u_time*0.9);
  col += vec3(0.85,0.80,1.0) * exp(-r*r*48.0) * (0.18 + 0.16*tw);
  col += softStars(uv, aspect, 0.990, vec3(0.9,0.92,1.0));
  return col;
}
`;
