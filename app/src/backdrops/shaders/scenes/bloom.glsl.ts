/** Scene 19 — BLOOM — infinite procedural garden.
 *
 *  FLOWERS use a TRUE ELLIPSE SDF (rx ≈ 0.34 × pLen, ry = pLen/2), matching
 *  BloomPad.tsx's <ellipse rx=14 ry=22> shape: rounded tip + rounded base,
 *  NEVER tapers to zero. The earlier sin(uu*PI)*(1-0.22*uu) teardrop drove
 *  the petal width to zero at the tip, which the smoothstep edge then
 *  carved into a single-pixel spike.
 *
 *  PROCEDURAL LIFE CYCLE (2026-06-07 finishing pass): every vine + every
 *  wildflower runs its own cycle on a different period, so the garden never
 *  freezes on the same 5 flowers. Each cycle re-rolls position, hue, petal
 *  count (5/6/7/8) and size from `hash(vec2(fi, cycle))`. A wildflower
 *  layer adds 10 small ground flowers (daisy / dandelion / wild rose /
 *  bluebell / poppy palette) along the grass with their own ~14s cycle,
 *  staggered so something is always blooming or wilting somewhere.
 *
 *  GLSL ES 1.00 safe: no continue, no float ternaries, no exponent literals,
 *  constant loop bounds only. Per-pixel cost stays bounded; the early-out
 *  guards on uv.y skip vines/wildflowers when the pixel is far above them.
 */
