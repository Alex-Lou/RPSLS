import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/store";

const MIN = 0.1;
const MAX = 2.0;
/** Écart minimal entre deux écritures du store pendant un glissement. */
const WRITE_EVERY_MS = 120;

/** Intensité d'un set premium, partagée par les deux curseurs du Profil.
 *  L'affichage suit le doigt (état local), mais le store (persisté + abonné
 *  par ~25 composants) n'est écrit qu'environ 8×/s, plus une écriture finale :
 *  avant, chaque pointermove (60–120 Hz) réécrivait toute la sauvegarde.
 *  L'aperçu en direct des effets (pluie, particules…) reste fluide. */
export function useIntensityValue(setId: string): [number, (v: number) => void] {
  const stored = useStore((s) => s.player.premiumIntensity?.[setId] ?? 1.0);
  const [value, setLocal] = useState(stored);
  const lastWrite = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(stored);

  // Valeur changée ailleurs (autre curseur, synchro) hors glissement.
  useEffect(() => {
    if (!pending.current) setLocal(stored);
  }, [stored]);

  const commit = () => {
    pending.current = null;
    lastWrite.current = Date.now();
    const current = useStore.getState().player.premiumIntensity ?? {};
    useStore.getState().updateProfile({ premiumIntensity: { ...current, [setId]: latest.current } });
  };

  // Démontage en plein glissement : on écrit la dernière valeur.
  useEffect(() => () => {
    if (pending.current) {
      clearTimeout(pending.current);
      commit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (v: number) => {
    const clamped = Math.max(MIN, Math.min(MAX, v));
    latest.current = clamped;
    setLocal(clamped);
    if (pending.current) return;
    const wait = WRITE_EVERY_MS - (Date.now() - lastWrite.current);
    if (wait <= 0) commit();
    else pending.current = setTimeout(commit, wait);
  };

  return [value, setValue];
}
