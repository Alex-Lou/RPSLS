import { motion } from "motion/react";
import { CARDS, RARITY_COLOR } from "../../ranked/cards";
import { CardImage } from "../../ranked/CardImage";
import type { CardId } from "../../ranked/rankedTypes";
import { DUST_PER_DUPLICATE } from "../../engine/economy";

/* ─────────── Pack card flip ─────────── */

export function PackCardFlip({
  cardId, isNew, revealed, onReveal, t,
}: {
  cardId: CardId;
  isNew: boolean;
  revealed: boolean;
  onReveal: () => void;
  t: (k: string) => string;
}) {
  const card = CARDS[cardId];
  const dust = DUST_PER_DUPLICATE[card.rarity] ?? 0;
  const rarityRing =
    card.rarity === "legendary" ? "ring-amber-400 shadow-amber-500/40" :
    card.rarity === "epic"      ? "ring-violet-400 shadow-violet-500/40" :
    card.rarity === "rare"      ? "ring-sky-400 shadow-sky-500/40" :
                                  "ring-white/15";
  const rarityHex =
    card.rarity === "legendary" ? "#fbbf24" :
    card.rarity === "epic"      ? "#a78bfa" :
    card.rarity === "rare"      ? "#38bdf8" :
                                  "#cbd5e1";
  const isRarePlus = card.rarity !== "common";

  return (
    <motion.button
      onClick={onReveal}
      whileTap={!revealed ? { scale: 0.95 } : undefined}
      animate={revealed ? { rotateY: 0 } : { rotateY: 180 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      className={
        "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center transition shadow-lg " +
        (revealed
          ? ((isNew ? "ring-2 ring-emerald-400 shadow-emerald-400/40 " : "ring-2 ") + rarityRing)
          : "ring-1 ring-violet-400/30 bg-gradient-to-br from-indigo-900 to-violet-900 cursor-pointer hover:brightness-110")
      }
    >
      {/* Back face (hidden once flipped) */}
      <div
        className={"absolute inset-0 flex items-center justify-center " + (revealed ? "invisible" : "")}
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-indigo-800" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, ease: "linear", repeat: Infinity }}
          className="absolute inset-2 rounded-lg border-2 border-fuchsia-300/40"
        />
        <span className="relative text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">🎴</span>
      </div>

      {/* Front face */}
      <div
        className={"absolute inset-0 " + (revealed ? "" : "invisible")}
        style={{ backfaceVisibility: "hidden" }}
      >
        <CardImage id={cardId} glyphSize="text-2xl" />

        {/* ── Reveal FX — play ONCE when the card flips face-up ── */}
        {revealed && (
          <>
            {/* Holographic sheen sweep across the freshly-revealed art. */}
            <motion.div
              aria-hidden
              initial={{ x: "-130%", opacity: 0 }}
              animate={{ x: "130%", opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.7, delay: 0.18, ease: "easeOut" }}
              className="absolute inset-y-0 w-2/3 -skew-x-12 z-10 pointer-events-none"
              style={{ background: `linear-gradient(90deg, transparent, ${rarityHex}, transparent)` }}
            />
            {/* Rarity shockwave ring (rare and up) — a quick burst of "value". */}
            {isRarePlus && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0.85, scale: 0.4 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="absolute inset-0 m-auto w-3/4 h-3/4 rounded-full z-10 pointer-events-none"
                style={{ border: `2px solid ${rarityHex}`, boxShadow: `0 0 16px ${rarityHex}` }}
              />
            )}
            {/* Epic/legendary sparkle motes converging outward. */}
            {(card.rarity === "epic" || card.rarity === "legendary") &&
              Array.from({ length: 8 }).map((_, i) => {
                const ang = (i / 8) * Math.PI * 2;
                return (
                  <motion.span
                    key={i}
                    aria-hidden
                    initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    animate={{ opacity: 0, x: Math.cos(ang) * 42, y: Math.sin(ang) * 42, scale: 0.2 }}
                    transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full z-10 pointer-events-none"
                    style={{ background: rarityHex, boxShadow: `0 0 8px ${rarityHex}` }}
                  />
                );
              })}
          </>
        )}
        <div className="relative z-10 flex flex-col items-center gap-0.5 p-1 mt-auto">
          <span className="text-2xl">{card.glyph}</span>
          <span className="text-[8px] font-bold uppercase text-white/90 text-center leading-tight">
            {t(card.nameKey)}
          </span>
          <span className={"text-[8px] font-bold " + RARITY_COLOR[card.rarity]}>
            {card.rarity}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="absolute top-1 right-1 z-20"
        >
          {isNew ? (
            <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-400 text-zinc-900 px-1.5 py-0.5 rounded-full">
              NEW
            </span>
          ) : (
            <span className="text-[8px] font-black uppercase tracking-wider bg-violet-400/90 text-zinc-900 px-1.5 py-0.5 rounded-full">
              +{dust} ✨
            </span>
          )}
        </motion.div>
      </div>
    </motion.button>
  );
}
