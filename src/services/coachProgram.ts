import {
  BodyAnalysisResult,
  ExperienceLevel,
  OnboardingAnswers,
  WorkoutLocation,
} from '../context/OnboardingContext';
import {
  EXERCISE_LIBRARY,
  ExerciseEquipment,
  MuscleGroupKey,
  ProgramExercise,
  muscleLabel,
} from '../data/muscleGroups';
import { adjustSetsForExperience, filterByEquipment } from './workoutGenerator';
import { loadJson, removeKey, saveJson } from './storage';

/**
 * PROGRAMME D'ENTRAÎNEMENT PERSISTANT
 * ===================================
 *
 * RÈGLE CENTRALE : le programme cible exactement les muscles que l'analyse a
 * identifiés, ni plus ni moins, avec trois exercices chacun.
 *
 * Une version précédente construisait un découpage classique sur les onze
 * groupes musculaires, en donnant simplement plus de séries aux zones en
 * retard. Le rapport avec la photo devenait ténu : on retrouvait des séances
 * de mollets ou d'avant-bras que rien dans l'analyse ne justifiait, et les
 * zones réellement en retard se diluaient dans le reste. Le programme se
 * limite donc désormais à ce qui a été observé.
 *
 * Chaque muscle ciblé reçoit sa propre séance : trois exercices, choisis dans
 * notre bibliothèque selon le lieu d'entraînement et le matériel déclaré.
 *
 * Deux règles de fond, inchangées :
 *   • Le contenu vient TOUJOURS de notre bibliothèque d'exercices, jamais
 *     d'une génération libre par l'IA. Un exercice inventé par un modèle peut
 *     être dangereux ; une charge de travail inventée l'est tout autant.
 *   • Sans analyse, aucun programme n'est fabriqué : un plan présenté comme
 *     personnalisé alors que rien n'a été observé serait un mensonge.
 */

export type SessionExercise = ProgramExercise & {
  muscleGroup: MuscleGroupKey;
  muscleLabel: string;
  /** Cet exercice cible une zone identifiée comme en retard sur la photo. */
  isPriority: boolean;
};

export type ProgramSession = {
  id: string;
  /** Rang de la séance dans la semaine, à partir de 1. */
  index: number;
  title: string;
  /** Muscle travaillé. Une séance, un muscle ciblé. */
  focusMuscles: MuscleGroupKey[];
  exercises: SessionExercise[];
  estimatedMinutes: number;
  /** Jour conseillé (0 = lundi). Indicatif : rien n'est verrouillé sur une date. */
  suggestedDay: number;
};

export type CoachProgram = {
  id: string;
  createdAt: number;
  /** Analyse corporelle à l'origine de ce programme. */
  basedOnAnalysisId?: string;
  location: WorkoutLocation;
  level: ExperienceLevel;
  goal?: string;
  sessionsPerWeek: number;
  priorityMuscles: MuscleGroupKey[];
  sessions: ProgramSession[];
  /** Numéro de cycle : 1 pour le programme initial, +1 à chaque analyse. */
  cycle: number;
};

const MUSCLE_KEYS = Object.keys(EXERCISE_LIBRARY) as MuscleGroupKey[];

const isMuscleKey = (key: string): key is MuscleGroupKey =>
  (MUSCLE_KEYS as string[]).includes(key);

/** Exercices par muscle ciblé. Assez pour varier les angles, assez court pour
 * que la séance soit tenue jusqu'au bout. */
export const EXERCISES_PER_MUSCLE = 3;

/**
 * Au-delà, ce n'est plus un programme ciblé mais un catalogue. Ne sert que
 * lorsque l'analyse ne signale aucun retard : on entretient alors les muscles
 * réellement observés, sans en inventer d'autres.
 */
const MAX_MAINTENANCE_MUSCLES = 4;

/** Jours conseillés selon le nombre de séances, étalés pour laisser de la
 * récupération plutôt que empilés en début de semaine. */
const DAY_PLAN: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
};

export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ---------------------------------------------------------------------------
// Choix des muscles ciblés
// ---------------------------------------------------------------------------

/** Zones réellement observées comme en retard sur la photo, au maximum 3. */
export function priorityMusclesOf(analysis?: BodyAnalysisResult): MuscleGroupKey[] {
  if (!analysis) return [];
  return analysis.zones
    .filter((z) => z.status === 'priority' && z.visible !== false && !z.isGeneric)
    .map((z) => String(z.muscleGroup))
    .filter(isMuscleKey);
}

/**
 * Les muscles que le programme va travailler.
 *
 * Ce sont les zones en retard, et elles seules. Si l'analyse n'en signale
 * aucune, il n'y a rien à rattraper : on retient alors les muscles visibles
 * sur la photo pour un travail d'entretien, plutôt que de laisser un programme
 * vide ou d'inventer un retard qui n'a pas été observé.
 */
export function targetMusclesOf(analysis?: BodyAnalysisResult): MuscleGroupKey[] {
  const priority = priorityMusclesOf(analysis);
  if (priority.length > 0) return priority;
  if (!analysis) return [];
  return analysis.zones
    .filter((z) => z.visible !== false && !z.isGeneric)
    .map((z) => String(z.muscleGroup))
    .filter(isMuscleKey)
    .slice(0, MAX_MAINTENANCE_MUSCLES);
}

