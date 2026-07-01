/**
 * fpsSampler — profileur FPS CONTINU par-match (Alex 2026-07). Échantillonne la
 * durée de chaque frame via rAF pendant TOUTE une partie, puis rend un résumé
 * (moyenne / pire / 5%-low / jank / hitches) envoyé au RPSLSWatcher avec le
 * MatchRecord → on pilote la PERF comme on pilote l'équilibrage.
 *
 * Contrainte n°1 : NE PAS dégrader les FPS qu'on mesure. Donc :
 *   - un SEUL rAF (singleton), zéro allocation par frame (histogramme Int32Array),
 *   - percentile calculé à l'arrêt depuis l'histo (pas de tri d'un tableau qui
 *     grandit sur des minutes de jeu),
 *   - fail-soft total : jamais d'exception, jamais d'effet gameplay.
 *
 * Distinct de useGfxAutoDetect (mesure one-shot au BOOT pour l'auto-palier) :
 * ici c'est CONTINU, par-match, observationnel. Seuils gardés cohérents.
 */

/** Résumé FPS d'une partie — MÊME contrat que le Watcher (src/data/types.ts).
 *  Dupliqué volontairement : deux repos, le contrat = leur frontière. */
export interface FpsSummary {
  avg: number;        // FPS moyen
  min: number;        // pire FPS instantané (= 1000 / plus longue frame)
  low: number;        // FPS des 5% pires frames (p95 de durée) — la métrique de stutter
  jankPct: number;    // % de frames > 32ms (sous ~30 fps)
  longFrames: number; // nb de frames > 50ms (hitch visible)
  frames: number;     // total de frames échantillonnées
  durMs: number;      // durée réelle d'échantillonnage
  dpr: number;        // devicePixelRatio (perf-pertinent)
  device?: string;    // hint appareil (modèle, non-PII)
}

const BIN_MS = 2;                 // largeur de bin de l'histogramme de durée
const BINS = 75;                  // 0..150ms (au-delà → dernier bin)
const JANK_MS = 32;               // > 32ms ≈ sous 30 fps
const LONG_MS = 50;               // > 50ms = hitch visible

let running = false;
let raf = 0;
let last = 0;
let startTs = 0;
let frames = 0;
let sumMs = 0;
let maxMs = 0;
let jank = 0;
let long = 0;
let bins: Int32Array | null = null;

function tick(t: number): void {
  if (!running) return;
  if (last) {
    const d = t - last;
    // Ignore les frames aberrantes (onglet en arrière-plan, > 1s) : elles ne
    // reflètent pas le rendu, elles fausseraient min/low.
    if (d > 0 && d < 1000) {
      frames++;
      sumMs += d;
      if (d > maxMs) maxMs = d;
      if (d > JANK_MS) jank++;
      if (d > LONG_MS) long++;
      if (bins) bins[Math.min(BINS - 1, (d / BIN_MS) | 0)]++;
    }
  }
  last = t;
  raf = requestAnimationFrame(tick);
}

function deviceHint(): string {
  try {
    const ua = navigator.userAgent || "";
    const m = ua.match(/;\s*([^;)]+?)\s+Build\//); // Android : "; <modèle> Build/"
    if (m) return m[1].trim().slice(0, 40);
    if (/iPhone|iPad|iPod/.test(ua)) return (ua.match(/iPhone|iPad|iPod/)?.[0] ?? "iOS");
    return (navigator.platform || "web").slice(0, 40);
  } catch {
    return "?";
  }
}

/** Démarre (ou redémarre) l'échantillonnage. Idempotent : un seul rAF. */
export function startMatchFps(): void {
  try {
    if (typeof requestAnimationFrame !== "function") return;
    running = true;
    last = 0;
    frames = 0;
    sumMs = 0;
    maxMs = 0;
    jank = 0;
    long = 0;
    bins = new Int32Array(BINS);
    startTs = typeof performance !== "undefined" ? performance.now() : Date.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  } catch {
    running = false;
  }
}

/** Arrête l'échantillonnage et rend le résumé, ou null si trop peu de frames. */
export function stopMatchFps(): FpsSummary | null {
  try {
    running = false;
    cancelAnimationFrame(raf);
    if (frames < 30 || sumMs <= 0 || !bins) return null; // échantillon trop maigre
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    // p95 de durée de frame (les 5% pires) depuis l'histogramme cumulatif.
    const target = frames * 0.95;
    let acc = 0;
    let p95Ms = maxMs;
    for (let i = 0; i < BINS; i++) {
      acc += bins[i];
      if (acc >= target) { p95Ms = (i + 1) * BIN_MS; break; }
    }
    const round1 = (x: number) => Math.round(x * 10) / 10;
    return {
      avg: round1(1000 / (sumMs / frames)),
      min: round1(1000 / Math.max(1, maxMs)),
      low: round1(1000 / Math.max(1, p95Ms)),
      jankPct: round1((100 * jank) / frames),
      longFrames: long,
      frames,
      durMs: Math.round(now - startTs),
      dpr: typeof devicePixelRatio === "number" ? round1(devicePixelRatio) : 1,
      device: deviceHint(),
    };
  } catch {
    return null;
  }
}
