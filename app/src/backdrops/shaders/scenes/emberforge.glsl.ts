/** Scene 11 — EMBERFORGE — industrial smithy: forge mouth at TOP, anvil
 *  silhouette centre, radial sparks bursting OUTWARD, periodic HAMMER STRIKE
 *  flashes, structured geometric heat veins (NOT volcanic FBM rivers),
 *  vertical heat columns rising. Differentiates HARD from Volcanic. */
export const EMBERFORGE_GLSL = `
vec3 emberforge(vec2 uv, float aspect){
  float t = u_time*0.07;
  vec3 col = mix(vec3(0.05,0.025,0.012), vec3(0.015,0.008,0.004),
                 length((uv-vec2(0.5,0.62))*vec2(aspect,1.0))*1.05);

  // FORGE MOUTH AT TOP.
  float bellows = 0.78 + 0.22*sin(u_time*0.55) + 0.08*sin(u_time*1.3);
  vec2 forgeD = (uv - vec2(0.5, 0.92)) * vec2(aspect*0.7, 2.4);
  float forgeMouth = exp(-dot(forgeD, forgeD)*9.0);
  col += vec3(1.0, 0.65, 0.18) * forgeMouth * 0.95 * bellows;
  col += vec3(1.0, 0.92, 0.55) * exp(-dot(forgeD, forgeD)*36.0) * 0.75 * bellows;
  float rim = smoothstep(0.02, 0.0, abs(uv.y - 0.84)) *
              smoothstep(0.18, 0.0, abs(uv.x - 0.5));
  col += vec3(1.0, 0.55, 0.10) * rim * 0.50 * bellows;

  // ANVIL SILHOUETTE.
  vec2 av = (uv - vec2(0.5, 0.32)) * vec2(aspect, 1.0);
  float anvilBody  = smoothstep(0.075, 0.07, abs(av.x)) *
                     smoothstep(0.18, 0.17, abs(av.y - 0.02));
  float anvilTop   = smoothstep(0.135, 0.13, abs(av.x)) *
                     smoothstep(0.022, 0.02, abs(av.y - 0.16));
  float anvilMask = max(anvilBody, anvilTop);
  col *= 1.0 - anvilMask*0.85;
  float anvilLit = smoothstep(0.14, 0.135, abs(av.x)) *
                   smoothstep(0.005, 0.0, abs(av.y - 0.182));
  col += vec3(1.0, 0.50, 0.12) * anvilLit * bellows * 0.55;

  // HAMMER STRIKE EVENTS every ~6s.
  float strikeCycle = mod(u_time, 6.0);
  float strikeBurst = exp(-strikeCycle*4.5) * smoothstep(6.0, 5.97, strikeCycle);
  vec2 strikeC = uv - vec2(0.5, 0.50);
  strikeC.x *= aspect;
  float flarePt = exp(-dot(strikeC, strikeC)*220.0);
  col += vec3(1.0, 0.95, 0.65) * flarePt * strikeBurst * 1.6;
  float ringR = strikeCycle*0.25;
  float shockRing = exp(-pow((length(strikeC)-ringR)*8.0, 2.0)) *
                    exp(-strikeCycle*1.2);
  col += vec3(1.0, 0.55, 0.15) * shockRing * 0.55;

  // RADIAL SPARK BURST — 12 angular spark rays.
  vec2 sd = uv - vec2(0.5, 0.50);
  sd.x *= aspect;
  float sang = atan(sd.y, sd.x);
  float srad = length(sd);
  float wedge = floor(sang * 12.0 / (2.0*PI) + 0.5);
  float wseed = fract(sin(wedge*23.7 + floor(u_time*0.7)*17.3) * 43758.5);
  float strikeT = mod(u_time + wseed*1.3, 1.4);
  float sparkR = strikeT * 0.42;
  float sparkOnRay = exp(-pow((srad - sparkR)*22.0, 2.0));
  float wedgeCentre = wedge * (2.0*PI) / 12.0;
  float sparkOnAng = exp(-pow((sang - wedgeCentre)*30.0, 2.0));
  float sparkFade = exp(-strikeT*3.5);
  col += vec3(1.0, 0.70, 0.18) * sparkOnRay * sparkOnAng * sparkFade * 0.85;

  // VERTICAL HEAT COLUMNS — 4 industrial shimmer pillars.
  float colA = exp(-pow((uv.x - 0.20)*9.0 + sin(uv.y*8.0 + t*2.0)*0.6, 2.0));
  float colB = exp(-pow((uv.x - 0.35)*9.0 + sin(uv.y*7.0 + t*1.8 + 1.3)*0.6, 2.0));
  float colC = exp(-pow((uv.x - 0.65)*9.0 + sin(uv.y*7.5 - t*1.9 + 2.1)*0.6, 2.0));
  float colD = exp(-pow((uv.x - 0.80)*9.0 + sin(uv.y*8.5 - t*2.1 + 3.7)*0.6, 2.0));
  float heatCols = (colA+colB+colC+colD) * smoothstep(0.85, 0.10, uv.y);
  col += vec3(0.85, 0.32, 0.06) * heatCols * 0.18 * bellows;

  // STRUCTURED GEOMETRIC HEAT VEINS — forge floor grid.
  vec2 gp = uv*vec2(aspect,1.0)*8.0 + vec2(0.0, t*0.4);
  vec2 gf = fract(gp) - 0.5;
  float gridX = exp(-pow(gf.x, 2.0)*220.0);
  float gridY = exp(-pow(gf.y, 2.0)*220.0);
  float gridMask = (gridX + gridY) * (0.4 + 0.6*hash(floor(gp)));
  gridMask *= smoothstep(0.45, 0.05, uv.y);
  col += vec3(0.85, 0.30, 0.05) * gridMask * 0.20;

  // RISING SPARKS — small bright motes drifting UP fast.
  vec2 ep = uv*vec2(aspect,1.0)*vec2(40.0,22.0); ep.y -= t*3.2;
  float emberMote = exp(-pow(length(fract(ep)-0.5),2.0)*55.0) *
                    step(0.985, hash(floor(ep)));
  float eTw = 0.45+0.55*sin(t*4.5+hash(floor(ep))*25.0);
  col += vec3(1.0, 0.72, 0.22) * emberMote * eTw * 0.70;

  // COPPER HAMMERED TEXTURE — faint metallic dotted noise on floor.
  float coppr = step(0.94, hash(floor(uv*vec2(aspect,1.0)*70.0)));
  col += vec3(0.30, 0.14, 0.06) * coppr * smoothstep(0.4, 0.0, uv.y) * 0.35;

  // SOOT AT THE TOP.
  col *= 1.0 - smoothstep(0.95, 1.0, uv.y)*0.3;

  return col;
}
`;
