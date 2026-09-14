import { ExperienceLevel } from '../context/OnboardingContext';
import { ExerciseEquipment, ProgramExercise } from '../data/muscleGroups';

/**
 * Règles de sélection d'exercices partagées.
 *
 * La construction du programme vit désormais dans coachProgram.ts, qui produit
 * de vraies séances enregistrées. Ce fichier ne garde que les trois règles
 * réutilisées partout : filtrer par matériel possédé, borner le nombre
 * d'exercices affichés, et ajuster le volume au niveau déclaré.
 */

/**
 * Ne garde que les exercices utilisant du matériel réellement déclaré par
 * l'utilisateur. Ne renvoie jamais une liste vide : sans matériel possédé
 * pour un exercice donné, mieux vaut proposer tout le catalogue que rien.
 */
export function filterByEquipment(
  exercises: ProgramExercise[],
  owned?: ExerciseEquipment[],
): ProgramExercise[] {
  if (!owned || owned.length === 0) return exercises;
  const filtered = exercises.filter((e) => owned.includes(e.equipment));
  return filtered.length > 0 ? filtered : exercises;
}

/** Nombre d'exercices affichés par muscle : volontairement court, pas un
 * catalogue exhaustif. */
export const MAX_EXERCISES_PER_MUSCLE = 3;

export function capExercises(
  exercises: ProgramExercise[],
  max: number = MAX_EXERCISES_PER_MUSCLE,
): ProgramExercise[] {
  return exercises.slice(0, max);
}

/**
 * Ajuste l'affichage du nombre de séries selon le niveau déclaré — un
 * réglage de présentation, pas une réécriture des données de la bibliothèque.
 * Volontairement modeste (±1 série, jamais moins de 2) : ce n'est pas à une
 * heuristique de décider d'un vrai plan de charge.
 */
export function adjustSetsForExperience(sets: number, level?: ExperienceLevel): number {
  if (level === 'debutant') return Math.max(2, sets - 1);
  if (level === 'avance') return sets + 1;
  return sets;
}
