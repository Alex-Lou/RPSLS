import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../../store/store";
import { PeekIntensitySlider } from "./PeekIntensitySlider";

/** Fields read from the active background — passed in from StyleSection so
 *  this overlay stays decoupled from the BACKGROUNDS catalogue. */
type PeekBg = { label?: string; premiumSetId?: string; accent?: { from: string; to: string } | null } | undefined;

/** Full-screen backdrop peek (portal to body).
 *  The background is applied for real the instant a tile is tapped, so
 *  selection can never fail. This overlay just hides the menu shell (via
 *  App's `peek` flag) so the live animated backdrop fills the screen for
 *  a true preview. Tap anywhere — or the button — to return. */
export function BackdropPeekOverlay({
  peek, peekPremiumPending, currentBg, onConfirm, onClose, onBuy,
}: {
  peek: boolean;
  peekPremiumPending: string | null;
  currentBg: PeekBg;
  onConfirm: () => void;
  onClose: () => void;
  onBuy: (setId: string) => void;
}) {
  const player = useStore((s) => s.player);
  return createPortal(
    <AnimatePresence>
      {peek && (
        <motion.div
          key="bg-peek"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          // pointer-events-none on the container so taps on the backdrop
          // PASS THROUGH to the touch layers (WebGL window-listeners /
          // Quartz active layer) — the player can play with the scene to
          // test the touch FX. Tapping NO LONGER closes/confirms the peek
          // (that was the bug). Only the button column (pointer-events-auto
          // below) commits or closes.
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-end pb-10 pointer-events-none"
        >
          {/* Vertical intensity slider — Alex's ask: "le bouton de réglage
              d'intensité doit egalement être présent, vertical sur le côté,
              pres des aperçus, sinon le joueur ne sait pas qu'il peut bénéficier
              de ça". Only shown when the previewed bg has a premium FX scene
              AND the player owns it (so dragging actually changes something
              they can apply). Pointer-events-auto on the slider control only,
              so taps on the backdrop still reach the touch FX. */}
          {currentBg?.premiumSetId &&
           (player.ownedPremiumSets ?? []).includes(currentBg.premiumSetId) && (
            <PeekIntensitySlider
              setId={currentBg.premiumSetId}
              accent={currentBg.accent ?? null}
            />
          )}

          <div className="flex flex-col items-center gap-3 max-w-md w-full px-6 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header pill: name + appliqué/aperçu state. */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15">
              {peekPremiumPending ? (
                <>
                  <span className="text-amber-300 text-sm font-black">✦</span>
                  <span className="font-bold text-white text-sm drop-shadow">{currentBg?.label ?? "Fond"}</span>
                  <span className="text-amber-300 text-[11px] font-bold uppercase tracking-wide">aperçu premium</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-400 text-sm font-black">✓</span>
                  <span className="font-bold text-white text-sm drop-shadow">{currentBg?.label ?? "Fond"}</span>
                  <span className="text-cyan-300 text-[11px] font-bold uppercase tracking-wide">appliqué</span>
                </>
              )}
            </div>
            {/* Button row — content depends on premium-locked vs applied. */}
            {peekPremiumPending ? (
              <div className="flex flex-col gap-2 w-full">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    // Open the purchase modal ON TOP of the peek. After purchase,
                    // CelebrationOverlay fires inside the modal; on close we
                    // confirmPeek() since the player now owns the set.
                    if (peekPremiumPending) onBuy(peekPremiumPending);
                  }}
                  className="w-full py-3 rounded-2xl font-black text-base uppercase tracking-wider shadow-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-zinc-900"
                >
                  ✦ Acheter ce thème
                </motion.button>
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onConfirm}
                    className="py-2.5 rounded-xl font-bold text-sm bg-white/10 border border-white/20 text-white"
                  >
                    Garder l'aperçu
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onClose}
                    className="py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/15 text-white/85"
                  >
                    Fermer
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onConfirm}
                  className="py-3 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl bg-themed text-white"
                >
                  ✓ Choisir ce thème
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onClose}
                  className="py-3 rounded-2xl font-bold text-sm uppercase tracking-wider bg-white/10 border border-white/20 text-white"
                >
                  Fermer
                </motion.button>
              </div>
            )}
            <span className="text-white/55 text-[11px]">Touche / glisse le fond pour jouer · les boutons valident</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
