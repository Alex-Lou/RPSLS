/**
 * Fragments de rendu d'ArenaGame (extraits, cap <400 lignes/fichier) — fonctions
 * de RENDU pures (pas des composants, aucun hook) appelées inline → arbre React
 * identique : bouton de sortie (forfait) et plateau ArenaBoard.
 */

import type { MutableRefObject, ReactElement } from "react";
import { FloatingMatchBackButton, type MatchBackHandle } from "../../match/sharedMatchUI";
import { ArenaBoard } from "../ArenaBoard";
import { findFusionResult } from "../arenaFusionCards";
import type { BoardState, LaneIndex, Side, TurnIntent } from "../arenaTypes";
import type { ArenaResolveFx } from "./useArenaResolveFx";

/** Bouton de sortie/forfait (masqué : handle impératif + modale de confirmation). */
export function renderArenaBackButton(
  backRef: MutableRefObject<MatchBackHandle | null>,
  handleForfeit: () => void,
  t: (key: string) => string,
  tutorial: unknown,
): ReactElement {
  return (
    <FloatingMatchBackButton
      ref={backRef}
      onClick={handleForfeit}
      label={t("match.quit")}
      hidden
      confirm={{
        title: t(tutorial ? "tut.quitTitle" : "match.quitConfirm"),
        body: t(tutorial ? "tut.quitBody" : "arena.quit.body"),
        confirmLabel: t(tutorial ? "tut.quitConfirm" : "arena.quit.confirm"),
        cancelLabel: t("arena.quit.cancel"),
        severity: "danger",
      }}
    />
  );
}

/** Plateau ArenaBoard (dans BoardFillSlot) — props lues depuis l'état d'ArenaGame. */
export function renderArenaBoard(slotH: number, {
  board, mySide, intent, fx, oppName, oppAvatar, onLaneTap, removeSpell, removeSummon, forgeTap, forgeFlash, forgeRecover,
}: {
  board: BoardState;
  mySide: Side;
  intent: TurnIntent;
  fx: ArenaResolveFx;
  oppName: string | undefined;
  oppAvatar: string | undefined;
  onLaneTap: (lane: LaneIndex, side: "a" | "b") => void;
  removeSpell: (idx: number) => void;
  removeSummon: (lane: LaneIndex) => void;
  forgeTap: () => void;
  forgeFlash: number | null;
  forgeRecover: number | null;
}): ReactElement {
  const {
    oppPreview, playerPreview, resolveStep, combatLane, combatChargers, heroHit, tauntBlock, antiTaunt,
    riposteFX, spellFX, projectileShots, targeting,
  } = fx;
  const handleBoardLaneTap = onLaneTap;
  return (
    <ArenaBoard
      fillHeight={slotH}
      board={board}
      playerSide={mySide}
      intent={intent}
      oppPreview={oppPreview}
      playerPreview={playerPreview}
      resolveStep={resolveStep}
      combatLane={combatLane}
      combatChargers={combatChargers}
      heroHit={heroHit}
      tauntBlock={tauntBlock}
      antiTaunt={antiTaunt}
      riposteFX={riposteFX}
      spellFX={spellFX}
      projectileShots={projectileShots}
      oppName={oppName}
      oppAvatar={oppAvatar}
      targeting={targeting}
      onLaneTap={handleBoardLaneTap}
      onRemoveSpell={removeSpell}
      onRemoveSummon={removeSummon}
      forgeYou={board.forgeA ?? null}
      forgeOpp={board.forgeB ?? null}
      onForgeTap={forgeTap}
      forgeFlashKey={forgeFlash}
      forgeRecoverKey={forgeRecover}
      forgeHighlight={
        targeting?.kind === "spell"
          ? board.forgeA
            ? (findFusionResult(targeting.id, board.forgeA) ? "fuse" : null)
            : "deposit"
          : null
      }
    />
  );
}
