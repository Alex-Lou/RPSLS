/**
 * ArenaTutorialPage — point d'entrée du tutoriel Arena Pro.
 *
 * Pas d'écran de préparation (pile ou face, thème adverse) : on garde le thème
 * du joueur et on entre directement dans la partie guidée. Plein écran comme
 * une vraie arène. « Rejouer » remonte une partie neuve (clé).
 */
import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { ArenaGame } from "../ArenaGame";
import { setMatchFullscreen } from "../../match/matchFullscreenStore";
import { TUTORIAL_CPU_AVATAR } from "./tutorialScript";

export function ArenaTutorialPage({ onBack, onPlayReal }: { onBack: () => void; onPlayReal: () => void }) {
  const t = useT();
  const [run, setRun] = useState(0);
  useEffect(() => {
    setMatchFullscreen(true);
    return () => setMatchFullscreen(false);
  }, []);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ArenaGame
        key={run}
        onQuit={onBack}
        oppName={t("tut.cpuName")}
        oppAvatar={TUTORIAL_CPU_AVATAR}
        tutorial={{ onPlayReal, onReplay: () => setRun((n) => n + 1) }}
      />
    </div>
  );
}
