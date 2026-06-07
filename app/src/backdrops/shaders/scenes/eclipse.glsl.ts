/** Scene 9 — ECLIPSE — total solar eclipse: corona ring, diamond ring, wispy streamers. */
export const ECLIPSE_GLSL = `
vec3 eclipse(vec2 uv, float aspect){
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float t = u_time * 0.12;

  vec3 col = mix(vec3(0.014, 0.011, 0.028), vec3(0.004, 0.004, 0.013),
                 smoothstep(0.0, 1.3, r));

  // CORONA RING — FBM noise perturbs the radius so the ring reads as
  // irregular streamers, not a perfect circle.
  float ringR = 0.17;
  float coronaNoise = fbm(q * 7.0 + vec2(t * 0.25, t * 0.18)) * 0.5 + 0.5;
  float coronaDist = abs(r - ringR - coronaNoise * 0.055);
  float corona = exp(-coronaDist * 26.0)
               * smoothstep(ringR + 0.012, ringR - 0.012, r);
  float breathe = 0.72 + 0.28 * sin(t * 0.65);
  vec3 coronaCol = mix(vec3(1.0, 0.90, 0.68), vec3(0.88, 0.88, 0.95), coronaNoise);
  col += coronaCol * corona * breathe * 0.52;

  float outerCorona = exp(-abs(r - ringR) * 10.0)
                    * smoothstep(ringR + 0.10, ringR - 0.02, r);
  col += vec3(0.50, 0.45, 0.55) * outerCorona * 0.14;

  // DIAMOND RING — Baily's beads orbiting.
  float diamondAngle = t * 0.22;
  vec2 diamondPos = vec2(cos(diamondAngle), sin(diamondAngle)) * ringR;
  float diamondDist = length(q - diamondPos);
  float twinkle = 0.65 + 0.35 * sin(t * 2.1);
  col += vec3(1.0, 0.94, 0.76) * exp(-diamondDist * diamondDist * 380.0) * twinkle * 0.85;

  float d2Angle = diamondAngle + 3.14159 * 0.62;
  vec2 d2Pos = vec2(cos(d2Angle), sin(d2Angle)) * ringR;
  float d2dist = length(q - d2Pos);
  col += vec3(0.75, 0.66, 0.88) * exp(-d2dist * d2dist * 220.0) * 0.28;

  // CORONA STREAMERS — rotating angular noise.
  float ang = atan(q.y, q.x);
  float streamerNoise = fbm(vec2(ang * 2.8 + t * 0.5, r * 1.8) + t * 0.12);
  float streamer = smoothstep(0.30, ringR + 0.02, r)
                 * smoothstep(0.85, 0.50, r)
                 * (0.45 + 0.55 * streamerNoise);
  col += vec3(0.55, 0.50, 0.62) * streamer * 0.13;

  // SOLAR PROMINENCES — 3 erupting plasma loops.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float promAng = t * 0.18 + fi * 2.094;
    vec2 promPos = vec2(cos(promAng), sin(promAng)) * (ringR + 0.025);
    float promD = length(q - promPos);
    float promPulse = 0.6 + 0.4*sin(u_time*0.9 + fi*1.7);
    col += vec3(1.0, 0.55, 0.20) * exp(-promD*promD * 450.0) * promPulse * 0.6;
    col += vec3(1.0, 0.45, 0.15) * exp(-promD*promD * 80.0) * promPulse * 0.12;
  }

  // CORONA BREATH PULSE.
  float coronaPulse = smoothstep(0.94, 1.0, sin(u_time*0.28));
  col += coronaCol * corona * coronaPulse * 0.45;

  // DIAMOND CASCADE — rare wow burst.
  float cascade = smoothstep(0.985, 1.0, sin(u_time*0.20));
  float cascadeGlow = exp(-r*r * 5.0) * cascade;
  col += vec3(1.0, 0.95, 0.78) * cascadeGlow * 0.55;
  if(cascade > 0.02){
    for(int k=0;k<8;k++){
      float fk = float(k);
      float rayAng = fk * 0.7854 + diamondAngle*0.5;
      vec2 rayDir = vec2(cos(rayAng), sin(rayAng));
      float along = dot(q, rayDir);
      float across = abs(dot(q, vec2(-rayDir.y, rayDir.x)));
      float ray = smoothstep(0.005, 0.0, across) * smoothstep(0.5, ringR, along);
      col += vec3(1.0, 0.92, 0.74) * ray * cascade * 0.6;
    }
  }

  // CONTINUOUS CORONA TURBULENCE.
  float boilNoise = fbm(vec2(ang*3.5 + t*1.4, r*5.0 - t*0.8));
  float boilBand = exp(-pow((r - ringR - 0.020)*22.0, 2.0));
  col += vec3(1.0, 0.78, 0.30) * boilBand * boilNoise * 0.55;

  // ORBITING CORONA EMBERS — 8 sparks revolving.
  for(int i=0;i<8;i++){
    float fi = float(i);
    float emAng = u_time*(0.18 + fi*0.024) + fi*0.785;
    vec2 emPos = vec2(cos(emAng), sin(emAng)) * (ringR + 0.012);
    float emD = length(q - emPos);
    float emTw = 0.55 + 0.45*sin(u_time*2.2 + fi*5.1);
    col += vec3(1.0, 0.88, 0.55) * exp(-emD*emD*620.0) * emTw * 0.55;
  }

  float shimmer = 0.5 + 0.5*sin(ang*10.0 + r*22.0 - u_time*1.3);
  col += vec3(0.85, 0.65, 0.30) * shimmer * smoothstep(0.20, 0.45, r) *
         smoothstep(0.75, 0.40, r) * 0.06;

  col += softStars(uv, aspect, 0.997, vec3(0.65, 0.75, 0.95))
       * smoothstep(ringR + 0.14, ringR + 0.55, r);

  return col;
}
`;
