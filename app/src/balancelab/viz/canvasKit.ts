/**
 * canvasKit — helpers canvas 2D partagés par les viz (pas de lib de charts :
 * les 5 visuels sont géométriquement simples, et le canvas donne le glow néon
 * gratuitement via shadowBlur). Règle de lisibilité : le glow vit sur les
 * contours/barres, JAMAIS sur un chiffre lu (les valeurs restent nettes).
 */

/** Résout une var CSS (--neon-cyan…) en couleur concrète pour le canvas. */
export function cssVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || "#2af5ff";
}

/** Prépare un canvas hi-DPI (net sur écrans Retina) et renvoie son contexte. */
export function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}

/** Exécute un dessin avec un halo néon, puis restaure (shadow off). */
export function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, fn: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

/** Texte de données NET (sans glow) — pour les valeurs lues. */
export function dataText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { color?: string; align?: CanvasTextAlign; size?: number; font?: string } = {},
): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = opts.color ?? cssVar("--ink");
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.font = `${opts.size ?? 12}px ${opts.font ?? '"Share Tech Mono", monospace'}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Quadrillage de fond technique discret. */
export function grid(ctx: CanvasRenderingContext2D, w: number, h: number, step = 28): void {
  ctx.save();
  ctx.strokeStyle = cssVar("--grid");
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

/** color-mix-like : applique une opacité à une couleur hex (#rrggbb). */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
