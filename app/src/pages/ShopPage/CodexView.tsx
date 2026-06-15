import { motion } from "motion/react";
import { useT } from "../../i18n";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR } from "../../ranked/cards";
import { CardImage } from "../../ranked/CardImage";
import { CODEX_TIERS, MASTERY_MAX_LEVEL, masteryLevel } from "../../engine/economy";

/* ─────────── Codex view (B3) ─────────── */

export function CodexView({
  collection, codexClaimed, cardMastery, onClaim,
}: {
  collection: string[];
  codexClaimed: number[];
  cardMastery: Record<string, number>;
  onClaim: (threshold: number) => void;
}) {
  const t = useT();
  const ownedSet = new Set(collection);
  const ownedCount = ownedSet.size;
  const total = ALL_CARD_IDS.length;
  const progress = total > 0 ? ownedCount / total : 0;
  const masteredCount = ALL_CARD_IDS.filter(
    (id) => ownedSet.has(id) && masteryLevel(cardMastery[id] ?? 0) === MASTERY_MAX_LEVEL,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress card */}
      <section className="rounded-2xl p-4 bg-surface-raised border border-hairline">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
            Collection
          </span>
          <span className="font-black tabular-nums text-ink">
            {ownedCount} / {total}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-hairline overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(progress * 100).toFixed(1)}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-themed"
          />
        </div>
        <p className="text-[11px] text-ink-muted mt-2 leading-snug">
          Débloque toutes les cartes pour empocher les paliers de complétion.
          {masteredCount > 0 && (
            <>
              {" "}<span className="text-amber-300 font-bold">⭐ {masteredCount}</span> carte
              {masteredCount > 1 ? "s" : ""} maîtrisée{masteredCount > 1 ? "s" : ""}.
            </>
          )}
        </p>
      </section>

      {/* Tier rewards */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted px-1">
          Paliers de complétion
        </h3>
        {CODEX_TIERS.map((tier) => {
          const claimed = codexClaimed.includes(tier.threshold);
          const ready = ownedCount >= tier.threshold && !claimed;
          return (
            <div
              key={tier.threshold}
              className={
                "rounded-xl p-3 flex items-center gap-3 border transition " +
                (claimed
                  ? "border-emerald-400/30 bg-emerald-500/5 opacity-70"
                  : ready
                  ? "border-amber-400/50 bg-amber-500/10 shadow-md shadow-amber-900/20"
                  : "border-hairline bg-hairline")
              }
            >
              <span className="text-2xl">
                {claimed ? "✅" : ready ? "🎁" : "🔒"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">
                  {tier.threshold} / {total} cartes
                </div>
                <div className="text-[11px] text-ink-muted">
                  +{tier.eclats} 💎{tier.dust > 0 ? ` · +${tier.dust} ✨` : ""}
                </div>
              </div>
              <motion.button
                whileTap={ready ? { scale: 0.94 } : undefined}
                onClick={ready ? () => onClaim(tier.threshold) : undefined}
                disabled={!ready}
                className={
                  "px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition " +
                  (claimed
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                    : ready
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 shadow-lg shadow-amber-900/40"
                    : "bg-hairline text-ink-faint border border-hairline cursor-not-allowed")
                }
              >
                {claimed ? "Récupéré" : ready ? "Récupérer" : `−${tier.threshold - ownedCount}`}
              </motion.button>
            </div>
          );
        })}
      </section>

      {/* Grid of all cards — owned vs locked at a glance. */}
      <section>
        <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted px-1 mb-2">
          Toutes les cartes
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {ALL_CARD_IDS.map((id) => {
            const card = CARDS[id];
            const owned = ownedSet.has(id);
            const lvl = owned ? masteryLevel(cardMastery[id] ?? 0) : 1;
            const mastered = lvl === MASTERY_MAX_LEVEL;
            return (
              <div
                key={id}
                className={
                  "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center text-center " +
                  (mastered
                    ? "ring-2 ring-amber-400/70 shadow-md shadow-amber-500/30"
                    : owned
                    ? "ring-1 ring-white/15"
                    : "ring-1 ring-white/5 grayscale opacity-30")
                }
                title={t(card.nameKey) + (owned && lvl > 1 ? ` · Niv ${lvl}` : "")}
              >
                <CardImage id={id} glyphSize="text-lg" />
                <div className="relative z-10 flex flex-col items-center p-0.5">
                  <span className="text-lg">{card.glyph}</span>
                  <span className={"text-[7px] font-bold uppercase " + RARITY_COLOR[card.rarity]}>
                    {card.rarity}
                  </span>
                </div>
                {!owned && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-20">
                    <span className="text-base">🔒</span>
                  </div>
                )}
                {owned && lvl > 1 && (
                  <span
                    className={
                      "absolute top-0.5 right-0.5 z-30 px-1 rounded-full text-[8px] font-black tabular-nums " +
                      (mastered
                        ? "bg-amber-400 text-zinc-900 shadow-md shadow-amber-900/40"
                        : "bg-white/15 text-white border border-white/20")
                    }
                  >
                    {mastered ? "⭐" : `Niv${lvl}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
