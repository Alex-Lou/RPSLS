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
import { MatchEndScreen } from "../../match/matchEnd";
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

  // Cadre = écran de fin COMMUN (MatchEndScreen) ; le contenu reste celui du
  // tuto : titre dédié, XP de première réussite, leçons apprises.
  return (
    <MatchEndScreen
      outcome={won ? "win" : "loss"}
      title={won ? t("tut.end.title") : t("tut.end.retryTitle")}
      glyph={won ? "🎓" : "🔁"}
      rewards={xp > 0 ? { xp } : undefined}
      extra={won ? (
        <div className="w-full flex flex-col gap-1.5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ink-faint text-center">
            {t("tut.end.learned")}
          </p>
          {LESSONS.map((l, i) => (
            <motion.div
              key={l.key}
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2 + i * 0.12, type: "spring", stiffness: 300, damping: 24 }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 [@media(max-height:700px)]:py-1.5"
            >
              <span className="text-xl shrink-0" aria-hidden>{l.icon}</span>
              <span className="text-[13px] [@media(max-height:700px)]:text-[12px] leading-snug text-zinc-100">{t(l.key)}</span>
            </motion.div>
          ))}
        </div>
      ) : undefined}
      primary={won ? { label: t("tut.end.play"), onClick: onPlay } : { label: t("tut.end.replay"), onClick: onReplay }}
      secondary={{ label: t("tut.end.back"), onClick: onQuit }}
    />
  );
}
