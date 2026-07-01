/**
 * arenaSpellSignatures — INDEX de la table SIGNATURES (signatures VFX plein-board,
 * extrait d'ArenaSpellFX 2026-06-30 ; règle archi <450 lignes). 1re moitié des
 * signatures ICI + 2e moitié dans arenaSpellSignaturesExtra (fusionnées). Les
 * briques visuelles vivent dans arenaSpellFXBricks. Le composant ArenaSpellFX
 * consomme SIGNATURES + SPELLS_WITH_SIGNATURE.
 *
 * Extensible : ajoute une entrée → le sort gagne son moment plein écran (le
 * résolveur émet le spotlight pour toute carte de SPELLS_WITH_SIGNATURE). Réservé
 * aux effets SPECTACULAIRES (légendaires, finishers, gros sorts) — pas les
 * utilitaires discrets (regarder des cartes…) pour éviter le bruit visuel.
 * Anti-fuite : aucune signature n'utilise repeat:Infinity (AnimatePresence + hold).
 */

import { motion } from "motion/react";
import type { ReactElement } from "react";
import type { CardId } from "../ranked/rankedTypes";
import { CoreFlash, GlyphPop, Shockwave, Sparks, radial } from "./arenaSpellFXBricks";
import { SIGNATURES_EXTRA } from "./arenaSpellSignaturesExtra";

