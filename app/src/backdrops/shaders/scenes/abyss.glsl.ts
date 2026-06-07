/** Scene 8 — ABYSS — deep ocean, bioluminescent glow, jellyfish silhouettes. */
export const ABYSS_GLSL = `
vec3 abyss(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.01,0.02,0.06), vec3(0.03,0.06,0.14), uv.y);
  float t = u_time*0.12;
  vec2 cp = uv*vec2(aspect,1.0)*5.0;
  float caustic = 0.0;
  for(int i=0;i<3;i++){
    float fi=float(i);
    caustic += noise(cp*2.0 + vec2(t*(0.8+fi*0.3), t*(0.5-fi*0.2)));
  }
  caustic = caustic/3.0;
  col += vec3(0.08,0.25,0.45) * pow(caustic, 2.5) * smoothstep(0.3, 1.0, uv.y) * 0.4;
  float shaft = smoothstep(0.18, 0.0, abs(uv.x - 0.48 + 0.03*sin(t))) * uv.y;
  col += vec3(0.06,0.15,0.30) * shaft * 0.35;
  vec2 bp = uv*vec2(aspect,1.0)*vec2(80.0,40.0); bp.y += t*2.0;
  float bSeed = hash(floor(bp));
  float alive = step(0.975, bSeed);
  vec2 bj = vec2(hash(floor(bp)+1.7), hash(floor(bp)+5.3)) - 0.5;
  float bd = length(fract(bp)-0.5 - bj*0.4);
  float abg = exp(-bd*bd*60.0) * alive;
  float btw = 0.4 + 0.6*sin(u_time*2.0 + bSeed*30.0);
  vec3 bCol = mix(vec3(0.0,0.9,0.8), vec3(1.0,0.25,0.63), step(0.5, fract(bSeed*7.0)));
  col += bCol * abg * btw * 0.55;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 jc = vec2(0.25+fi*0.25 + 0.08*sin(t*0.7+fi*2.1),
                   0.35+fi*0.15 + 0.10*cos(t*0.5+fi*1.7));
    vec2 jp = (uv - jc)*vec2(aspect,1.0); jp.y *= 1.3;
    float jr = length(jp);
    vec3 jCol = mix(vec3(1.0,0.3,0.65), vec3(0.0,0.9,0.8), fi/2.0);
    col += jCol * exp(-jr*jr*120.0) * 0.22;
    float tent = smoothstep(0.01,0.0, abs(jp.x + 0.003*sin(jp.y*60.0-t*3.0)))
               * smoothstep(jc.y-0.02, jc.y-0.15, uv.y) * smoothstep(jc.y-0.22, jc.y-0.12, uv.y);
    col += jCol * tent * 0.10;
  }
  vec2 bb = uv*vec2(aspect,1.0)*vec2(30.0,60.0); bb.y -= t*4.0;
  float bubble = smoothstep(0.42,0.40, length(fract(bb)-0.5)) * step(0.993, hash(floor(bb)));
  col += vec3(0.3,0.6,0.8) * bubble * 0.15;
  return col;
}
`;
