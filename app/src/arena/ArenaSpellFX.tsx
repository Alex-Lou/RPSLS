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
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { CardId } from "../ranked/rankedTypes";
import { isDominantSpell } from "./arenaFinishers";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import { useT } from "../i18n";
import { useGfxAllows } from "../graphics/graphicsQuality";

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
  // FINISHER FORTERESSE (Voie Montagne) — les remparts se DRESSENT : flash ocre,
  // double onde granite + ambre, éclats de pierre, glyphe 🏰. Le climax du mur.
  "finisher-forteresse": () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.96)" to="rgba(180,83,9,0.7)" dur={0.8} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.75} max={3.6} />
      <Shockwave color="rgba(245,158,11,0.85)" delay={0.14} dur={0.75} max={2.8} />
      <Sparks count={14} radius={130} color="rgba(231,229,228,0.95)" dur={0.8} size={7} />
      <Sparks count={8} radius={80} color="rgba(180,83,9,0.9)" dur={0.6} size={6} />
      <GlyphPop glyph="🏰" color="rgba(245,158,11,0.95)" dur={0.9} />
    </>
  ),
  // FINISHER MÉTAMORPHOSE (Voie Mirage) — l'insaisissable se RECOMPOSE : flash
  // indigo, double onde iridescente cyan→vert, étincelles, glyphe 🎭.
  "finisher-metamorphose": () => (
    <>
      <CoreFlash from="rgba(224,231,255,0.95)" to="rgba(129,140,248,0.7)" dur={0.8} />
      <Shockwave color="rgba(34,211,238,0.9)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(110,231,183,0.8)" delay={0.15} dur={0.7} max={2.7} />
      <Sparks count={14} radius={130} color="rgba(165,243,252,0.95)" dur={0.8} size={6} />
      <GlyphPop glyph="🎭" color="rgba(129,140,248,0.95)" dur={0.9} />
    </>
  ),
  // FINISHER LAME (Voie Tranchant) — une GRANDE LAME d'acier tranche en diagonale
  // (flash rose, onde, éclats, glyphe ⚔️). La lame qui perce tout.
  "finisher-lame": () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.96)" to="rgba(244,63,94,0.7)" dur={0.7} />
      <motion.div
        initial={{ opacity: 0, x: "-130%" }}
        animate={{ opacity: [0, 1, 1, 0], x: ["-130%", "0%", "12%", "130%"] }}
        transition={{ duration: 0.5, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-56 h-2 -ml-28 -mt-1 origin-center"
        style={{ rotate: "-18deg", background: "linear-gradient(90deg, transparent, #e2e8f0 35%, #ffffff 50%, #fb7185 65%, transparent)" }}
      />
      <Shockwave color="rgba(251,113,133,0.9)" dur={0.6} max={3.4} />
      <Sparks count={12} radius={120} color="rgba(254,205,211,0.95)" dur={0.6} size={6} />
      <GlyphPop glyph="⚔️" color="rgba(244,63,94,0.95)" dur={0.85} />
    </>
  ),
  // ÉBOULIS FINAL (Montagne) — la montagne s'effondre : flash blanc→ardoise,
  // double onde granite + bleu glacier, éclats de pierre, glyphe 🏔️.
  "eboulis-final": () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.95)" to="rgba(148,163,184,0.7)" dur={0.75} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.7} max={3.6} />
      <Shockwave color="rgba(125,211,252,0.8)" delay={0.14} dur={0.7} max={2.8} />
      <Sparks count={16} radius={140} color="rgba(231,229,228,0.95)" dur={0.8} size={7} />
      <Sparks count={8} radius={85} color="rgba(125,211,252,0.85)" dur={0.6} size={6} />
      <GlyphPop glyph="🏔️" color="rgba(148,163,184,0.95)" dur={0.9} />
    </>
  ),
  // DRAIN VITAL (Forêt) — la vie est ASPIRÉE vers le lanceur : particules vertes
  // attirées vers le centre (inward), flash émeraude, onde tardive, glyphe 🩸.
  "drain-vital": () => (
    <>
      <Sparks count={16} radius={150} color="rgba(52,211,153,0.9)" dur={0.7} size={6} inward />
      <CoreFlash from="rgba(167,243,208,0.9)" to="rgba(16,122,87,0.6)" dur={0.7} />
      <Shockwave color="rgba(52,211,153,0.85)" delay={0.3} dur={0.5} max={2.6} />
      <GlyphPop glyph="🩸" color="rgba(52,211,153,0.95)" dur={0.85} />
    </>
  ),
  // COUP DANS L'OMBRE (Mirage) — 3 entailles violet→cyan se croisent en éclair,
  // étincelles cyan à l'impact, glyphe 🌑. L'imblocable qui frappe de partout.
  "coup-dans-lombre": () => (
    <>
      {[-32, 0, 32].map((rot, k) => (
        <motion.div
          key={`slash${k}`}
          initial={{ opacity: 0, x: "-120%" }}
          animate={{ opacity: [0, 1, 1, 0], x: ["-120%", "0%", "10%", "120%"] }}
          transition={{ duration: 0.5, delay: k * 0.08, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-56 h-1.5 origin-center"
          style={{ marginLeft: -112, marginTop: -3, rotate: `${rot}deg`, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.92) 45%, rgba(34,211,238,0.95) 55%, transparent)", boxShadow: "0 0 16px 2px rgba(139,92,246,0.8)" }}
        />
      ))}
      <Sparks count={12} radius={115} color="rgba(34,211,238,0.92)" dur={0.6} size={6} />
      <GlyphPop glyph="🌑" color="rgba(167,139,250,0.95)" dur={0.8} />
    </>
  ),
  // INTRICATION QUANTIQUE (Cosmos) — résonance : double onde violet→cyan,
  // particules aspirées au cœur, flash indigo, glyphe ⚛️.
  "intrication-quantique": () => (
    <>
      <CoreFlash from="rgba(196,181,253,0.9)" to="rgba(124,58,237,0.65)" dur={0.75} />
      <Shockwave color="rgba(139,92,246,0.9)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(34,211,238,0.8)" delay={0.16} dur={0.7} max={2.7} />
      <Sparks count={14} radius={130} color="rgba(196,181,253,0.95)" dur={0.8} size={6} />
      <Sparks count={8} radius={80} color="rgba(165,243,252,0.9)" dur={0.6} size={5} inward />
      <GlyphPop glyph="⚛️" color="rgba(167,139,250,0.95)" dur={0.9} />
    </>
  ),
  // TAILLADE MORTELLE (Tranchant) — UNE grande entaille blanc→rouge sang traverse
  // l'écran en diagonale, onde + gerbe d'étincelles, glyphe ⚡. Le coup fatal.
  "taillade-mortelle": () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.96)" to="rgba(220,38,38,0.7)" dur={0.65} />
      <motion.div
        initial={{ opacity: 0, x: "-130%" }}
        animate={{ opacity: [0, 1, 1, 0], x: ["-130%", "0%", "12%", "130%"] }}
        transition={{ duration: 0.45, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-60 h-2.5 origin-center"
        style={{ marginLeft: -120, marginTop: -5, rotate: "-22deg", background: "linear-gradient(90deg, transparent, #ffffff 45%, #ef4444 60%, transparent)" }}
      />
      <Shockwave color="rgba(239,68,68,0.9)" dur={0.55} max={3.6} />
      <Sparks count={14} radius={130} color="rgba(254,202,202,0.95)" dur={0.6} size={6} />
      <GlyphPop glyph="⚡" color="rgba(239,68,68,0.95)" dur={0.8} />
    </>
  ),
};

/** Liste des sorts qui ONT une signature — exporté pour l'IA/tests éventuels. */
export const SPELLS_WITH_SIGNATURE = Object.keys(SIGNATURES) as CardId[];

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
