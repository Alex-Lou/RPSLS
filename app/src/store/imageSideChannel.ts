import type { Player } from "../types";
import { useStore } from "./store";

/** Images perso (avatar, fonds, plateaux importés : data URLs de plusieurs Mo
 *  au total) rangées HORS du blob principal `rpsls-app-state`. Zustand réécrit
 *  ce blob ENTIER à chaque set() : avec les images dedans, chaque fin de match
 *  sérialisait et écrivait des Mo. Ici elles ne sont écrites que quand elles
 *  changent (import / suppression dans le Profil), soit rarement. */
export const IMAGES_STORAGE_KEY = "rpsls-images";

const IMAGE_FIELDS = ["avatar", "customBgUrl", "customPadUrl", "customBgs", "customPads"] as const;
type ImageField = (typeof IMAGE_FIELDS)[number];
export type PlayerImages = Partial<Pick<Player, ImageField>>;

/** Vrai dès que la clé dédiée contient les images COURANTES. Tant que c'est
 *  faux (écriture jamais faite ou échouée), le blob principal les garde :
 *  jamais de fenêtre où elles ne seraient sauvegardées nulle part. */
let sideReady = false;

function pick(p: Player): PlayerImages {
  const out: PlayerImages = {};
  for (const k of IMAGE_FIELDS) if (p[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  return out;
}

function write(p: Player): void {
  try {
    localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(pick(p)));
    sideReady = true;
  } catch {
    // Quota / stockage indisponible : le blob principal reprend les images.
    sideReady = false;
  }
}

/** Lecture brute au boot (non validée : elle passe ensuite par
 *  sanitisePersisted avec le reste du joueur, cf. persistConfig.merge). */
export function readSideImages(): PlayerImages | null {
  try {
    const raw = localStorage.getItem(IMAGES_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as PlayerImages) : null;
  } catch {
    return null;
  }
}

/** Joueur à persister dans le blob principal : sans les images si elles sont
 *  déjà en sûreté dans leur clé dédiée. */
export function playerForMainBlob(p: Player): Player {
  if (!sideReady) return p;
  const rest = { ...p } as Record<string, unknown>;
  for (const k of IMAGE_FIELDS) delete rest[k];
  return rest as unknown as Player;
}

/** À appeler UNE fois après la création du store (cf. store.ts). Écrit les
 *  images courantes (migration des anciennes versions), puis à chaque
 *  changement de l'une d'elles. */
export function initImageSideChannel(): void {
  let last = useStore.getState().player;
  write(last);
  useStore.subscribe((s) => {
    const p = s.player;
    if (p === last) return;
    const changed = IMAGE_FIELDS.some((k) => p[k] !== last[k]);
    last = p;
    if (changed) write(p);
  });
}
