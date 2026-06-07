/**
 * Per-scene touch interaction block. Each scene paints a different reaction
 * to TAP / LONG-PRESS / SWIPE at the finger position (u_touch, u_touchAge,
 * u_hold, u_swipeMag, u_swipeAge).
 *
 * 2026-06-07: scene 19 (bloom) — flower bloom + pollen trail now scale with
 * u_intensity (slider). At low intensity, a single delicate flower; at max,
 * a vivid bloom + denser pollen trail. Matches what the player feels when
 * dragging the intensity slider in the picker.
 */
export const TOUCH_FX_GLSL = `
void applyTouchFx(inout vec3 col, vec2 uv, float aspect){
  vec2 tuv = u_touch / u_res;
  float age = u_touchAge;
  float td = length((uv - tuv) * vec2(aspect, 1.0));
  if (u_scene == 2) {
    // Neon Grid → the touched spot lights up pink and fades like a piano key.
    col += vec3(1.0,0.30,0.72) * exp(-td*td*55.0) * exp(-age*3.2) * 1.6;
  } else if (u_scene == 5) {
    // Quantum → a liquid ripple radiating from the fingertip.
    col += vec3(0.45,0.92,1.0) * sin(td*42.0 - age*9.0) * exp(-td*5.5) * exp(-age*2.2) * 0.7;
  } else if (u_scene == 4) {
    // Holy → a golden glitch square that materialises while held.
    float h = clamp(u_hold, 0.0, 1.0);
    float sz = 0.03 + h*0.11;
    vec2 d2 = abs(uv - tuv) * vec2(aspect, 1.0);
    float sq = smoothstep(sz, sz*0.78, max(d2.x, d2.y));
    float glitch = step(0.5, fract(uv.y*70.0 + u_time*4.0));
    col += vec3(1.0,0.82,0.36) * sq * (0.45 + 0.55*glitch) * smoothstep(0.0,0.04,h);
  } else if (u_scene == 7) {
    // Volcanic → lava eruption burst.
    col += vec3(1.0,0.35,0.0) * exp(-td*td*40.0) * exp(-age*2.0) * 1.4;
    col += vec3(1.0,0.7,0.2) * sin(td*30.0 - age*8.0) * exp(-td*5.0) * exp(-age*2.5) * 0.5;
  } else if (u_scene == 8) {
    // Abyss → bioluminescent pulse.
    col += vec3(0.0,0.9,0.8) * sin(td*35.0 - age*6.0) * exp(-td*4.0) * exp(-age*2.8) * 0.5;
    col += vec3(1.0,0.3,0.65) * exp(-td*td*60.0) * exp(-age*1.8) * 0.6;
  } else if (u_scene == 9) {
    // Eclipse → small diamond glint + corona breath + golden swipe trail.
    float h9 = clamp(u_hold, 0.0, 1.0);
    col += vec3(1.0,0.92,0.65) * exp(-td*td*90.0) * exp(-age*2.8) * 0.45;
    float coronaH = smoothstep(0.012,0.0, abs(td - 0.04 - h9*0.10));
    col += vec3(1.0,0.78,0.35) * coronaH * h9 * (0.65 + 0.35*sin(u_time*2.5)) * 0.50;
    float trail9 = exp(-abs((uv.y - tuv.y))*aspect*9.0) * smoothstep(0.0,0.5,u_swipeMag);
    col += vec3(1.0,0.80,0.35) * trail9 * exp(-u_swipeAge*1.5) * 0.30;
  } else if (u_scene == 10) {
    // Phantom → ghost glow + materialising soul orb + curtain swipe.
    float h10 = clamp(u_hold, 0.0, 1.0);
    col += vec3(0.85,0.92,1.0) * exp(-td*td*60.0) * exp(-age*1.8) * 0.42;
    float orbR = 0.025 + h10*0.06;
    float orb = exp(-pow((td - 0.0)*1.0, 2.0) / (orbR*orbR));
    col += vec3(0.95,0.98,1.0) * orb * h10 * (0.65 + 0.20*sin(u_time*2.0)) * 0.45;
    col += vec3(0.55,0.75,0.95) * exp(-td*td*20.0) * h10 * 0.20;
    float partY = exp(-pow((uv.y - tuv.y)*aspect*4.5, 2.0));
    col += vec3(0.70,0.85,1.0) * partY * smoothstep(0.0,0.6,u_swipeMag) *
           exp(-u_swipeAge*1.3) * 0.25;
  } else if (u_scene == 11) {
    // Emberforge → ember pop + forge mouth growing + spark swipe.
    float h11 = clamp(u_hold, 0.0, 1.0);
    col += vec3(1.0,0.65,0.20) * exp(-td*td*80.0) * exp(-age*2.5) * 0.55;
    float forgeR = 0.04 + h11*0.14;
    float forge = exp(-td*td / (forgeR*forgeR));
    col += vec3(1.0,0.55,0.10) * forge * h11 * (0.55 + 0.25*sin(u_time*4.0)) * 0.55;
    col += vec3(1.0,0.85,0.45) * exp(-td*td*200.0) * h11 * 0.40;
    float trailE = exp(-abs(uv.y - tuv.y)*aspect*12.0);
    col += vec3(1.0,0.70,0.15) * trailE * smoothstep(0.0,0.5,u_swipeMag) *
           exp(-u_swipeAge*1.8) * 0.30;
  } else if (u_scene == 12) {
    // Tempus → sepia ripple + bronze glow + sand swipe.
    float h12 = clamp(u_hold, 0.0, 1.0);
    col += vec3(0.85,0.55,0.20) * exp(-td*td*55.0) * exp(-age*2.0) * 0.42;
    float fract12 = smoothstep(0.020,0.0, abs(td - h12*0.18));
    col += vec3(0.85,0.55,0.20) * fract12 * h12 * 0.45;
    col += vec3(0.95,0.78,0.32) * exp(-td*td*22.0) * h12 * 0.20;
    col -= vec3(0.04,0.025,0.012) * h12 * smoothstep(0.5, 1.05, length((uv-0.5)*vec2(aspect,1.0)));
    float sandTr = exp(-abs(uv.y - tuv.y)*aspect*7.0);
    col += vec3(0.75,0.45,0.18) * sandTr * smoothstep(0.0,0.5,u_swipeMag) *
           exp(-u_swipeAge*1.4) * 0.22;
  } else if (u_scene == 13) {
    // Storm → cloud illumination + bolt charge + rain wind swipe.
    float h13 = clamp(u_hold, 0.0, 1.0);
    col += vec3(0.30,0.55,0.85) * exp(-td*td*30.0) * exp(-age*2.5) * 0.50;
    col += vec3(0.55,0.75,1.0) * exp(-td*td*180.0) * h13 * (0.55 + 0.25*sin(u_time*8.0)) * 0.55;
    float boltDist = abs((uv.x - tuv.x) * aspect);
    float boltMask = exp(-boltDist * 60.0) * smoothstep(1.0, tuv.y, uv.y);
    col += vec3(0.55,0.85,1.0) * boltMask * smoothstep(0.0,0.05,age) *
           exp(-age*5.0) * 0.85;
    col += vec3(0.95,0.95,0.85) * exp(-td*td*100.0) * exp(-age*5.0) * 0.65;
    float windBand = exp(-abs(uv.y - tuv.y)*aspect*5.0);
    col += vec3(0.55,0.70,0.95) * windBand * smoothstep(0.0,0.4,u_swipeMag) *
           exp(-u_swipeAge*1.3) * 0.22;
  } else if (u_scene == 14) {
    // Coral → anemone glow + growing anemone + fish-wake swipe.
    float h14 = clamp(u_hold, 0.0, 1.0);
    col += vec3(0.30,1.0,0.80) * exp(-td*td*220.0) * exp(-age*2.5) * 0.85;
    float coralRing = smoothstep(0.012, 0.0, abs(td - 0.04 - age*0.18));
    col += vec3(0.70,1.0,0.92) * coralRing * exp(-age*1.6) * 0.55;
    float anR = 0.04 + h14*0.10;
    float anemone = exp(-td*td / (anR*anR));
    col += vec3(0.30,1.0,0.80) * anemone * h14 * (0.55 + 0.25*sin(u_time*3.5)) * 0.60;
    float ang14 = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
    float petalLobes = 0.55 + 0.45*cos(ang14*8.0);
    float anHalo = exp(-td*td*60.0) * petalLobes;
    col += vec3(1.0,0.45,0.45) * anHalo * h14 * 0.35;
    float fishWake = exp(-abs(uv.y - tuv.y)*aspect*9.0);
    col += vec3(1.0,0.92,0.65) * fishWake * smoothstep(0.0,0.4,u_swipeMag) *
           exp(-u_swipeAge*1.5) * 0.30;
  } else if (u_scene == 15) {
    // Rust → welding flash + forge mouth glow + spark swipe.
    float h15 = clamp(u_hold, 0.0, 1.0);
    col += vec3(1.0,0.55,0.10) * exp(-td*td*85.0) * exp(-age*3.0) * 0.85;
    col += vec3(1.0,0.95,0.78) * exp(-td*td*420.0) * exp(-age*2.5) * 0.95;
    float forgeR15 = 0.05 + h15*0.13;
    float forge15 = exp(-td*td / (forgeR15*forgeR15));
    col += vec3(0.95,0.45,0.10) * forge15 * h15 * (0.55 + 0.20*sin(u_time*5.0)) * 0.55;
    col += vec3(1.0,0.85,0.45) * exp(-td*td*250.0) * h15 * 0.45;
    float sparkBand = exp(-abs(uv.y - tuv.y)*aspect*8.0);
    sparkBand *= 0.5 + 0.5*sin(uv.x*aspect*60.0 + u_time*8.0);
    col += vec3(1.0,0.70,0.20) * sparkBand * smoothstep(0.0,0.4,u_swipeMag) *
           exp(-u_swipeAge*1.6) * 0.45;
  } else if (u_scene == 16) {
    // Void → clean reticule expanding + hexagram hold + line swipe.
    float h16 = clamp(u_hold, 0.0, 1.0);
    col += vec3(1.0) * exp(-td*td*1200.0) * exp(-age*3.5) * 1.0;
    float reticule16 = smoothstep(0.001, 0.0, abs(td - 0.025 - age*0.08));
    col += vec3(1.0) * reticule16 * exp(-age*1.8) * 0.85;
    float angV = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
    float starWedge = abs(sin(angV*3.0));
    float starR = 0.06 + h16*0.10;
    float starLine = smoothstep(0.001, 0.0, abs(td - starR*starWedge));
    col += vec3(1.0) * starLine * h16 * 0.95;
    col += vec3(1.0) * exp(-td*td*600.0) * h16 * 0.55;
    float swipeLine = smoothstep(0.001, 0.0, abs(uv.y - tuv.y));
    col += vec3(1.0) * swipeLine * smoothstep(0.0,0.3,u_swipeMag) *
           exp(-u_swipeAge*1.4) * 0.85;
  } else if (u_scene == 17) {
    // Prism → spectral burst + rainbow ring hold + rainbow swipe band.
    float h17 = clamp(u_hold, 0.0, 1.0);
    col += vec3(1.0) * exp(-td*td*1100.0) * exp(-age*2.5) * 1.0;
    float prismAng = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
    float halo17 = exp(-td*td*200.0) * exp(-age*1.5);
    vec3 rb = vec3(0.5 + 0.5*sin(prismAng*3.0 + 0.0),
                   0.5 + 0.5*sin(prismAng*3.0 + 2.09),
                   0.5 + 0.5*sin(prismAng*3.0 + 4.18));
    col += rb * halo17 * 0.85;
    float spRingR = 0.10 + h17*0.06;
    float spRing = exp(-pow((td - spRingR)*28.0, 2.0));
    col += rb * spRing * h17 * 0.85;
    float prismBand = exp(-abs(uv.y - tuv.y)*aspect*7.0);
    vec3 trailRB = vec3(0.5 + 0.5*sin(uv.x*aspect*22.0 + 0.0),
                        0.5 + 0.5*sin(uv.x*aspect*22.0 + 2.09),
                        0.5 + 0.5*sin(uv.x*aspect*22.0 + 4.18));
    col += trailRB * prismBand * smoothstep(0.0,0.35,u_swipeMag) *
           exp(-u_swipeAge*1.4) * 0.45;
  } else if (u_scene == 18) {
    // Ink → black blot lands + stroke ring hold + ink swipe trail.
    float h18 = clamp(u_hold, 0.0, 1.0);
    col = mix(col, vec3(0.06, 0.04, 0.05), exp(-td*td*350.0) * exp(-age*1.8) * 0.85);
    col = mix(col, vec3(0.30, 0.25, 0.28), exp(-td*td*60.0) * exp(-age*1.2) * 0.18);
    float strokeR18 = 0.03 + h18*0.10;
    float stroke18 = smoothstep(0.006, 0.0, abs(td - strokeR18));
    col = mix(col, vec3(0.05, 0.03, 0.04), stroke18 * h18 * 0.85);
    float inkBand = smoothstep(0.012, 0.0, abs(uv.y - tuv.y));
    col = mix(col, vec3(0.06, 0.04, 0.05),
              inkBand * smoothstep(0.0,0.3,u_swipeMag) * exp(-u_swipeAge*1.5) * 0.85);
  } else if (u_scene == 19) {
    // Bloom → SCALABLE flower bloom that grows with u_intensity (slider).
    //   k = 0.4 : tiny delicate single flower.
    //   k = 1.0 : shipping look.
    //   k = 2.0 : vivid bloom + denser pollen trail.
    // The shader companion to the PremiumTouchLayer's draggable petals.
    float h19 = clamp(u_hold, 0.0, 1.0);
    float k19 = clamp(u_intensity, 0.4, 2.0);
    // 5-petal flower around the touch — radius + brightness scale with k.
    float angB = atan(uv.y - tuv.y, (uv.x - tuv.x)*aspect);
    float lobesB = 0.55 + 0.45*cos(angB*5.0);
    float bloomR = (0.06 + h19*0.06) * mix(0.85, 1.4, (k19 - 0.4) / 1.6);
    float bloomFlower = smoothstep(bloomR, bloomR*0.35, td) * lobesB;
    float hueT = u_time*0.4;
    vec3 bloomCol = vec3(0.5 + 0.5*sin(hueT + 0.0),
                         0.5 + 0.5*sin(hueT + 2.09),
                         0.5 + 0.5*sin(hueT + 4.18));
    bloomCol = mix(vec3(1.0, 0.55, 0.75), bloomCol, 0.4);
    col = mix(col, bloomCol, bloomFlower * exp(-age*1.2) * (0.85 + h19*0.15) * k19);
    // Bright yellow centre — brighter at high intensity.
    col = mix(col, vec3(1.0, 0.92, 0.40),
              exp(-td*td*1800.0) * (exp(-age*1.5) + h19*0.5) * (0.65 + 0.30*k19));
    // Pollen trail (yellow dotted band) — density scales with k.
    float pollenBand = exp(-abs(uv.y - tuv.y)*aspect*6.0);
    pollenBand *= 0.4 + 0.6*sin(uv.x*aspect*45.0 + u_time*3.0);
    col += vec3(1.0, 0.85, 0.45) * pollenBand * smoothstep(0.0,0.35,u_swipeMag) *
           exp(-u_swipeAge*1.4) * 0.32 * k19;
  } else {
    // Galaxy / Nebula / Aurora / Casino → a soft universal ripple.
    col += vec3(0.80,0.85,1.0) * sin(td*26.0 - age*7.0) * exp(-td*4.8) * exp(-age*2.6) * 0.35;
  }
}
`;
