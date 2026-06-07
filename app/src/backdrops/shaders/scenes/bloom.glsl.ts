/** Scene 19 — BLOOM — infinite garden.
 *
 *  FLOWERS use a TRUE ELLIPSE SDF (rx ≈ 0.34 × pLen, ry = pLen/2), matching
 *  BloomPad.tsx's <ellipse rx=14 ry=22> shape: rounded tip + rounded base,
 *  NEVER tapers to zero. The earlier sin(uu*PI)*(1-0.22*uu) teardrop drove
 *  the petal width to zero at the tip, which the smoothstep edge then
 *  carved into a single-pixel spike — the "piques au bout des pétales"
 *  artifact Alex flagged on device.
 *
 *  All edges are smoothstep (no gaussian blur). Atmospheric layers: cloud
 *  wisps, grass, dappled sunlight, fireflies, falling petals.
 *
 *  GLSL ES 1.00 safe: no continue, no float ternaries, no exponent literals,
 *  constant loop bounds only.
 */
export const BLOOM_GLSL = `
vec3 bloom(vec2 uv, float aspect){
  float t = u_time;
  float intensityK = clamp(u_intensity, 0.0, 2.0);

  // SKY-TO-MEADOW gradient, clean, no banding.
  vec3 col = mix(vec3(0.72, 0.84, 0.94), vec3(0.82, 0.92, 0.80),
                 smoothstep(0.0, 1.0, uv.y));

  // Warm sun glow upper-right.
  float sd = length((uv - vec2(0.78, 0.14)) * vec2(aspect, 1.0));
  col += vec3(1.0, 0.97, 0.82) * exp(-sd*sd*5.5) * 0.20;

  // CLOUD WISPS — elongated ellipses drifting slowly.
  for(int i=0; i<2; i++){
    float fi = float(i);
    float cx = fract(0.22 + fi*0.45 + u_time*0.006*(1.0 + fi*0.5));
    float cy = 0.10 + fi*0.06;
    vec2 cd = (uv - vec2(cx, cy)) * vec2(aspect, 1.0);
    float cloud = smoothstep(0.14, 0.0, abs(cd.x))
                * smoothstep(0.013, 0.0, abs(cd.y));
    col = mix(col, vec3(1.0, 1.0, 0.98), cloud * 0.28);
  }

  // GRASS — wavy top edge, darker base for depth.
  float grassTop = 0.86 + 0.018*sin(uv.x*35.0 + u_time*0.2)
                        + 0.010*sin(uv.x*58.0 - u_time*0.15);
  float grassMask = smoothstep(grassTop + 0.015, grassTop - 0.005, uv.y);
  col = mix(col, vec3(0.42, 0.66, 0.36), grassMask * 0.50);
  col = mix(col, vec3(0.30, 0.52, 0.26),
            smoothstep(0.94, 1.0, uv.y) * grassMask * 0.50);

  // FIVE VINES with crisp realistic flowers (BloomPad quality).
  for(int i=0; i<5; i++){
    float fi = float(i);
    float vx = 0.10 + fi*0.195;
    float growH = 0.38 + 0.10*sin(u_time*0.08 + fi*1.3) + fi*0.018;

    // Early-out guard.
    if(uv.y <= growH + 0.06){

      // STEM: crisp two-tone line with gentle sway.
      float sway = 0.030*sin(uv.y*6.0 + fi*1.8 + u_time*0.12);
      float stemX = vx + sway;
      float stemDx = abs(uv.x - stemX) * aspect;
      float stemFade = smoothstep(growH + 0.002, growH - 0.02, uv.y)
                     * smoothstep(1.01, 0.94, uv.y);
      float stemO = smoothstep(0.0045, 0.0025, stemDx);
      float stemI = smoothstep(0.0020, 0.0008, stemDx);
      col = mix(col, vec3(0.34, 0.58, 0.32), stemO * stemFade * 0.65);
      col = mix(col, vec3(0.24, 0.46, 0.26), stemI * stemFade * 0.80);

      // LEAVES — 2 per vine, with central vein highlight.
      for(int l=0; l<2; l++){
        float fl = float(l);
        float ly = growH + (1.0 - growH) * (0.30 + fl*0.30);
        float leafVis = smoothstep(growH + 0.005, growH - 0.01, ly);
        if(leafVis > 0.01){
          float side = sign(mod(fl + fi, 2.0) - 0.5);
          float lx = stemX + side * 0.025;
          vec2 ld = (uv - vec2(lx, ly)) * vec2(aspect, 1.0);
          float tiltA = side * 0.65;
          float cs = cos(tiltA);
          float sn = sin(tiltA);
          float rx = ld.x*cs - ld.y*sn;
          float ry = ld.x*sn + ld.y*cs;
          // Teardrop leaf — crisp smoothstep.
          float leafR = rx*rx*1000.0 + ry*ry*4500.0;
          float leaf = smoothstep(1.3, 0.5, leafR);
          col = mix(col, vec3(0.38, 0.64, 0.34), leaf * 0.78 * leafVis);
          float vein = smoothstep(0.004, 0.001, abs(ry))
                     * smoothstep(-0.002, 0.005, rx)
                     * smoothstep(0.030, 0.018, rx);
          col = mix(col, vec3(0.52, 0.76, 0.44),
                    vein * leaf * leafVis * 0.40);
        }
      }

      // ── FLOWER: 5 ELLIPSE petals (rounded tip + base, no spikes) ──
      vec2 fc = vec2(stemX, growH);
      vec2 fd = (uv - fc) * vec2(aspect, 1.0);
      float fdist = length(fd);
      float bPulse = 0.92 + 0.08*sin(u_time*0.7 + fi*1.6);

      // Per-vine petal colour (if/else — no float ternaries).
      vec3 pCol = vec3(1.0, 0.55, 0.72);
      if(fi < 0.5){
        pCol = vec3(1.0, 0.50, 0.68);
      } else if(fi < 1.5){
        pCol = vec3(1.0, 0.72, 0.58);
      } else if(fi < 2.5){
        pCol = vec3(0.96, 0.68, 0.86);
      } else if(fi < 3.5){
        pCol = vec3(1.0, 0.82, 0.48);
      }

      // Five petals — TRUE ELLIPSE SDF (BloomPad style).
      //   pLen        = petal length from centre to tip
      //   pHalfW      = ellipse rx; pLen*0.5 = ellipse ry; aspect ≈ 0.34
      //   (along - pLen/2) shifts the ellipse so it sits centred at pLen/2
      //   nx² + ny² < 1 → inside the ellipse. Smoothstep gives the soft edge.
      float pLen = 0.055;
      float pHalfW = pLen * 0.34;
      float petalMask = 0.0;
      for(int k=0; k<5; k++){
        float fk = float(k);
        float pang = fk * 1.2566 + fi * 0.52 + 1.5708;
        vec2 pdir = vec2(cos(pang), sin(pang));
        vec2 perp = vec2(-pdir.y, pdir.x);
        float along = dot(fd, pdir);
        float across = dot(fd, perp);

        // Petals only spawn forward (along > 0). Clamp keeps SDF stable.
        float forward = step(-0.004, along);
        float nx = across / pHalfW;
        float ny = (along - pLen*0.5) / (pLen*0.5);
        float ellipseSDF = nx*nx + ny*ny;
        float inP = smoothstep(1.0, 0.78, ellipseSDF) * forward;
        petalMask = max(petalMask, inP);
      }

      // Apply petals — flat colour + subtle surface sheen.
      col = mix(col, pCol, petalMask * 0.93 * bPulse);
      col += vec3(1.0, 0.98, 0.94) * petalMask*petalMask * 0.16;

      // Yellow centre disc.
      float cDisc = smoothstep(0.014, 0.010, fdist) * bPulse;
      col = mix(col, vec3(1.0, 0.88, 0.38), cDisc * 0.95);
      // Stamen ring — darker annulus around centre.
      float stRing = smoothstep(0.013, 0.011, fdist)
                   * smoothstep(0.007, 0.009, fdist);
      col = mix(col, vec3(0.58, 0.40, 0.16), stRing * 0.40);
      // Pistil — dark centre dot.
      float pistil = smoothstep(0.005, 0.003, fdist);
      col = mix(col, vec3(0.42, 0.28, 0.10), pistil * 0.50);
    }
  }

  // FALLING PETALS — crisp spinning ellipses, count scales with intensity.
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
      vec3 fpc = mix(vec3(1.0, 0.58, 0.72), vec3(1.0, 0.84, 0.90), lane);
      col = mix(col, fpc, petal * 0.72);
    }
  }

  // FIREFLIES — sharp bright core, tiny warm glow.
  for(int i=0; i<8; i++){
    float fi = float(i);
    float fx = 0.10 + fi*0.105 + 0.04*sin(u_time*0.55 + fi*1.3);
    float fy = 0.20 + 0.42*(fi/8.0) + 0.035*cos(u_time*0.75 + fi*2.1);
    vec2 ffd = (uv - vec2(fx, fy)) * vec2(aspect, 1.0);
    float ffdist = length(ffd);
    float ffP = max(0.45 + 0.55*sin(u_time*1.9 + fi*4.7), 0.0);
    float core = smoothstep(0.004, 0.002, ffdist);
    float glow = exp(-ffdist*ffdist*10000.0);
    col += vec3(1.0, 0.93, 0.50) * (core*0.80 + glow*0.30) * ffP;
  }

  // DAPPLED SUNLIGHT on grass.
  for(int i=0; i<3; i++){
    float fi = float(i);
    float dx = 0.15 + fi*0.28 + 0.03*sin(t*0.08 + fi*2.2);
    float dy = 0.92 + 0.025*sin(fi*3.1);
    vec2 dd = (uv - vec2(dx, dy)) * vec2(aspect, 1.0);
    float spk = exp(-dot(dd,dd)*800.0);
    float flk = 0.55 + 0.45*sin(t*0.3 + fi*1.8);
    col += vec3(1.0, 0.98, 0.80) * spk * flk * 0.10 * grassMask;
  }

  return col;
}
`;
