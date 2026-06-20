/**
 * ArenaCardBack — DOS DE CARTE premium, harmonisé au THÈME courant (Alex
 * 2026-06-17). Structure premium (cadre + emblème étoile + nébuleuse + champ
 * d'étoiles + reflet holographique), COULEURS issues des vars de thème
 * (`--theme-primary`/`--theme-secondary`/`--theme-bg`) via color-mix → chaque
 * appearance a SON dos.
 *
 * PERF (Alex 2026-06-17 « ça rame ») : animations RÉDUITES à 3 boucles/dos
 * (nébuleuse qui respire + emblème qui pulse + reflet qui balaie). Les étoiles
 * et les anneaux sont STATIQUES (avant : 8 étoiles scintillantes + anneau en
 * rotation × 3 dos dans l'ouverture = trop de boucles → lag). Reste premium,
 * coût GPU divisé par ~4.
 */

import { motion } from "motion/react";

const STARS: Array<[number, number, number]> = [
  [18, 22, 2], [80, 18, 1.5], [30, 70, 2], [72, 76, 1.5],
  [50, 12, 1.5], [13, 52, 2], [88, 56, 1.5], [42, 88, 1.5],
];

// Raccourcis color-mix sur les vars de thème (fallback violet/cyan si absentes).
const P = "var(--theme-primary, #a78bfa)";
const S = "var(--theme-secondary, #22d3ee)";

export function ArenaCardBack({ className = "", glow = false }: { className?: string; glow?: boolean }) {
  return (
    // Cadre (dégradé d'accent du thème) via une fine bordure : couche externe + contenu.
    <div
      className={"relative rounded-md p-[1.5px] shrink-0 " + className}
      style={{
        background: `linear-gradient(150deg, ${S} 0%, ${P} 45%, color-mix(in oklab, ${P} 60%, #000) 60%, ${S} 100%)`,
        boxShadow: glow
          ? `0 0 16px -2px color-mix(in oklab, ${P} 65%, transparent), 0 0 6px color-mix(in oklab, ${S} 60%, transparent)`
          : "0 2px 6px rgba(0,0,0,0.5)",
      }}
      aria-hidden
    >
      <div
        className="relative w-full h-full rounded-[5px] overflow-hidden"
        style={{
          background: `radial-gradient(125% 95% at 50% 16%, color-mix(in oklab, ${P} 52%, #0a0a14) 0%, color-mix(in oklab, ${S} 26%, #08060f) 44%, var(--theme-bg, #06040e) 100%)`,
        }}
      >
        {/* Nébuleuse centrale qui RESPIRE (1 boucle) */}
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(48% 38% at 50% 50%, color-mix(in oklab, ${S} 45%, transparent), transparent 72%)` }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Champ d'étoiles — STATIQUE (perf) */}
        {STARS.map(([x, y, s], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${x}%`, top: `${y}%`, width: s, height: s,
              opacity: 0.4 + (i % 3) * 0.18,
              boxShadow: "0 0 3px rgba(255,255,255,0.8)",
            }}
          />
        ))}
        {/* Emblème : étoile rayonnante + anneaux STATIQUES, halo qui PULSE (1 boucle). */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ filter: `drop-shadow(0 0 4px ${P})` }}
          animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.05, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 100 100" className="w-[58%] h-[58%]">
            <defs>
              <radialGradient id="acbStar" cx="50%" cy="42%" r="60%">
                <stop offset="0%" style={{ stopColor: "#ffffff" }} />
                <stop offset="52%" style={{ stopColor: P }} />
                <stop offset="100%" style={{ stopColor: S }} />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="1" style={{ stroke: `color-mix(in oklab, ${P} 55%, transparent)` }} />
            <circle cx="50" cy="50" r="33" fill="none" strokeWidth="0.6" style={{ stroke: `color-mix(in oklab, ${S} 45%, transparent)` }} />
            {/* étoile à 4 grandes branches + 4 fines (8 pointes) */}
            <path d="M50 8 L57 43 L92 50 L57 57 L50 92 L43 57 L8 50 L43 43 Z" fill="url(#acbStar)" />
            <path d="M50 24 L52 48 L76 50 L52 52 L50 76 L48 52 L24 50 L48 48 Z" fill="#ffffff" opacity="0.55" />
          </svg>
        </motion.div>
        {/* Reflet holographique qui BALAIE (1 boucle) */}
        <motion.div
          className="absolute inset-y-0 w-1/2"
          style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.16) 50%, transparent 70%)", mixBlendMode: "screen" }}
          initial={{ x: "-160%" }}
          animate={{ x: ["-160%", "320%"] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
        />
      </div>
    </div>
  );
}
