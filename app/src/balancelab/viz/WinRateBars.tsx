/**
 * WinRateBars — win-rate par Voie en barres horizontales, avec la BANDE CIBLE
 * 45–55%. Glow conditionnel : >55 magenta (« trop fort »), <45 ambre (« à buff »),
 * dans la cible lime (« équilibré »). Valeur exacte en mono, sans glow (lisible).
 * `overlay` (télémétrie réelle, PALIER 4) = tick losange sur la même ligne.
 */
import { useEffect, useRef } from "react";
import { VOIE_META, type VoieStats } from "../sim/simTypes";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, dataText, grid, setupCanvas, withGlow } from "./canvasKit";

const TARGET_LO = 0.45;
const TARGET_HI = 0.55;

function glowColor(wr: number): string {
  if (wr > TARGET_HI) return cssVar("--neon-magenta");
  if (wr < TARGET_LO) return cssVar("--neon-amber");
  return cssVar("--neon-lime");
}

export function WinRateBars({ stats, overlay }: { stats: VoieStats[]; overlay?: VoieStats[] | null }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const padL = 96;
    const padR = 56;
    const padT = 16;
    const rowH = 38;
    const h = padT * 2 + stats.length * rowH;
    const ctx = setupCanvas(canvas, width, h);
    grid(ctx, width, h, 32);

    const x0 = padL;
    const x1 = width - padR;
    const span = x1 - x0;
    const xOf = (p: number) => x0 + Math.max(0, Math.min(1, p)) * span;

    // Bande cible 45–55
    const bandTop = padT - 4;
    const bandH = stats.length * rowH + 8;
    ctx.fillStyle = alpha(cssVar("--neon-lime"), 0.1);
    ctx.fillRect(xOf(TARGET_LO), bandTop, xOf(TARGET_HI) - xOf(TARGET_LO), bandH);
    ctx.strokeStyle = alpha(cssVar("--neon-lime"), 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(xOf(TARGET_LO) + 0.5, bandTop + 0.5, xOf(TARGET_HI) - xOf(TARGET_LO), bandH);
    // Repère 50%
    ctx.strokeStyle = alpha(cssVar("--ink-dim"), 0.5);
    ctx.beginPath();
    ctx.moveTo(xOf(0.5) + 0.5, bandTop);
    ctx.lineTo(xOf(0.5) + 0.5, bandTop + bandH);
    ctx.stroke();

    stats.forEach((s, i) => {
      const cy = padT + i * rowH + rowH / 2;
      const color = cssVar(VOIE_META[s.move].cssVar);
      dataText(ctx, VOIE_META[s.move].name, x0 - 10, cy, {
        align: "right",
        color,
        size: 13,
        font: '"Rajdhani", sans-serif',
      });
      // rail
      ctx.fillStyle = alpha(cssVar("--ink-dim"), 0.12);
      ctx.fillRect(x0, cy - 7, span, 14);
      // barre
      const bw = xOf(s.winRate) - x0;
      withGlow(ctx, glowColor(s.winRate), 12, () => {
        ctx.fillStyle = color;
        ctx.fillRect(x0, cy - 7, bw, 14);
      });
      // valeur exacte (sans glow)
      dataText(ctx, `${(s.winRate * 100).toFixed(1)}%`, x1 + 8, cy, { align: "left", size: 13 });

      // overlay réel = losange sur la même ligne
      const ov = overlay?.find((o) => o.move === s.move);
      if (ov) {
        const ox = xOf(ov.winRate);
        ctx.save();
        ctx.fillStyle = cssVar("--ink");
        ctx.translate(ox, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
    });
  }, [stats, overlay, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
