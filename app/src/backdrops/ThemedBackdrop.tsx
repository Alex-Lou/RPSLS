import { useEffect, useRef } from "react";
import { menuFxSuppressed } from "../fx/menuFx";
import { useStore } from "../store/store";
import { FRAG, VERT } from "./shaders";

/**
 * ThemedBackdrop — full-screen WebGL canvas wired to the modular shader
 * library in ./shaders. This component is intentionally THIN: it only
 * handles React lifecycle, GL setup / context loss, touch plumbing and
 * uniform updates. Every pixel of art lives in ./shaders/scenes/*.glsl.ts.
 *
 * Perf guards (so it never janks or drains the phone):
 *  - ONE full-screen triangle, one fragment shader. No geometry/textures.
 *  - devicePixelRatio capped at 1.5.
 *  - rAF PAUSES when the app is backgrounded (visibilitychange).
 *  - 60fps timestamp gate (capable phones + tablets run buttery smooth;
 *    battery saved by the visibility-hidden pause + the rAF gate itself).
 *  - Silent CSS fallback if WebGL is unavailable.
 *
 * Scenes switch on a cheap `u_scene` int branch. Touch state feeds five
 * uniforms (u_touch, u_touchAge, u_hold, u_swipeMag, u_swipeAge) that the
 * per-scene touch block in shaders/touchFx.glsl.ts reads.
 */

export type BackdropScene =
  | "nebula" | "aurora" | "grid" | "galaxy" | "holy" | "quantum" | "casino"
  | "volcanic" | "abyss" | "eclipse" | "phantom" | "emberforge"
  | "tempus" | "storm"
  // 2026-06-07 premium lineup (docs/PREMIUM_THEMES.md).
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom";

const SCENE_INDEX: Record<BackdropScene, number> = {
  nebula: 0, aurora: 1, grid: 2, galaxy: 3, holy: 4, quantum: 5, casino: 6,
  volcanic: 7, abyss: 8, eclipse: 9, phantom: 10, emberforge: 11,
  tempus: 12, storm: 13,
  coral: 14, rust: 15, void: 16, prism: 17, ink: 18, bloom: 19,
};

