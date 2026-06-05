import { useEffect, useRef } from "react";
import { ThemedBackdrop, type BackdropScene } from "./backdrops/ThemedBackdrop";

/**
 * SplashShader — WebGL fluid cosmic backdrop for the splash screen.
 *
 * Replaces the previous <video> tag which, on Android WebView, flashed the
 * native media controls (play button overlay) for ~50ms before autoplay
 * kicked in. A canvas with a procedural fragment shader has none of that
 * baggage: it paints frame 1 instantly and never shows any browser UI.
 *
 * Style inspiration: the Nyx browser's newtab fluid shader (warped FBM
 * Perlin noise + click ripples), simplified for an ambient cosmic vibe
 * matching the RPSLS Constellation palette — deep indigo void, sweeping
 * violet/fuchsia nebula tendrils, occasional cyan sparkles.
 *
 * The shader runs ~60 FPS even on entry-level Android phones because:
 *   - A single full-screen triangle (3 verts) covers the viewport.
 *   - FBM is unrolled to 4 octaves max.
 *   - No texture lookups, no per-pixel branches, no expensive trig.
 *
 * The canvas is positioned fixed inset-0 z-0 — the splash UI (logo,
 * title, tap hint) renders on top at z-10+.
 *
 * When the player has already picked a coded scene (player.backgroundId →
 * BACKGROUNDS_BY_ID[id].scene), the splash uses that scene instead of the
 * default cosmic shader so the opening matches the chosen ambience.
 */
export function SplashShader({ scene }: { scene?: BackdropScene | null } = {}) {
  // Reuse the same scene catalogue as the in-app backdrop so the splash
  // already shows the player's chosen ambience. The default cosmic shader
  // below kicks in only when no scene is set (first launch / "default" /
  // "custom" bg — none of which advertise a procedural scene).
  if (scene) {
    return <ThemedBackdrop scene={scene} />;
  }
  return <DefaultCosmicShader />;
}

function DefaultCosmicShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try WebGL2 first, fall back to WebGL1 — both work for our needs.
    const gl =
      (canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false }) as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl",  { alpha: false, antialias: false, depth: false }) as WebGLRenderingContext  | null);
    if (!gl) return;

    // Resize canvas to fill its CSS box at devicePixelRatio capped at 2
    // (above 2 the perf hit isn't worth it on mobile).
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // ─── Shaders ──────────────────────────────────────────────────────
    const vsSrc = `
      attribute vec2 a;
      void main(){ gl_Position = vec4(a, 0.0, 1.0); }
    `;
    const fsSrc = `
      precision highp float;
      uniform vec2  u_res;
      uniform float u_time;

      // RPSLS Constellation palette — navy core, violet/fuchsia mids,
      // cyan highlights. Indices match the colour ramp tier:
      //   p0 = deepest void shadow
      //   p1 = primary violet body
      //   p2 = fuchsia accent
      //   p3 = cyan highlight
      const vec3 P0 = vec3(0.020, 0.030, 0.085);
      const vec3 P1 = vec3(0.260, 0.130, 0.520);
      const vec3 P2 = vec3(0.780, 0.250, 0.640);
      const vec3 P3 = vec3(0.250, 0.820, 0.910);
      const vec3 GLOW = vec3(0.85, 0.62, 1.00);

      float hash(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0,1.)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.0 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / u_res;
        float aspect = u_res.x / u_res.y;
        vec2  p = uv * vec2(aspect, 1.0) * 2.2;
        float t = u_time * 0.18;

        // Domain warp — two FBM passes, each offset by the previous, so
        // the nebula tendrils swirl rather than just drift linearly.
        vec2  q  = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t)));
        vec2  r2 = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.5),
                        fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.5));
        float f  = fbm(p + 4.0 * r2);

        // Build the colour ramp: void → violet body → fuchsia mid → cyan tips.
        vec3 col = mix(P0, P1, smoothstep(0.00, 0.60, f));
        col = mix(col, P2, smoothstep(0.35, 0.90, r2.x));
        col = mix(col, P3, smoothstep(0.55, 1.00, q.y) * 0.45);
        col += GLOW * pow(max(f, 0.0), 3.0) * 0.10;

        // Sparkle stars — sparse hash field rendered as soft circular
        // glows rather than the previous hard-edge step() that produced
        // ugly square pixels. Each star cell uses its centred distance
        // to fade off naturally into the nebula.
        vec2  sp        = uv * vec2(aspect, 1.0) * 180.0;
        vec2  spCell    = floor(sp);
        vec2  spLocal   = fract(sp) - 0.5;
        float starSeed  = hash(spCell);
        // Only ~1% of cells are "alive" stars. Random jitter inside the
        // cell keeps them from forming a visible grid.
        float starAlive = step(0.988, starSeed);
        vec2  jitter    = vec2(hash(spCell + 1.7), hash(spCell + 5.3)) - 0.5;
        float starDist  = length(spLocal - jitter * 0.6);
        // Gaussian-shaped soft point (no hard edges).
        float starGlow  = exp(-starDist * starDist * 70.0) * starAlive;
        float twinkle   = 0.55 + 0.45 * sin(u_time * 2.4 + starSeed * 31.0);
        col += vec3(0.92, 0.96, 1.00) * starGlow * twinkle * 0.75;

        // Soft vignette — pushes the centre brighter, edges deeper.
        float vigDist = distance(uv, vec2(0.5));
        col *= mix(1.05, 0.55, smoothstep(0.2, 0.95, vigDist));

        // Final gamma + clamp.
        col = pow(col, vec3(0.9));
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // Surface the error to logcat so build failures are catchable —
        // previously a silent compile error meant a black canvas with no
        // diagnostic trail.
        // eslint-disable-next-line no-console
        console.error("[SplashShader] compile error", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER,   vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // Single covering triangle — bigger than the viewport, GPU clips the rest.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes  = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    const start = performance.now();
    const frame = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafRef.current = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ display: "block" }}
    />
  );
}
