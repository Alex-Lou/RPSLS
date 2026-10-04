/**
 * ArenaMatchEnd — fin de match Constellation Pro (vs CPU et en ligne).
 *
 * Adaptateur vers l'écran de fin COMMUN (MatchEndScreen) : issue lue sur le
 * board (PV des deux héros), raison de fin (board.endReason : K.O., plafond,
 * départages, mort subite, nul), PV restants + nombre de tours en ligne de
 * score. Gains = barème ARENA_ECLATS / ARENA_XP, le même que recordArenaMatch
 * (affichage seul : le crédit a lieu dans le store, ou côté serveur en ligne).
 */
import { useStore } from "../store/store";
import { useT } from "../i18n";
import { ARENA_ECLATS, ARENA_XP } from "../engine/economy";
import { MatchEndScreen } from "../match/matchEnd";
import type { BoardState, Side } from "./arenaTypes";

export interface ArenaMatchEndProps {
  board: BoardState;
  /** Camp du joueur LOCAL (en ligne, le serveur peut lui donner « b »). */
  mySide: Side;
  /** Nom de l'adversaire (persona CPU ou pseudo en ligne). */
  oppName?: string;
  onQuit: () => void;
  /** Absent = pas de revanche proposée (en ligne : la session est close). */
  onRematch?: () => void;
}

export function ArenaMatchEnd({ board, mySide, oppName, onQuit, onRematch }: ArenaMatchEndProps) {
  const t = useT();
  const me = board[mySide];
  const opp = board[mySide === "a" ? "b" : "a"];
  const playerName = useStore((s) => s.player.nickname) || t("end.you");
  const meDead = me.hp <= 0;
  const oppDead = opp.hp <= 0;
  const youWon = oppDead && !meDead;
  const draw = meDead && oppDead;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : youWon ? "win" : "loss";

  const subtitle =
    draw ? t("arena.end.subDraw")
    : youWon ? t("arena.end.subWin", { name: playerName })
    : t("arena.end.subLoss");
  // Raison de fin (decideMatchEnd) : K.O., plafond de tours, départages…
  const reason = board.endReason ? t(`arena.endReason.${board.endReason}`) : null;

  return (
    <MatchEndScreen
      outcome={outcome}
      subtitle={subtitle}
      reason={reason}
      score={{
        you: <>❤ {Math.max(0, me.hp)}</>,
        opp: <>❤ {Math.max(0, opp.hp)}</>,
        youName: playerName,
        oppName: oppName || t("end.opponent"),
        caption: t("end.turn", { n: board.turn }),
      }}
      rewards={{ xp: ARENA_XP[outcome], eclats: ARENA_ECLATS[outcome] }}
      primary={onRematch ? { label: t("end.playAgain"), onClick: onRematch } : undefined}
      secondary={{ label: t("end.back"), onClick: onQuit }}
    />
  );
}
