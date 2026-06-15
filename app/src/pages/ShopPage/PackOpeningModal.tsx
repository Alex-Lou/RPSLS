import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { BurstCanvas } from "../../fx/LevelUpOverlay";
import { CARDS } from "../../ranked/cards";
import { useT } from "../../i18n";
import { type PackResult } from "../../engine/economy";
import { hapticTap, hapticMatchWin } from "../../haptic";
import { PackCardFlip } from "./PackCardFlip";

/* ─────────── Pack opening modal ─────────── */

export function PackOpeningModal({
  result, onClose,
}: {
  result: PackResult;
  onClose: () => void;
}) {
  const t = useT();
  // Cards start face-down — the player taps to flip each one. Letting the
  // user pace the reveal is what makes a pack opening *feel* like an event
  // instead of an automatic stagger.
  const [revealed, setRevealed] = useState<boolean[]>(() => result.cards.map(() => false));
  const allRevealed = revealed.every(Boolean);
  // Highest rarity in the pack drives the celebratory burst behind the
  // grid (epic/legendary get a warm fire palette, rare gets the cool one,
  // commons-only is calm — no burst). The intensity tracks how lucky the
  // pull was so the moment really lands.
  const maxRarity = useMemo(() => {
    const order = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;
    return result.cards.reduce<keyof typeof order>(
      (acc, id) => (order[CARDS[id].rarity] > order[acc] ? CARDS[id].rarity : acc),
      "common",
    );
  }, [result.cards]);
  const showBurst = allRevealed && maxRarity !== "common";

  function reveal(idx: number) {
    if (revealed[idx]) return;
    hapticTap();
    const r = CARDS[result.cards[idx]].rarity;
    // A juicier buzz on the rare pulls so the player physically feels luck.
    if (r === "legendary") hapticMatchWin();
    else if (r === "epic") hapticMatchWin();
    setRevealed((cur) => {
      const next = cur.slice();
      next[idx] = true;
      return next;
    });
  }
  function revealAll() {
    if (allRevealed) return;
    hapticMatchWin();
    setRevealed(result.cards.map(() => true));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={allRevealed ? onClose : undefined}
    >
      {/* Celebratory backdrop — the level-up burst reused at a calmer
          intensity. Only fires once the last card has flipped so it stays
          a reward, not noise. */}
      {showBurst && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <BurstCanvas
            warm={maxRarity === "epic" || maxRarity === "legendary"}
            intensity={maxRarity === "legendary" ? 1.1 : maxRarity === "epic" ? 0.85 : 0.6}
          />
        </div>
      )}

      <motion.div
        initial={{ scale: 0.92, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 5 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-50 w-full max-w-md bg-surface-raised border border-hairline rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="text-center">
          <div className="text-3xl mb-1">🎉</div>
          <h2 className="text-lg font-black bg-gradient-to-br from-amber-300 to-orange-400 bg-clip-text text-transparent">
            Pack ouvert
          </h2>
          <p className="text-[11px] text-ink-muted mt-1">
            {allRevealed
              ? result.dustGained > 0
                ? <>Doublons → <span className="text-violet-300 font-bold">+{result.dustGained} ✨</span></>
                : "Tu as ouvert ton pack."
              : "Touche chaque carte pour la révéler"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {result.cards.map((id, i) => (
            <PackCardFlip
              key={i}
              cardId={id}
              isNew={result.isNew[i]}
              revealed={revealed[i]}
              onReveal={() => reveal(i)}
              t={t}
            />
          ))}
        </div>

        {/* Bouton bascule "Tout révéler" → "Terminer" — un seul slot, deux
            comportements selon l'état du flip. */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={allRevealed ? onClose : revealAll}
          className={
            "w-full py-3 rounded-2xl font-bold text-white shadow-lg transition " +
            (allRevealed ? "bg-themed" : "bg-violet-500/40 hover:bg-violet-500/60 border border-violet-400/50")
          }
        >
          {allRevealed ? "Terminer" : "Tout révéler"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
