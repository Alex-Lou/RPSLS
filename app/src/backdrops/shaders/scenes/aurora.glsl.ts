/** Scene 1 — AURORA — broad, defined curtains. Less flicker, more body. */
export const AURORA_GLSL = `
vec3 aurora(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.02,0.05,0.12), vec3(0.06,0.02,0.14), uv.y);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float band = 0.45 + 0.16*sin(uv.x*2.2 + u_time*0.35 + fi*2.1)
                      + 0.06*sin(uv.x*4.5 - u_time*0.18 + fi);
    float d = abs(uv.y - band);
    float glow = smoothstep(0.16, 0.0, d); glow = glow*glow;
    float ridge = smoothstep(0.022, 0.0, d);
    float streak = 0.55 + 0.45*sin(uv.x*70.0 + u_time*0.9 + fi*3.0);
    vec3 tint = mix(vec3(0.16,0.95,0.55), vec3(0.55,0.35,1.0), fi/2.0);
    col += tint * glow * streak * (0.42 + 0.12*sin(u_time*0.5 + fi*1.7));
    col += tint * ridge * 0.85;
  }
  col += softStars(uv, aspect, 0.994, vec3(0.8,0.95,1.0)) * step(0.45, uv.y);
  return col;
}
`;
