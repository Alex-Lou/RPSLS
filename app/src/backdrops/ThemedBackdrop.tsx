import { useEffect, useRef } from "react";

/**
 * ThemedBackdrop — a live, hand-coded animated background rendered on a
 * full-screen WebGL canvas behind the whole app. This is the "coded theme"
 * system: instead of a static PNG with typography slapped on top, the
 * player navigates fully procedural scenes that breathe and move.
 *
 * Design constraints (so it never janks or drains the phone):
 *  - ONE full-screen triangle, one fragment shader. No geometry, no textures.
 *  - devicePixelRatio capped at 1.5 — retina-sharp enough, half the fill cost.
 *  - requestAnimationFrame PAUSES whenever the tab/app is hidden
 *    (visibilitychange) so a backgrounded app burns zero GPU/battery.
 *  - A soft FPS clamp (~40fps) via timestamp gating keeps low-end GPUs cool.
 *  - Falls back silently to a CSS gradient if WebGL is unavailable.
 *
 * Scenes are switched by a `u_scene` uniform (cheap int branch in the
 * shader). Add a new scene = add a branch + a SCENES entry, nothing else.
 */

export type BackdropScene = "nebula" | "aurora" | "grid";

/** Human metadata for the picker. */
export const BACKDROP_META: Record<BackdropScene, { label: string; emoji: string; accent: { from: string; to: string } }> = {
  nebula: { label: "Nebula",    emoji: "🌌", accent: { from: "#a855f7", to: "#22d3ee" } },
  aurora: { label: "Aurora",    emoji: "🌠", accent: { from: "#34d399", to: "#8b5cf6" } },
  grid:   { label: "Neon Grid", emoji: "🌐", accent: { from: "#06b6d4", to: "#f0abfc" } },
};

const SCENE_INDEX: Record<BackdropScene, number> = { nebula: 0, aurora: 1, grid: 2 };

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform int   u_scene;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.0+vec2(1.7,9.2); a*=0.5;} return v; }

// ── Scene 0: NEBULA — domain-warped FBM clouds + twinkle stars ──
vec3 nebula(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*2.2; float t=u_time*0.05;
  vec2 q = vec2(fbm(p+vec2(0.0,t)), fbm(p+vec2(5.2,1.3)-vec2(0.0,t)));
  vec2 r = vec2(fbm(p+4.0*q+vec2(1.7,9.2)+t*0.4), fbm(p+4.0*q+vec2(8.3,2.8)-t*0.4));
  float f = fbm(p+4.0*r);
  vec3 col = mix(vec3(0.02,0.03,0.09), vec3(0.26,0.13,0.52), smoothstep(0.0,0.6,f));
  col = mix(col, vec3(0.78,0.25,0.64), smoothstep(0.35,0.9,r.x));
  col = mix(col, vec3(0.20,0.78,0.92), smoothstep(0.55,1.0,q.y)*0.4);
  vec2 sp = uv*vec2(aspect,1.0)*160.0; vec2 c=floor(sp); float s=hash(c);
  float star = exp(-length(fract(sp)-0.5)*length(fract(sp)-0.5)*60.0)*step(0.988,s);
  col += vec3(0.9,0.95,1.0)*star*(0.6+0.4*sin(u_time*2.0+s*30.0));
  return col;
}

// ── Scene 1: AURORA — vertical curtains of light waving over a dark sky ──
vec3 aurora(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.02,0.04,0.10), vec3(0.05,0.02,0.12), uv.y);
  // a few flowing bands
  for(int i=0;i<3;i++){
    float fi=float(i);
    float band = 0.5 + 0.18*sin(uv.x*3.0 + u_time*0.5 + fi*2.1)
                     + 0.10*sin(uv.x*7.0 - u_time*0.3 + fi);
    float d = abs(uv.y - band);
    float glow = 0.020/(d*d+0.004);
    vec3 tint = mix(vec3(0.20,0.95,0.55), vec3(0.55,0.35,0.95), fi/2.0);
    col += tint*glow*0.5*(0.6+0.4*sin(u_time*0.7+fi));
  }
  // faint star dust up top
  vec2 sp=uv*vec2(aspect,1.0)*140.0; float s=hash(floor(sp));
  col += vec3(0.8,0.9,1.0)*step(0.99,s)*step(0.5,uv.y)*0.5;
  return col;
}

// ── Scene 2: NEON GRID — synthwave perspective grid + horizon glow ──
vec3 grid(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.05,0.01,0.10), vec3(0.10,0.02,0.18), uv.y);
  float horizon = 0.45;
  if(uv.y < horizon){
    // perspective floor
    float depth = (horizon - uv.y);
    float persp = 1.0/(depth+0.05);
    float gx = abs(fract((uv.x-0.5)*persp*2.0)-0.5);
    float gz = abs(fract((u_time*0.25 + persp*0.5))-0.5);
    float line = smoothstep(0.48,0.5,1.0-gx) + smoothstep(0.48,0.5,1.0-gz);
    vec3 neon = mix(vec3(0.0,0.9,1.0), vec3(0.95,0.3,0.9), uv.x);
    col += neon*line*0.5*depth*3.0;
  } else {
    // sun + scanlines above horizon
    float d = distance(uv, vec2(0.5,horizon+0.12));
    col += mix(vec3(1.0,0.4,0.7), vec3(1.0,0.8,0.3), uv.y)*exp(-d*d*40.0)*0.8;
    col *= 0.8 + 0.2*step(0.5, fract(uv.y*120.0)); // scanlines
  }
  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  float aspect = u_res.x/u_res.y;
  vec3 col;
  if(u_scene==1) col = aurora(uv, aspect);
  else if(u_scene==2) col = grid(uv, aspect);
  else col = nebula(uv, aspect);
  // gentle vignette
  float vig = distance(uv, vec2(0.5));
  col *= mix(1.05, 0.6, smoothstep(0.2,0.95,vig));
  gl_FragColor = vec4(pow(col, vec3(0.92)), 1.0);
}
`;

export function ThemedBackdrop({ scene }: { scene: BackdropScene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl =
      (canvas.getContext("webgl", { alpha: false, antialias: false, depth: false }) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl", { alpha: false }) as WebGLRenderingContext | null);
    if (!gl) return; // CSS fallback (parent paints a gradient behind us)

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.error("[ThemedBackdrop] shader error", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uScene = gl.getUniformLocation(prog, "u_scene");
    gl.uniform1i(uScene, SCENE_INDEX[scene]);

    const start = performance.now();
    let last = 0;
    const MIN_DT = 1000 / 40; // ~40fps cap, gentle on low-end GPUs
    let running = true;

    const frame = (now: number) => {
      if (!running) return;
      if (now - last >= MIN_DT) {
        last = now;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    // Pause rendering when the app is backgrounded — zero battery cost idle.
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafRef.current);
      } else if (!running) {
        running = true;
        last = 0;
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteProgram(prog); gl.deleteBuffer(buf);
      gl.deleteShader(vs); gl.deleteShader(fs);
    };
  }, [scene]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "#0b0d12" }}
    >
      <canvas ref={canvasRef} aria-hidden className="w-full h-full block" />
      {/* Legibility veil so foreground UI text always reads over the scene. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 40%, rgba(5,7,11,0.5) 100%)" }}
      />
    </div>
  );
}
