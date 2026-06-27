/**
 * PowerRadar — profil de puissance de chaque Voie sur 4 axes (Win-rate, Dégâts
 * infligés, Survie = PV final, Finisher). Chaque axe est NORMALISÉ min→max entre
 * les 5 Voies : le bord externe = la meilleure Voie sur cet axe, le centre = la
 * pire. La forme de chaque polygone montre d'un coup ses « high / mid / low ».
 */
import { useEffect, useRef } from "react";
import { VOIE_META, type VoieStats } from "../sim/simTypes";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, dataText, setupCanvas } from "./canvasKit";

const AXES: { key: keyof VoieStats; label: string }[] = [
  { key: "winRate", label: "Win" },
  { key: "avgDmgDealt", label: "Dégâts" },
  { key: "avgFinalHp", label: "Survie" },
  { key: "finisherFireRate", label: "Finisher" },
];

export function PowerRadar({ stats }: { stats: VoieStats[] }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const h = 260;
    const ctx = setupCanvas(canvas, width, h);
    const cx = width / 2;
    const cy = h / 2 + 4;
    const R = Math.min(width, h) / 2 - 38;

    // bornes min/max par axe
    const bounds = AXES.map(({ key }) => {
      const vals = stats.map((s) => s[key] as number);
      return { lo: Math.min(...vals), hi: Math.max(...vals) };
    });
    const norm = (v: number, k: number) => {
      const { lo, hi } = bounds[k];
      return hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo);
    };
    const angleOf = (k: number) => -Math.PI / 2 + (k / AXES.length) * Math.PI * 2;

    // toile de fond (anneaux + rayons)
    ctx.strokeStyle = alpha(cssVar("--grid"), 0.7);
    ctx.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      for (let k = 0; k <= AXES.length; k++) {
        const a = angleOf(k % AXES.length);
        const px = cx + Math.cos(a) * (R * r) / 3;
        const py = cy + Math.sin(a) * (R * r) / 3;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    AXES.forEach(({ label }, k) => {
      const a = angleOf(k);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
      dataText(ctx, label, cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 14), {
        align: "center",
        size: 11,
        color: cssVar("--ink-dim"),
        font: '"Rajdhani", sans-serif',
      });
    });

    // polygone par Voie
    stats.forEach((s) => {
      const color = cssVar(VOIE_META[s.move].cssVar);
      ctx.strokeStyle = color;
      ctx.fillStyle = alpha(color, 0.07);
      ctx.lineWidth = 2;
      ctx.beginPath();
      AXES.forEach(({ key }, k) => {
        const rr = 0.12 + 0.88 * norm(s[key] as number, k); // garde un mini-rayon au centre
        const a = angleOf(k);
        const px = cx + Math.cos(a) * R * rr;
        const py = cy + Math.sin(a) * R * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }, [stats, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
      <div className="lab-legend">
        {stats.map((s) => (
          <span key={s.move} style={{ color: cssVar(VOIE_META[s.move].cssVar) }}>
            ● {VOIE_META[s.move].name}
          </span>
        ))}
      </div>
    </div>
  );
}
