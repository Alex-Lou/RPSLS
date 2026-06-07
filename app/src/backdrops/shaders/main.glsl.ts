/**
 * Entry point for the fragment shader: scene dispatch (cheap u_scene int
 * branch), per-scene touch overlay, then a vignette gamma pass.
 *
 * Light scenes (ink, bloom, void) get a much gentler edge darkening — the
 * normal vignette grays out paper / sky / the deliberate void in a way
 * that fights the theme's identity.
 */
export const MAIN_GLSL = `
void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  float aspect = u_res.x/u_res.y;
  vec3 col;
  if(u_scene==1) col = aurora(uv, aspect);
  else if(u_scene==2) col = grid(uv, aspect);
  else if(u_scene==3) col = galaxy(uv, aspect);
  else if(u_scene==4) col = holy(uv, aspect);
  else if(u_scene==5) col = quantum(uv, aspect);
  else if(u_scene==6) col = casino(uv, aspect);
  else if(u_scene==7) col = volcanic(uv, aspect);
  else if(u_scene==8) col = abyss(uv, aspect);
  else if(u_scene==9) col = eclipse(uv, aspect);
  else if(u_scene==10) col = phantom(uv, aspect);
  else if(u_scene==11) col = emberforge(uv, aspect);
  else if(u_scene==12) col = tempus(uv, aspect);
  else if(u_scene==13) col = storm(uv, aspect);
  else if(u_scene==14) col = coral(uv, aspect);
  else if(u_scene==15) col = rust(uv, aspect);
  else if(u_scene==16) col = void_scene(uv, aspect);
  else if(u_scene==17) col = prism(uv, aspect);
  else if(u_scene==18) col = ink(uv, aspect);
  else if(u_scene==19) col = bloom(uv, aspect);
  else col = nebula(uv, aspect);

  applyTouchFx(col, uv, aspect);

  float vig = distance(uv, vec2(0.5));
  if (u_scene == 16 || u_scene == 18 || u_scene == 19) {
    col *= mix(1.0, 0.92, smoothstep(0.4, 0.95, vig));
  } else {
    col *= mix(1.04, 0.58, smoothstep(0.2,0.95,vig));
  }
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.92)), 1.0);
}
`;
