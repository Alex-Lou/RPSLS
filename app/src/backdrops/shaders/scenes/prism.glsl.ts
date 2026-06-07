/** Scene 17 — PRISM — laboratory of light: deep almost-black with a tiny
 *  radial bloom at the centre (light source), 3-4 rays radiating outward and
 *  SPLITTING into spectral bands (R→V) along their length, slow rotation. */
export const PRISM_GLSL = `
vec3 prism(vec2 uv, float aspect){
  float t = u_time * 0.05;
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float ang = atan(q.y, q.x);

  vec3 col = mix(vec3(0.015, 0.018, 0.030), vec3(0.005, 0.005, 0.012),
                 smoothstep(0.0, 1.0, r));

  // CENTRAL LIGHT SOURCE.
  float source = exp(-r*r*420.0);
  float halo = exp(-r*r*22.0);
  col += vec3(1.0) * source * 0.95;
  col += vec3(0.85, 0.88, 1.0) * halo * 0.28;

  // 4 SPECTRAL RAYS at 90°.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float rayAng = fi * 1.5708 + t*0.5;
    float aDelta = abs(mod(ang - rayAng + 3.14159, 6.28318) - 3.14159);
    float angBand = exp(-aDelta*aDelta*1800.0);
    float wl = clamp(r / 0.55, 0.0, 1.0);
    vec3 spectrum;
    if(wl < 0.18) spectrum = mix(vec3(1.0), vec3(1.0, 0.20, 0.20), wl/0.18);
    else if(wl < 0.36) spectrum = mix(vec3(1.0, 0.20, 0.20), vec3(1.0, 0.55, 0.0), (wl-0.18)/0.18);
    else if(wl < 0.54) spectrum = mix(vec3(1.0, 0.55, 0.0), vec3(1.0, 1.0, 0.0), (wl-0.36)/0.18);
    else if(wl < 0.72) spectrum = mix(vec3(1.0, 1.0, 0.0), vec3(0.20, 1.0, 0.30), (wl-0.54)/0.18);
    else if(wl < 0.90) spectrum = mix(vec3(0.20, 1.0, 0.30), vec3(0.20, 0.45, 1.0), (wl-0.72)/0.18);
    else spectrum = mix(vec3(0.20, 0.45, 1.0), vec3(0.65, 0.20, 1.0), (wl-0.90)/0.10);
    float bright = exp(-wl*1.8);
    col += spectrum * angBand * bright * 0.95;
  }

  // PHOTON BEADS travelling outward along each ray.
  for(int i=0;i<4;i++){
    float fi = float(i);
    float rayAng = fi * 1.5708 + t*0.5;
    vec2 rayDir = vec2(cos(rayAng), sin(rayAng));
    for(int p=0;p<3;p++){
      float fp = float(p);
      float ph = fract(u_time*0.5 + fp*0.33 + fi*0.17);
      vec2 pPos = rayDir * ph * 0.55;
      float pd = distance(q, pPos);
      col += vec3(1.0) * exp(-pd*pd*1200.0) * 0.85;
    }
  }

  float farHalo = smoothstep(0.55, 0.20, r);
  col += vec3(0.20, 0.18, 0.45) * farHalo * 0.06;

  return col;
}
`;
