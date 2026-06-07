/** Scene 10 — PHANTOM — haunted realm: spectral wisps, drifting eyes, soul
 *  mist, breath glow, periodic ghost flash. Premium-grade richness in motion. */
export const PHANTOM_GLSL = `
vec3 phantom(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*2.8;
  float t = u_time*0.055;
  float tFast = u_time*0.18;

  float breath = 0.85 + 0.15*sin(u_time*0.35);
  vec3 col = mix(vec3(0.05,0.06,0.10), vec3(0.10,0.13,0.18),
                 smoothstep(0.0,1.0,uv.y)) * breath;

  float mistA = fbm(p + vec2(t*0.8, t*0.4));
  float mistB = fbm(p*1.4 + vec2(-t*0.5, t*0.9));
  float mist = mistA*0.6 + mistB*0.4;
  col += mix(vec3(0.06,0.10,0.18), vec3(0.16,0.22,0.32), mist) * mist * 0.42;

  for(int i=0;i<5;i++){
    float fi=float(i);
    float yBase = 0.12 + fi*0.18;
    float yPert = 0.06*sin(t*0.5 + fi*2.3) + 0.04*fbm(vec2(uv.x*3.0 + t*0.6, fi));
    float y = yBase + yPert;
    float wisp = exp(-abs(uv.y - y)*5.0);
    float shimmer = 0.55 + 0.45*sin(uv.x*18.0 + t*1.3 + fi*4.0 + mistA*3.0);
    vec3 wispCol = mix(vec3(0.40,0.55,0.68), vec3(0.65,0.78,0.88), fi/4.0);
    col += wispCol * wisp * shimmer * 0.14;
  }

  for(int i=0;i<4;i++){
    float fi=float(i);
    float tx = 0.16 + fi*0.22 + 0.04*sin(t*0.32 + fi*1.7);
    float ty = 0.48 + 0.20*cos(t*0.45 + fi*2.0);
    float dropR = 0.055 + 0.018*sin(t*0.8 + fi);
    float d = distance(uv, vec2(tx, ty));
    float tear = smoothstep(dropR, 0.0, d);
    float halo = smoothstep(dropR*2.2, dropR*1.0, d) - tear;
    col += vec3(0.45,0.62,0.74) * tear * 0.20;
    col += vec3(0.55,0.72,0.86) * halo * 0.10;
    float lineD = abs(uv.x - tx);
    float dripShim = 0.6 + 0.4*sin(uv.y*30.0 + t*2.0 + fi);
    float line = smoothstep(0.010, 0.0, lineD) * smoothstep(ty, 0.30, uv.y);
    col += vec3(0.32,0.48,0.60) * line * dripShim * 0.11;
  }

  // GHOSTLY EYES — periodic open/close.
  for(int i=0;i<2;i++){
    float fi=float(i);
    vec2 eyePos = vec2(0.28 + fi*0.44, 0.32 + 0.10*sin(t*0.5+fi*1.3));
    float eyeD = distance(uv*vec2(aspect,1.0), eyePos*vec2(aspect,1.0));
    float blink = smoothstep(0.94, 1.0, sin(u_time*0.55 + fi*2.7));
    float eyeGlow = exp(-eyeD*eyeD*180.0) * blink;
    float eyeAura = exp(-eyeD*eyeD*55.0) * blink * 0.4;
    col += vec3(0.75,0.92,1.00) * eyeGlow * 0.85;
    col += vec3(0.42,0.62,0.80) * eyeAura;
  }

  // GHOST FLASH — periodic full-screen pale luminescence.
  float flashCycle = fract(u_time*0.11);
  float flash = smoothstep(0.96, 1.0, flashCycle) * smoothstep(1.0, 0.97, flashCycle);
  col += vec3(0.35,0.52,0.68) * flash * 0.45;

  vec2 mp = uv*vec2(aspect,1.0)*vec2(48.0,28.0); mp.x += t*0.65; mp.y += t*0.35;
  float moteSeed = hash(floor(mp));
  float mote = exp(-pow(length(fract(mp)-0.5),2.0)*32.0) * step(0.97, moteSeed);
  float moteTw = 0.5 + 0.5*sin(u_time*2.5 + moteSeed*30.0);
  col += vec3(0.70,0.84,0.94) * mote * moteTw * 0.18;

  // DRIFTING FACE SILHOUETTES.
  for(int i=0;i<3;i++){
    float fi=float(i);
    float fx = fract(0.10 + fi*0.32 + t*0.18);
    vec2 fp = uv - vec2(fx, 0.30 + 0.18*sin(t*0.5+fi*1.8));
    fp.x *= aspect;
    fp.y *= 1.4;
    float fd = length(fp);
    float face = exp(-fd*fd*40.0);
    float fade = 0.5 + 0.5*sin(t*0.42 + fi*2.3);
    col += vec3(0.42,0.62,0.78) * face * fade * 0.22;
    float lx = fp.x + 0.025;
    float rx = fp.x - 0.025;
    float ey = fp.y + 0.005;
    float eyeL = exp(-(lx*lx + ey*ey)*900.0);
    float eyeR = exp(-(rx*rx + ey*ey)*900.0);
    col -= vec3(0.10,0.14,0.18) * (eyeL+eyeR) * fade * 0.7;
  }

  // ORBITAL SOUL ORBS.
  for(int i=0;i<6;i++){
    float fi=float(i);
    float orbAng = u_time*(0.10 + fi*0.025) + fi*1.047;
    float orbR = 0.18 + fi*0.025;
    vec2 orbPos = vec2(0.5, 0.55) + vec2(cos(orbAng)*orbR/aspect, sin(orbAng)*orbR);
    float od = distance(uv, orbPos);
    float oTw = 0.5 + 0.5*sin(u_time*2.0 + fi*3.7);
    col += vec3(0.70,0.85,1.0) * exp(-od*od*1400.0) * oTw * 0.45;
  }

  // CONTINUOUS HORIZONTAL MIST CURTAINS.
  for(int i=0;i<3;i++){
    float fi=float(i);
    float my = 0.18 + fi*0.27;
    float mFlow = uv.x*4.0 + t*(0.7 + fi*0.18);
    float mistShim = fbm(vec2(mFlow, my*4.0)) * 0.5 + 0.5;
    float mistBand = exp(-pow((uv.y - my)*9.0, 2.0));
    col += vec3(0.32,0.42,0.55) * mistBand * mistShim * 0.18;
  }

  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col -= vec3(0.04,0.05,0.08) * smoothstep(0.55, 0.95, r);
  return col;
}
`;