export const BLOOM_GLSL = `
vec3 bloom(vec2 uv, float aspect){
  float t = u_time;
  float intensityK = clamp(u_intensity, 0.0, 2.0);

  // SKY-TO-MEADOW gradient. Darkened ~25% (2026-06-07) so HUD text stays
  // readable over the scene and the pink flowers no longer flash against a
  // chalk-white sky. Reads as a soft overcast meadow instead of a pastel
  // brochure.
  vec3 col = mix(vec3(0.50, 0.58, 0.66), vec3(0.56, 0.64, 0.54),
                 smoothstep(0.0, 1.0, uv.y));

  // Warm sun glow upper-right — softer, dimmer.
  float sd = length((uv - vec2(0.78, 0.14)) * vec2(aspect, 1.0));
  col += vec3(0.92, 0.86, 0.66) * exp(-sd*sd*5.5) * 0.13;

  // CLOUD WISPS — softer overcast tint so they don't punch white through.
  for(int i=0; i<2; i++){
    float fi = float(i);
    float cx = fract(0.22 + fi*0.45 + u_time*0.006*(1.0 + fi*0.5));
    float cy = 0.10 + fi*0.06;
    vec2 cd = (uv - vec2(cx, cy)) * vec2(aspect, 1.0);
    float cloud = smoothstep(0.14, 0.0, abs(cd.x))
                * smoothstep(0.013, 0.0, abs(cd.y));
    col = mix(col, vec3(0.86, 0.86, 0.82), cloud * 0.22);
  }

  // GRASS — wavy top edge, darker than the old chalky pastel.
  float grassTop = 0.86 + 0.018*sin(uv.x*35.0 + u_time*0.2)
                        + 0.010*sin(uv.x*58.0 - u_time*0.15);
  float grassMask = smoothstep(grassTop + 0.015, grassTop - 0.005, uv.y);
  col = mix(col, vec3(0.30, 0.48, 0.26), grassMask * 0.55);
  col = mix(col, vec3(0.20, 0.36, 0.18),
            smoothstep(0.94, 1.0, uv.y) * grassMask * 0.60);

  // ── 5 PROCEDURAL VINES — each cycles every ~22-30s; per-cycle hash seed
  //    re-rolls position, hue, petal count and size so the garden never
  //    repeats the same 5 flowers.
  for(int i=0; i<5; i++){
    float fi = float(i);
    float lifespan = 22.0 + fi * 1.8;
    float phaseRaw = u_time / lifespan + fi * 0.41;
    float cycle = floor(phaseRaw);
    float phase = fract(phaseRaw);

    // Per-cycle seeds — DIFFERENT every renewal (cycle changes integer).
    vec2 seedV = vec2(fi*7.31, cycle);
    float s0 = hash(seedV);
    float s1 = hash(seedV + vec2(1.7, 3.1));
    float s2 = hash(seedV + vec2(9.4, 5.6));
    float s3 = hash(seedV + vec2(2.9, 11.2));
    float s4 = hash(seedV + vec2(6.5, 17.8));

    // Life envelope: grow -> bloom -> fade. Multiplies every contribution
    // so we don't need a continue keyword (GLSL ES 1.00 forbids it).
    float grow = smoothstep(0.0, 0.16, phase);
    float fade = 1.0 - smoothstep(0.84, 1.0, phase);
    float life = grow * fade;

    // Random position: vx anywhere across the canvas, growH varies.
    float vx = mix(0.06, 0.94, s0);
    float growH = mix(0.32, 0.48, s1);

    // Early-out: skip pixels far above the flower's top.
    if(uv.y <= growH + 0.07){

      // Per-cycle petal colour drawn from a 6-stop palette. Saturation
      // dropped ~25% (2026-06-07) so the flowers no longer blast pure pink
      // / yellow against the meadow — Alex's "trop flash, presque
      // illisible" feedback.
      vec3 pCol = vec3(0.82, 0.50, 0.62);
      if(s2 < 0.16) pCol = vec3(0.82, 0.46, 0.60);           // rose poudré
      else if(s2 < 0.32) pCol = vec3(0.84, 0.62, 0.50);      // pêche fade
      else if(s2 < 0.48) pCol = vec3(0.78, 0.58, 0.72);      // lilas grisé
      else if(s2 < 0.64) pCol = vec3(0.86, 0.70, 0.42);      // safran mat
      else if(s2 < 0.80) pCol = vec3(0.62, 0.72, 0.84);      // bleu fumé
      else                pCol = vec3(0.82, 0.80, 0.74);     // ivoire

      // Per-cycle petal count: 5, 6, 7 or 8.
      float pCountF = 5.0;
      if(s3 < 0.30) pCountF = 5.0;
      else if(s3 < 0.60) pCountF = 6.0;
      else if(s3 < 0.85) pCountF = 7.0;
      else                pCountF = 8.0;

      // Random size, then scaled by grow so the flower visibly EXPANDS at
      // birth and shrinks as it fades.
      float pLenBase = mix(0.044, 0.066, s4);
      float pLen = pLenBase * (0.25 + 0.75 * grow);
      // Width narrows as petal count rises (more petals must be thinner).
      float pHalfW = pLen * (0.45 - pCountF * 0.026);

      // STEM: crisp two-tone line with gentle sway. Stem length follows
      // grow so it "extends" from the ground.
      float sway = 0.030*sin(uv.y*6.0 + fi*1.8 + u_time*0.12);
      float stemX = vx + sway;
      float stemTop = mix(1.05, growH, grow);
      float stemDx = abs(uv.x - stemX) * aspect;
      float stemFade = smoothstep(stemTop + 0.002, stemTop - 0.02, uv.y)
                     * smoothstep(1.01, 0.94, uv.y);
      float stemO = smoothstep(0.0045, 0.0025, stemDx);
      float stemI = smoothstep(0.0020, 0.0008, stemDx);
      col = mix(col, vec3(0.34, 0.58, 0.32), stemO * stemFade * 0.65 * life);
      col = mix(col, vec3(0.24, 0.46, 0.26), stemI * stemFade * 0.80 * life);

      // LEAVES — 2 per vine, with central vein highlight. Slide up the
      // stem with growth.
      for(int l=0; l<2; l++){
        float fl = float(l);
        float lyTarget = growH + (1.0 - growH) * (0.30 + fl*0.30);
        float ly = mix(1.0, lyTarget, grow);
        float leafVis = smoothstep(stemTop + 0.005, stemTop - 0.01, ly);
        if(leafVis > 0.01){
          float side = sign(mod(fl + fi, 2.0) - 0.5);
          float lx = stemX + side * 0.025;
          vec2 ld = (uv - vec2(lx, ly)) * vec2(aspect, 1.0);
          float tiltA = side * 0.65;
          float cs = cos(tiltA);
          float sn = sin(tiltA);
          float rx = ld.x*cs - ld.y*sn;
          float ry = ld.x*sn + ld.y*cs;
          float leafR = rx*rx*1000.0 + ry*ry*4500.0;
          float leaf = smoothstep(1.3, 0.5, leafR);
          col = mix(col, vec3(0.38, 0.64, 0.34), leaf * 0.78 * leafVis * life);
          float vein = smoothstep(0.004, 0.001, abs(ry))
                     * smoothstep(-0.002, 0.005, rx)
                     * smoothstep(0.030, 0.018, rx);
          col = mix(col, vec3(0.52, 0.76, 0.44),
                    vein * leaf * leafVis * 0.40 * life);
        }
      }

      // ── FLOWER: variable-count ellipse petals ──
      vec2 fc = vec2(stemX, growH);
      vec2 fd = (uv - fc) * vec2(aspect, 1.0);
      float fdist = length(fd);
      float bPulse = 0.92 + 0.08*sin(u_time*0.7 + fi*1.6);
      // Each cycle starts with a random global rotation, so the petals
      // never line up the same way twice.
      float baseAng = s0 * 6.2832 + 1.5708;

      // Petal loop with constant bound 8; mask off via if() gate so the
      // loop is safe under GLSL ES 1.00 (no dynamic loop bound).
      float petalMask = 0.0;
      for(int k=0; k<8; k++){
        float fk = float(k);
        if(fk < pCountF){
          float pang = baseAng + fk * 6.2832 / pCountF;
          vec2 pdir = vec2(cos(pang), sin(pang));
          vec2 perp = vec2(-pdir.y, pdir.x);
          float along = dot(fd, pdir);
          float across = dot(fd, perp);
          float forward = step(-0.004, along);
          float nx = across / pHalfW;
          float ny = (along - pLen*0.5) / (pLen*0.5);
          float ellipseSDF = nx*nx + ny*ny;
          float inP = smoothstep(1.0, 0.78, ellipseSDF) * forward;
          petalMask = max(petalMask, inP);
        }
      }

      // Apply petals — softer mix factor + dimmer sheen so they no longer
      // burn into the sky.
      col = mix(col, pCol, petalMask * 0.78 * bPulse * life);
      col += vec3(0.85, 0.82, 0.78) * petalMask*petalMask * 0.08 * life;

      // Centre disc — toned-down gold so it doesn't strobe.
      float discScale = max(grow, 0.18);
      float cDisc = smoothstep(0.014 * discScale, 0.010 * discScale, fdist) * bPulse;
      col = mix(col, vec3(0.78, 0.66, 0.30), cDisc * 0.78 * life);
      // Stamen ring.
      float stRing = smoothstep(0.013 * discScale, 0.011 * discScale, fdist)
                   * smoothstep(0.007 * discScale, 0.009 * discScale, fdist);
      col = mix(col, vec3(0.46, 0.32, 0.14), stRing * 0.42 * life);
      // Pistil — dark centre dot.
      float pistil = smoothstep(0.005 * discScale, 0.003 * discScale, fdist);
      col = mix(col, vec3(0.32, 0.22, 0.08), pistil * 0.55 * life);
    }
  }

  // ── 10 WILDFLOWERS scattered along the grass — their own ~12-16s cycle
  //    with a 4-petal rosette SDF (cheap polar sin lobe) + bright disc
  //    centre. Each picks from a wider palette (dandelion / bluebell / wild
  //    rose / poppy / daisy) so the meadow reads like several species.
  if(uv.y > 0.72){
    for(int w=0; w<10; w++){
      float fw = float(w);
      float wfLife = 12.0 + mod(fw, 3.0)*2.5;
      float wfRaw = u_time / wfLife + fw * 0.197;
      float wfCycle = floor(wfRaw);
      float wfPhase = fract(wfRaw);
      vec2 wfSeedV = vec2(fw*4.73, wfCycle);
      float w0 = hash(wfSeedV);
      float w1 = hash(wfSeedV + vec2(2.1, 9.7));
      float w2 = hash(wfSeedV + vec2(5.9, 1.4));
      float wfGrow = smoothstep(0.0, 0.18, wfPhase);
      float wfFade = 1.0 - smoothstep(0.82, 1.0, wfPhase);
      float wfL = wfGrow * wfFade;

      // Position: spread across X, sit just under the grass line.
      vec2 wfc = vec2(mix(0.02, 0.98, fract(fw*0.193 + w0*0.27)),
                      mix(0.82, 0.93, w1));
      vec2 wfd = (uv - wfc) * vec2(aspect, 1.0);
      float wfDist = length(wfd);

      // Per-cycle palette pick — 5 wild species, all desaturated so they
      // read as flowers in shade, not roadside neons.
      vec3 wfCol = vec3(0.82, 0.46, 0.54);
      if(w2 < 0.20) wfCol = vec3(0.84, 0.74, 0.32);         // pissenlit mat
      else if(w2 < 0.40) wfCol = vec3(0.84, 0.84, 0.80);    // marguerite ivoire
      else if(w2 < 0.60) wfCol = vec3(0.56, 0.52, 0.78);    // clochette grisée
      else if(w2 < 0.80) wfCol = vec3(0.82, 0.46, 0.54);    // wild rose poudré
      else                wfCol = vec3(0.78, 0.30, 0.30);   // coquelicot brûlé

      // Per-cycle lobe count (4 or 6 lobes — wild species variation).
      float lobeFreq = 4.0;
      if(w0 > 0.5) lobeFreq = 6.0;

      // Polar 4/6-lobe rosette — sin lobes around centre, cheap (one atan).
      float wfAng = atan(wfd.y, wfd.x);
      float lobe = 0.55 + 0.45 * cos(wfAng * lobeFreq + w0 * 6.28);
      float wfSize = mix(0.014, 0.026, w1) * (0.3 + 0.7 * wfGrow);
      float wfShape = smoothstep(wfSize, wfSize*0.35, wfDist) * lobe;
      col = mix(col, wfCol, wfShape * 0.70 * wfL);
      // Centre dot — muted gold, no longer hot.
      float wfDisc = smoothstep(wfSize*0.35, wfSize*0.20, wfDist);
      col = mix(col, vec3(0.74, 0.62, 0.26), wfDisc * 0.70 * wfL);
    }
  }

  // FALLING PETALS — crisp spinning ellipses, count + colour vary.
  for(int i=0; i<14; i++){
    float fi = float(i);
    if(fi <= intensityK * 9.0){
      float lane = fract(fi*0.137 + sin(fi*1.7)*0.21);
      float phase = fract(u_time*0.07 + fi*0.18);
      float px = lane + 0.07*sin(phase*6.28 + fi);
      float py = 1.0 - phase * 1.14;
      vec2 pp = (uv - vec2(px, py)) * vec2(aspect, 1.0);
      float spinAng = phase * 9.0 + fi;
      float cs = cos(spinAng);
      float sn = sin(spinAng);
      float rx = pp.x*cs - pp.y*sn;
      float ry = pp.x*sn + pp.y*cs;
      float petalR = rx*rx*2600.0 + ry*ry*7000.0;
      float petal = smoothstep(1.4, 0.4, petalR);
      // Falling petals — palette muted to match the new flower tones; mix
      // factor dropped from 0.72 to 0.50 so they no longer flash through.
      float ph = fract(fi*0.347 + sin(fi*3.2)*0.18);
      vec3 fpc = vec3(0.82, 0.48, 0.60);
      if(ph < 0.20) fpc = vec3(0.82, 0.48, 0.60);
      else if(ph < 0.40) fpc = vec3(0.82, 0.70, 0.74);
      else if(ph < 0.60) fpc = vec3(0.84, 0.64, 0.42);
      else if(ph < 0.80) fpc = vec3(0.70, 0.64, 0.82);
      else                fpc = vec3(0.80, 0.78, 0.70);
      col = mix(col, fpc, petal * 0.50);
    }
  }

  // FIREFLIES — strobe range tightened (was 0.0..1.0 full strobe →
  // 0.30..0.85) so they breathe instead of flashing, and tinted dimmer.
  for(int i=0; i<8; i++){
    float fi = float(i);
    float fx = 0.10 + fi*0.105 + 0.04*sin(u_time*0.55 + fi*1.3);
    float fy = 0.20 + 0.42*(fi/8.0) + 0.035*cos(u_time*0.75 + fi*2.1);
    vec2 ffd = (uv - vec2(fx, fy)) * vec2(aspect, 1.0);
    float ffdist = length(ffd);
    float ffP = 0.30 + 0.55*0.5*(1.0 + sin(u_time*1.9 + fi*4.7));
    float core = smoothstep(0.004, 0.002, ffdist);
    float glow = exp(-ffdist*ffdist*10000.0);
    col += vec3(0.82, 0.74, 0.42) * (core*0.60 + glow*0.22) * ffP;
  }

  // DAPPLED SUNLIGHT on grass — also dimmer to keep the meadow calm.
  for(int i=0; i<3; i++){
    float fi = float(i);
    float dx = 0.15 + fi*0.28 + 0.03*sin(t*0.08 + fi*2.2);
    float dy = 0.92 + 0.025*sin(fi*3.1);
    vec2 dd = (uv - vec2(dx, dy)) * vec2(aspect, 1.0);
    float spk = exp(-dot(dd,dd)*800.0);
    float flk = 0.55 + 0.45*sin(t*0.3 + fi*1.8);
    col += vec3(0.86, 0.84, 0.66) * spk * flk * 0.07 * grassMask;
  }

  return col;
}
`;
