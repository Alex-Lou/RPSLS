/**
 * Calques FX de CreatureSlot (extraits pour le cap <400 lignes/fichier) —
 * rendus EN PLACE (fragments) dans l'ordre DOM d'origine : l'ordre DOM pilote
 * l'empilement des overlays sans z-index explicite, ne pas réordonner.
 * - CreatureImpactFX   : burst/onde de choc de charge, étincelles, flash rouge.
 * - CreatureStatusFX   : Toile Gluante, Éclipse (en phase), Phénix.
 * - CreatureHitChips   : popup −N, chip « absorbé » (bouclier), chip esquive.
 */

import { AnimatePresence, motion } from "motion/react";
import type { Creature } from "../arenaTypes";
import { useT } from "../../i18n";

/** Vecteurs FIXES des étincelles d'impact (pas de Math.random au render —
 *  zéro jitter de re-render). 7 directions en éventail, alternance ambre/rose. */
const SPARK_VECTORS: Array<{ dx: number; dy: number; amber: boolean }> = [
  { dx: -30, dy: -24, amber: true },
  { dx: 0,   dy: -34, amber: false },
  { dx: 30,  dy: -24, amber: true },
  { dx: -36, dy: 2,   amber: false },
  { dx: 36,  dy: 2,   amber: true },
  { dx: -22, dy: 26,  amber: false },
  { dx: 22,  dy: 26,  amber: true },
];

