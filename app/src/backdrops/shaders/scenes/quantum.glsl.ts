/** Scene 5 — QUANTUM — smooth electric plasma + drifting energy nodes. */
export const QUANTUM_GLSL = `
vec3 quantum(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0);
  float t = u_time*0.4;
  float v = sin(p.x*6.0 + t)
          + sin((p.y*6.0 + t)*1.1)
          + sin((p.x*4.0 + p.y*5.0 + t)*0.9)
          + sin(length(p-0.5)*10.0 - t*1.3);
  v *= 0.25;
  vec3 col = mix(vec3(0.02,0.05,0.12), vec3(0.10,0.55,0.85), 0.5+0.5*v);
  col = mix(col, vec3(0.2,0.85,1.0), smoothstep(0.5,1.0, 0.5+0.5*sin(v*PI)));
  float field = sin(p.x*9.0 + sin(p.y*7.0 + t)*2.2 + t)
              + sin(p.y*8.0 - sin(p.x*6.0 - t)*2.0 - t*1.2);
  float fil = smoothstep(0.10, 0.0, abs(field));
  col += vec3(0.55,1.0,1.0) * fil * 0.6;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 c = vec2(0.5+0.34*sin(t*0.7+fi*2.1), 0.5+0.30*cos(t*0.5+fi*1.7));
    col += vec3(0.5,0.95,1.0) * exp(-distance(p,c)*distance(p,c)*60.0) * 0.4;
  }
  return col;
}
`;
