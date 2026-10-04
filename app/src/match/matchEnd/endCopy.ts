/**
 * Textes d'ambiance de l'écran de fin commun : phrase de situation (balayage,
 * remontée, défaite serrée…) tirée de flavor/endphrases, figée au montage.
 */
import { useRef } from "react";
import { useT } from "../../i18n";
import { classifyEnd, pickEndSubtitleKey } from "../../flavor/endphrases";

export function useEndPhrase(opts: {
  youScore?: number; oppScore?: number; bestOf?: number;
  forfeit?: boolean; forfeitByYou?: boolean;
}): string | null {
  const t = useT();
  // Clé tirée UNE fois (variante aléatoire) : la phrase ne change pas au rendu.
  const key = useRef<string | null | undefined>(undefined);
  if (key.current === undefined) {
    const { youScore, oppScore, bestOf } = opts;
    key.current = youScore == null || oppScore == null || bestOf == null
      ? null
      : pickEndSubtitleKey(classifyEnd({
          youScore, oppScore, bestOf,
          forfeit: !!opts.forfeit, forfeitByYou: !!opts.forfeitByYou,
        }));
  }
  if (!key.current) return null;
  const phrase = t(key.current);
  // Variante non traduite dans cette langue → t() renvoie la clé : on se tait.
  return phrase.startsWith("endphrase.") ? null : phrase;
}
