/** Scene 6 — CASINO ROYALE — emerald felt + Art Déco gold rays + drifting bokeh. */
export const CASINO_GLSL = `
vec3 casino(vec2 uv, float aspect){
  float r = distance(uv, vec2(0.5));
  vec3 felt = mix(vec3(0.045, 0.32, 0.21), vec3(0.012, 0.075, 0.052),
                  smoothstep(0.0, 0.9, r));
  float grain = (hash(uv * 2400.0) - 0.5) * 0.05;
  felt += grain;
  felt += vec3(1.0, 0.78, 0.32) * exp(-pow((uv.y - 0.08) * 2.2, 2.0)) * 0.18;
  vec2 p = uv - 0.5; p.x *= aspect;
  float ang = atan(p.y, p.x);
  float rays = 0.5 + 0.5 * cos(ang * 16.0 + u_time * 0.18);
  rays *= smoothstep(0.55, 0.0, length(p));
  felt += vec3(0.96, 0.78, 0.36) * rays * 0.10;
  vec2 sp = uv * vec2(aspect, 1.0) * 40.0;
  vec2 c = floor(sp + vec2(0.0, u_time * 0.18));
  float s = hash(c);
  if (s > 0.985) {
    vec2 j = vec2(hash(c + 1.7), hash(c + 5.3)) - 0.5;
    float d = length(fract(sp + vec2(0.0, u_time * 0.18)) - 0.5 - j * 0.4);
    float g = exp(-d * d * 70.0);
    float tw = 0.6 + 0.4 * sin(u_time * 1.8 + s * 35.0);
    felt += vec3(1.0, 0.88, 0.5) * g * tw * 0.55;
  }
  return felt;
}
`;
