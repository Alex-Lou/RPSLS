/**
 * useGfxAutoDetect — VRAIE détection de perf au runtime (Alex 2026-06-20).
 *
 * Les specs ne suffisent pas : la tablette (8 Go / 8 cœurs / DPR 2.0) a de
 * « bonnes » specs mais une WebView lente → detectGraphicsLevel() la classe en
 * 'medium' alors qu'elle rame. Ce hook MESURE les FPS réels au démarrage et
 * RÉTROGRADE le palier (player.graphicsMeasured, persisté per-appareil) si ça
 * rame. Précédence : override manuel > mesuré > specs (cf. graphicsQuality.ts).
 *
 * Garde-fous : (1) ne mesure pas si un override MANUEL est posé (le joueur
 * décide) ; (2) ne rétrograde JAMAIS au-dessus du palier specs ; (3) lève la
 * rétrogradation si l'appareil tient désormais son palier specs.
 */

import { useEffect } from "react";
import { useStore } from "../store/store";
import { AUTO_LEVEL, type GraphicsLevel } from "./graphicsQuality";

const ORDER: GraphicsLevel[] = ["low", "medium", "high"];
const idx = (l: GraphicsLevel) => ORDER.indexOf(l);

export function useGfxAutoDetect() {
  useEffect(() => {
    // Le joueur a fixé un palier manuel → on ne mesure pas (il décide).
    if (useStore.getState().player.graphicsQuality) return;

    let raf = 0;
    let started = 0;
    let windowStart = 0;
    let last = 0;
    const deltas: number[] = [];

    const finish = () => {
      cancelAnimationFrame(raf);
      if (deltas.length < 20) return; // échantillon trop maigre, on s'abstient
      const sorted = deltas.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      const slow = deltas.filter((d) => d > 22).length / deltas.length; // part de frames < ~45fps

      // Jank mesurée → palier, PLAFONNÉ au palier specs (jamais au-dessus).
      let measured: GraphicsLevel = AUTO_LEVEL;
      if (p95 > 33 || slow > 0.4) measured = "low"; // tient mal 30fps
      else if (p95 > 22 || slow > 0.2) measured = ORDER[Math.max(0, idx(AUTO_LEVEL) - 1)]; // un cran sous specs
      const capped = ORDER[Math.min(idx(measured), idx(AUTO_LEVEL))];

      const prev = useStore.getState().player.graphicsMeasured;
      const updateProfile = useStore.getState().updateProfile;
      if (capped !== AUTO_LEVEL) {
        if (capped !== prev) {
          updateProfile({ graphicsMeasured: capped });
          // eslint-disable-next-line no-console
          console.warn(`[GFX] détecté '${capped}' (p95=${p95.toFixed(1)}ms, slow=${(slow * 100).toFixed(0)}%, specs='${AUTO_LEVEL}')`);
        }
      } else if (prev) {
        // L'appareil tient son palier specs → on retire la rétrogradation.
        updateProfile({ graphicsMeasured: undefined });
      }
    };

    const tick = (t: number) => {
      if (!started) { started = t; last = t; raf = requestAnimationFrame(tick); return; }
      // Warm-up 700ms : on ignore le jank initial de boot.
      if (!windowStart) {
        if (t - started >= 700) { windowStart = t; }
        last = t; raf = requestAnimationFrame(tick); return;
      }
      deltas.push(t - last);
      last = t;
      if (t - windowStart >= 2500) { finish(); return; } // fenêtre de mesure ~2.5s
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
