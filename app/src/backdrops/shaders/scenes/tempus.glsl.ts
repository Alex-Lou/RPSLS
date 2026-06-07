/** Scene 12 — TEMPUS — chronomancer's hall: domain-warped sand FBM, 4
 *  rotating bronze gears (counter-rotating), central hourglass glow with
 *  cyclic sand build-up + drain, falling grains, zodiac star ring,
 *  time-fracture chronoshock rings every ~9s, golden centre stream. */
export const TEMPUS_GLSL = `
vec3 tempus(vec2 uv, float aspect){
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float ang = atan(q.y, q.x);
  float t = u_time * 0.09;
  float tFast = u_time * 0.32;

  // DOMAIN-WARPED SAND BACKGROUND.
  vec2 p = uv * vec2(aspect, 1.0) * 2.4;
  vec2 q1 = vec2(fbm(p + vec2(t*0.6, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t*0.6)));
  vec2 q2 = vec2(fbm(p + 3.0*q1 + vec2(1.7, 9.2) + t*0.4),
                 fbm(p + 3.0*q1 + vec2(8.3, 2.8) - t*0.4));
  float duneF = fbm(p + 3.5*q2);
  vec3 col = mix(vec3(0.04, 0.025, 0.010), vec3(0.18, 0.10, 0.04),
                 smoothstep(0.20, 0.85, duneF));
  col = mix(col, vec3(0.32, 0.18, 0.06), smoothstep(0.55, 0.95, q2.x) * 0.55);
  col = mix(col, vec3(0.45, 0.28, 0.08), smoothstep(0.65, 1.0, q1.y) * 0.30);

  // 4 CONCENTRIC GEARS — counter-rotating, real-feeling teeth.
  float gear1 = smoothstep(0.020, 0.0, abs(r - 0.16))
              * (0.55 + 0.45 * abs(sin(ang*16.0 + t*1.0)));
  float gear2 = smoothstep(0.018, 0.0, abs(r - 0.26))
              * (0.55 + 0.45 * abs(sin(ang*22.0 - t*0.7)));
  float gear3 = smoothstep(0.016, 0.0, abs(r - 0.38))
              * (0.50 + 0.50 * abs(sin(ang*28.0 + t*0.5)));
  float gear4 = smoothstep(0.012, 0.0, abs(r - 0.52))
              * (0.50 + 0.50 * abs(sin(ang*36.0 - t*0.35)));
  col += vec3(0.85, 0.55, 0.20) * gear1 * 0.45;
  col += vec3(0.75, 0.48, 0.16) * gear2 * 0.38;
  col += vec3(0.65, 0.40, 0.12) * gear3 * 0.30;
  col += vec3(0.55, 0.32, 0.10) * gear4 * 0.22;

  // ZODIAC STAR RING — 12 constellation markers.
  float zodiacR = 0.62;
  float zodiacAng = mod(ang - t*0.35, 6.28318);
  float seg = floor(zodiacAng * 12.0 / 6.28318);
  float segCentre = (seg + 0.5) * 6.28318 / 12.0;
  float angDist = abs(zodiacAng - segCentre);
  float zodiacDist = sqrt((r - zodiacR)*(r - zodiacR) + (angDist*zodiacR)*(angDist*zodiacR));
  float zodiacTw = 0.45 + 0.55 * sin(u_time*1.8 + seg*7.3);
  col += vec3(1.0, 0.85, 0.40) * exp(-zodiacDist*zodiacDist*1200.0) * zodiacTw * 0.85;

  // CENTRAL HOURGLASS GLOW.
  float coreP = 0.65 + 0.35 * sin(u_time*0.70);
  float bloomP = 0.55 + 0.45 * sin(u_time*0.45 + 1.2);
  col += vec3(0.95, 0.65, 0.22) * exp(-r*r*18.0) * coreP * 0.60;
  col += vec3(0.65, 0.40, 0.14) * exp(-r*r*5.0)  * bloomP * 0.30;
  col += vec3(1.0, 0.92, 0.55) * exp(-r*r*120.0) * coreP * 0.55;

  // CHRONO-SHOCK RING — periodic event every ~9s.
  float chronoCycle = mod(u_time, 9.0);
  float chronoR = chronoCycle * 0.13;
  float chronoRing = exp(-pow((r - chronoR)*22.0, 2.0)) * exp(-chronoCycle*0.55);
  col += vec3(1.0, 0.92, 0.55) * chronoRing * 0.90;
  float chronoR2 = chronoCycle * 0.085;
  float chronoRing2 = exp(-pow((r - chronoR2)*28.0, 2.0)) * exp(-chronoCycle*0.40);
  col += vec3(0.95, 0.65, 0.22) * chronoRing2 * 0.55;

  // FALLING SAND GRAINS — high-density rapid-fall stream.
  vec2 sp = uv*vec2(aspect,1.0)*vec2(55.0, 38.0); sp.y -= tFast;
  float grain = exp(-pow(length(fract(sp)-0.5), 2.0)*55.0)
              * step(0.984, hash(floor(sp)));
  float grainTw = 0.55 + 0.45*sin(u_time*4.0 + hash(floor(sp))*30.0);
  col += vec3(1.0, 0.72, 0.28) * grain * grainTw * 0.85;

  // GOLD SAND STREAM AT CENTRE.
  float centreStream = exp(-pow((uv.x - 0.5)*aspect*22.0, 2.0));
  vec2 csp = vec2(uv.x*aspect*8.0, uv.y*32.0 - tFast*1.4);
  float csGrain = exp(-pow(length(fract(csp)-0.5), 2.0)*35.0) *
                  step(0.93, hash(floor(csp)));
  col += vec3(1.0, 0.82, 0.40) * centreStream * csGrain * 1.1;
  col += vec3(0.85, 0.55, 0.18) * centreStream * 0.18 * coreP;

  // BRONZE VIGNETTE that breathes.
  col += vec3(0.18, 0.10, 0.04) * (1.0 - smoothstep(0.35, 1.05, r)) * 0.22;
  col -= vec3(0.04, 0.025, 0.012) * smoothstep(0.65, 1.05, r);

  return col;
}
`;
