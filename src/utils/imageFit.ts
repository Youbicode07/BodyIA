/**
 * Calcul de la zone réellement occupée par une image dans son conteneur.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * Une <Image> React Native sans `resizeMode` utilise "cover" : l'image est
 * agrandie puis ROGNÉE pour remplir le cadre. Or l'IA raisonne sur l'image
 * ENTIÈRE et renvoie des coordonnées 0-1 rapportées à celle-ci.
 *
 * Dessiner ces coordonnées directement sur le conteneur revient donc à ignorer
 * le rognage : tous les repères se retrouvent décalés (mesuré : jusqu'à 20 %
 * de la hauteur quand une photo 3:4 est affichée dans un cadre 4:5).
 *
 * On calcule ici le rectangle exact où l'image est peinte, et l'overlay projette
 * ses coordonnées dedans. Les repères tombent alors au bon endroit quel que
 * soit le format de la photo.
 */

export type FitRect = { x: number; y: number; width: number; height: number };

export type FitMode = 'cover' | 'contain';

/**
 * @param naturalWidth  largeur d'origine de la photo (px)
 * @param naturalHeight hauteur d'origine de la photo (px)
 * @param boxWidth      largeur du cadre d'affichage (px)
 * @param boxHeight     hauteur du cadre d'affichage (px)
 */
export function fitImage(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
  mode: FitMode = 'contain',
): FitRect {
  // Dimensions inconnues (Image.getSize pas encore revenu) : on suppose que
  // l'image remplit exactement le cadre, ce qui est le cas après ajustement
  // du ratio du conteneur.
  if (!naturalWidth || !naturalHeight) {
    return { x: 0, y: 0, width: boxWidth, height: boxHeight };
  }

  const scale =
    mode === 'cover'
      ? Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight)
      : Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);

  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  // L'image est centrée : en "contain" les marges sont vides (letterbox),
  // en "cover" elles sont négatives (partie rognée hors cadre).
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height,
  };
}

/** Projette un point normalisé (0-1 sur l'image d'origine) en pixels du cadre. */
export function project(rect: FitRect, nx: number, ny: number) {
  return { x: rect.x + nx * rect.width, y: rect.y + ny * rect.height };
}