/* ─── SIGNATURES par sort (1re moitié ; 2e dans …Extra, fusionnée plus bas) ─── */
export const SIGNATURES: Partial<Record<CardId, () => ReactElement>> = {
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
  /* ══════════ Voie MIRAGE — nouvelles cartes (Alex 2026-06-29) ══════════ */
  // DÉROBADE — esquive SPATIALE : traits de déplacement latéral teal→cyan + brume.
  derobade: () => (
    <>
      {[-18, 0, 18].map((dy, k) => (
        <motion.div
          key={`dr${k}`}
          initial={{ opacity: 0, x: -64, scaleX: 0.4 }}
          animate={{ opacity: [0, 0.85, 0], x: 84, scaleX: 1.1 }}
          transition={{ duration: 0.5, delay: k * 0.05, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 h-1 w-32 -ml-16 rounded-full"
          style={{ marginTop: dy, background: "linear-gradient(to right, transparent, rgba(45,212,191,0.9) 40%, rgba(34,211,238,0.7), transparent)" }}
        />
      ))}
      <Sparks count={8} radius={90} color="rgba(94,234,212,0.85)" dur={0.5} size={5} />
      <GlyphPop glyph="🌫️" color="rgba(45,212,191,0.95)" dur={0.7} />
    </>
  ),
  // FRAPPE SPECTRALE — une griffe-fantôme glacée fend en diagonale + flash + étincelles.
  "frappe-spectrale": () => (
    <>
      <motion.div
        initial={{ opacity: 0, x: "-120%" }}
        animate={{ opacity: [0, 1, 1, 0], x: ["-120%", "0%", "8%", "120%"] }}
        transition={{ duration: 0.45, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-56 h-1.5 origin-center"
        style={{ marginLeft: -112, marginTop: -3, rotate: "-24deg", background: "linear-gradient(90deg, transparent, rgba(165,243,252,0.95) 45%, rgba(34,211,238,0.95) 60%, transparent)", boxShadow: "0 0 16px 2px rgba(34,211,238,0.8)" }}
      />
      <CoreFlash from="rgba(224,242,254,0.9)" to="rgba(34,211,238,0.55)" dur={0.55} />
      <Sparks count={10} radius={100} color="rgba(165,243,252,0.95)" dur={0.5} size={6} />
      <GlyphPop glyph="👻" color="rgba(125,211,252,0.95)" dur={0.7} />
    </>
  ),
  // SILLAGE SPECTRAL — aura : ondes douces concentriques + particules vers le cœur.
  "sillage-spectral": () => (
    <>
      <Shockwave color="rgba(129,140,248,0.7)" dur={0.85} max={2.8} />
      <Shockwave color="rgba(167,139,250,0.6)" delay={0.2} dur={0.85} max={2.2} />
      <Shockwave color="rgba(196,181,253,0.5)" delay={0.4} dur={0.85} max={1.7} />
      <Sparks count={10} radius={80} color="rgba(196,181,253,0.85)" dur={0.8} size={5} inward />
      <GlyphPop glyph="🌀" color="rgba(167,139,250,0.95)" dur={0.95} />
    </>
  ),
  // FAUX-SEMBLANT — illusion offensive : ondulation violet→magenta + leurre.
  "faux-semblant": () => (
    <>
      <CoreFlash from="rgba(240,171,252,0.85)" to="rgba(124,58,237,0.6)" dur={0.7} />
      <Shockwave color="rgba(217,70,239,0.85)" dur={0.65} max={3} />
      <Shockwave color="rgba(139,92,246,0.7)" delay={0.16} dur={0.65} max={2.4} />
      <Sparks count={12} radius={110} color="rgba(240,171,252,0.9)" dur={0.7} size={6} />
      <GlyphPop glyph="🃏" color="rgba(217,70,239,0.95)" dur={0.85} />
    </>
  ),
  // NUÉE SPECTRALE — une nuée de traits convergent vers le bas (le héros) + or légendaire.
  "nuee-spectrale": () => (
    <>
      {radial(9, 130).map((p, i) => (
        <motion.div
          key={`nu${i}`}
          initial={{ opacity: 0, x: p.x, y: p.y - 20, scaleX: 0.5 }}
          animate={{ opacity: [0, 0.9, 0], x: 0, y: 38, scaleX: 1 }}
          transition={{ duration: 0.6, delay: (i % 5) * 0.04, ease: "easeIn" }}
          className="absolute left-1/2 top-1/2 h-1 w-16 -ml-8 rounded-full"
          style={{ rotate: `${p.deg}deg`, background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.9), transparent)" }}
        />
      ))}
      <CoreFlash from="rgba(199,210,254,0.9)" to="rgba(34,211,238,0.6)" dur={0.7} />
      <Sparks count={10} radius={110} color="rgba(252,211,77,0.85)" dur={0.6} size={5} />
      <GlyphPop glyph="🌠" color="rgba(129,140,248,0.95)" dur={0.85} />
    </>
  ),
  // ÉCLIPSE — disque sombre qui éclipse, fin liseré cyan, particules aspirées.
  eclipse: () => (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.95, 0.9, 0], scale: [0.2, 1.1, 1.0, 1.35] }}
        transition={{ duration: 0.9, times: [0, 0.3, 0.7, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-28 h-28 -ml-14 -mt-14 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(8,5,25,0.96) 55%, rgba(34,211,238,0.6) 70%, transparent 78%)", boxShadow: "0 0 26px 4px rgba(34,211,238,0.5)" }}
      />
      <Shockwave color="rgba(34,211,238,0.7)" dur={0.7} max={2.6} />
      <Sparks count={9} radius={90} color="rgba(165,243,252,0.85)" dur={0.7} size={5} inward />
      <GlyphPop glyph="🌘" color="rgba(125,211,252,0.95)" dur={0.8} />
    </>
  ),
  /* ── Fusions Mirage ── */
  // GALERIE DES GLACES — reflets en miroir qui se démultiplient latéralement, prismatique.
  "galerie-des-glaces": () => (
    <>
      {[-2, -1, 1, 2].map((m, k) => (
        <motion.div
          key={`gg${k}`}
          initial={{ opacity: 0, scaleX: 0.3, x: 0 }}
          animate={{ opacity: [0, 0.8, 0], scaleX: 1, x: m * 40 }}
          transition={{ duration: 0.7, delay: Math.abs(m) * 0.06, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-10 h-24 -ml-5 -mt-12 rounded-md"
          style={{ background: "linear-gradient(180deg, rgba(165,243,252,0.5), rgba(129,140,248,0.3))", border: "1px solid rgba(224,242,254,0.6)", boxShadow: "0 0 12px rgba(34,211,238,0.6)" }}
        />
      ))}
      <CoreFlash from="rgba(224,242,254,0.85)" to="rgba(34,211,238,0.5)" dur={0.65} />
      <Sparks count={12} radius={120} color="rgba(165,243,252,0.9)" dur={0.6} size={5} />
      <GlyphPop glyph="🪞" color="rgba(125,211,252,0.95)" dur={0.8} />
    </>
  ),
  // MASCARADE SOUVERAINE — masque royal : flash or→violet, double onde, gerbe dorée.
  "mascarade-souveraine": () => (
    <>
      <CoreFlash from="rgba(252,211,77,0.85)" to="rgba(124,58,237,0.6)" dur={0.7} />
      <Shockwave color="rgba(245,158,11,0.85)" dur={0.65} max={3.2} />
      <Shockwave color="rgba(139,92,246,0.75)" delay={0.16} dur={0.65} max={2.5} />
      <Sparks count={14} radius={125} color="rgba(253,224,71,0.9)" dur={0.7} size={6} />
      <GlyphPop glyph="👑" color="rgba(245,158,11,0.95)" dur={0.9} />
    </>
  ),
  // APOTHÉOSE SPECTRALE — l'apex légendaire : grand flash + TRIPLE onde indigo/cyan/or + nuée.
  "apotheose-spectrale": () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.96)" to="rgba(129,140,248,0.7)" dur={0.95} />
      <Shockwave color="rgba(34,211,238,0.95)" dur={0.9} max={4.2} />
      <Shockwave color="rgba(167,139,250,0.85)" delay={0.14} dur={0.9} max={3.4} />
      <Shockwave color="rgba(252,211,77,0.8)" delay={0.28} dur={0.9} max={2.6} />
      <Sparks count={20} radius={165} color="rgba(199,210,254,0.95)" dur={0.9} size={7} />
      <Sparks count={12} radius={95} color="rgba(253,224,71,0.9)" dur={0.7} size={6} />
      <GlyphPop glyph="🌟" color="rgba(129,140,248,0.95)" dur={1} />
    </>
  ),
  /* ── Phénix (renaissance) — flamme d'or qui jaillit (cast) ── */
  phenix: () => (
    <>
      <CoreFlash from="rgba(255,237,213,0.95)" to="rgba(249,115,22,0.7)" dur={0.8} />
      <Shockwave color="rgba(251,146,60,0.9)" dur={0.7} max={3.2} />
      <Sparks count={16} radius={140} color="rgba(254,215,170,0.95)" dur={0.8} size={6} />
      <Sparks count={8} radius={80} color="rgba(252,211,77,0.9)" dur={0.6} size={5} />
      <GlyphPop glyph="🔥" color="rgba(249,115,22,0.95)" dur={0.9} />
    </>
  ),
  /* ══════════ Voie FORÊT — fusions + ramure (Alex 2026-06-30, passe nerf/parité) ══════════ */
  // SOURCE VITALE (fusion : +3 créature ET +3 héros) — double sève : flash émeraude,
  // double onde verte/teal, pousses montantes, glyphe 💞. Climax de fusion (était muette).
  "source-vitale": () => (
    <>
      <CoreFlash from="rgba(167,243,208,0.92)" to="rgba(16,122,87,0.6)" dur={0.8} />
      <Shockwave color="rgba(52,211,153,0.9)" dur={0.7} max={3.2} />
      <Shockwave color="rgba(45,212,191,0.8)" delay={0.16} dur={0.7} max={2.5} />
      <Sparks count={14} radius={125} color="rgba(167,243,208,0.95)" dur={0.8} size={6} />
      <GlyphPop glyph="💞" color="rgba(52,211,153,0.95)" dur={0.9} />
    </>
  ),
  // BOSQUET ÉPINEUX (fusion : gardien épineux riposte+bouclier+croissance) — des ronces
  // JAILLISSENT en couronne : flash émeraude, onde verte, traits-épines radiaux, glyphe 🌿.
  "bosquet-epineux": () => (
    <>
      <CoreFlash from="rgba(187,247,208,0.9)" to="rgba(21,128,61,0.6)" dur={0.75} />
      <Shockwave color="rgba(34,197,94,0.9)" dur={0.7} max={3.2} />
      {radial(10, 120).map((p, i) => (
        <motion.div
          key={`th${i}`}
          initial={{ opacity: 0, x: 0, y: 0, scaleX: 0.3 }}
          animate={{ opacity: [0, 0.9, 0], x: p.x, y: p.y, scaleX: 1 }}
          transition={{ duration: 0.6, delay: (i % 5) * 0.04, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 h-1 w-12 -ml-6 rounded-full"
          style={{ rotate: `${p.deg}deg`, background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.9), transparent)" }}
        />
      ))}
      <GlyphPop glyph="🌿" color="rgba(34,197,94,0.95)" dur={0.85} />
    </>
  ),
  // RAMURE (bouclier à TOUT mon board) — la forêt se SCELLE : triple onde émeraude
  // concentrique DOUCE (pas de CoreFlash, reste sous le niveau légendaire) + glyphe 🛡️.
  // Lisibilité-équité : l'adversaire voit la forteresse se verrouiller.
  ramure: () => (
    <>
      <Shockwave color="rgba(52,211,153,0.7)" dur={0.85} max={3} />
      <Shockwave color="rgba(16,185,129,0.6)" delay={0.18} dur={0.85} max={2.4} />
      <Shockwave color="rgba(110,231,183,0.5)" delay={0.36} dur={0.85} max={1.8} />
      <Sparks count={10} radius={95} color="rgba(167,243,208,0.85)" dur={0.8} size={5} />
      <GlyphPop glyph="🛡️" color="rgba(52,211,153,0.95)" dur={0.95} />
    </>
  ),
  ...SIGNATURES_EXTRA,
};

/** Liste des sorts qui ONT une signature — exporté pour l'IA/tests éventuels. */
export const SPELLS_WITH_SIGNATURE = Object.keys(SIGNATURES) as CardId[];
