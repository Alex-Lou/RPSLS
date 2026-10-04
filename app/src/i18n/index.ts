/**
 * Internationalisation — 5 langues, dictionnaires plats.
 * Toutes les chaînes traduisibles passent par t(key).
 */

import { useStore } from "../store/store";

export * from "./core";
import { setCurrentLocale, tFor } from "./core";

// La logique hors React (tNow) suit la langue du store.
setCurrentLocale(useStore.getState().locale);
useStore.subscribe((st) => setCurrentLocale(st.locale));

/** React hook returning a `t(key, params?)` function bound to the current locale. */
export function useT() {
  const locale = useStore((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) => tFor(locale, key, params);
}

