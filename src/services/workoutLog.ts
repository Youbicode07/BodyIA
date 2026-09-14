import { CoachProgram, ProgramSession } from './coachProgram';
import { loadJson, removeKey, saveJson } from './storage';

/**
 * JOURNAL D'ENTRAÎNEMENT
 * ======================
 *
 * Rien dans l'application n'enregistrait ce qui était réellement fait. Le
 * tableau de bord affichait donc « 0 séance terminée » et une progression de
 * 42 % écrite en dur : deux chiffres qui ne mesuraient rien.
 *
 * Ce journal enregistre chaque séance terminée, avec les exercices réellement
 * cochés. Tout ce qui est présenté ensuite comme « progression », « régularité »
 * ou « série en cours » se calcule à partir de ces entrées — jamais d'une
 * estimation, et jamais d'une invention de l'IA. C'est aussi ce que le bilan de
 * suivi transmet à Gemini : sans lui, une absence de progrès serait impossible
 * à expliquer honnêtement (manque de travail ? programme inadapté ?).
 */

export type WorkoutLogEntry = {
  id: string;
  /** Horodatage de fin de séance. */
  date: number;
  sessionId: string;
  sessionTitle: string;
  /** Muscles travaillés pendant cette séance. */
  muscles: string[];
  completedExercises: number;
  totalExercises: number;
  /** Séries réellement effectuées, utilisées pour le volume par muscle. */
  setsByMuscle: Record<string, number>;
  durationMin?: number;
  feeling?: 'facile' | 'correct' | 'difficile';
};

const GUEST_BUCKET = 'guest';
const logKey = (userId?: string) => `bodyai.workoutlog.${userId || GUEST_BUCKET}`;

/** Au-delà, les entrées les plus anciennes sont oubliées : un journal illimité
 * finirait par ralentir chaque démarrage pour des données que plus rien
 * n'affiche. 400 séances couvrent largement deux ans d'entraînement. */
const MAX_ENTRIES = 400;

export async function loadWorkoutLog(userId?: string): Promise<WorkoutLogEntry[]> {
  const list = await loadJson<WorkoutLogEntry[]>(logKey(userId));
  return Array.isArray(list) ? list.sort((a, b) => b.date - a.date) : [];
}

/**
 * Construit l'entrée correspondant à une séance terminée.
 * `completedIds` contient les identifiants d'exercices réellement cochés :
 * une séance abandonnée à moitié doit se lire comme telle.
 */
export function toLogEntry(
  session: ProgramSession,
  completedIndexes: number[],
  extra: { durationMin?: number; feeling?: WorkoutLogEntry['feeling'] } = {},
): WorkoutLogEntry {
  const done = session.exercises.filter((_, i) => completedIndexes.includes(i));
  const setsByMuscle: Record<string, number> = {};
  for (const exercise of done) {
    setsByMuscle[exercise.muscleGroup] = (setsByMuscle[exercise.muscleGroup] ?? 0) + exercise.sets;
  }

  return {
    id: `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    date: Date.now(),
    sessionId: session.id,
    sessionTitle: session.title,
    muscles: [...new Set(done.map((e) => e.muscleGroup))],
    completedExercises: done.length,
    totalExercises: session.exercises.length,
    setsByMuscle,
    ...extra,
  };
}

export async function appendWorkout(
  userId: string | undefined,
  entry: WorkoutLogEntry,
): Promise<WorkoutLogEntry[]> {
  const current = await loadWorkoutLog(userId);
  const next = [entry, ...current].slice(0, MAX_ENTRIES);
  await saveJson(logKey(userId), next);
  return next;
}

export async function clearWorkoutLog(userId?: string): Promise<void> {
  await removeKey(logKey(userId));
}

// ---------------------------------------------------------------------------
// Statistiques — calculées, jamais estimées
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lundi 00:00 de la semaine contenant `at`. */
export function startOfWeek(at: number = Date.now()): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  // getDay() renvoie 0 pour dimanche : on ramène la semaine au lundi, comme
  // le reste de l'application (DAY_LABELS commence à lundi).
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY_MS;
}

export type WorkoutStats = {
  /** Séances terminées depuis lundi. */
  thisWeek: number;
  /** Séances prévues par semaine dans le programme en cours. */
  weeklyTarget: number;
  /** Part de l'objectif hebdomadaire atteinte, bornée à 100. */
  weeklyCompletion: number;
  /** Semaines consécutives où l'objectif a été atteint, en partant de celle-ci. */
  streakWeeks: number;
  totalSessions: number;
  lastWorkoutAt?: number;
  /** Séries réalisées par muscle sur les 14 derniers jours. */
  recentSetsByMuscle: Record<string, number>;
};

export function computeStats(
  log: WorkoutLogEntry[],
  program: CoachProgram | null,
  now: number = Date.now(),
): WorkoutStats {
  const weeklyTarget = program?.sessionsPerWeek ?? 0;
  const weekStart = startOfWeek(now);
  const thisWeek = log.filter((e) => e.date >= weekStart).length;

  // Régularité : on ne compte une semaine que si l'objectif a été atteint. La
  // semaine en cours n'interrompt jamais la série tant qu'elle n'est pas finie
  // — sanctionner un lundi matin n'aurait aucun sens.
  let streakWeeks = 0;
  for (let week = thisWeek >= weeklyTarget && weeklyTarget > 0 ? 0 : 1; week < 52; week += 1) {
    const start = weekStart - week * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    const count = log.filter((e) => e.date >= start && e.date < end).length;
    if (weeklyTarget > 0 && count >= weeklyTarget) streakWeeks += 1;
    else break;
  }

  const recentSetsByMuscle: Record<string, number> = {};
  for (const entry of log.filter((e) => e.date >= now - 14 * DAY_MS)) {
    for (const [muscle, sets] of Object.entries(entry.setsByMuscle ?? {})) {
      recentSetsByMuscle[muscle] = (recentSetsByMuscle[muscle] ?? 0) + sets;
    }
  }

  return {
    thisWeek,
    weeklyTarget,
    weeklyCompletion: weeklyTarget > 0 ? Math.min(100, Math.round((thisWeek / weeklyTarget) * 100)) : 0,
    streakWeeks,
    totalSessions: log.length,
    lastWorkoutAt: log[0]?.date,
    recentSetsByMuscle,
  };
}

/**
 * Séance à proposer ensuite : celle qui suit la dernière terminée, en tournant
 * sur la semaine. Un programme suivi dans l'ordre reste dans l'ordre, et une
 * reprise après une pause redémarre simplement à la suite.
 */
export function nextSession(
  program: CoachProgram | null,
  log: WorkoutLogEntry[],
): ProgramSession | null {
  if (!program || program.sessions.length === 0) return null;
  const last = log.find((e) => program.sessions.some((s) => s.id === e.sessionId));
  if (!last) return program.sessions[0];
  const lastIndex = program.sessions.findIndex((s) => s.id === last.sessionId);
  return program.sessions[(lastIndex + 1) % program.sessions.length];
}

/** Séances déjà terminées cette semaine, par identifiant de séance. */
export function completedThisWeek(log: WorkoutLogEntry[], now: number = Date.now()): Set<string> {
  const weekStart = startOfWeek(now);
  return new Set(log.filter((e) => e.date >= weekStart).map((e) => e.sessionId));
}
