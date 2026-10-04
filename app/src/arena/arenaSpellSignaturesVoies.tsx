/**
 * arenaSpellSignaturesVoies — fin de SIGNATURES_EXTRA : nouvelles cartes des
 * Voies MONTAGNE / TRANCHANT / COSMOS (lots 2026-06-30+). Extrait
 * d'arenaSpellSignaturesExtra (cap <400 lignes/fichier) et ré-étalé EN FIN de
 * SIGNATURES_EXTRA → ordre des clés inchangé.
 */

import { motion } from "motion/react";
import type { ReactElement } from "react";
import type { CardId } from "../ranked/rankedTypes";
import { CoreFlash, GlyphPop, Shockwave, Sparks } from "./arenaSpellFXBricks";

export const SIGNATURES_VOIES: Partial<Record<CardId, () => ReactElement>> = {
  /* ── Voie MONTAGNE — nouvelles cartes (Alex 2026-06-30) ── */
  // ÉCRASEMENT TELLURIQUE — la dalle ÉCRASE : flash blanc→ardoise + double onde
  // granite/ambre + éclats de pierre, glyphe 🗿. Le coup de grâce qui perce le mur.
  ecrasement: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.95)" to="rgba(120,113,108,0.7)" dur={0.7} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.7} max={3.6} />
      <Shockwave color="rgba(180,83,9,0.8)" delay={0.14} dur={0.7} max={2.7} />
      <Sparks count={16} radius={140} color="rgba(231,229,228,0.95)" dur={0.75} size={7} />
      <Sparks count={8} radius={85} color="rgba(180,83,9,0.85)" dur={0.6} size={6} />
      <GlyphPop glyph="🗿" color="rgba(180,83,9,0.95)" dur={0.85} />
    </>
  ),
  // GRONDEMENT — la terre TREMBLE : ondes telluriques montantes (granite) + éclats,
  // glyphe 🌋. L'aura sismique qui s'installe.
  grondement: () => (
    <>
      <Shockwave color="rgba(168,162,158,0.9)" dur={0.8} max={3.2} />
      <Shockwave color="rgba(120,113,108,0.8)" delay={0.18} dur={0.8} max={2.5} />
      <Shockwave color="rgba(180,83,9,0.7)" delay={0.36} dur={0.8} max={1.9} />
      <Sparks count={12} radius={120} color="rgba(214,211,209,0.92)" dur={0.7} size={6} />
      <GlyphPop glyph="🌋" color="rgba(180,83,9,0.95)" dur={0.9} />
    </>
  ),
  /* ── Fusions Voie MONTAGNE (Alex 2026-06-30) — chaque fusion = climax ── */
  // AVALANCHE — chute de blocs (était MUETTE) : double onde granite + éclats de
  // pierre qui jaillissent, glyphe 🏔️.
  avalanche: () => (
    <>
      <CoreFlash from="rgba(231,229,228,0.9)" to="rgba(120,113,108,0.65)" dur={0.7} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(148,163,184,0.8)" delay={0.14} dur={0.7} max={2.7} />
      <Sparks count={16} radius={140} color="rgba(231,229,228,0.95)" dur={0.75} size={7} />
      <GlyphPop glyph="🏔️" color="rgba(148,163,184,0.95)" dur={0.85} />
    </>
  ),
  // BASTION — le rempart se dresse : flash blanc→ambre + onde granite + halo de
  // bouclier, glyphe 🏰.
  bastion: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.95)" to="rgba(180,83,9,0.65)" dur={0.75} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(245,158,11,0.8)" delay={0.15} dur={0.7} max={2.6} />
      <Sparks count={12} radius={120} color="rgba(231,229,228,0.92)" dur={0.7} size={6} />
      <GlyphPop glyph="🏰" color="rgba(245,158,11,0.95)" dur={0.85} />
    </>
  ),
  // CITADELLE — la citadelle monte : ondes granite + ambre qui s'élèvent + gerbe
  // dorée, glyphe 🏯. Tout le mur se renforce d'un coup.
  citadelle: () => (
    <>
      <CoreFlash from="rgba(254,243,199,0.9)" to="rgba(180,83,9,0.6)" dur={0.75} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(245,158,11,0.85)" delay={0.16} dur={0.7} max={2.7} />
      <Sparks count={14} radius={130} color="rgba(253,224,71,0.9)" dur={0.7} size={6} />
      <GlyphPop glyph="🏯" color="rgba(245,158,11,0.95)" dur={0.9} />
    </>
  ),
  // CATACLYSME — l'apex granite (légendaire) : grand flash + TRIPLE onde granite/
  // ardoise/ambre + nuée d'éclats, glyphe ⛰️. Le coup de grâce de la montagne.
  cataclysme: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.96)" to="rgba(120,113,108,0.7)" dur={0.95} />
      <Shockwave color="rgba(214,211,209,0.95)" dur={0.9} max={4.2} />
      <Shockwave color="rgba(148,163,184,0.85)" delay={0.14} dur={0.9} max={3.4} />
      <Shockwave color="rgba(180,83,9,0.8)" delay={0.28} dur={0.9} max={2.6} />
      <Sparks count={20} radius={165} color="rgba(231,229,228,0.95)" dur={0.9} size={7} />
      <Sparks count={12} radius={95} color="rgba(180,83,9,0.9)" dur={0.7} size={6} />
      <GlyphPop glyph="⛰️" color="rgba(180,83,9,0.95)" dur={1} />
    </>
  ),
  /* ── Fusions Voie TRANCHANT (Alex 2026-06-30) — acier froid + rose-cardinal ── */
  // FRAPPE PARFAITE (était MUETTE) — LA frappe précise : un trait de lame net
  // blanc→rose qui fend en diagonale + flash + étincelles, glyphe 🎯.
  "frappe-parfaite": () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.96)" to="rgba(244,63,94,0.7)" dur={0.6} />
      <motion.div
        initial={{ opacity: 0, x: "-120%" }}
        animate={{ opacity: [0, 1, 1, 0], x: ["-120%", "0%", "8%", "120%"] }}
        transition={{ duration: 0.45, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-56 h-1.5 -ml-28 -mt-1 origin-center"
        style={{ rotate: "-20deg", background: "linear-gradient(90deg, transparent, #ffffff 45%, #fb7185 60%, transparent)" }}
      />
      <Sparks count={10} radius={100} color="rgba(254,205,211,0.95)" dur={0.5} size={6} />
      <GlyphPop glyph="🎯" color="rgba(244,63,94,0.95)" dur={0.75} />
    </>
  ),
  // ESTOCADE — la VOLÉE d'estoc : 3 entailles acier→rose qui se croisent board-wide
  // + flash + gerbe, glyphe ⚔️. Toutes les lames percent à la fois.
  estocade: () => (
    <>
      {[-28, 0, 28].map((rot, k) => (
        <motion.div
          key={`es${k}`}
          initial={{ opacity: 0, x: "-120%" }}
          animate={{ opacity: [0, 1, 1, 0], x: ["-120%", "0%", "10%", "120%"] }}
          transition={{ duration: 0.5, delay: k * 0.07, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-56 h-1.5 origin-center"
          style={{ marginLeft: -112, marginTop: -3, rotate: `${rot}deg`, background: "linear-gradient(90deg, transparent, #e2e8f0 40%, #fb7185 60%, transparent)", boxShadow: "0 0 12px 1px rgba(244,63,94,0.7)" }}
        />
      ))}
      <CoreFlash from="rgba(255,255,255,0.92)" to="rgba(244,63,94,0.65)" dur={0.6} />
      <Sparks count={12} radius={120} color="rgba(254,205,211,0.95)" dur={0.6} size={6} />
      <GlyphPop glyph="⚔️" color="rgba(244,63,94,0.95)" dur={0.85} />
    </>
  ),
  /* ══════════ Voie COSMOS — loi-de-causalité + fusion Effacement (Alex 2026-06-30) ══════════ */
  // LOI DE CAUSALITÉ (fige une créature adverse) — le temps se SUSPEND : double anneau
  // temporel indigo/cyan + particules aspirées, glyphe ⏱️. Équité : l'adversaire VOIT le gel.
  "loi-de-causalite": () => (
    <>
      <Shockwave color="rgba(129,140,248,0.8)" dur={0.75} max={3} />
      <Shockwave color="rgba(34,211,238,0.7)" delay={0.18} dur={0.75} max={2.3} />
      <Sparks count={9} radius={85} color="rgba(196,181,253,0.85)" dur={0.7} size={5} inward />
      <GlyphPop glyph="⏱️" color="rgba(129,140,248,0.95)" dur={0.9} />
    </>
  ),
  // EFFACEMENT (fusion : efface 1 créature adverse + fige le reste) — un VIDE d'encre
  // cosmique engloutit le board adverse : particules avalées, flash indigo→nuit, vortex
  // aspirant, onde tardive, glyphe ⬛. Le contrôle total.
  effacement: () => (
    <>
      <Sparks count={18} radius={155} color="rgba(167,139,250,0.9)" dur={0.7} size={6} inward />
      <CoreFlash from="rgba(196,181,253,0.9)" to="rgba(30,27,75,0.85)" dur={0.85} />
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1.2, 0.5] }}
        transition={{ duration: 0.8, ease: "easeIn" }}
        className="absolute left-1/2 top-1/2 w-24 h-24 -ml-12 -mt-12 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(10,8,30,0.95) 50%, rgba(124,58,237,0.6) 72%, transparent 80%)", boxShadow: "0 0 30px 6px rgba(124,58,237,0.6)" }}
      />
      <Shockwave color="rgba(139,92,246,0.85)" delay={0.4} dur={0.5} max={2.6} />
      <GlyphPop glyph="⬛" color="rgba(167,139,250,0.95)" dur={0.85} />
    </>
  ),
};
