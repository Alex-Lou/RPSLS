import { useStore } from "../../store/store";
import { TUTORIAL_XP } from "./tutorialScript";

/** Tuto réussi : XP versée UNE seule fois (idempotent, même si l'écran de fin
 *  se remonte). Renvoie l'XP réellement versée (0 si déjà réussi avant). */
export function completeArenaTutorial(): number {
  const s = useStore.getState();
  if (s.player.arenaTutorial === "done") return 0;
  s.grantXp(TUTORIAL_XP);
  s.updateProfile({ arenaTutorial: "done" });
  return TUTORIAL_XP;
}

/** « Plus tard » / « Passer » : on ne le propose plus automatiquement (il reste
 *  rejouable depuis le lobby). Ne rétrograde jamais un tuto déjà réussi. */
export function skipArenaTutorial(): void {
  const s = useStore.getState();
  if (!s.player.arenaTutorial) s.updateProfile({ arenaTutorial: "skipped" });
}