/** Charge (burst + onde de choc), étincelles d'impact et flash rouge de coup. */
export function CreatureImpactFX({ chargeAttack, hitShake }: {
  chargeAttack: boolean;
  hitShake: { key: number } | null;
}) {
  return (
    <>
      {/* Radial burst overlay — at the apex of the charge, a bright
       *  white → amber ring expands outward from the creature's center.
       *  Drives the "impact" feel beyond the lunge alone. */}
      <AnimatePresence>
        {chargeAttack && (
          <motion.div
            key="charge-burst"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0.7, 0], scale: [0.4, 1.4, 2.2, 2.8] }}
            transition={{ duration: 0.6, ease: "easeOut", times: [0, 0.35, 0.6, 1], delay: 0.16 }}
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(252,211,77,0.6) 35%, transparent 70%)",
              mixBlendMode: "screen",
            }}
          />
        )}
        {/* ONDE DE CHOC (Alex 2026-06-12 "combats trop mous") : un anneau
         *  net qui claque vers l'extérieur à l'apex du slam. Transform-only. */}
        {chargeAttack && (
          <motion.div
            key="shockwave"
            initial={{ opacity: 0, scale: 0.45 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.45, 1.7, 2.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.3, 1], delay: 0.24 }}
            className="absolute inset-0 pointer-events-none rounded-full border-2"
            style={{ borderColor: "rgba(252,211,77,0.9)", boxShadow: "0 0 12px rgba(252,211,77,0.5)" }}
          />
        )}
      </AnimatePresence>
      {/* ÉTINCELLES D'IMPACT — 7 particules en éventail quand la créature
       *  encaisse (hitShake). Vecteurs fixes, transform/opacity only. */}
      <AnimatePresence>
        {hitShake && (
          <motion.div
            key={`sparks-${hitShake.key}`}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 25 }}
            exit={{ opacity: 0 }}
          >
            {SPARK_VECTORS.map((v, i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{ x: v.dx, y: v.dy, scale: 0.2, opacity: 0 }}
                transition={{ duration: 0.42, ease: "easeOut", delay: i * 0.012 }}
                className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                style={{
                  background: v.amber ? "#fcd34d" : "#fb7185",
                  boxShadow: v.amber
                    ? "0 0 6px rgba(252,211,77,0.95)"
                    : "0 0 6px rgba(251,113,133,0.95)",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* FLASH ROUGE de coup (Alex 2026-06-23 « le dégât est encore mou ») : voile
       *  rouge bref sur TOUTE la case quand la créature encaisse — viscéral et
       *  lisible, opacity-only (GPU-safe, pas de filtre animé). */}
      <AnimatePresence>
        {hitShake && (
          <motion.div
            key={`hitflash-${hitShake.key}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, times: [0, 0.3, 1], ease: "easeOut" }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ background: "rgba(244,63,94,0.7)", zIndex: 24 }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** Statuts persistants : Toile Gluante, Éclipse (en phase), renaissance Phénix. */
export function CreatureStatusFX({ creature }: { creature: Creature }) {
  const t = useT();
  return (
    <>
      {/* 🕸 TOILE GLUANTE — voile lime + badge tant que la créature est
       *  engluée (cannotAttack, expire en fin de tour). L'UI ne ment pas :
       *  ⚔ affiche déjà 0, ceci montre POURQUOI. */}
      {creature.cannotAttack && !creature.phasedOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }} aria-hidden>
          <div
            className="absolute inset-0 rounded-xl"
            style={{ background: "radial-gradient(circle, rgba(132,204,22,0.16) 0%, rgba(132,204,22,0.05) 60%, transparent 80%)" }}
          />
          <motion.span
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1 left-1/2 -translate-x-1/2 text-[13px] drop-shadow"
            title={t("arena.slot.webbed")}
          >
            🕸️
          </motion.span>
        </div>
      )}
      {/* 🌘 ÉCLIPSE — créature EN PHASE : voile cyan + liseré pulsant + badge tant
       *  qu'elle est intouchable (phasedOut, expire fin de tour). Elle survit à
       *  tout ce tour mais n'attaque pas → on rend l'intangibilité LISIBLE.
       *  Perf-safe : box-shadow STATIQUE, on n'anime que l'opacity (cf. halo Provoc). */}
      {creature.phasedOut && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 16 }} aria-hidden>
          <div
            className="absolute inset-0 rounded-xl"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(129,140,248,0.10) 55%, transparent 82%)" }}
          />
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-xl"
            style={{ boxShadow: "inset 0 0 0 2px rgba(34,211,238,0.55), inset 0 0 16px rgba(34,211,238,0.4)" }}
          />
          <span
            className="absolute top-1 left-1/2 -translate-x-1/2 text-[12px] drop-shadow"
            title={t("arena.slot.phasedOut")}
          >
            🌘
          </span>
        </div>
      )}
      {/* 🔥 PHÉNIX — flamme de RENAISSANCE : quand une créature revient
       *  (justRevived), une flamme or→rouge s'élève UNE fois (rise + fade).
       *  Per-turn (flag effacé au reset suivant). One-shot, leak-free. */}
      {creature.justRevived && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 21 }} aria-hidden>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.4, 1.8] }}
            transition={{ duration: 1.0, times: [0, 0.4, 1], ease: "easeOut" }}
            className="absolute inset-0 rounded-xl"
            style={{ background: "radial-gradient(circle at 50% 70%, rgba(251,146,60,0.8) 0%, rgba(249,115,22,0.4) 40%, transparent 72%)", mixBlendMode: "screen" }}
          />
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], y: -18, scale: 1.2 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl"
            style={{ filter: "drop-shadow(0 0 8px rgba(249,115,22,0.9))" }}
          >
            🔥
          </motion.span>
        </div>
      )}
    </>
  );
}

/** Popups one-shot : dégât flottant, bouclier absorbé, esquive. */
export function CreatureHitChips({ dmgPop, shieldBlocked, dodgedHit }: {
  dmgPop: { n: number; key: number } | null;
  shieldBlocked: { key: number } | null;
  dodgedHit: { key: number } | null;
}) {
  const t = useT();
  return (
    <>
      {/* Floating damage popup */}
      <AnimatePresence>
        {dmgPop && (
          <motion.div
            key={dmgPop.key}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: 1, y: -28, scale: 1.15 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
            style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
          >
            −{dmgPop.n}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Shield absorbed chip — pops when divineShield just ate damage. */}
      <AnimatePresence>
        {shieldBlocked && (
          <motion.div
            key={shieldBlocked.key}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -22 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="px-1.5 py-0.5 rounded bg-amber-300/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
              {t("arena.slot.absorbed")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Dodge chip — pops when dodgeCharge (Lézard Esquive) absorbed the hit. */}
      <AnimatePresence>
        {dodgedHit && (
          <motion.div
            key={dodgedHit.key}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -22 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="px-1.5 py-0.5 rounded bg-cyan-300/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
              {t("arena.slot.dodged")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
