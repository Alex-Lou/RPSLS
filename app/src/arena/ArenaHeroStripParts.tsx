/**
 * Sous-composants d'ArenaHeroStrip (extraits pour le cap <400 lignes/fichier) :
 * - AugurPeekOverlay : cartes adverses révélées par Augure (overlay du strip).
 * - HeroHpBar        : barre de vie (shake/flash à l'impact, gouttes de sang).
 * - HeroPortrait     : médaillon avatar (+ pulse rouge au dégât, bouclier).
 * Rendu strictement identique à l'ancien JSX inline ; l'état reste dans
 * ArenaHeroStrip (passé en props).
 */

import { AnimatePresence, motion } from "motion/react";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import { useT } from "../i18n";
import type { CardId } from "../ranked/rankedTypes";
import { arenaCardDescKey } from "./arenaTypes";
import type { HeroState } from "./arenaTypes";

/** Augur peek — cartes de la main adverse révélées (long-press → fiche). */
export function AugurPeekOverlay({ augurRevealed, onInspectCard, startInspect, cancelInspect }: {
  augurRevealed: CardId[];
  onInspectCard?: (id: CardId) => void;
  startInspect: (id: CardId) => void;
  cancelInspect: () => void;
}) {
  const t = useT();
  return (
    <motion.div
      key={"augur-" + augurRevealed.join("|")}
      initial={{ opacity: 0, y: -6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={"absolute left-2 right-2 -bottom-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/65 z-40 " + (onInspectCard ? "" : "pointer-events-none")}
      style={{ boxShadow: "0 0 14px -2px rgba(252,211,77,0.6), inset 0 1px 0 rgba(252,211,77,0.22)" }}
    >
      <motion.span
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="text-[10px] uppercase tracking-wider font-black text-amber-200 drop-shadow shrink-0"
      >
        👁
      </motion.span>
      <div className="flex items-center gap-1 flex-wrap">
        {augurRevealed.map((id, i) => {
          const card = CARDS[id];
          if (!card) return null;
          return (
            <motion.div
              key={`${id}-${i}`}
              initial={{ opacity: 0, scale: 0.6, y: -6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.05 + i * 0.08, type: "spring", stiffness: 280, damping: 20 }}
              onPointerDown={onInspectCard ? () => startInspect(id) : undefined}
              onPointerUp={onInspectCard ? cancelInspect : undefined}
              onPointerLeave={onInspectCard ? cancelInspect : undefined}
              onPointerCancel={onInspectCard ? cancelInspect : undefined}
              className={"relative w-9 h-12 sm:w-10 sm:h-[3.4rem] rounded-md overflow-hidden ring-2 ring-amber-300/75 shadow-md shadow-amber-500/30 " + (onInspectCard ? "cursor-pointer active:scale-95" : "")}
              title={onInspectCard ? t("arena.strip.holdToInspect") : t(card.nameKey) + " — " + t(arenaCardDescKey(id))}
            >
              <CardImage id={id} glyphSize="text-base" />
              <div className="absolute top-0.5 left-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black/80 text-sky-200 text-[8px] font-black tabular-nums">
                {card.cost}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/** Ligne 2 du strip — barre de vie (PV, ticks par 5 PV, impact, gouttes de sang). */
export function HeroHpBar({ hero, incomingAttackKey, hpPct, lowHp, bloodDrip }: {
  hero: HeroState;
  incomingAttackKey?: number | null;
  hpPct: number;
  lowHp: boolean;
  bloodDrip: { key: number } | null;
}) {
  return (
    <motion.div
      key={incomingAttackKey ?? "hp-idle"}
      initial={incomingAttackKey ? { x: 0 } : undefined}
      animate={incomingAttackKey ? { x: [0, -6, 7, -5, 3, 0] } : undefined}
      transition={incomingAttackKey ? { duration: 0.55, ease: "easeOut" } : undefined}
      className="relative flex items-center gap-1.5"
    >
      {/* Typo retravaillée (Alex 2026-06-13 "trop codée/austère") : PV
       *  courant en gros chiffre (font headline), max en petit/atténué,
       *  cœur teinté. Plus de monospace "code". */}
      <motion.span
        key={hero.hp}
        initial={{ scale: 1.35 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-baseline gap-0.5 shrink-0 leading-none"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        <span className="text-[13px] mr-0.5" style={{ color: lowHp ? "#fb7185" : "#f87171" }}>❤</span>
        <span className="text-[18px] landscape:text-[24px] font-black" style={{ color: lowHp ? "#fb7185" : "#ffffff" }}>{hero.hp}</span>
        <span className="text-[10px] font-bold text-white/45">/{hero.maxHp}</span>
      </motion.span>
      <div
        className={
          "relative w-28 sm:w-32 landscape:flex-1 landscape:min-w-0 h-3 landscape:h-4 rounded-full bg-zinc-900/80 overflow-hidden ring-1 ring-black/50 " +
          (lowHp ? "animate-pulse" : "")
        }
      >
        <motion.div
          className={
            "h-full transition-colors " +
            (hpPct > 50 ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[inset_0_0_8px_rgba(110,231,183,0.6)]" :
             hpPct > 25 ? "bg-gradient-to-r from-amber-500 to-amber-300 shadow-[inset_0_0_8px_rgba(252,211,77,0.6)]" :
             "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[inset_0_0_8px_rgba(251,113,133,0.6)]")
          }
          animate={{ width: `${hpPct}%` }}
          transition={{ duration: 0.45 }}
        />
        {/* Per-5-HP tick marks. */}
        <div className="absolute inset-0 flex pointer-events-none">
          {Array.from({ length: Math.max(1, Math.floor(hero.maxHp / 5)) - 1 }, (_, i) => (
            <div
              key={i}
              className="border-r border-black/40"
              style={{ width: `${100 / Math.max(1, Math.floor(hero.maxHp / 5))}%` }}
            />
          ))}
        </div>
        {/* White IMPACT sweep — when an attack lands on THIS hero, a bright
         *  white-to-rose flash sweeps across the HP bar, then fades. */}
        <AnimatePresence>
          {incomingAttackKey && (
            <motion.div
              key={incomingAttackKey}
              initial={{ opacity: 0.95, x: "-100%" }}
              animate={{ opacity: [0.95, 0.8, 0], x: ["-100%", "0%", "100%"] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.45, 1] }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 35%, rgba(244,63,94,0.7) 55%, transparent 100%)",
                mixBlendMode: "screen",
              }}
            />
          )}
        </AnimatePresence>
        {/* Outer ring pulse — rose halo when hit. */}
        <AnimatePresence>
          {incomingAttackKey && (
            <motion.div
              key={`ring-${incomingAttackKey}`}
              initial={{ opacity: 0.9, scale: 1 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{
                boxShadow:
                  "0 0 12px 3px rgba(244,63,94,0.85), inset 0 0 8px rgba(244,63,94,0.6)",
              }}
            />
          )}
        </AnimatePresence>
      </div>
      {/* 🩸 Gouttes de sang sous la barre quand PV ≤ 5 + coup encaissé. */}
      <AnimatePresence>
        {bloodDrip && [0, 1, 2].map((i) => (
          <motion.span
            key={`blood-${bloodDrip.key}-${i}`}
            className="absolute bottom-0 w-1 rounded-b-full pointer-events-none"
            style={{ right: 8 + i * 16, background: "linear-gradient(to bottom, #ef4444, #7f1d1d)", boxShadow: "0 0 4px rgba(127,29,29,0.8)" }}
            initial={{ height: 1, opacity: 0.95, y: 0 }}
            animate={{ height: [1, 7, 9], opacity: [0.95, 0.95, 0], y: [0, 8, 16] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, delay: i * 0.13, ease: "easeIn" }}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

/** Hero portrait — a small circular badge with the avatar inside. Falls
 *  back to a generic CPU mask glyph when no avatar is provided.
 *  `damaged` flips on for ~500ms when the hero just took damage — the ring
 *  pulses red so the player FEELS the hit beyond the floating −N number. */
export function HeroPortrait({ avatar, ringColor, divineShield, damaged }: {
  avatar?: string;
  ringColor: string;
  divineShield: boolean;
  damaged?: boolean;
}) {
  const t = useT();
  const isImage = avatar && (avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:"));
  return (
    <motion.div
      animate={damaged ? { scale: [1, 1.08, 0.96, 1], x: [0, -2, 2, -1, 1, 0] } : { scale: 1, x: 0 }}
      transition={damaged ? { duration: 0.5 } : { duration: 0.2 }}
      className={
        "relative w-14 h-14 sm:w-16 sm:h-16 landscape:w-[68px] landscape:h-[68px] rounded-full overflow-hidden ring-2 " +
        (damaged ? "ring-rose-400 shadow-[0_0_18px_-1px_rgba(244,63,94,0.95)]" : ringColor) +
        " bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center " +
        (divineShield && !damaged ? "shadow-[0_0_12px_-1px_rgba(252,211,77,0.85)]" : "")
      }
    >
      {isImage ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : avatar ? (
        <span className="text-3xl">{avatar}</span>
      ) : (
        <span className="text-3xl">🤖</span>
      )}
      {damaged && (
        <span className="absolute inset-0 bg-rose-500/35 pointer-events-none" aria-hidden />
      )}
      {divineShield && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px]" title={t("arena.strip.divineShield")}>🛡️</span>
      )}
    </motion.div>
  );
}
