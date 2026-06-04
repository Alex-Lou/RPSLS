import { useEffect, useRef } from "react";

/**
 * ThemedBackdrop — live, hand-coded animated backgrounds on a full-screen
 * WebGL canvas. This is the ONLY background system now (the old PNG themes
 * were retired); the player either picks a coded scene or supplies their
 * own image via the "Custom" option.
 *
 * Perf guards (so it never janks or drains the phone):
 *  - ONE full-screen triangle, one fragment shader. No geometry/textures.
 *  - devicePixelRatio capped at 1.5.
 *  - rAF PAUSES when the app is backgrounded (visibilitychange).
 *  - ~40fps timestamp gate keeps low-end GPUs cool.
 *  - Silent CSS fallback if WebGL is unavailable.
 *
 * Scenes switch on a cheap `u_scene` int branch. All glows are soft
 * gaussians (no hard white pixels) and animation is continuous + smooth.
 */

export type BackdropScene =
  | "nebula" | "aurora" | "grid" | "galaxy" | "holy" | "quantum" | "casino";

export const BACKDROP_META: Record<BackdropScene, { label: string; emoji: string; accent: { from: string; to: string } }> = {
  nebula:  { label: "Nebula",        emoji: "🌌", accent: { from: "#a855f7", to: "#22d3ee" } },
  aurora:  { label: "Aurora",        emoji: "🌠", accent: { from: "#34d399", to: "#8b5cf6" } },
  grid:    { label: "Neon Grid",     emoji: "🌐", accent: { from: "#06b6d4", to: "#f0abfc" } },
  galaxy:  { label: "Galaxy",        emoji: "✨", accent: { from: "#a855f7", to: "#22d3ee" } },
  holy:    { label: "Holy",          emoji: "✝️", accent: { from: "#fbbf24", to: "#6366f1" } },
  quantum: { label: "Quantum",       emoji: "⚛️", accent: { from: "#22d3ee", to: "#3b82f6" } },
  casino:  { label: "Casino Royale", emoji: "🎰", accent: { from: "#10b981", to: "#f5c543" } },
};

const SCENE_INDEX: Record<BackdropScene, number> = {
  nebula: 0, aurora: 1, grid: 2, galaxy: 3, holy: 4, quantum: 5, casino: 6,
};

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform int   u_scene;

const float PI = 3.14159265;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.0+vec2(1.7,9.2); a*=0.5;} return v; }

// Soft, sparse, TINTED star dust (no hard white pixels). Returns a colour add.
vec3 softStars(vec2 uv, float aspect, float density, vec3 tint){
  vec2 sp = uv*vec2(aspect,1.0)*120.0;
  vec2 c = floor(sp);
  float s = hash(c);
  if (s < density) return vec3(0.0);
  vec2 jitter = vec2(hash(c+1.7), hash(c+5.3)) - 0.5;
  float d = length(fract(sp)-0.5 - jitter*0.5);
  float g = exp(-d*d*55.0);
  float tw = 0.55 + 0.45*sin(u_time*1.6 + s*40.0);
  return tint * g * tw * 0.35;
}

// ── 0 NEBULA — warped FBM clouds, softer & deeper than before ──
vec3 nebula(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0)*2.2; float t=u_time*0.045;
  vec2 q = vec2(fbm(p+vec2(0.0,t)), fbm(p+vec2(5.2,1.3)-vec2(0.0,t)));
  vec2 r = vec2(fbm(p+4.0*q+vec2(1.7,9.2)+t*0.4), fbm(p+4.0*q+vec2(8.3,2.8)-t*0.4));
  float f = fbm(p+4.0*r);
  vec3 col = mix(vec3(0.02,0.03,0.09), vec3(0.26,0.13,0.52), smoothstep(0.0,0.6,f));
  col = mix(col, vec3(0.78,0.25,0.64), smoothstep(0.35,0.9,r.x));
  col = mix(col, vec3(0.20,0.78,0.92), smoothstep(0.55,1.0,q.y)*0.4);
  col += softStars(uv, aspect, 0.992, vec3(0.85,0.9,1.0));
  return col;
}