// ---------------------------------------------------------------------------
// Construction du programme
// ---------------------------------------------------------------------------

/**
 * Les trois exercices d'un muscle, pour le lieu d'entraînement choisi.
 *
 * Le matériel déclaré passe en premier : quelqu'un qui n'a que des élastiques
 * voit d'abord ce qu'il peut faire. Si son matériel ne couvre pas les trois
 * exercices, on complète avec le reste du catalogue plutôt que d'en proposer
 * un ou deux — chaque exercice affiche de toute façon le matériel qu'il exige,
 * donc rien n'est masqué.
 */
function pickExercises(
  muscle: MuscleGroupKey,
  location: WorkoutLocation,
  equipment: ExerciseEquipment[] | undefined,
  count: number = EXERCISES_PER_MUSCLE,
): ProgramExercise[] {
  const source = location === 'gym' ? EXERCISE_LIBRARY[muscle].gym : EXERCISE_LIBRARY[muscle].home;
  const owned = filterByEquipment(source, equipment);
  const rest = source.filter((e) => !owned.includes(e));
  return [...owned, ...rest].slice(0, count);
}

/**
 * Volume de séries : plus élevé sur une zone en retard, ajusté au niveau
 * déclaré. Borné des deux côtés, ni une séance vide ni un volume qu'aucun
 * débutant ne tiendra.
 */
function setsFor(base: number, isPriority: boolean, level: ExperienceLevel | undefined): number {
  const sets = adjustSetsForExperience(base, level) + (isPriority ? 1 : 0);
  return Math.max(2, Math.min(6, sets));
}

/**
 * Durée estimée : environ 2,5 min par série (exécution et récupération), plus
 * 8 min d'échauffement. Une estimation, jamais une promesse.
 */
function estimateMinutes(exercises: SessionExercise[]): number {
  const sets = exercises.reduce((sum, e) => sum + e.sets, 0);
  return Math.round(8 + sets * 2.5);
}

/**
 * Construit le programme : une séance par muscle analysé, trois exercices
 * chacun, adaptés au lieu et au matériel.
 *
 * Sans analyse, renvoie un programme sans séance. L'interface doit alors
 * proposer de lancer l'analyse, pas afficher un plan vide.
 */
export function buildProgram(
  answers: OnboardingAnswers,
  options: { analysisId?: string; cycle?: number } = {},
): CoachProgram {
  const location: WorkoutLocation = answers.workoutLocation ?? 'gym';
  const level = answers.experienceLevel ?? 'debutant';
  const priority = priorityMusclesOf(answers.analysis);
  const targets = targetMusclesOf(answers.analysis);
  const days = DAY_PLAN[targets.length] ?? DAY_PLAN[4];

  const sessions: ProgramSession[] = targets.map((muscle, index) => {
    const isPriority = priority.includes(muscle);
    const exercises: SessionExercise[] = pickExercises(muscle, location, answers.equipment).map(
      (ex) => ({
        ...ex,
        sets: setsFor(ex.sets, isPriority, level),
        muscleGroup: muscle,
        muscleLabel: muscleLabel(muscle),
        isPriority,
      }),
    );

    return {
      id: `s${index + 1}`,
      index: index + 1,
      title: muscleLabel(muscle),
      focusMuscles: [muscle],
      exercises,
      estimatedMinutes: estimateMinutes(exercises),
      suggestedDay: days[index] ?? index,
    };
  });

  return {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    basedOnAnalysisId: options.analysisId,
    location,
    level,
    goal: answers.goal,
    // Le rythme suit l'analyse, pas la fréquence déclarée : il y a autant de
    // séances que de muscles à travailler.
    sessionsPerWeek: sessions.length,
    priorityMuscles: priority,
    sessions,
    cycle: options.cycle ?? 1,
  };
}

/** Nombre total d'exercices du programme, tous jours confondus. */
export function totalExercises(program: CoachProgram): number {
  return program.sessions.reduce((sum, s) => sum + s.exercises.length, 0);
}

/**
 * Séries hebdomadaires consacrées à chaque muscle : c'est la mesure concrète
 * du lien entre une zone détectée sur la photo et l'entraînement réel.
 */
export function weeklySetsByMuscle(program: CoachProgram): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      totals[exercise.muscleGroup] = (totals[exercise.muscleGroup] ?? 0) + exercise.sets;
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Persistance, par compte
// ---------------------------------------------------------------------------

const GUEST_BUCKET = 'guest';
const programKey = (userId?: string) => `bodyai.program.${userId || GUEST_BUCKET}`;

export async function loadProgram(userId?: string): Promise<CoachProgram | null> {
  const program = await loadJson<CoachProgram>(programKey(userId));
  // Un programme enregistré par une version antérieure du format n'a pas de
  // séances exploitables : mieux vaut le régénérer que d'afficher du vide.
  if (!program || !Array.isArray(program.sessions) || program.sessions.length === 0) return null;
  return program;
}

export async function saveProgram(userId: string | undefined, program: CoachProgram): Promise<void> {
  await saveJson(programKey(userId), program);
}

export async function clearProgram(userId?: string): Promise<void> {
  await removeKey(programKey(userId));
}
