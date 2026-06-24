/**
 * ArenaCenterBand — bande centrale du pad : [⚗️ Forge adverse] [statut] [⚗️ TA
 * Forge]. Extrait de ArenaBoard (Alex 2026-06-22, « au fil de l'eau » + DRY).
 *
 * PAYSAGE (Alex 2026-06-22) : les 2 forges QUITTENT le flux de la bande et se
 * posent en ABSOLU sur les FLANCS du pad (le vide que les lanes étalées
 * laissent), agrandies → enfin visibles. Le wrapper `FLANK_WRAP` est `contents`
 * en PORTRAIT (forge inline dans la bande, inchangé) et `absolute` centré-
 * vertical sur le flanc en PAYSAGE. Bonus : la bande libérée donne plus d'air au
 * centre pour les FX de combat. Le wrapper est factorisé (seul left/right diffère).
 */

import { CARDS } from "../../ranked/cards";
import { ForgeSlot } from "../ArenaForge";
import { CenterStatus } from "./CenterStatus";
import type { TurnIntent } from "../arenaTypes";
import type { CardId } from "../../ranked/rankedTypes";
import type { ArenaBoardProps } from "./ArenaBoard";

/** Positionnement du flanc, partagé par les 2 forges (seul left/right change). */
const FLANK_WRAP =
  "contents landscape:block landscape:absolute landscape:top-1/2 landscape:-translate-y-1/2 landscape:z-[3]";

export function ArenaCenterBand({
  forgeOpp, forgeYou, onForgeTap, forgeHighlight = null,
  forgeFlashKey = null, forgeRecoverKey = null,
  resolveStep, turn, oppPreview, playerPreview,
}: {
  forgeOpp: CardId | null;
  forgeYou: CardId | null;
  onForgeTap?: () => void;
  forgeHighlight?: "deposit" | "fuse" | null;
  forgeFlashKey?: number | null;
  forgeRecoverKey?: number | null;
  resolveStep: ArenaBoardProps["resolveStep"];
  turn: number;
  oppPreview: TurnIntent | null | undefined;
  playerPreview: TurnIntent | null | undefined;
}) {
  return (
    <div className="shrink-0 flex items-center gap-1.5">
      <div className={FLANK_WRAP + " landscape:left-3"}>
        <ForgeSlot card={forgeOpp} mine={false} />
      </div>
      <div className="flex-1 min-w-0">
        <CenterStatus
          step={resolveStep ?? null}
          turn={turn}
          oppPreview={oppPreview}
          playerPreview={playerPreview}
        />
      </div>
      <div className={FLANK_WRAP + " landscape:right-3"}>
        <ForgeSlot
          card={forgeYou}
          mine
          onTap={onForgeTap}
          highlight={forgeHighlight}
          flashKey={forgeFlashKey}
          recoverKey={forgeRecoverKey}
          forged={!!forgeYou && CARDS[forgeYou]?.kind === "fusion"}
        />
      </div>
    </div>
  );
}