// ── 1 AURORA — broad, defined curtains. Less flicker, more body. ──
vec3 aurora(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.02,0.05,0.12), vec3(0.06,0.02,0.14), uv.y);
  for(int i=0;i<3;i++){
    float fi=float(i);
    // Slow, broad waving band; low-frequency so curtains read clearly.
    float band = 0.45 + 0.16*sin(uv.x*2.2 + u_time*0.35 + fi*2.1)
                      + 0.06*sin(uv.x*4.5 - u_time*0.18 + fi);
    float d = abs(uv.y - band);
    // Wider, softer falloff (was a thin 1/d^2 line that flashed). Steady.
    float glow = smoothstep(0.22, 0.0, d);
    glow = glow*glow;
    vec3 tint = mix(vec3(0.16,0.90,0.55), vec3(0.55,0.35,0.95), fi/2.0);
    // Gentle breathe instead of harsh sine flash.
    col += tint * glow * (0.45 + 0.12*sin(u_time*0.5 + fi*1.7));
  }
  col += softStars(uv, aspect, 0.994, vec3(0.8,0.95,1.0)) * step(0.45, uv.y);
  return col;
}

// ── 2 NEON GRID — synthwave floor + horizon sun + scanlines ──
vec3 grid(vec2 uv, float aspect){
  vec3 col = mix(vec3(0.05,0.01,0.10), vec3(0.10,0.02,0.18), uv.y);
  float horizon = 0.45;
  if(uv.y < horizon){
    float depth = (horizon - uv.y);
    float persp = 1.0/(depth+0.05);
    float gx = abs(fract((uv.x-0.5)*persp*2.0)-0.5);
    float gz = abs(fract((u_time*0.25 + persp*0.5))-0.5);
    float line = smoothstep(0.46,0.5,1.0-gx) + smoothstep(0.46,0.5,1.0-gz);
    vec3 neon = mix(vec3(0.0,0.9,1.0), vec3(0.95,0.3,0.9), uv.x);
    col += neon*line*0.45*depth*3.0;
  } else {
    float d = distance(uv, vec2(0.5,horizon+0.12));
    col += mix(vec3(1.0,0.4,0.7), vec3(1.0,0.8,0.3), uv.y)*exp(-d*d*40.0)*0.8;
    col *= 0.85 + 0.15*smoothstep(0.45,0.55, fract(uv.y*110.0));
  }
  return col;
}

// ── 3 GALAXY — rotating spiral arms + bright core ──
vec3 galaxy(vec2 uv, float aspect){
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.2;
  float r = length(p);
  float a = atan(p.y, p.x);
  // Spiral: twist angle by radius + slow global rotation.
  float spiral = a + r*3.2 - u_time*0.18;
  float arms = 0.5 + 0.5*cos(spiral*2.0);            // 2 arms
  arms *= smoothstep(1.4, 0.1, r);                   // fade outward
  float dust = fbm(vec2(spiral*1.5, r*3.0 - u_time*0.1));
  vec3 col = vec3(0.02,0.02,0.07);
  col += mix(vec3(0.35,0.15,0.6), vec3(0.15,0.7,0.95), dust) * arms * 0.9;
  // Core bloom.
  col += vec3(1.0,0.85,0.95) * exp(-r*r*6.0) * 0.7;
  col += vec3(0.7,0.4,1.0) * exp(-r*r*1.4) * 0.18;
  col += softStars(uv, aspect, 0.990, vec3(0.9,0.92,1.0));
  return col;
}

