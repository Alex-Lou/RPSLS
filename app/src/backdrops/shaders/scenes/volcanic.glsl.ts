/** Scene 7 — VOLCANIC — cracked obsidian, flowing lava veins, rising embers. */
export const VOLCANIC_GLSL = `
vec3 volcanic(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*3.0;
  vec3 col = mix(vec3(0.06,0.03,0.02), vec3(0.10,0.05,0.03), fbm(p*2.0));
  float t = u_time*0.08;
  vec2 q = vec2(fbm(p + vec2(t,0.0)), fbm(p + vec2(5.2,1.3) + vec2(0.0,t)));
  float cells = fbm(p + 3.0*q);
  float crack = smoothstep(0.06, 0.0, abs(cells - 0.48));
  float crackW = smoothstep(0.14, 0.0, abs(cells - 0.48));
  col += vec3(1.0,0.27,0.0) * crack * 0.95;
  col += vec3(1.0,0.55,0.08) * crackW * 0.25;
  float pulse = 0.5 + 0.5*sin(u_time*0.6 + cells*8.0);
  col += vec3(0.6,0.08,0.0) * crackW * pulse * 0.3;
  vec2 ep = uv*vec2(aspect,1.0)*vec2(60.0,25.0);
  ep.y -= u_time*0.8;
  float ember = exp(-pow(length(fract(ep)-0.5),2.0)*50.0) * step(0.98, hash(floor(ep)));
  float etw = 0.5+0.5*sin(u_time*3.0+hash(floor(ep))*20.0);
  col += vec3(1.0,0.5,0.1) * ember * etw * 0.7;
  float smoke = fbm(uv*vec2(aspect,1.0)*4.0 + vec2(t*2.0, 0.0)) * smoothstep(0.5, 1.0, uv.y);
  col += vec3(0.15,0.10,0.08) * smoke * 0.3;
  col += softStars(uv, aspect, 0.997, vec3(1.0,0.6,0.3));
  return col;
}
`;
