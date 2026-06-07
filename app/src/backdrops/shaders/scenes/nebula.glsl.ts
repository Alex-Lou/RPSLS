/** Scene 0 — NEBULA — warped FBM clouds, softer & deeper than before. */
export const NEBULA_GLSL = `
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
`;
