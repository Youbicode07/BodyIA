import type { MuscleGroupKey, ZoneShape } from '../data/muscleGroups';

/**
 * PLACEMENT ANATOMIQUE DES REPÈRES
 * ================================
 *
 * Constat mesuré : demander à l'IA une boîte par muscle donne des repères faux.
 * Sur une photo réelle, les 5 repères renvoyés ont TOUS dû être recalés, avec
 * des boîtes couvrant jusqu'à 84 % de la largeur de l'image pour un seul muscle.
 * L'IA sait dire CE QU'ELLE VOIT, elle ne sait pas dire OÙ précisément.
 *
 * On sépare donc les rôles :
 *   • l'IA fournit deux repères simples qu'elle localise de façon fiable —
 *     la ligne des ÉPAULES et la ligne des HANCHES — plus, pour chaque muscle,
 *     s'il est visible et ce qu'elle y observe ;
 *   • ce fichier place les repères par proportions anatomiques.
 *
 * Pourquoi épaules + hanches plutôt que la boîte du corps entier : sur une
 * photo de musculation, la tête et les pieds sont très souvent hors cadre.
 * Une boîte « corps entier » vaut alors le cadre entier, et toutes les
 * proportions mesurées depuis le sommet du crâne deviennent fausses — c'est
 * exactement ce qui décalait les repères vers le haut. Les épaules et les
 * hanches, elles, sont visibles sur pratiquement toutes les photos utiles, et
 * elles suffisent à reconstruire l'échelle du corps.
 */

export type BodyFrame = {
  /** Axe vertical du corps (0 = bord gauche de l'image, 1 = bord droit). */
  cx: number;
  /** Ligne des épaules, en fraction de la hauteur de l'image. */
  yS: number;
  /** Ligne des hanches. */
  yH: number;
  /** Largeur d'épaules, en fraction de la largeur de l'image. */
  S: number;
  /** Longueur du torse (yH - yS). Unité verticale de référence. */
  T: number;
};

type Placement = {
  /** Origine verticale : la ligne des épaules ou celle des hanches. */
  from: 'shoulder' | 'hip';
  /** Décalage vertical depuis cette ligne, en unités de torse T. */
  dy: number;
  /** Écart horizontal à l'axe du corps, en unités de largeur d'épaules S. */
  dx: number;
  /** Muscle pair : un repère de chaque côté de l'axe. */
  pair: boolean;
  /** Largeur du repère en unités de S, hauteur en unités de T. */
  w: number;
  h: number;
  shape: ZoneShape;
};

/**
 * Proportions humaines de référence, exprimées relativement au torse.
 * Repères utilisés : coude ≈ 0,95 T sous les épaules, poignet ≈ 1,45 T,
 * genou ≈ 0,78 T sous les hanches, cheville ≈ 1,5 T.
 */
export const ANATOMY: Record<MuscleGroupKey, Placement> = {
  // Deltoïdes : aux pointes des épaules, donc presque à la demi-largeur.
  epaules: { from: 'shoulder', dy: 0.05, dx: 0.44, pair: true, w: 0.3, h: 0.26, shape: 'circle' },
  // Pectoraux : deux masses de part et d'autre du sternum.
  pectoraux: { from: 'shoulder', dy: 0.28, dx: 0.2, pair: true, w: 0.36, h: 0.3, shape: 'circle' },
  // Dos : une seule grande zone, jamais visible en même temps que les pectoraux.
  dos: { from: 'shoulder', dy: 0.35, dx: 0, pair: false, w: 0.98, h: 0.62, shape: 'rect' },
  // Bras : milieu du segment épaule vers coude.
  biceps: { from: 'shoulder', dy: 0.48, dx: 0.46, pair: true, w: 0.22, h: 0.3, shape: 'circle' },
  // Triceps : face arrière du bras, donc légèrement plus à l'extérieur de face.
  triceps: { from: 'shoulder', dy: 0.48, dx: 0.5, pair: true, w: 0.2, h: 0.3, shape: 'circle' },
  // Abdominaux : centrés sur le nombril, aux ~70 % du torse.
  abdominaux: { from: 'shoulder', dy: 0.72, dx: 0, pair: false, w: 0.52, h: 0.44, shape: 'rect' },
  // Avant-bras : milieu du segment coude vers poignet.
  avant_bras: { from: 'shoulder', dy: 1.18, dx: 0.5, pair: true, w: 0.2, h: 0.32, shape: 'circle' },
  fessiers: { from: 'hip', dy: 0.12, dx: 0, pair: false, w: 0.78, h: 0.3, shape: 'rect' },
  // Cuisses : milieu du segment hanche vers genou.
  quadriceps: { from: 'hip', dy: 0.42, dx: 0.22, pair: true, w: 0.34, h: 0.52, shape: 'rect' },
  ischio_jambiers: { from: 'hip', dy: 0.46, dx: 0.22, pair: true, w: 0.32, h: 0.48, shape: 'rect' },
  // Mollets : sous le genou (0,78 T), au niveau du galbe.
  mollets: { from: 'hip', dy: 1.05, dx: 0.2, pair: true, w: 0.26, h: 0.36, shape: 'circle' },
};