// ── 4 HOLY — descending god-rays, warm gold over cathedral indigo ──
vec3 holy(vec2 uv, float aspect){
  vec3 base = mix(vec3(0.05,0.05,0.12), vec3(0.02,0.02,0.07), uv.y);
  // Light shafts from the top: vertical bands modulated by a slow noise,
  // brightest near the top, fading down.
  float shaft = 0.0;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float x = 0.2 + fi*0.2 + 0.04*sin(u_time*0.3 + fi);
    float w = 0.06 + 0.02*sin(u_time*0.2 + fi*2.0);
    float band = smoothstep(w, 0.0, abs(uv.x - x));
    shaft += band;
  }
  shaft *= smoothstep(1.0, 0.1, uv.y);                 // top-down fade
  vec3 gold = vec3(1.0, 0.82, 0.42);
  vec3 col = base + gold * shaft * 0.30;
  // Floating motes drifting up.
  vec2 mp = uv*vec2(aspect,1.0)*vec2(40.0, 18.0); mp.y += u_time*0.4;
  float mote = exp(-pow(length(fract(mp)-0.5),2.0)*40.0) * step(0.97, hash(floor(mp)));
  col += gold * mote * 0.5;
  // Soft indigo halo centre.
  col += vec3(0.3,0.3,0.7) * exp(-distance(uv,vec2(0.5,0.32))*2.0) * 0.12;
  return col;
}

// ── 5 QUANTUM — smooth electric plasma + drifting energy nodes ──
vec3 quantum(vec2 uv, float aspect){
  vec2 p = uv*vec2(aspect,1.0);
  float t = u_time*0.4;
  // Classic layered plasma — all smooth sines, zero hard pixels.
  float v = sin(p.x*6.0 + t)
          + sin((p.y*6.0 + t)*1.1)
          + sin((p.x*4.0 + p.y*5.0 + t)*0.9)
          + sin(length(p-0.5)*10.0 - t*1.3);
  v *= 0.25;
  vec3 col = mix(vec3(0.02,0.05,0.12), vec3(0.10,0.55,0.85), 0.5+0.5*v);
  col = mix(col, vec3(0.2,0.85,1.0), smoothstep(0.5,1.0, 0.5+0.5*sin(v*PI)));
  // A few drifting energy nodes (soft bright orbs).
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 c = vec2(0.5+0.34*sin(t*0.7+fi*2.1), 0.5+0.30*cos(t*0.5+fi*1.7));
    col += vec3(0.5,0.95,1.0) * exp(-distance(p,c)*distance(p,c)*60.0) * 0.4;
  }
  return col;
}

// ── 6 CASINO ROYALE — emerald felt + Art Déco gold rays + drifting bokeh ──
vec3 casino(vec2 uv, float aspect){
  // Deep emerald felt — radial gradient darkening toward the edges.
  float r = distance(uv, vec2(0.5));
  vec3 felt = mix(vec3(0.045, 0.32, 0.21), vec3(0.012, 0.075, 0.052),
                  smoothstep(0.0, 0.9, r));
  // Tiny felt grain — high-frequency speckle keeps the table from looking flat.
  float grain = (hash(uv * 2400.0) - 0.5) * 0.05;
  felt += grain;
  // Soft warm halo from the chandeliers overhead (top-third bloom).
  felt += vec3(1.0, 0.78, 0.32) * exp(-pow((uv.y - 0.08) * 2.2, 2.0)) * 0.18;
  // Gold ray fan from the centre — slow sweep, Art Déco accent.
  vec2 p = uv - 0.5; p.x *= aspect;
  float ang = atan(p.y, p.x);
  float rays = 0.5 + 0.5 * cos(ang * 16.0 + u_time * 0.18);
  rays *= smoothstep(0.55, 0.0, length(p));
  felt += vec3(0.96, 0.78, 0.36) * rays * 0.10;
  // Drifting bokeh sparkles (chip glints + chandelier reflections).
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
  else col = nebula(uv, aspect);
  float vig = distance(uv, vec2(0.5));
  col *= mix(1.04, 0.58, smoothstep(0.2,0.95,vig));
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.92)), 1.0);
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
    if (!gl) return;

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
    const MIN_DT = 1000 / 40;
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

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(rafRef.current); }
      else if (!running) { running = true; last = 0; rafRef.current = requestAnimationFrame(frame); }
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
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: "#0b0d12" }}>
      <canvas ref={canvasRef} aria-hidden className="w-full h-full block" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 40%, rgba(5,7,11,0.5) 100%)" }}
      />
    </div>
  );
}
