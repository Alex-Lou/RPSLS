/**
 * ArenaTutorialEnd — écran de fin du tutoriel Arena Pro.
 *
 * Remplace l'écran de fin normal (aucune stat, aucun historique, aucun Éclat :
 * le tuto ne compte pas comme un match). Récapitule les 4 leçons, verse l'XP
 * de la première réussite, et pousse vers une vraie partie.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useT } from "../../i18n";
import { CelebrationBurst } from "../../match/sharedMatchUI";
import { useStore } from "../../store/store";
import { completeArenaTutorial } from "./tutorialProgress";
import { TUTORIAL_XP } from "./tutorialScript";

const LESSONS = [
  { icon: "⚔️", key: "tut.end.l1" },
  { icon: "✂️", key: "tut.end.l2" },
  { icon: "💧", key: "tut.end.l3" },
  { icon: "🃏", key: "tut.end.l4" },
];

export function ArenaTutorialEnd({
  won, onPlay, onReplay, onQuit,
}: {
  won: boolean;
  onPlay: () => void;
  onReplay: () => void;
  onQuit: () => void;
}) {
  const t = useT();
  // XP affichée = figée AVANT le versement (sinon un 2e passage d'effet, ex.
  // StrictMode, lirait « déjà réussi » et afficherait +0). Le versement est
  // idempotent (flag "done") : jamais deux fois.
  const [xp] = useState(() => (won && useStore.getState().player.arenaTutorial !== "done" ? TUTORIAL_XP : 0));
  useEffect(() => {
    if (won) completeArenaTutorial();
  }, [won]);

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-hidden">
      {won && <CelebrationBurst />}
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14 }}
        className="text-6xl mb-2 drop-shadow-[0_8px_24px_rgba(252,211,77,0.45)]"
      >
        {won ? "🎓" : "🔁"}
      </motion.div>
      <motion.h2
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-2xl font-black text-center bg-gradient-to-br from-amber-200 to-orange-400 bg-clip-text text-transparent"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        {won ? t("tut.end.title") : t("tut.end.retryTitle")}
      </motion.h2>
      {xp > 0 && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 320, damping: 16 }}
          className="mt-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-300/40 text-emerald-200 text-sm font-black tabular-nums"
        >
          +{xp} XP
        </motion.div>
      )}

      {won && (
        <div className="w-full max-w-sm mt-5 flex flex-col gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ink-faint text-center mb-1">
            {t("tut.end.learned")}
          </p>
          {LESSONS.map((l, i) => (
            <motion.div
              key={l.key}
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.45 + i * 0.12, type: "spring", stiffness: 300, damping: 24 }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5"
            >
              <span className="text-xl shrink-0" aria-hidden>{l.icon}</span>
              <span className="text-[13px] leading-snug text-zinc-100">{t(l.key)}</span>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: won ? 1 : 0.3 }}
        className="w-full max-w-sm mt-6 flex flex-col gap-2"
      >
        {won ? (
          <button
            type="button"
            onClick={onPlay}
            className="w-full py-3.5 rounded-2xl font-black text-white shadow-2xl bg-themed-br"
            style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
          >
            {t("tut.end.play")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onReplay}
            className="w-full py-3.5 rounded-2xl font-black text-white shadow-2xl bg-themed-br"
          >
            {t("tut.end.replay")}
          </button>
        )}
        <button
          type="button"
          onClick={onQuit}
          className="w-full py-3 rounded-2xl font-bold text-ink-muted bg-hairline"
        >
          {t("tut.end.back")}
        </button>
      </motion.div>
    </div>
  );
}
