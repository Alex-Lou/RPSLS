/**
 * ArenaHeroStrip — portrait + HP bar + mana pips + hand count for one hero.
 *
 * Extracted from ArenaBoard.tsx to keep that file under the project's
 * 400-line ceiling. Used twice per board (opp on top, player on bottom).
 *
 * Visual ownership: emerald accents for "you", rose for "opp". The portrait
 * pulses + tints red when the hero just took damage (driven by the
 * useEffect that compares prev/next HP), and floats a "-N" damage popup
 * out of the portrait at the same time.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HeroState } from "./arenaTypes";

export interface ArenaHeroStripProps {
  hero: HeroState;
  side: "you" | "opp";
  turn: number;
  /** Display name shown next to the portrait — player nickname for "you",
   *  "CPU" / persona name for "opp". */
  name: string;
  /** Avatar — emoji char, preset path, or undefined for the default mask. */
  avatar?: string;
}

export function ArenaHeroStrip({
  hero, side, turn, name, avatar,
}: ArenaHeroStripProps) {
  const accent = side === "you" ? "text-emerald-300" : "text-rose-300";
  const ringColor = side === "you" ? "ring-emerald-400/70" : "ring-rose-400/70";
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const lowHp = hero.hp <= 5;
  // Track previous HP so we can spawn a floating damage popup over the
  // portrait when the hero just took damage.
  const prevHpRef = useRef(hero.hp);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (hero.hp < prev) {
      setDmgPop({ n: prev - hero.hp, key: Date.now() });
      const id = window.setTimeout(() => setDmgPop(null), 1100);
      prevHpRef.current = hero.hp;
      return () => window.clearTimeout(id);
    }
    prevHpRef.current = hero.hp;
  }, [hero.hp]);
  return (
    <div className="flex items-center gap-2 px-1">
      {/* Portrait — avatar + name in a circle so each side has a face.
       *  Floating damage popup pops out of the portrait on HP loss. */}
      <div className="flex flex-col items-center shrink-0 w-16 relative">
        <HeroPortrait avatar={avatar} ringColor={ringColor} divineShield={hero.divineShield} damaged={!!dmgPop} />
        <span className={"text-[9px] uppercase tracking-wider font-black truncate max-w-[64px] mt-0.5 " + accent}>
          {name}
        </span>
        <AnimatePresence>
          {dmgPop && (
            <motion.div
              key={dmgPop.key}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -32, scale: 1.2 }}
              exit={{ opacity: 0, y: -48 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
              style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
            >
              −{dmgPop.n}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* HP + mana stacked vertically — the player reads them in one column. */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* HP bar — taller, segmented every 5 HP, glow on the filled portion,
         *  pulse at low HP. */}
        <div className="flex items-center gap-1.5">
          <motion.span
            key={hero.hp}
            initial={{ scale: 1.35, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#ffffff" }}
            transition={{ duration: 0.3 }}
            className="text-[13px] font-black tabular-nums w-12 text-right"
          >
            ❤ {hero.hp}/{hero.maxHp}
          </motion.span>
          <div
            className={
              "relative flex-1 h-3 rounded-full bg-zinc-900/80 overflow-hidden ring-1 ring-black/50 " +
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
          </div>
        </div>
        {/* Mana + hand size + turn — compact secondary row. */}
        <div className="flex items-center gap-1 text-[9px]">
          <span className="font-bold text-sky-300 tabular-nums w-12 text-right">⋙ {hero.mana}/{hero.maxMana}</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: hero.maxMana }, (_, i) => (
              <span
                key={i}
                className={
                  "w-1.5 h-1.5 rounded-full ring-1 ring-black/40 " +
                  (i < hero.mana ? "bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" : "bg-zinc-700")
                }
              />
            ))}
          </div>
          <span className="ml-auto font-bold text-ink-muted">🂠 {hero.hand.length}</span>
          {side === "you" && <span className="font-bold text-themed">T{turn}</span>}
        </div>
      </div>
    </div>
  );
}

/** Hero portrait — a small circular badge with the avatar inside. Falls
 *  back to a generic CPU mask glyph when no avatar is provided.
 *  `damaged` flips on for ~500ms when the hero just took damage — the ring
 *  pulses red so the player FEELS the hit beyond the floating −N number. */
function HeroPortrait({ avatar, ringColor, divineShield, damaged }: {
  avatar?: string;
  ringColor: string;
  divineShield: boolean;
  damaged?: boolean;
}) {
  const isImage = avatar && (avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:"));
  return (
    <motion.div
      animate={damaged ? { scale: [1, 1.08, 0.96, 1], x: [0, -2, 2, -1, 1, 0] } : { scale: 1, x: 0 }}
      transition={damaged ? { duration: 0.5 } : { duration: 0.2 }}
      className={
        "relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 " +
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
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px]" title="Bouclier divin">🛡️</span>
      )}
    </motion.div>
  );
}
