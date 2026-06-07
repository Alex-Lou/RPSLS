/** Scene 4 — HOLY — descending god-rays, warm gold over cathedral indigo. */
export const HOLY_GLSL = `
vec3 holy(vec2 uv, float aspect){
  vec3 base = mix(vec3(0.05,0.05,0.12), vec3(0.02,0.02,0.07), uv.y);
  float shaft = 0.0;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float x = 0.2 + fi*0.2 + 0.04*sin(u_time*0.3 + fi);
    float w = 0.06 + 0.02*sin(u_time*0.2 + fi*2.0);
    float dx = abs(uv.x - x);
    float band = smoothstep(w, 0.0, dx);
    float core = smoothstep(w*0.32, 0.0, dx);
    shaft += band*0.55 + core*0.9;
  }
  shaft *= smoothstep(1.0, 0.1, uv.y);
  shaft *= 0.72 + 0.28*sin(uv.y*90.0 - u_time*1.1);
  vec3 gold = vec3(1.0, 0.82, 0.42);
  vec3 col = base + gold * shaft * 0.32;
  vec2 mp = uv*vec2(aspect,1.0)*vec2(40.0, 18.0); mp.y += u_time*0.4;
  float mote = exp(-pow(length(fract(mp)-0.5),2.0)*40.0) * step(0.97, hash(floor(mp)));
  col += gold * mote * 0.5;
  col += vec3(0.3,0.3,0.7) * exp(-distance(uv,vec2(0.5,0.32))*2.0) * 0.12;
  return col;
}
`;
