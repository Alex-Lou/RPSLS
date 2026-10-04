import { useCallback, useState } from "react";

export type ProfileTab = "profile" | "settings";

/** Clé localStorage de l'onglet mémorisé (préférence d'affichage locale,
 *  volontairement HORS du store persistant/synchronisé). */
const KEY = "rpsls.profileTab";

function read(): ProfileTab {
  try {
    const v = localStorage.getItem(KEY);
    return v === "settings" ? "settings" : "profile";
  } catch {
    // Stockage indisponible (navigation privée, WebView restreinte…).
    return "profile";
  }
}

/** Onglet actif de la page Profil, mémorisé d'une visite à l'autre.
 *  Défaut : « Profil ». */
export function useProfileTab(): [ProfileTab, (t: ProfileTab) => void] {
  const [tab, setTab] = useState<ProfileTab>(read);
  const change = useCallback((next: ProfileTab) => {
    setTab(next);
    try { localStorage.setItem(KEY, next); } catch { /* sans effet si bloqué */ }
  }, []);
  return [tab, change];
}
