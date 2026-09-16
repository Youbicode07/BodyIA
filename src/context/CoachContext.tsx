import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { OnboardingAnswers, useOnboarding } from './OnboardingContext';
import { useUser } from './UserContext';
import { API_CONFIGURED, dataApi, loadToken } from '../services/api';
import { enqueue } from '../services/sync';
import {
  HistoryEntry,
  clearFollowUpSnooze,
  clearHistory,
  isFollowUpDue,
  loadFollowUpSnooze,
  loadHistory,
  nextCheckInDate,
  snoozeFollowUp,
} from '../services/analysisHistory';
import {
  CoachProgram,
  ProgramSession,
  buildProgram,
  clearProgram,
  loadProgram,
  saveProgram,
} from '../services/coachProgram';
import {
  WorkoutLogEntry,
  WorkoutStats,
  appendWorkout,
  clearWorkoutLog,
  completedThisWeek,
  computeStats,
  loadWorkoutLog,
  nextSession,
  toLogEntry,
} from '../services/workoutLog';

/**
 * ÉTAT DU COACH
 * =============
 *
 * Un seul endroit où vivent le programme, le journal d'entraînement et
 * l'historique d'analyses — les trois choses que l'application produisait sans
 * jamais les relier. Chaque écran lisait auparavant sa propre source, ce qui
 * rendait impossible la moindre cohérence : le tableau de bord ne pouvait pas
 * savoir ce que l'onglet Corps venait d'apprendre.
 *
 * Deux enchaînements y vivent :
 *   • le programme suit la dernière analyse archivée. Dès qu'une analyse plus
 *     récente apparaît dans l'historique, les séances sont reconstruites sur
 *     ses zones prioritaires, sans que l'écran d'analyse ait à le demander.
 *   • finishSession() : une séance terminée est enregistrée → la progression
 *     affichée change réellement.
 */

