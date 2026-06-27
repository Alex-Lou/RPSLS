/**
 * HpCurveChart — PV moyen du héros par tour, une polyligne par Voie. Montre QUI
 * fond vite (Mirage/Tranchant) vs QUI tient (Montagne/Forêt) et à quel tour ça
 * bascule. Glow léger sur les traits, valeurs d'axe nettes.
 */
import { useEffect, useRef } from "react";
import { HERO_MAX_HP } from "../../arena/arenaTypes/constants";
import { VOIE_META, type VoieStats } from "../sim/simTypes";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, dataText, setupCanvas, withGlow } from "./canvasKit";

export function HpCurveChart({ stats }: { stats: VoieStats[] }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const padL = 38;
    const padR = 12;
    const padT = 12;
    const padB = 26;
    const h = 240;
    const ctx = setupCanvas(canvas, width, h);

    const maxTurn = Math.max(2, ...stats.map((s) => s.hpByTurn.length - 1));
    const x0 = padL;
    const x1 = width - padR;
    const y0 = h - padB;
    const y1 = padT;
    const xOf = (t: number) => x0 + (t / maxTurn) * (x1 - x0);
    const yOf = (hp: number) => y0 + (hp / HERO_MAX_HP) * (y1 - y0);

    // grille + axes Y (0,5,10,15,20)
    ctx.strokeStyle = alpha(cssVar("--grid"), 0.6);
    ctx.lineWidth = 1;
    for (let hp = 0; hp <= HERO_MAX_HP; hp += 5) {
      ctx.beginPath();
      ctx.moveTo(x0, yOf(hp));
      ctx.lineTo(x1, yOf(hp));
      ctx.stroke();
      dataText(ctx, String(hp), x0 - 6, yOf(hp), { align: "right", size: 10, color: cssVar("--ink-dim") });
    }
    // axe X (tours)
    for (let t = 0; t <= maxTurn; t += Math.ceil(maxTurn / 8) || 1) {
      dataText(ctx, `T${t}`, xOf(t), y0 + 12, { align: "center", size: 10, color: cssVar("--ink-dim") });
    }

    // polylignes
    stats.forEach((s) => {
      if (s.hpByTurn.length < 2) return;
      const color = cssVar(VOIE_META[s.move].cssVar);
      withGlow(ctx, color, 6, () => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        s.hpByTurn.forEach((hp, t) => {
          const px = xOf(t);
          const py = yOf(hp);
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
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