/** Cadre de repli : personne debout, centrée, cadrée du buste aux cuisses. */
export const DEFAULT_FRAME: BodyFrame = { cx: 0.5, yS: 0.22, yH: 0.62, S: 0.46, T: 0.4 };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Centre + largeur d'une boîte Gemini [ymin, xmin, ymax, xmax] en 0-1000. */
function boxCenter(box?: number[]) {
  if (!box || box.length !== 4 || !box.every(finite)) return null;
  const [ymin, xmin, ymax, xmax] = box;
  const top = Math.min(ymin, ymax) / 1000;
  const bottom = Math.max(ymin, ymax) / 1000;
  const left = Math.min(xmin, xmax) / 1000;
  const right = Math.max(xmin, xmax) / 1000;
  // Une boîte entièrement nulle signifie « non renseignée ».
  if (right - left === 0 && bottom - top === 0) return null;
  return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
}

/**
 * Reconstruit le cadre du corps à partir des repères renvoyés par l'IA.
 * Chaque valeur est vérifiée : une mesure invraisemblable est remplacée par une
 * estimation dérivée de l'autre repère, jamais utilisée telle quelle.
 */
export function buildBodyFrame(
  shoulderBox?: number[],
  hipBox?: number[],
  personBox?: number[],
): BodyFrame {
  const shoulder = boxCenter(shoulderBox);
  const hip = boxCenter(hipBox);
  const person = boxCenter(personBox);

  // Largeur d'épaules. À défaut, ~75 % de la largeur du corps (le reste, ce
  // sont les bras qui pendent de chaque côté).
  let S = shoulder?.w ?? (person ? person.w * 0.75 : DEFAULT_FRAME.S);
  if (!finite(S) || S < 0.08 || S > 1) S = DEFAULT_FRAME.S;

  let yS = shoulder?.y ?? (person ? person.y - person.h * 0.28 : DEFAULT_FRAME.yS);
  if (!finite(yS)) yS = DEFAULT_FRAME.yS;

  // Longueur du torse : mesurée si les deux lignes sont cohérentes, sinon
  // déduite de la largeur d'épaules (rapport moyen torse/épaules ≈ 1,25).
  let T = hip && hip.y > yS ? hip.y - yS : S * 1.25;
  if (!finite(T) || T < 0.08 || T > 0.8) T = S * 1.25;

  const yH = yS + T;

  // Axe du corps : moyenne des deux lignes quand on les a toutes les deux.
  let cx =
    shoulder && hip
      ? (shoulder.x + hip.x) / 2
      : shoulder?.x ?? hip?.x ?? person?.x ?? DEFAULT_FRAME.cx;
  if (!finite(cx) || cx < 0 || cx > 1) cx = DEFAULT_FRAME.cx;

  return { cx, yS, yH, S, T };
}

export type PlacedZone = {
  x: number;
  y: number;
  /** Repère jumeau (muscle pair). Absent pour les muscles centraux. */
  mirrorX?: number;
  shape: ZoneShape;
  radius?: number;
  width?: number;
  height?: number;
};

/**
 * Borne large, volontairement pas 0-1 : un muscle hors du cadre (jambes
 * coupées sur une photo de buste) doit RESTER hors du cadre. Le ramener au
 * bord collerait un faux repère sur la tranche de la photo ; l'overlay, lui,
 * écarte simplement les repères qui tombent en dehors.
 */
const bound = (v: number) => Math.min(Math.max(v, -0.4), 1.4);

/**
 * Place un muscle sur l'image à partir du cadre du corps.
 * Résultat en coordonnées relatives 0-1 de l'image D'ORIGINE (celle qu'a vue
 * l'IA) : c'est l'overlay qui les projette ensuite dans la zone réellement
 * affichée à l'écran.
 */
export function placeMuscle(key: MuscleGroupKey, frame: BodyFrame): PlacedZone {
  const p = ANATOMY[key];
  const originY = p.from === 'shoulder' ? frame.yS : frame.yH;

  const y = bound(originY + p.dy * frame.T);
  const w = p.w * frame.S;
  const h = p.h * frame.T;

  const size: Pick<PlacedZone, 'radius' | 'width' | 'height'> =
    p.shape === 'circle'
      ? { radius: Math.max(0.025, Math.min(w, h) / 2) }
      : { width: w, height: h };

  if (p.pair) {
    const offset = p.dx * frame.S;
    return {
      x: bound(frame.cx - offset),
      mirrorX: bound(frame.cx + offset),
      y,
      shape: p.shape,
      ...size,
    };
  }

  return { x: bound(frame.cx + p.dx * frame.S), y, shape: p.shape, ...size };
}
