import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { levelFromXp } from "./leveling";
import { useT } from "./i18n";
import { hapticMatchWin } from "./haptic";

/**
 * Level-up celebration — a FULLY CODED WebGL burst (no PNG sprites). A single
 * fragment shader paints an expanding shockwave ring, rotating god-rays, a
 * hot bloom core and a sparkle field, all driven by a normalised 0→1 time so
 * the explosion peaks early then fades out smoothly over ~2.5s. The "LEVEL UP"
 * banner springs in over the top.
 *
 * Perf: one full-screen triangle, one shader, DPR-capped, auto-unmounts when
 * the parent clears the celebration (so the rAF loop is short-lived).
 */

const DURATION_S = 2.8;

export function LevelUpWatcher() {
  const xp = useStore((s) => s.player.xp);
  const level = levelFromXp(xp).level;
  const prev = useRef(level);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  useEffect(() => {
    if (level > prev.current) {
      setCelebrate(level);
      hapticMatchWin();
      const id = window.setTimeout(() => setCelebrate(null), DURATION_S * 1000 + 200);
      prev.current = level;
      return () => window.clearTimeout(id);
    }
    prev.current = level;
  }, [level]);

  return (
    <AnimatePresence>
      {celebrate !== null && <LevelUpOverlay level={celebrate} />}
    </AnimatePresence>
  );
}

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_t;   // 0..1 normalised life
const float PI = 3.14159265;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  vec2 p = (uv - 0.5) * vec2(u_res.x/u_res.y, 1.0);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float t = clamp(u_t, 0.0, 1.0);

  // Global envelope: snap up, ease down.
  float env = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.45, 1.0, t));

  vec3 col = vec3(0.0);

  // 1) Hot bloom core — bright at the start, collapses quickly.
  float core = exp(-r*r * (20.0 + t*120.0)) * (1.0 - smoothstep(0.0, 0.5, t));
  col += mix(vec3(1.0,0.95,0.8), vec3(1.0,0.8,0.45), t) * core * 2.0;

  // 2) Expanding shockwave ring — travels outward, thins + dims with age.
  float radius = t * 1.1;
  float ringW = 0.025 + t*0.06;
  float ring = exp(-pow(r - radius, 2.0) / (ringW*ringW));
  col += mix(vec3(0.7,0.9,1.0), vec3(0.9,0.5,1.0), t) * ring * env * 1.2;

  // 3) Rotating god-rays — high-frequency angular streaks, fade with radius.
  float rays = pow(0.5 + 0.5*cos(ang*16.0 + t*6.0), 6.0);
  rays *= smoothstep(0.9, 0.1, r) * exp(-r*1.5);
  col += mix(vec3(1.0,0.8,0.4), vec3(0.6,0.4,1.0), r) * rays * env * 0.9;

  // 4) Sparkle field bursting outward — points pushed out as t grows.
  vec2 gp = p * (3.0 - t*1.5);
  vec2 cell = floor(gp*6.0);
  float s = hash(cell);
  if (s > 0.93) {
    vec2 jit = vec2(hash(cell+1.3), hash(cell+7.7)) - 0.5;
    float d = length(fract(gp*6.0) - 0.5 - jit*0.6);
    float spark = exp(-d*d*90.0) * (0.5 + 0.5*sin(u_t*30.0 + s*40.0));
    col += vec3(1.0,0.95,0.85) * spark * env * 1.1;
  }

  float a = clamp(max(max(col.r,col.g),col.b), 0.0, 1.0) * env;
  gl_FragColor = vec4(col, a);
}
`;

function BurstCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl =
      (canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, premultipliedAlpha: false }) as WebGLRenderingContext | null);
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const comp = (ty: number, src: string) => {
      const sh = gl.createShader(ty)!; gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const vs = comp(gl.VERTEX_SHADER, VERT), fs = comp(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT = gl.getUniformLocation(prog, "u_t");
    const start = performance.now();
    const frame = (now: number) => {
      const t = (now - start) / 1000 / DURATION_S;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (t < 1.0) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf.current);
      gl.deleteProgram(prog); gl.deleteBuffer(buf); gl.deleteShader(vs); gl.deleteShader(fs);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 w-full h-full" />;
}

export function LevelUpOverlay({ level }: { level: number }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none overflow-hidden"
    >
      <BurstCanvas />

      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 12 }}
        animate={{ scale: [0.4, 1.16, 1], opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ delay: 0.12, type: "spring", stiffness: 260, damping: 15 }}
        className="relative flex flex-col items-center gap-1 px-9 py-5 rounded-3xl bg-zinc-950/70 backdrop-blur-md border border-white/15 shadow-2xl"
        style={{ boxShadow: "0 0 60px -10px color-mix(in oklab, var(--theme-primary) 60%, transparent)" }}
      >
        <div
          className="text-3xl font-black tracking-[0.18em] bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 85%, #fff), color-mix(in oklab, var(--theme-secondary) 85%, #fff))", fontFamily: "var(--font-headline)" }}
        >
          {t("levelup.title")}
        </div>
        <div className="text-sm font-bold text-zinc-200">{t("levelup.reached", { n: level })}</div>
      </motion.div>
    </motion.div>
  );
}
