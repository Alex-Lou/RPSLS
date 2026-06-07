/** Scene 13 — STORM — tempest fury: VORTEX storm cell, 4 simultaneous fork
 *  bolts, ground reflection glow, sheet-rain wind sweep, thunder shake,
 *  rolling domain-warped thunderheads, multiple flash beats per cycle. */
export const STORM_GLSL = `
vec3 storm(vec2 uv, float aspect){
  float t = u_time*0.085;
  float wind = sin(u_time*0.35);
  float skySway = 0.90 + 0.10*sin(u_time*0.3);
  vec3 col = mix(vec3(0.025,0.035,0.10), vec3(0.05,0.07,0.18),
                 smoothstep(0.0,1.0,uv.y)) * skySway;

  // VORTEX STORM CELL — rotating clouds at the centre.
  vec2 c = uv - vec2(0.5, 0.55);
  c.x *= aspect;
  float r = length(c);
  float swirl = atan(c.y, c.x) + (0.35 / max(r, 0.12)) * sin(u_time*0.18);
  vec2 swirlUV = vec2(0.5 + cos(swirl)*r/aspect, 0.55 + sin(swirl)*r);
  float cloudA = fbm(vec2(swirlUV.x*5.5 + t*0.6, swirlUV.y*4.0 + t*0.3));
  float cloudB = fbm(vec2(uv.x*9.0 - t*0.85 + wind*0.4, uv.y*3.2 + 0.7));
  col += vec3(0.08,0.10,0.18) * cloudA * smoothstep(0.0,0.85,uv.y) * 0.55;
  col += vec3(0.04,0.06,0.13) * cloudB * smoothstep(0.0,0.55,uv.y) * 0.30;
  float peaks = smoothstep(0.65, 0.95, cloudA);
  col += vec3(0.18,0.22,0.36) * peaks * smoothstep(0.0,0.85,uv.y) * 0.50;

  // DISTANT HORIZON SHEET LIGHTNING.
  float horizon = smoothstep(0.30, 0.0, uv.y);
  float horizonPulse = smoothstep(0.92, 1.0, sin(u_time*0.42));
  col += vec3(0.50,0.32,0.70) * horizon * horizonPulse * 0.45;
  col += vec3(0.20,0.18,0.35) * horizon * (0.55 + 0.45*sin(u_time*0.9 + uv.x*8.0)) * 0.12;

  // PRIMARY + SECONDARY FLASH — three beats per cycle.
  float flashCycle = fract(t*0.22);
  float flash = smoothstep(0.86, 0.91, flashCycle) * smoothstep(0.99, 0.92, flashCycle);
  float aftFlash = smoothstep(0.55, 0.58, flashCycle) * smoothstep(0.66, 0.59, flashCycle);
  float strobe = smoothstep(0.30, 0.32, flashCycle) * smoothstep(0.36, 0.32, flashCycle) * 0.6;
  col += vec3(0.65,0.75,1.0) * flash * exp(-length(uv-0.5)*0.5) * 0.45;
  col += vec3(0.40,0.55,0.85) * aftFlash * 0.30;
  col += vec3(0.55,0.65,0.95) * strobe * 0.22;

  // 4 BOLTS firing simultaneously on flash.
  float bolt1x = 0.18 + 0.04*sin(u_time*0.4);
  float bolt2x = 0.42 + 0.06*cos(u_time*0.35 + 1.7);
  float bolt3x = 0.66 + 0.05*sin(u_time*0.30 + 3.1);
  float bolt4x = 0.82 + 0.03*cos(u_time*0.55 + 0.6);
  float bolt1 = smoothstep(0.012,0.0, abs(uv.x - bolt1x - 0.030*sin(uv.y*15.0)));
  float bolt2 = smoothstep(0.011,0.0, abs(uv.x - bolt2x - 0.025*sin(uv.y*19.0 + 1.5)));
  float bolt3 = smoothstep(0.010,0.0, abs(uv.x - bolt3x - 0.022*sin(uv.y*23.0 + 0.8)));
  float bolt4 = smoothstep(0.009,0.0, abs(uv.x - bolt4x - 0.028*sin(uv.y*17.0 + 2.4)));
  float fork1 = smoothstep(0.008,0.0, abs(uv.x - bolt1x - 0.10 - 0.02*sin(uv.y*22.0)))
              * smoothstep(0.55, 0.30, uv.y);
  float fork3 = smoothstep(0.008,0.0, abs(uv.x - bolt3x + 0.09 + 0.018*sin(uv.y*20.0)))
              * smoothstep(0.50, 0.28, uv.y);
  col += vec3(0.60,0.85,1.0) * bolt1 * flash * smoothstep(0.0,0.90,uv.y) * 1.05;
  col += vec3(0.65,0.80,1.0) * bolt2 * flash * smoothstep(0.0,0.85,uv.y) * 0.90;
  col += vec3(0.70,0.85,1.0) * bolt3 * aftFlash * smoothstep(0.0,0.85,uv.y) * 1.05;
  col += vec3(0.55,0.75,0.95) * bolt4 * strobe * smoothstep(0.0,0.80,uv.y) * 0.85;
  col += vec3(0.55,0.80,1.0) * fork1 * flash * 0.65;
  col += vec3(0.65,0.80,1.0) * fork3 * aftFlash * 0.65;
  col += vec3(0.50,0.30,0.85) * (bolt1+bolt2)*flash*0.30;
  col += vec3(0.55,0.35,0.90) * bolt3*aftFlash*0.35;
  float hit1 = exp(-pow((uv.x-bolt1x)*aspect*9.0,2.0) - pow((uv.y-0.05)*8.0,2.0));
  float hit3 = exp(-pow((uv.x-bolt3x)*aspect*9.0,2.0) - pow((uv.y-0.05)*8.0,2.0));
  col += vec3(1.0,0.95,0.85) * hit1 * flash * 1.4;
  col += vec3(1.0,0.95,0.85) * hit3 * aftFlash * 1.4;

  // CLOUD ILLUMINATION.
  col += vec3(0.30,0.45,0.80) * cloudA * flash * smoothstep(0.0,0.65,uv.y) * 0.45;
  col += vec3(0.25,0.35,0.65) * cloudA * aftFlash * smoothstep(0.0,0.65,uv.y) * 0.25;

  // GROUND REFLECTION.
  float ground = smoothstep(0.12, 0.0, uv.y);
  col += vec3(0.30,0.45,0.85) * ground * flash * 1.0;
  col += vec3(0.25,0.35,0.70) * ground * aftFlash * 0.6;

  // RAIN — 3 layers parallax + wind shear.
  vec2 rp = uv*vec2(aspect,1.0)*vec2(40.0,75.0); rp.x -= t*3.4 + wind*0.3;
  float rain = smoothstep(0.93,0.96, fract(rp.x + rp.y*0.32 + wind*0.5))
             * step(0.965, hash(floor(rp)));
  col += vec3(0.30,0.45,0.65) * rain * 0.18;
  col += vec3(0.55,0.70,0.95) * rain * flash * 0.50;
  vec2 rp2 = uv*vec2(aspect,1.0)*vec2(60.0,50.0); rp2.x -= t*1.7;
  float rain2 = smoothstep(0.92,0.95, fract(rp2.x + rp2.y*0.22 + wind*0.3))
              * step(0.96, hash(floor(rp2)));
  col += vec3(0.35,0.50,0.70) * rain2 * 0.12;
  vec2 rp3 = uv*vec2(aspect,1.0)*vec2(28.0,90.0); rp3.x -= t*4.5;
  float rain3 = smoothstep(0.94,0.97, fract(rp3.x + rp3.y*0.40))
              * step(0.97, hash(floor(rp3)));
  col += vec3(0.45,0.60,0.85) * rain3 * 0.10;

  // SHEET-RAIN WIND SWEEP.
  float sweepX = fract(u_time*0.06 + wind*0.05);
  float sweep = exp(-pow((uv.x - sweepX)*aspect*2.8, 2.0))
              * smoothstep(0.0, 0.5, uv.y) * smoothstep(0.9, 0.3, uv.y);
  col += vec3(0.20,0.28,0.42) * sweep * 0.22;

  // RAIN MIST CURTAIN at top.
  float mistBand = fbm(uv*vec2(aspect,1.0)*vec2(8.0,3.0) + vec2(t*1.5,0.0));
  col += vec3(0.13,0.18,0.30) * mistBand * smoothstep(0.85, 1.0, uv.y) * 0.45;

  return col;
}
`;
