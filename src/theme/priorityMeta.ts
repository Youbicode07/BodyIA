import { PriorityLevel } from '../data/muscleGroups';
import { colors } from './colors';

/** Couleur et libellé affichés pour chaque niveau de gravité d'un problème
 * prioritaire. Partagé entre l'écran d'analyse et la vue photo agrandie pour
 * qu'un même niveau soit toujours présenté de la même façon. */
export const PRIORITY_LEVEL_META: Record<PriorityLevel, { label: string; color: string }> = {
  haute: { label: 'Priorité haute', color: colors.danger },
  moyenne: { label: 'Priorité moyenne', color: colors.warning },
  faible: { label: 'Priorité faible', color: colors.carbs },
};
