import { useEffect, useRef } from "react";
import { useAndroidBackPrompt } from "../../match/sharedMatchUI";
import { setMatchExit } from "../../matchExitStore";
import { useT } from "../../i18n";

/** Monté UNIQUEMENT pendant un match en ligne classique (phases matched /
 *  round / reveal). Sans lui, le retour Android et la flèche « retour Play »
 *  démontaient la page → socket coupée → forfait serveur (−LP) sans aucune
 *  confirmation ni trace locale. Ici : retour Android et burger ouvrent la
 *  MÊME modale de forfait que le bouton du match ; la flèche globale d'App se
 *  masque tant qu'une sortie de match est enregistrée (matchExitStore). */
export function OnlineMatchGuard({ onQuitRequest }: { onQuitRequest: () => void }) {
  const t = useT();
  const cbRef = useRef(onQuitRequest);
  cbRef.current = onQuitRequest;
  useAndroidBackPrompt(() => cbRef.current());
  useEffect(() => {
    setMatchExit({ label: t("match.quit"), onExit: () => cbRef.current() });
    return () => setMatchExit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