type CoachContextType = {
  isReady: boolean;
  program: CoachProgram | null;
  workoutLog: WorkoutLogEntry[];
  history: HistoryEntry[];
  stats: WorkoutStats;
  /** Séance à proposer maintenant, ou null sans programme. */
  upcoming: ProgramSession | null;
  /** Identifiants des séances déjà faites cette semaine. */
  doneThisWeek: Set<string>;
  /** Le suivi obligatoire à 15 jours est échu. */
  followUpDue: boolean;
  /** Date du prochain suivi, ou undefined sans analyse. */
  nextCheckIn?: number;

  refresh: () => Promise<void>;
  /** (Re)construit le programme depuis l'analyse et le profil courants.
   * `overrides` sert quand une réponse vient d'être modifiée : la mise à jour
   * du contexte d'inscription n'est pas encore visible ici au moment de
   * l'appel, et reconstruire avec l'ancienne valeur produirait un programme
   * pour le mauvais lieu d'entraînement. */
  regenerateProgram: (overrides?: Partial<OnboardingAnswers>) => Promise<CoachProgram>;
  finishSession: (
    session: ProgramSession,
    completedIndexes: number[],
    extra?: { durationMin?: number; feeling?: WorkoutLogEntry['feeling'] },
  ) => Promise<void>;
  /** Reporte le suivi obligatoire de 24 h (soupape en cas de panne IA). */
  snoozeCheckIn: () => Promise<void>;
  /** Efface programme, journal et historique du compte courant. */
  resetCoachData: () => Promise<void>;
};

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const { user, isReady: userReady } = useUser();
  const { answers, isReady: onboardingReady } = useOnboarding();

  const [program, setProgram] = useState<CoachProgram | null>(null);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLogEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [isReady, setReady] = useState(false);

  const userId = user?.id;

  const refresh = useCallback(async () => {
    // Local d'abord : le tableau de bord doit s'afficher sans attendre le réseau.
    const [savedProgram, log, entries, snooze] = await Promise.all([
      loadProgram(userId),
      loadWorkoutLog(userId),
      loadHistory(userId),
      loadFollowUpSnooze(userId),
    ]);
    setProgram(savedProgram);
    setWorkoutLog(log);
    setHistory(entries);
    setSnoozedUntil(snooze);

    // Puis le serveur, SANS bloquer l'affichage. Un hébergement gratuit sort
    // de veille en une minute ; attendre ici figerait le tableau de bord aussi
    // longtemps, alors que les données locales sont déjà prêtes à l'écran.
    // On fusionne par identifiant, jamais on ne remplace : ce qui a été produit
    // hors ligne et pas encore envoyé doit survivre.
    if (!userId || !API_CONFIGURED || !(await loadToken())) return;
    void (async () => {
    try {
      const [remoteProgram, remoteAnalyses, remoteWorkouts] = await Promise.all([
        dataApi.getProgram(),
        dataApi.getAnalyses(),
        dataApi.getWorkouts(),
      ]);

      if (remoteProgram?.program && !savedProgram) {
        setProgram(remoteProgram.program);
        await saveProgram(userId, remoteProgram.program);
      }

      const mergeById = <T extends { id?: string }>(remote: T[], local: T[]) => {
        const byId = new Map<string, T>();
        for (const item of [...(remote ?? []), ...local]) {
          if (item?.id) byId.set(item.id, item);
        }
        return [...byId.values()];
      };

      const mergedHistory = mergeById(remoteAnalyses?.analyses ?? [], entries).sort(
        (a: any, b: any) => b.date - a.date,
      );
      const mergedLog = mergeById(remoteWorkouts?.workouts ?? [], log).sort(
        (a: any, b: any) => b.date - a.date,
      );
      setHistory(mergedHistory as HistoryEntry[]);
      setWorkoutLog(mergedLog as WorkoutLogEntry[]);
    } catch {
      // Hors ligne ou session expirée : les données locales font foi.
    }
    })();
  }, [userId]);

  // Rechargement à chaque changement de compte : deux comptes sur le même
  // téléphone ne doivent jamais voir le programme l'un de l'autre.
  useEffect(() => {
    if (!userReady || !onboardingReady) return;
    let alive = true;
    setReady(false);
    refresh().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [userReady, onboardingReady, refresh]);

  const stats = useMemo(() => computeStats(workoutLog, program), [workoutLog, program]);

  const regenerateProgram = useCallback(async (overrides?: Partial<OnboardingAnswers>) => {
    const next = buildProgram({ ...answers, ...overrides }, {
      analysisId: history[0]?.id,
      cycle: program?.cycle ?? 1,
    });
    setProgram(next);
    await saveProgram(userId, next);
    if (userId) enqueue({ kind: 'program', program: next });
    return next;
  }, [answers, history, program, userId]);

  /**
   * Le programme suit la dernière analyse archivée.
   *
   * L'écran d'analyse se contente d'enregistrer son résultat dans
   * l'historique, comme il l'a toujours fait. C'est ici qu'on en tire les
   * conséquences : dès qu'une analyse plus récente que celle ayant servi au
   * programme apparaît, les séances sont reconstruites sur ses zones
   * prioritaires. Sans cela, quelqu'un pourrait refaire une analyse et garder
   * indéfiniment un programme calé sur des zones qui ne sont plus les siennes.
   */
  useEffect(() => {
    if (!isReady) return;
    const latest = history[0];
    // Pas d'analyse archivée, ou analyse absente du profil : rien à construire.
    // Un programme fabriqué sans observation ne reposerait sur rien.
    if (!latest || !answers.analysis) return;
    if (program?.basedOnAnalysisId === latest.id) return;
    regenerateProgram();
  }, [isReady, history, program, answers.analysis, regenerateProgram]);

  const finishSession = useCallback(
    async (
      session: ProgramSession,
      completedIndexes: number[],
      extra: { durationMin?: number; feeling?: WorkoutLogEntry['feeling'] } = {},
    ) => {
      const entry = toLogEntry(session, completedIndexes, extra);
      const updated = await appendWorkout(userId, entry);
      setWorkoutLog(updated);
      // La séance rejoint la base : elle compte dans la progression, et cette
      // progression doit survivre au téléphone.
      if (userId) enqueue({ kind: 'workout', workout: entry });
    },
    [userId],
  );

  /**
   * Remise à zéro, appelée quand l'utilisateur refait son questionnaire.
   *
   * Sans elle, le programme et l'historique survivaient à l'effacement des
   * réponses : l'application aurait continué à réclamer un suivi rattaché à
   * un profil qui n'existe plus, et à proposer des séances calées sur des
   * zones jamais réobservées.
   */
  const resetCoachData = useCallback(async () => {
    await Promise.all([
      clearProgram(userId),
      clearWorkoutLog(userId),
      clearHistory(userId),
      clearFollowUpSnooze(userId),
    ]);
    setProgram(null);
    setWorkoutLog([]);
    setHistory([]);
    setSnoozedUntil(0);
    if (userId) await enqueue({ kind: 'reset' });
  }, [userId]);

  const snoozeCheckIn = useCallback(async () => {
    const until = await snoozeFollowUp(userId);
    setSnoozedUntil(until);
  }, [userId]);

  const followUpDue = isFollowUpDue(history[0], Date.now(), snoozedUntil);

  const value: CoachContextType = {
    isReady,
    program,
    workoutLog,
    history,
    stats,
    upcoming: nextSession(program, workoutLog),
    doneThisWeek: completedThisWeek(workoutLog),
    followUpDue,
    nextCheckIn: history[0] ? nextCheckInDate(history[0].date) : undefined,
    refresh,
    regenerateProgram,
    finishSession,
    snoozeCheckIn,
    resetCoachData,
  };

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach() {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error('useCoach doit être utilisé dans CoachProvider');
  return ctx;
}
