/**
 * ArenaSpellFX — SIGNATURES d'effet plein-board (Alex 2026-06-13).
 *
 * Le mètre-étalon = l'anim Mascarade (ArenaLaneSlot) : multi-couches,
 * chorégraphiée (keyframes `times`), le sujet RÉAGIT, 100% transform/opacity
 * + mixBlendMode screen → fluide WebView, et SURTOUT auto-démontée (zéro
 * timer qui traîne, zéro repeat:Infinity → pas de fuite CPU/GPU/batterie).
 *
 * Ce module porte ce niveau aux GROS sorts plein-board (Genèse, Supernova,
 * Gravité, Trou Noir, Paradoxe, Apocalypse) qui, avant, n'avaient AUCUNE
 * signature — les créatures disparaissaient sans vie. Les sorts ciblés
 * gardent leurs réactions par-créature (buff/debuff/soin/dégâts) dans
 * ArenaLaneSlot ; ici on ne joue QUE les signatures spectaculaires.
 *
 * Extensible : ajoute une entrée dans SIGNATURES pour donner vie à un sort.
 * Une entrée absente = pas d'overlay board (et c'est très bien — on évite le
 * bruit visuel). Chaque signature joue UNE fois (~1–1.5s) puis disparaît.
 *
 * RÈGLE ANTI-FUITE (cf. demande Alex) : aucune signature n'utilise
 * repeat:Infinity. AnimatePresence démonte l'overlay ; ArenaGame purge l'état
 * `spellFX` via un timer nettoyé (clearTimeout) → rien ne tourne en idle.
 */

import { AnimatePresence, motion } from "motion/react";
import type { ReactElement } from "react";
import type { CardId } from "../ranked/rankedTypes";

/* Particules radiales déterministes (pas de Math.random → SSR/replay sûrs,
 * et même semence = même éclat, ce qui suffit visuellement). */
function radial(n: number, radius: number, jitter = 0): { x: number; y: number; deg: number }[] {
  const out: { x: number; y: number; deg: number }[] = [];
  for (let i = 0; i < n; i++) {
    const deg = (360 / n) * i;
    const r = radius + (jitter ? ((i % 3) - 1) * jitter : 0);
    const rad = (deg * Math.PI) / 180;
    out.push({ x: Math.cos(rad) * r, y: Math.sin(rad) * r, deg });
  }
  return out;
}

/* ─── Briques réutilisables (transform/opacity only) ─────────────────────── */

function CoreFlash({ from, to, dur = 0.7 }: { from: string; to: string; dur?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 1, 0], scale: [0.4, 1.7, 2.6] }}
      transition={{ duration: dur, ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
      style={{ background: `radial-gradient(circle, ${from} 0%, ${to} 45%, transparent 72%)`, mixBlendMode: "screen" }}
    />
  );
}

function Shockwave({ color, delay = 0, dur = 0.7, max = 3.4 }: { color: string; delay?: number; dur?: number; max?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.9, scale: 0.2 }}
      animate={{ opacity: 0, scale: max }}
      transition={{ duration: dur, ease: "easeOut", delay }}
      className="absolute left-1/2 top-1/2 w-32 h-32 -ml-16 -mt-16 rounded-full"
      style={{ border: `2.5px solid ${color}`, boxShadow: `0 0 24px ${color}` }}
    />
  );
}

