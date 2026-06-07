/** Scene 14 — CORAL — bioluminescent reef: warm radial gradient (turquoise
 *  top → coral-red bottom), domain-warped organic coral shapes, pulsating
 *  anemones, schools of bright micro-fish, slow rising bubbles. Warmest
 *  scene of the catalogue. */
export const CORAL_GLSL = `
vec3 coral(vec2 uv, float aspect){
  float t = u_time * 0.08;
  vec2 p = uv * vec2(aspect, 1.0) * 2.0;

  vec3 col = mix(vec3(0.04, 0.085, 0.155), vec3(0.10, 0.025, 0.04),
                 smoothstep(0.0, 1.0, uv.y));

  float causticA = fbm(p*1.6 + vec2(t*0.6, 0.0));
  float causticB = fbm(p*1.2 + vec2(-t*0.4, t*0.3));
  float caustic = (causticA + causticB) * 0.5;
  col += vec3(0.20, 0.78, 0.72) * smoothstep(0.45, 0.85, caustic) * 0.18;

  // Domain-warped coral colony.
  vec2 q1 = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t*0.5)));
  vec2 q2 = vec2(fbm(p + 3.0*q1 + vec2(1.7, 9.2) + t*0.3),
                 fbm(p + 3.0*q1 + vec2(8.3, 2.8) - t*0.3));
  float reef = fbm(p + 3.5*q2);
  float reefMask = reef * smoothstep(0.05, 0.65, uv.y);
  col += vec3(1.0, 0.42, 0.42) * smoothstep(0.55, 0.95, reefMask) * 0.50;
  col += vec3(1.0, 0.62, 0.30) * smoothstep(0.70, 1.05, reefMask) * 0.35;
  float reefCrest = smoothstep(0.86, 1.0, reefMask);
  col += vec3(1.0, 0.88, 0.65) * reefCrest * 0.30;

  // 5 bioluminescent anemones, staggered pulses.
  for(int i=0;i<5;i++){
    float fi = float(i);
    vec2 ac = vec2(0.18 + fi*0.165 + 0.02*sin(t*0.6 + fi),
                   0.42 + 0.20*sin(t*0.4 + fi*1.3));
    float ad = distance(uv, ac);
    float pulse = 0.5 + 0.5*sin(u_time*(0.9 + fi*0.13) + fi*1.7);
    float anemone = exp(-ad*ad*900.0);
    float halo = exp(-ad*ad*140.0);
    col += vec3(0.30, 1.0, 0.80) * anemone * pulse * 0.65;
    col += vec3(0.10, 0.65, 0.55) * halo * pulse * 0.18;
  }

  // SCHOOLS of fish — 2 opposite-direction swarms.
  for(int s=0;s<2;s++){
    float fs = float(s);
    float drift = fract(t*(0.35 + fs*0.15) + fs*0.5);
    vec2 sp = uv*vec2(aspect,1.0)*vec2(70.0,36.0);
    sp.x -= drift*4.0 - fs*2.0;
    sp.y += sin(u_time*1.2 + sp.x*0.3 + fs*2.0)*0.08;
    float fishSeed = hash(floor(sp));
    float fish = exp(-pow(length(fract(sp)-0.5),2.0)*55.0) *
                 step(0.985, fishSeed);
    float fTw = 0.5 + 0.5*sin(u_time*3.0 + fishSeed*30.0);
    vec3 fishCol = mix(vec3(1.0, 0.85, 0.55), vec3(0.55, 1.0, 0.85), fs);
    col += fishCol * fish * fTw * 0.85;
  }

  // Rising BUBBLES.
  vec2 bp = uv*vec2(aspect,1.0)*vec2(28.0,55.0);
  bp.y -= t*3.5;
  bp.x += sin(bp.y*0.25 + t*1.5)*0.08;
  float bubbleSeed = hash(floor(bp));
  float bubble = smoothstep(0.45,0.42, length(fract(bp)-0.5)) *
                 step(0.992, bubbleSeed);
  col += vec3(0.55, 0.92, 0.95) * bubble * 0.30;

  // SOFT GOD-RAYS from the surface.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float rx = 0.25 + fi*0.25 + 0.03*sin(t*0.4 + fi);
    float dx = abs(uv.x - rx);
    float ray = exp(-dx*aspect*7.0) * smoothstep(1.0, 0.2, uv.y);
    col += vec3(0.25, 0.55, 0.60) * ray * 0.10;
  }

  // Vignette.
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.04, 0.03, 0.04) * smoothstep(0.55, 1.05, r);
  return col;
}
`;
