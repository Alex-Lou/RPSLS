/**
 * MatchupHeatmap — grille 5×5 des win-rates symétrisés. Ligne = Voie attaquante,
 * colonne = Voie défenseur. Couleur divergente centrée sur 50% : froid (cyan,
 * <50 = perd) → near-black (≈50 = équilibré) → chaud (magenta, >50 = domine).
 * Diagonale (miroir) grisée. Valeur exacte en mono, sans glow.
 */
import { useEffect, useRef } from "react";
import { MOVES, VOIE_META, type SimResult } from "../sim/simTypes";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, dataText, setupCanvas } from "./canvasKit";

function divergingColor(v: number): string {
  if (Number.isNaN(v)) return "#0c1018";
  const t = Math.max(-1, Math.min(1, (v - 50) / 50)); // -1..1
  const cold = [42, 245, 255]; // cyan
  const hot = [255, 61, 240]; // magenta
  const base = [10, 14, 24]; // near-black
  const target = t < 0 ? cold : hot;
  const k = Math.abs(t);
  const c = base.map((b, i) => Math.round(b + (target[i] - b) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function MatchupHeatmap({ result }: { result: SimResult }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const m = result.matchupMatrix;
    const gut = 92; // gouttière labels gauche
    const top = 26; // labels colonnes
    const n = MOVES.length;
    const cellW = (width - gut - 8) / n;
    const cellH = 46;
    const h = top + n * cellH + 8;
    const ctx = setupCanvas(canvas, width, h);

    // labels colonnes (défenseur)
    MOVES.forEach((mv, j) => {
      dataText(ctx, VOIE_META[mv].name, gut + j * cellW + cellW / 2, top - 12, {
        align: "center",
        size: 11,
        color: cssVar(VOIE_META[mv].cssVar),
        font: '"Rajdhani", sans-serif',
      });
    });

    for (let i = 0; i < n; i++) {
      // label ligne (attaquant)
      dataText(ctx, VOIE_META[MOVES[i]].name, gut - 8, top + i * cellH + cellH / 2, {
        align: "right",
        size: 12,
        color: cssVar(VOIE_META[MOVES[i]].cssVar),
        font: '"Rajdhani", sans-serif',
      });
      for (let j = 0; j < n; j++) {
        const x = gut + j * cellW;
        const y = top + i * cellH;
        const v = m[i][j];
        ctx.fillStyle = i === j ? alpha(cssVar("--ink-dim"), 0.12) : divergingColor(v);
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        ctx.strokeStyle = alpha("#000000", 0.35);
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        if (!Number.isNaN(v)) {
          dataText(ctx, `${v.toFixed(0)}%`, x + cellW / 2, y + cellH / 2, {
            align: "center",
            size: 13,
            color: "#0a0e18",
          });
        }
      }
    }
  }, [result, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
      <div className="lab-legend">
        <span style={{ color: cssVar("--neon-cyan") }}>◀ perd</span>
        <span style={{ color: cssVar("--ink-dim") }}>≈50 équilibré</span>
        <span style={{ color: cssVar("--neon-magenta") }}>domine ▶</span>
      </div>
    </div>
  );
}
