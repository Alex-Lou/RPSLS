/**
 * arenaSpellSignaturesMirage — bloc « Voie MIRAGE » de la table SIGNATURES
 * (Dérobade → Apothéose spectrale). Extrait d'arenaSpellSignatures (cap <400
 * lignes/fichier) et ré-étalé À LA MÊME POSITION dans SIGNATURES → ordre des
 * clés (SPELLS_WITH_SIGNATURE) inchangé.
 */

import { motion } from "motion/react";
import type { ReactElement } from "react";
import type { CardId } from "../ranked/rankedTypes";
import { CoreFlash, GlyphPop, Shockwave, Sparks, radial } from "./arenaSpellFXBricks";

export const SIGNATURES_MIRAGE: Partial<Record<CardId, () => ReactElement>> = {
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
};
