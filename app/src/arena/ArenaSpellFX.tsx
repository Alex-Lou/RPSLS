/**
 * ArenaSpellFX — COMPOSANT du spotlight d'effet plein-board (Alex 2026-06-13 ;
 * data extraite vers arenaSpellSignatures 2026-06-30 pour tenir <400 lignes).
 *
 * Le résolveur émet UNE carte à la fois (file séquencée) → on prend la 1ʳᵉ
 * signature présente, on met la CARTE au centre (vignette + nom) puis on joue
 * sa SIGNATURE derrière (boom plein cadre). Un climax (Légendaire/Finisher) dure
 * plus longtemps. Démontage : AnimatePresence + le hold timer d'ArenaGame.spellFX.
 *
 * Le vocabulaire visuel (briques) + la table SIGNATURES vivent dans
 * arenaSpellSignatures.tsx. On RE-EXPORTE SPELLS_WITH_SIGNATURE pour ne pas
 * casser l'import d'arenaResolverFlow.
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { CardId } from "../ranked/rankedTypes";
import { isDominantSpell } from "./arenaFinishers";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import { useT } from "../i18n";
import { useGfxAllows } from "../graphics/graphicsQuality";
import { SIGNATURES } from "./arenaSpellSignatures";

export { SPELLS_WITH_SIGNATURE } from "./arenaSpellSignatures";

export function ArenaSpellFX({ fx }: { fx: { ids: CardId[]; key: number } | null }) {
  const t = useT();
  // PERF (Alex 2026-06-26 « tranchant définitif saccadé ») : le boom plein-board
  // (~14 nœuds composités/blend) est désormais gaté. En 'low' (auto-downgrade FPS
  // ou réglage manuel), on garde la carte + la vignette mais on COUPE la signature
  // → le finisher Tranchant et les autres ne saccadent plus sur appareil faible.
  const heavyOk = useGfxAllows("spellSignatureHeavy");
  // SPELL-SPOTLIGHT (Alex 2026-06-23 « carte à l'avant → anim → dissolution →
  // suivante, sinon ça se mélange »). Le résolveur émet désormais UNE carte à la
  // fois (file séquencée) → on prend la 1ʳᵉ signature présente. Chaque carte a SON
  // moment : vignette + carte au centre + sa signature derrière + dissolution.
  const id = fx ? (Array.from(new Set(fx.ids)).filter((x) => SIGNATURES[x])[0] ?? null) : null;
  const Sig = id ? SIGNATURES[id]! : null;
  const dominant = id ? isDominantSpell(id) : false;
  const vignetteDur = dominant ? 2.2 : 1.5;
  // La signature monte APRÈS un court délai (la carte a eu son moment SEULE), puis
  // joue ses keyframes internes EN AVANT de la carte. Avant, elle jouait DERRIÈRE
  // la carte au même instant → la carte cachait le boom (« je vois la carte mais
  // rien de l'anim »). Démontage final géré par ArenaGame.spellFX (hold timer).
  const [showSig, setShowSig] = useState(false);
  useEffect(() => {
    if (!fx || !id) { setShowSig(false); return; }
    setShowSig(false);
    const tid = window.setTimeout(() => setShowSig(true), dominant ? 520 : 400);
    return () => window.clearTimeout(tid);
  }, [fx?.key, id, dominant]);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 40 }} aria-hidden>
      <AnimatePresence>
        {fx && id && Sig && (
          <motion.div
            key={`spellfx-${fx.key}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Vignette focus — DERRIÈRE tout, assombrit le board. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, dominant ? 0.84 : 0.72, dominant ? 0.8 : 0.62, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: vignetteDur, times: [0, 0.16, 0.72, 1], ease: "easeInOut" }}
              className="absolute inset-0"
              style={{ background: "radial-gradient(circle at 50% 50%, transparent 18%, rgba(2,2,10,0.88) 82%)" }}
            />
            {/* LA CARTE — s'affiche d'abord (DERRIÈRE le boom), puis se dissout. */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 16, rotateZ: -4 }}
              animate={{
                scale: dominant ? [0.5, 1.28, 1.16, 1.3] : [0.5, 1.12, 1.0, 1.08],
                opacity: [0, 1, 1, 0],
                y: [16, 0, 0, -14],
                rotateZ: [-4, 0, 0, 3],
              }}
              transition={{ duration: dominant ? 1.2 : 1.0, times: [0, 0.2, 0.5, 1], ease: "easeOut" }}
              className="relative flex flex-col items-center gap-1"
            >
              <div className="relative w-24 h-32 landscape:w-28 landscape:h-36 rounded-xl overflow-hidden ring-2 ring-white/45 shadow-[0_10px_44px_-4px_rgba(0,0,0,0.95)]">
                <CardImage id={id} glyphSize="text-5xl" />
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white"
                style={{ background: "rgba(0,0,0,0.62)", textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}
              >
                {t(CARDS[id].nameKey)}
              </span>
            </motion.div>
            {/* LA SIGNATURE — AU-DESSUS de la carte, montée RETARDÉE : elle explose
             *  quand la carte se dissout → le boom est enfin VISIBLE plein cadre. */}
            <AnimatePresence>
              {showSig && heavyOk && (
                <motion.div
                  key="sig"
                  initial={{ scale: dominant ? 1.35 : 1.1, opacity: 0 }}
                  animate={{ scale: dominant ? 1.65 : 1.32, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dominant ? 0.9 : 0.55, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Sig />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
