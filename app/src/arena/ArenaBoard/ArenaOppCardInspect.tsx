/**
 * ArenaOppCardInspect — fiche LECTURE SEULE d'une carte ADVERSE révélée par
 * Augure (long-press sur le strip opp). Rendu en PORTAL vers document.body.
 * Extrait de ArenaBoard (Alex 2026-06-22, « au fil de l'eau »). JSX verbatim.
 */

import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { useT } from "../../i18n";
import { ArenaCardInspect } from "../ArenaCardInspect";
import { fusionPartnersOf } from "../arenaFusionCards";
import { CARD_TARGET_KIND } from "../arenaTypes";
import type { CardId } from "../../ranked/rankedTypes";

export function ArenaOppCardInspect({ inspectOpp, onClose }: {
  inspectOpp: CardId | null;
  onClose: () => void;
}) {
  const t = useT();
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {inspectOpp && (
        <ArenaCardInspect
          id={inspectOpp}
          targetKind={CARD_TARGET_KIND[inspectOpp] ?? "global"}
          t={t}
          readOnly
          onCommit={() => {}}
          onClose={onClose}
          fusionRecipes={fusionPartnersOf(inspectOpp).map((r) => ({
            partner: r.a === inspectOpp ? r.b : r.a,
            result: r.result,
          }))}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
