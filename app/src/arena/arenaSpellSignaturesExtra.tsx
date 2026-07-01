/**
 * arenaSpellSignaturesExtra — 2e moitié de la table SIGNATURES (finishers
 * restants + légendaires + épiques/fusions, lots 2026-06-30). Fusionnée dans
 * SIGNATURES par arenaSpellSignatures. Séparée pour tenir <450 lignes/fichier.
 */

import { motion } from "motion/react";
import type { ReactElement } from "react";
import type { CardId } from "../ranked/rankedTypes";
import { CoreFlash, GlyphPop, Shockwave, Sparks } from "./arenaSpellFXBricks";

export const SIGNATURES_EXTRA: Partial<Record<CardId, () => ReactElement>> = {
  /* ══════ FINISHERS restants + LÉGENDAIRES sans signature (Alex 2026-06-30) :
   *  « chaque finisher ET chaque légendaire a son climax plein écran ». ══════ */
  // FINISHER VERGER (Voie Forêt) — l'orchard éternel FLEURIT : flash émeraude,
  // double onde vert→lime, gerbe de pousses, glyphe 🌳. La vie qui ne tarit jamais.
  "finisher-verger": () => (
    <>
      <CoreFlash from="rgba(187,247,208,0.95)" to="rgba(5,150,105,0.65)" dur={0.85} />
      <Shockwave color="rgba(52,211,153,0.92)" dur={0.75} max={3.6} />
      <Shockwave color="rgba(132,204,22,0.8)" delay={0.15} dur={0.75} max={2.8} />
      <Sparks count={16} radius={140} color="rgba(167,243,208,0.95)" dur={0.85} size={7} />
      <Sparks count={9} radius={85} color="rgba(190,242,100,0.9)" dur={0.65} size={5} />
      <GlyphPop glyph="🌳" color="rgba(52,211,153,0.95)" dur={0.95} />
    </>
  ),
  // FINISHER CALCUL (Voie Cosmos) — le Grand Calcul CONVERGE : flash indigo, double
  // onde indigo→cyan, particules aspirées au cœur (la résolution), glyphe 🖖.
  "finisher-calcul": () => (
    <>
      <CoreFlash from="rgba(199,210,254,0.92)" to="rgba(67,56,202,0.65)" dur={0.8} />
      <Shockwave color="rgba(129,140,248,0.9)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(34,211,238,0.8)" delay={0.15} dur={0.7} max={2.7} />
      <Sparks count={16} radius={150} color="rgba(165,180,252,0.92)" dur={0.7} size={6} inward />
      <Sparks count={10} radius={90} color="rgba(165,243,252,0.9)" dur={0.6} size={5} />
      <GlyphPop glyph="🖖" color="rgba(129,140,248,0.95)" dur={0.9} />
    </>
  ),
  // RAZZIA (légendaire) — le raid : éclats fuchsia ASPIRÉS au centre (le butin happé)
  // + flash magenta + onde tardive, glyphe 🗝️.
  razzia: () => (
    <>
      <Sparks count={14} radius={140} color="rgba(240,171,252,0.92)" dur={0.7} size={6} inward />
      <CoreFlash from="rgba(245,208,254,0.88)" to="rgba(192,38,211,0.6)" dur={0.7} />
      <Shockwave color="rgba(217,70,239,0.88)" delay={0.28} dur={0.5} max={2.8} />
      <GlyphPop glyph="🗝️" color="rgba(217,70,239,0.95)" dur={0.85} />
    </>
  ),
  // TRINITÉ (légendaire) — TRIPLE onde or concentrique + flash ambre + gerbe dorée, 🔱.
  trinite: () => (
    <>
      <CoreFlash from="rgba(254,243,199,0.92)" to="rgba(245,158,11,0.65)" dur={0.8} />
      <Shockwave color="rgba(252,211,77,0.9)" dur={0.7} max={3.6} />
      <Shockwave color="rgba(245,158,11,0.8)" delay={0.15} dur={0.7} max={2.8} />
      <Shockwave color="rgba(217,119,6,0.7)" delay={0.3} dur={0.7} max={2.1} />
      <Sparks count={12} radius={120} color="rgba(253,224,71,0.95)" dur={0.7} size={6} />
      <GlyphPop glyph="🔱" color="rgba(245,158,11,0.95)" dur={0.9} />
    </>
  ),
  // SCHRÖDINGER (légendaire) — superposition : la boîte se DÉDOUBLE en deux états
  // fantômes (cyan / fuchsia) qui s'écartent, flash violet, glyphe 📦.
  schrodinger: () => (
    <>
      {[-1, 1].map((m, k) => (
        <motion.div
          key={`sc${k}`}
          initial={{ opacity: 0, x: 0, scale: 0.6 }}
          animate={{ opacity: [0, 0.7, 0], x: m * 50, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-12 h-14 -ml-6 -mt-7 rounded-md"
          style={{ background: m > 0 ? "rgba(34,211,238,0.4)" : "rgba(217,70,239,0.4)", border: "1px solid rgba(224,242,254,0.6)", boxShadow: `0 0 14px ${m > 0 ? "rgba(34,211,238,0.6)" : "rgba(217,70,239,0.6)"}` }}
        />
      ))}
      <CoreFlash from="rgba(240,171,252,0.85)" to="rgba(124,58,237,0.55)" dur={0.7} />
      <Sparks count={12} radius={110} color="rgba(216,180,254,0.9)" dur={0.6} size={5} />
      <GlyphPop glyph="📦" color="rgba(217,70,239,0.95)" dur={0.85} />
    </>
  ),
  // JUGE (légendaire Cosmos) — le verdict tombe : flash blanc→or, onde or + onde
  // cosmique indigo, gerbe dorée, glyphe ⚖️.
  juge: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.95)" to="rgba(250,204,21,0.65)" dur={0.75} />
      <Shockwave color="rgba(253,224,71,0.9)" dur={0.7} max={3.4} />
      <Shockwave color="rgba(165,180,252,0.7)" delay={0.16} dur={0.7} max={2.7} />
      <Sparks count={14} radius={130} color="rgba(254,240,138,0.95)" dur={0.8} size={6} />
      <GlyphPop glyph="⚖️" color="rgba(250,204,21,0.95)" dur={0.9} />
    </>
  ),
  // ROUE DU DESTIN (légendaire) — la roue TOURNE : disque conique multicolore en
  // rotation + onde rose + gerbe, glyphe 🎡.
  "roue-destin": () => (
    <>
      <motion.div
        initial={{ opacity: 0, rotate: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.9, 0.9, 0], rotate: 540, scale: [0.4, 1.3, 1.3, 1.5] }}
        transition={{ duration: 0.95, times: [0, 0.25, 0.75, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
        style={{ background: "conic-gradient(from 0deg, rgba(244,63,94,0.85), rgba(250,204,21,0.8), rgba(34,211,238,0.8), rgba(167,139,250,0.85), rgba(244,63,94,0.85))", mixBlendMode: "screen" }}
      />
      <Shockwave color="rgba(251,113,133,0.9)" dur={0.7} max={3.2} />
      <Sparks count={14} radius={130} color="rgba(254,205,211,0.92)" dur={0.7} size={6} />
      <GlyphPop glyph="🎡" color="rgba(244,63,94,0.95)" dur={0.9} />
    </>
  ),
  // SINGULARITÉ (légendaire Cosmos) — effondrement : tout est ASPIRÉ, cœur noir qui
  // implose puis rebond indigo, glyphe 🌀.
  singularite: () => (
    <>
      <Sparks count={20} radius={165} color="rgba(165,180,252,0.9)" dur={0.7} size={6} inward />
      <motion.div
        initial={{ opacity: 0, scale: 1.8 }}
        animate={{ opacity: [0, 0.9, 0], scale: [1.8, 0.25, 0.1] }}
        transition={{ duration: 0.65, ease: "easeIn" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.9) 0%, rgba(15,12,41,0.95) 55%, transparent 75%)", mixBlendMode: "screen" }}
      />
      <Shockwave color="rgba(129,140,248,0.9)" delay={0.55} dur={0.5} max={3} />
      <GlyphPop glyph="🌀" color="rgba(129,140,248,0.95)" dur={0.9} />
    </>
  ),
  // IMPOSTEUR (fusion légendaire Mirage) — le masque se RÉVÈLE : flash violet, double
  // onde violet→fuchsia, gerbe, glyphe 🎭 (l'apex de Faux-Semblant).
  imposteur: () => (
    <>
      <CoreFlash from="rgba(221,214,254,0.9)" to="rgba(124,58,237,0.6)" dur={0.75} />
      <Shockwave color="rgba(167,139,250,0.9)" dur={0.7} max={3.3} />
      <Shockwave color="rgba(217,70,239,0.8)" delay={0.16} dur={0.7} max={2.6} />
      <Sparks count={14} radius={125} color="rgba(216,180,254,0.92)" dur={0.7} size={6} />
      <GlyphPop glyph="🎭" color="rgba(167,139,250,0.95)" dur={0.9} />
    </>
  ),
  /* ══════ LOT 2 — ÉPIQUES + fusions sans signature (Alex 2026-06-30). Écartés :
   *  Oracle/Télépathie (regarder des cartes = info) ; Trèfle/Sursaut (1-coût
   *  fréquents → bruit). Toutes les FUSIONS incluses (climax crafté). ══════ */
  // HEIST — le braquage : flash orange, butin ASPIRÉ au centre, onde, glyphe 🏴‍☠️.
  heist: () => (
    <>
      <CoreFlash from="rgba(254,215,170,0.9)" to="rgba(234,88,12,0.6)" dur={0.6} />
      <Sparks count={12} radius={120} color="rgba(251,146,60,0.92)" dur={0.6} size={6} inward />
      <Shockwave color="rgba(249,115,22,0.85)" dur={0.55} max={3} />
      <GlyphPop glyph="🏴‍☠️" color="rgba(249,115,22,0.95)" dur={0.8} />
    </>
  ),
  // RAPPEL — la créature est happée hors du board : volute violette vers le cœur, ↩️.
  rappel: () => (
    <>
      <Sparks count={12} radius={120} color="rgba(196,181,253,0.9)" dur={0.6} size={5} inward />
      <CoreFlash from="rgba(221,214,254,0.85)" to="rgba(124,58,237,0.55)" dur={0.6} />
      <GlyphPop glyph="↩️" color="rgba(167,139,250,0.95)" dur={0.8} />
    </>
  ),
  // DOUBLE-MOT — surcharge de puissance : double onde azur + flash, glyphe 📜.
  "double-mot": () => (
    <>
      <CoreFlash from="rgba(186,230,253,0.9)" to="rgba(2,132,199,0.55)" dur={0.6} />
      <Shockwave color="rgba(56,189,248,0.9)" dur={0.6} max={3} />
      <Shockwave color="rgba(125,211,252,0.8)" delay={0.14} dur={0.6} max={2.4} />
      <Sparks count={12} radius={115} color="rgba(186,230,253,0.92)" dur={0.6} size={6} />
      <GlyphPop glyph="📜" color="rgba(56,189,248,0.95)" dur={0.8} />
    </>
  ),
  // CHRONOMANCIEN — ondulation temporelle : TRIPLE onde indigo + flash, glyphe ⏳.
  chronomancien: () => (
    <>
      <Shockwave color="rgba(129,140,248,0.85)" dur={0.7} max={3.2} />
      <Shockwave color="rgba(165,180,252,0.75)" delay={0.16} dur={0.7} max={2.5} />
      <Shockwave color="rgba(199,210,254,0.65)" delay={0.32} dur={0.7} max={1.9} />
      <CoreFlash from="rgba(224,231,255,0.85)" to="rgba(99,102,241,0.55)" dur={0.65} />
      <GlyphPop glyph="⏳" color="rgba(129,140,248,0.95)" dur={0.9} />
    </>
  ),
  // TIDE — la grande vague : flash cyan + double onde, gerbe d'écume, glyphe 🌊.
  tide: () => (
    <>
      <CoreFlash from="rgba(207,250,254,0.9)" to="rgba(8,145,178,0.6)" dur={0.7} />
      <Shockwave color="rgba(34,211,238,0.9)" dur={0.7} max={3.6} />
      <Shockwave color="rgba(103,232,249,0.8)" delay={0.15} dur={0.7} max={2.8} />
      <Sparks count={14} radius={135} color="rgba(165,243,252,0.92)" dur={0.7} size={6} />
      <GlyphPop glyph="🌊" color="rgba(34,211,238,0.95)" dur={0.85} />
    </>
  ),
  // VORTEX — tourbillon qui fait pivoter le board : disque conique indigo en rotation
  // + particules aspirées, glyphe 🌪️.
  vortex: () => (
    <>
      <motion.div
        initial={{ opacity: 0, rotate: 0, scale: 1.6 }}
        animate={{ opacity: [0, 0.9, 0], rotate: 300, scale: [1.6, 0.6, 1.2] }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="absolute left-1/2 top-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full"
        style={{ background: "conic-gradient(from 0deg, transparent, rgba(129,140,248,0.85), transparent, rgba(99,102,241,0.7), transparent)", mixBlendMode: "screen" }}
      />
      <Sparks count={14} radius={140} color="rgba(165,180,252,0.9)" dur={0.65} size={6} inward />
      <GlyphPop glyph="🌪️" color="rgba(129,140,248,0.95)" dur={0.85} />
    </>
  ),
  // GAMBIT — coup de dés : flash rose + onde + gerbe, glyphe 🎲.
  gambit: () => (
    <>
      <CoreFlash from="rgba(254,205,211,0.88)" to="rgba(225,29,72,0.55)" dur={0.6} />
      <Shockwave color="rgba(251,113,133,0.88)" dur={0.6} max={3.2} />
      <Sparks count={12} radius={120} color="rgba(254,205,211,0.92)" dur={0.6} size={6} />
      <GlyphPop glyph="🎲" color="rgba(244,63,94,0.95)" dur={0.8} />
    </>
  ),
  // MÉTAMORPHOSE (épique) — éclosion : flash émeraude + double onde, gerbe, glyphe 🦋.
  metamorphose: () => (
    <>
      <CoreFlash from="rgba(187,247,208,0.9)" to="rgba(16,185,129,0.6)" dur={0.7} />
      <Shockwave color="rgba(52,211,153,0.9)" dur={0.65} max={3.2} />
      <Shockwave color="rgba(110,231,183,0.8)" delay={0.15} dur={0.65} max={2.5} />
      <Sparks count={12} radius={120} color="rgba(167,243,208,0.92)" dur={0.7} size={6} />
      <GlyphPop glyph="🦋" color="rgba(52,211,153,0.95)" dur={0.85} />
    </>
  ),
  // MARCHAND D'ÂMES — pacte sombre : les âmes (rose) ASPIRÉES au centre + flash
  // cramoisi + onde tardive, glyphe 💀.
  "marchand-ames": () => (
    <>
      <Sparks count={14} radius={135} color="rgba(251,113,133,0.9)" dur={0.7} size={6} inward />
      <CoreFlash from="rgba(254,205,211,0.85)" to="rgba(159,18,57,0.6)" dur={0.7} />
      <Shockwave color="rgba(225,29,72,0.85)" delay={0.3} dur={0.5} max={2.6} />
      <GlyphPop glyph="💀" color="rgba(244,63,94,0.95)" dur={0.85} />
    </>
  ),
  // BÉNÉDICTION — grâce dorée : flash blanc→or + onde + rayons (gerbe), glyphe ✨.
  benediction: () => (
    <>
      <CoreFlash from="rgba(255,255,255,0.92)" to="rgba(250,204,21,0.6)" dur={0.75} />
      <Shockwave color="rgba(253,224,71,0.9)" dur={0.7} max={3.4} />
      <Sparks count={16} radius={140} color="rgba(254,240,138,0.95)" dur={0.8} size={6} />
      <GlyphPop glyph="✨" color="rgba(250,204,21,0.95)" dur={0.9} />
    </>
  ),
  // VEINE GAÏA — la terre soigne : flash émeraude + gerbe de pousses + onde, glyphe 💚.
  "veine-gaia": () => (
    <>
      <CoreFlash from="rgba(187,247,208,0.9)" to="rgba(5,150,105,0.6)" dur={0.7} />
      <Sparks count={14} radius={130} color="rgba(167,243,208,0.92)" dur={0.75} size={6} />
      <Shockwave color="rgba(52,211,153,0.85)" dur={0.65} max={3} />
      <GlyphPop glyph="💚" color="rgba(52,211,153,0.95)" dur={0.85} />
    </>
  ),
  // CONVERGENCE COSMIQUE — l'inévitable converge : particules aspirées au cœur +
  // flash indigo + onde tardive, glyphe ☄️.
  "convergence-cosmique": () => (
    <>
      <Sparks count={18} radius={160} color="rgba(165,180,252,0.9)" dur={0.7} size={6} inward />
      <CoreFlash from="rgba(199,210,254,0.9)" to="rgba(67,56,202,0.6)" dur={0.75} />
      <Shockwave color="rgba(129,140,248,0.9)" delay={0.35} dur={0.5} max={2.8} />
      <GlyphPop glyph="☄️" color="rgba(129,140,248,0.95)" dur={0.85} />
    </>
  ),
  // DOPPELGÄNGER — dédoublement : deux copies azur s'écartent + flash, glyphe 👥.
  doppelganger: () => (
    <>
      {[-1, 1].map((m, k) => (
        <motion.div
          key={`dg${k}`}
          initial={{ opacity: 0, x: 0, scale: 0.7 }}
          animate={{ opacity: [0, 0.7, 0], x: m * 46, scale: 1 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-12 h-16 -ml-6 -mt-8 rounded-md"
          style={{ background: "rgba(56,189,248,0.4)", border: "1px solid rgba(186,230,253,0.6)", boxShadow: "0 0 14px rgba(56,189,248,0.6)" }}
        />
      ))}
      <CoreFlash from="rgba(186,230,253,0.85)" to="rgba(2,132,199,0.5)" dur={0.6} />
      <Sparks count={10} radius={105} color="rgba(186,230,253,0.9)" dur={0.55} size={5} />
      <GlyphPop glyph="👥" color="rgba(56,189,248,0.95)" dur={0.8} />
    </>
  ),
  // PURGE — vague de dissipation : flash ambre + onde + gerbe nettoyante, glyphe 🧹.
  purge: () => (
    <>
      <CoreFlash from="rgba(254,243,199,0.88)" to="rgba(217,119,6,0.55)" dur={0.6} />
      <Shockwave color="rgba(251,191,36,0.9)" dur={0.6} max={3.4} />
      <Sparks count={14} radius={135} color="rgba(254,240,138,0.92)" dur={0.65} size={6} />
      <GlyphPop glyph="🧹" color="rgba(245,158,11,0.95)" dur={0.8} />
    </>
  ),
  /* ── Fusions épiques ── */
  // COCON — carapace protectrice : flash lime + double onde + gerbe, glyphe 🛡.
  cocon: () => (
    <>
      <CoreFlash from="rgba(217,249,157,0.9)" to="rgba(101,163,13,0.55)" dur={0.7} />
      <Shockwave color="rgba(163,230,53,0.88)" dur={0.65} max={3} />
      <Shockwave color="rgba(190,242,100,0.75)" delay={0.15} dur={0.65} max={2.4} />
      <Sparks count={12} radius={115} color="rgba(217,249,157,0.92)" dur={0.65} size={5} />
      <GlyphPop glyph="🛡" color="rgba(132,204,22,0.95)" dur={0.85} />
    </>
  ),
  // OMNISCIENCE (fusion) — l'œil qui sait tout : ondes cyan concentriques + flash, 👁️.
  omniscience: () => (
    <>
      <CoreFlash from="rgba(207,250,254,0.9)" to="rgba(8,145,178,0.55)" dur={0.7} />
      <Shockwave color="rgba(34,211,238,0.85)" dur={0.7} max={3.2} />
      <Shockwave color="rgba(103,232,249,0.7)" delay={0.18} dur={0.7} max={2.5} />
      <Sparks count={12} radius={120} color="rgba(165,243,252,0.9)" dur={0.7} size={5} />
      <GlyphPop glyph="👁️" color="rgba(34,211,238,0.95)" dur={0.85} />
    </>
  ),
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
