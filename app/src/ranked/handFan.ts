/**
 * handFan — géométrie PARTAGÉE de l'éventail de cartes (main du joueur ET
 * indicateur de main adverse). Source UNIQUE : les deux éventails (bas = joueur,
 * haut = adversaire, en miroir) DOIVENT rester visuellement symétriques → toute
 * retouche ici s'applique aux deux côtés. Avant, la fonction était copiée à
 * l'identique dans CardHand et OppHandIndicator (dérive garantie à la moindre
 * retouche d'un seul côté).
 */

/** Angle par carte (spread), lift vertical des cartes externes, et chevauchement
 *  horizontal, selon le nombre de cartes en main. */
export function fanGeometry(total: number): { spread: number; lift: number; overlap: number } {
  if (total <= 1) return { spread: 0, lift: 0, overlap: 0 };
  if (total === 2) return { spread: 7, lift: 3, overlap: 2 };
  if (total === 3) return { spread: 9, lift: 5, overlap: 4 };
  return { spread: 8, lift: 7, overlap: 10 }; // 4 cartes
}