export function ThemedBackdrop({ scene }: { scene: BackdropScene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // Latest scene, readable from the frame loop and the context-restore path
  // WITHOUT re-running the GL-setup effect (which is what caused the grey
  // screen — see the long note below).
  const sceneRef = useRef<BackdropScene>(scene);
  sceneRef.current = scene;
  // Live GL handles so the scene-change effect can poke the uniform directly.
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const uSceneRef = useRef<WebGLUniformLocation | null>(null);
  // Player intensity for the active scene's premium set (storm/coral/…).
  // Lives in a ref so the frame loop reads the live value without re-running
  // the GL setup effect on every slider tick.
  const intensity = useStore((s) => s.player.premiumIntensity?.[scene] ?? 1.0);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  // GL setup runs ONCE per mount (deps: []). It used to depend on [scene],
  // so every theme change tore the context down (loseContext) and then
  // re-getContext()'d the SAME <canvas> — but a canvas whose context was
  // explicitly lost hands back a DEAD context, so all draws silently no-op
  // and you're left staring at a grey/white rectangle. Now the context lives
  // for the whole mount; switching scenes only updates a uniform.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const MIN_DT = 1000 / 60; // 60fps — capable devices run smooth; battery saved by visibility pause
    let gl: WebGLRenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uTouch: WebGLUniformLocation | null = null;
    let uTouchAge: WebGLUniformLocation | null = null;
    let uHold: WebGLUniformLocation | null = null;
    let uSwipeMag: WebGLUniformLocation | null = null;
    let uSwipeAge: WebGLUniformLocation | null = null;
    let uIntensity: WebGLUniformLocation | null = null;
    let running = false;
    let start = performance.now();
    let last = 0;
    // Touch state for the per-scene backdrop interaction.
    let touchX = -1e6, touchY = -1e6, touchDownAt = -1e6, hold = 0;
    let pressing = false;
    // Swipe detection — horizontal-dominant move that DOESN'T conflict with
    // vertical scroll. Recorded on pointer move; magnitude normalised to
    // [0,1] over half a viewport width.
    let downX = 0, downY = 0, swipeMag = 0, swipeEndedAt = -1e6;
    const SWIPE_TRIGGER_PX = 36;  // dead-zone before counting as swipe
    let swipeArmed = false;

    const resize = () => {
      if (!gl) return;
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
      }
    };

    const compile = (type: number, src: string) => {
      if (!gl) return null;
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.error("[ThemedBackdrop] shader error", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    // Build (or, after a context-restore, REBUILD) every GL resource bound to
    // the live context. Returns false on any failure → CSS fallback shows.
    const buildGL = (): boolean => {
      gl =
        (canvas.getContext("webgl", { alpha: false, antialias: false, depth: false }) as WebGLRenderingContext | null) ??
        (canvas.getContext("experimental-webgl", { alpha: false }) as WebGLRenderingContext | null);
      if (!gl) return false;
      glRef.current = gl;
      resize();
      vs = compile(gl.VERTEX_SHADER, VERT);
      fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      prog = gl.createProgram()!;
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);

      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aLoc = gl.getAttribLocation(prog, "a");
      gl.enableVertexAttribArray(aLoc);
      gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

      uRes = gl.getUniformLocation(prog, "u_res");
      uTime = gl.getUniformLocation(prog, "u_time");
      uTouch = gl.getUniformLocation(prog, "u_touch");
      uTouchAge = gl.getUniformLocation(prog, "u_touchAge");
      uHold = gl.getUniformLocation(prog, "u_hold");
      uSwipeMag = gl.getUniformLocation(prog, "u_swipeMag");
      uSwipeAge = gl.getUniformLocation(prog, "u_swipeAge");
      uIntensity = gl.getUniformLocation(prog, "u_intensity");
      const uScene = gl.getUniformLocation(prog, "u_scene");
      uSceneRef.current = uScene;
      gl.uniform1i(uScene, SCENE_INDEX[sceneRef.current]);

      // Paint one solid backdrop-coloured frame immediately so the canvas
      // never flashes an uninitialised (white/grey) framebuffer before the
      // first animated tick lands.
      gl.clearColor(0.043, 0.051, 0.071, 1); // #0b0d12
      gl.clear(gl.COLOR_BUFFER_BIT);
      return true;
    };

    const frame = (now: number) => {
      if (!running) return;
      if (gl && !gl.isContextLost() && now - last >= MIN_DT) {
        const dt = (now - last) / 1000;
        last = now;
        // Ease the press value up while held, down on release (Holy square etc.).
        if (pressing) hold = Math.min(1.2, hold + dt / 0.8);
        else hold = Math.max(0, hold - dt / 1.1);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.uniform2f(uTouch, touchX, touchY);
        gl.uniform1f(uTouchAge, (now - touchDownAt) / 1000);
        gl.uniform1f(uHold, hold);
        gl.uniform1f(uSwipeMag, swipeMag);
        gl.uniform1f(uSwipeAge, (now - swipeEndedAt) / 1000);
        gl.uniform1f(uIntensity, intensityRef.current);
        // Swipe magnitude fades to zero gradually so the trail tail dies out.
        swipeMag = Math.max(0, swipeMag - dt * 1.2);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    const startLoop = () => {
      if (running) return;
      running = true; last = 0;
      rafRef.current = requestAnimationFrame(frame);
    };
    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };

    // Context-loss recovery. preventDefault() is MANDATORY — without it the
    // browser refuses to fire `webglcontextrestored`, so the canvas stays a
    // dead grey/white rectangle forever. Mobile GPUs drop contexts on memory
    // pressure / returning from background / hitting the live-context cap.
    const onLost = (e: Event) => { e.preventDefault(); stopLoop(); };
    const onRestored = () => {
      if (buildGL()) { start = performance.now(); startLoop(); }
    };
    canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
    canvas.addEventListener("webglcontextrestored", onRestored as EventListener, false);
    window.addEventListener("resize", resize);

    // Touch interaction → feed finger position (GL y-up) + press state + swipe
    // magnitude to the shader. Listened on window since the canvas is
    // pointer-events:none. Swipe detection: arms only when horizontal motion
    // dominates vertical (|dx| > |dy|*1.2) AND exceeds a dead-zone. This way
    // a vertical scroll on a menu list NEVER triggers a backdrop swipe.
    const setTouch = (e: PointerEvent) => {
      touchX = e.clientX * dpr;
      touchY = canvas.height - e.clientY * dpr;
    };
    const onTDown = (e: PointerEvent) => {
      // NEVER react to touch during a match (classic / ranked / constellation /
      // training). Match surfaces call useNoMenuFx() → menuFxSuppressed() is
      // true; the playmat is for playing, not for painting backdrop ripples.
      if (menuFxSuppressed()) return;
      setTouch(e);
      touchDownAt = performance.now();
      pressing = true;
      downX = e.clientX;
      downY = e.clientY;
      swipeArmed = false;
      startLoop();
    };
    const onTMove = (e: PointerEvent) => {
      if (menuFxSuppressed()) { pressing = false; return; }
      if (pressing) {
        setTouch(e);
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (!swipeArmed && Math.abs(dx) > SWIPE_TRIGGER_PX &&
            Math.abs(dx) > Math.abs(dy) * 1.2) {
          swipeArmed = true;
        }
        if (swipeArmed) {
          // Magnitude rises with absolute horizontal displacement, capped at
          // half-viewport-width for a clean [0,1] range. Sign isn't tracked
          // — the shader uses magnitude only (per-scene direction is implicit).
          swipeMag = Math.min(1, Math.abs(dx) / (window.innerWidth * 0.5));
        }
      }
    };
    const onTUp = () => {
      pressing = false;
      if (swipeArmed) swipeEndedAt = performance.now();
      swipeArmed = false;
    };
    window.addEventListener("pointerdown", onTDown, { passive: true });
    window.addEventListener("pointermove", onTMove, { passive: true });
    window.addEventListener("pointerup", onTUp, { passive: true });
    window.addEventListener("pointercancel", onTUp, { passive: true });

    const onVis = () => { if (document.hidden) stopLoop(); else startLoop(); };
    document.addEventListener("visibilitychange", onVis);

    if (buildGL()) startLoop();

    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onTDown);
      window.removeEventListener("pointermove", onTMove);
      window.removeEventListener("pointerup", onTUp);
      window.removeEventListener("pointercancel", onTUp);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onRestored as EventListener);
      if (gl) {
        gl.deleteProgram(prog); gl.deleteBuffer(buf);
        gl.deleteShader(vs); gl.deleteShader(fs);
        // Drop the context only on a REAL unmount (the <canvas> leaves the
        // DOM and is discarded), never on a scene change. This keeps the
        // anti-accumulation guard from v0.4.33 without the grey-screen
        // regression it introduced.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      glRef.current = null;
      uSceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene switch → just re-point the uniform on the live context. No teardown,
  // no new context. If the context is currently lost, the restore path reads
  // sceneRef and applies the right scene when it rebuilds.
  useEffect(() => {
    const gl = glRef.current;
    const uScene = uSceneRef.current;
    if (gl && uScene && !gl.isContextLost()) {
      gl.uniform1i(uScene, SCENE_INDEX[scene]);
    }
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

/** Dégradé statique on-thème par scène (deux glows d'accent sur fond sombre).
 *  Couleurs d'accent reprises de themes.ts — assez pour garder l'identité du
 *  thème SANS aucun WebGL/rAF. */
const g = (a: string, b: string) =>
  `radial-gradient(120% 85% at 50% 28%, ${a}33 0%, transparent 52%),` +
  `radial-gradient(85% 70% at 72% 78%, ${b}26 0%, transparent 58%),` +
  `linear-gradient(180deg, #0a0b14 0%, #06070e 100%)`;

const SCENE_GRADIENT: Record<BackdropScene, string> = {
  nebula: g("#7c5cff", "#22d3ee"),
  aurora: g("#34d399", "#f0abfc"),
  grid: g("#06b6d4", "#f0abfc"),
  galaxy: g("#a855f7", "#22d3ee"),
  holy: g("#fbbf24", "#6366f1"),
  quantum: g("#22d3ee", "#3b82f6"),
  casino: g("#10b981", "#f5c543"),
  volcanic: g("#ff4500", "#ff8c00"),
  abyss: g("#00e5c8", "#6040c0"),
  eclipse: g("#d4a745", "#8b7fcf"),
  phantom: g("#5a7a9a", "#8a9bb5"),
  emberforge: g("#ff6a14", "#ff9426"),
  tempus: g("#b8956a", "#d4a76a"),
  storm: g("#4af0ff", "#a078ff"),
  coral: g("#ff6b6b", "#4ecdc4"),
  rust: g("#d2691e", "#8b4513"),
  void: g("#9aa0a6", "#3a3a3a"),
  prism: g("#8b5cf6", "#22d3ee"),
  ink: g("#8c8c8c", "#262626"),
  bloom: g("#c45a86", "#5f9367"),
};

/** Fallback STATIQUE (zéro WebGL/rAF) pour le palier graphique bas : monté à la
 *  place de ThemedBackdrop quand les thèmes premium sont coupés (perf tablette).
 *  Même signature de boîte (fixed inset-0 z-0) → la shell ne bouge pas. */
export function ThemedBackdropStaticFallback({ scene }: { scene: BackdropScene }) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: SCENE_GRADIENT[scene] ?? "#0b0d12" }}>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 40%, rgba(5,7,11,0.5) 100%)" }}
      />
    </div>
  );
}