function Sparks({ count, radius, color, dur = 0.7, size = 6, inward = false }: { count: number; radius: number; color: string; dur?: number; size?: number; inward?: boolean }) {
  const pts = radial(count, radius, radius * 0.18);
  return (
    <>
      {pts.map((p, i) => (
        <motion.span
          key={i}
          initial={inward ? { opacity: 0, x: p.x, y: p.y, scale: 0.4 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={inward ? { opacity: [0, 1, 0], x: 0, y: 0, scale: 0.3 } : { opacity: 0, x: p.x, y: p.y, scale: 0.3 }}
          transition={{ duration: dur, ease: "easeOut", delay: (i % 4) * 0.03 }}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      ))}
    </>
  );
}

function GlyphPop({ glyph, color, dur = 0.9 }: { glyph: string; color: string; dur?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.3, rotate: -18 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1.1, 1.5], rotate: [-18, 0, 0, 6] }}
      transition={{ duration: dur, times: [0, 0.3, 0.7, 1], ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl"
      style={{ filter: `drop-shadow(0 0 12px ${color})` }}
    >
      {glyph}
    </motion.span>
  );
}

/* ─── SIGNATURES par sort ─────────────────────────────────────────────────
 * Chaque clé = un CardId. La valeur = l'overlay JSX (plein board). */
const SIGNATURES: Partial<Record<CardId, () => ReactElement>> = {
  // ÉCHAPPÉE — sacrifie TA créature → pioche 2 (Alex 2026-06-13 « rendre ça
  // logique pour l'œil »). Lecture : elle FUIT (traits de vitesse + 💨), puis
  // 2 cartes filent vers le BAS (= elles arrivent dans ta main).
  echappee: () => (
    <>
      {[-20, 0, 20].map((dy, k) => (
        <motion.div
          key={`dash${k}`}
          initial={{ opacity: 0, x: -70, scaleX: 0.4 }}
          animate={{ opacity: [0, 0.9, 0], x: 90, scaleX: 1 }}
          transition={{ duration: 0.45, delay: k * 0.05, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 h-1 w-28 -ml-14 rounded-full"
          style={{ marginTop: dy, background: "linear-gradient(to right, transparent, rgba(125,211,252,0.9), transparent)" }}
        />
      ))}
      <GlyphPop glyph="💨" color="rgba(125,211,252,0.95)" dur={0.6} />
      {[-16, 16].map((dx, k) => (
        <motion.div
          key={`card${k}`}
          initial={{ opacity: 0, y: -6, x: dx, rotate: dx > 0 ? 10 : -10, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-6, 48], x: dx * 1.4, scale: 0.95 }}
          transition={{ duration: 0.8, delay: 0.25 + k * 0.08, ease: "easeIn" }}
          className="absolute left-1/2 top-1/2 w-7 h-10 -ml-3.5 -mt-5 rounded-md border-2 border-sky-200/90"
          style={{ background: "rgba(56,189,248,0.35)", boxShadow: "0 0 8px rgba(125,211,252,0.7)" }}
        />
      ))}
    </>
  ),
  // GENÈSE — détruit TOUT + chacun pioche 3. Big-bang cosmique : cœur blanc,
  // double onde, étoiles qui jaillissent puis re-pluie de pioche, glyphe 🌌.
  genese: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.98)" to="rgba(129,140,248,0.7)" dur={0.85} />
      <Shockwave color="rgba(199,210,254,0.95)" dur={0.8} max={3.8} />
      <Shockwave color="rgba(129,140,248,0.8)" delay={0.12} dur={0.8} max={3} />
      <Sparks count={18} radius={150} color="rgba(224,231,255,0.95)" dur={0.9} size={7} />
      <Sparks count={10} radius={90} color="rgba(252,211,77,0.9)" dur={0.7} size={5} />
      <GlyphPop glyph="🌌" color="rgba(165,180,252,0.95)" dur={0.95} />
    </>
  ),
  // SUPERNOVA — dégâts à TOUTES les créatures. Détonation rouge/orange.
  supernova: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.98)" to="rgba(251,146,60,0.75)" dur={0.7} />
      <Shockwave color="rgba(251,146,60,0.95)" dur={0.65} max={3.6} />
      <Sparks count={16} radius={140} color="rgba(254,215,170,0.95)" dur={0.7} size={7} />
      <Sparks count={8} radius={80} color="rgba(239,68,68,0.9)" dur={0.55} size={6} />
      <GlyphPop glyph="💥" color="rgba(251,146,60,0.95)" dur={0.8} />
    </>
  ),
  // GRAVITÉ — implosion : tout est aspiré vers le centre, puis pulse sombre.
  gravite: () => (
    <>
      <Sparks count={16} radius={150} color="rgba(165,180,252,0.9)" dur={0.6} size={6} inward />
      <motion.div
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: [0, 0.8, 0], scale: [1.6, 0.3, 0.1] }}
        transition={{ duration: 0.6, ease: "easeIn" }}
        className="absolute left-1/2 top-1/2 w-36 h-36 -ml-18 -mt-18 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.85) 0%, rgba(30,27,75,0.9) 55%, transparent 75%)", mixBlendMode: "screen" }}
      />
      <Shockwave color="rgba(129,140,248,0.85)" delay={0.5} dur={0.45} max={2.4} />
      <GlyphPop glyph="🪐" color="rgba(129,140,248,0.95)" dur={0.9} />
    </>
  ),
  // TROU NOIR — vortex sombre + anneau d'horizon qui aspire.
  "trou-noir": () => (
    <>
      <Sparks count={20} radius={160} color="rgba(196,181,253,0.9)" dur={0.65} size={6} inward />
      <motion.div
        initial={{ opacity: 0, rotate: 0, scale: 1.8 }}
        animate={{ opacity: [0, 0.95, 0], rotate: 220, scale: [1.8, 0.4, 0.15] }}
        transition={{ duration: 0.75, ease: "easeIn" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
        style={{ background: "conic-gradient(from 0deg, transparent, rgba(139,92,246,0.85), transparent, rgba(30,27,75,0.95), transparent)", mixBlendMode: "screen" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 1.1, 0.6] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-16 h-16 -ml-8 -mt-8 rounded-full"
        style={{ background: "rgba(8,5,20,0.95)", boxShadow: "0 0 30px 8px rgba(139,92,246,0.7)" }}
      />
      <GlyphPop glyph="🕳️" color="rgba(167,139,250,0.95)" dur={0.85} />
    </>
  ),
  // PARADOXE — ondulation temporelle : anneaux concentriques + glyphe ⏳.
  paradoxe: () => (
    <>
      <Shockwave color="rgba(45,212,191,0.9)" dur={0.7} max={3.2} />
      <Shockwave color="rgba(94,234,212,0.8)" delay={0.18} dur={0.7} max={2.6} />
      <Shockwave color="rgba(45,212,191,0.7)" delay={0.36} dur={0.7} max={2} />
      <CoreFlash from="rgba(204,251,241,0.9)" to="rgba(45,212,191,0.6)" dur={0.7} />
      <GlyphPop glyph="⏳" color="rgba(94,234,212,0.95)" dur={0.9} />
    </>
  ),
  // APOCALYPSE (fusion : 4 dmg all + 4 héros) — détonation MAJEURE, plus
  // grande/plus sombre que Supernova, double onde + cendres.
  apocalypse: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.98)" to="rgba(239,68,68,0.8)" dur={0.9} />
      <Shockwave color="rgba(248,113,113,0.95)" dur={0.85} max={4.2} />
      <Shockwave color="rgba(127,29,29,0.85)" delay={0.15} dur={0.85} max={3.2} />
      <Sparks count={22} radius={165} color="rgba(254,202,202,0.95)" dur={0.9} size={7} />
      <Sparks count={12} radius={95} color="rgba(245,158,11,0.9)" dur={0.7} size={6} />
      <GlyphPop glyph="☄️" color="rgba(248,113,113,0.95)" dur={1} />
    </>
  ),
};

/** Liste des sorts qui ONT une signature — exporté pour l'IA/tests éventuels. */
export const SPELLS_WITH_SIGNATURE = Object.keys(SIGNATURES) as CardId[];

export function ArenaSpellFX({ fx }: { fx: { ids: CardId[]; key: number } | null }) {
  // Ne garde que les sorts AVEC signature (déduplique : un même sort joué des
  // deux côtés ne joue qu'une fois — un big-bang suffit).
  const sigs = fx ? Array.from(new Set(fx.ids)).filter((id) => SIGNATURES[id]) : [];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 40 }} aria-hidden>
      <AnimatePresence>
        {fx && sigs.length > 0 && (
          <motion.div
            key={`spellfx-${fx.key}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {sigs.map((id) => {
              const Sig = SIGNATURES[id]!;
              return (
                <div key={id} className="absolute inset-0 flex items-center justify-center">
                  <Sig />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
