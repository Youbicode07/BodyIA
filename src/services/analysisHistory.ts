import { PriorityLevel } from '../data/muscleGroups';
import { BodyAnalysisResult } from '../context/OnboardingContext';
import { loadJson, removeKey, saveJson } from './storage';

/**
 * SUIVI DE PROGRESSION DANS LE TEMPS
 * ===================================
 *
 * Chaque analyse corporelle réussie est archivée ici, avec juste assez
 * d'informations pour comparer une zone d'une analyse à l'autre : le nom du
 * muscle, sa gravité (severityScore, 1-10) et son niveau de priorité. Le
 * reste (exercices) n'a pas besoin d'être dupliqué dans l'historique : il
 * redevient disponible à chaque nouvelle analyse.
 *
 * L'historique est stocké par compte (clé dérivée de l'identifiant
 * utilisateur) : se connecter avec un autre compte sur le même téléphone ne
 * mélange jamais deux historiques.
 */

export type TrackedProblem = {
  muscleGroup: string;
  priorityLevel?: PriorityLevel;
  severityScore?: number;
  problem: string;
  estimatedWeeks?: number;
};

export type HistoryEntry = {
  id: string;
  date: number;
  photoUri?: string;
  summary: string;
  viewAngle?: string;
  problems: TrackedProblem[];
};

const GUEST_BUCKET = 'guest';

const historyKey = (userId?: string) => `bodyai.history.${userId || GUEST_BUCKET}`;

export async function loadHistory(userId?: string): Promise<HistoryEntry[]> {
  const list = await loadJson<HistoryEntry[]>(historyKey(userId));
  return Array.isArray(list) ? list.sort((a, b) => b.date - a.date) : [];
}

/** Construit l'entrée d'historique à partir d'une analyse fraîchement reçue. */
export function toHistoryEntry(analysis: BodyAnalysisResult, photoUri?: string): HistoryEntry {
  const problems: TrackedProblem[] = analysis.zones
    .filter((z) => z.status === 'priority' && z.visible !== false && !z.isGeneric)
    .map((z) => ({
      muscleGroup: String(z.muscleGroup),
      priorityLevel: z.priorityLevel,
      severityScore: z.severityScore,
      problem: z.problem,
      estimatedWeeks: z.estimatedWeeks,
    }));

  return {
    id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    date: Date.now(),
    photoUri,
    summary: analysis.summary,
    viewAngle: analysis.viewAngle,
    problems,
  };
}

/** Efface tout l'historique d'un compte. Utilisé quand l'utilisateur refait
 * son questionnaire : conserver des analyses rattachées à un profil qui
 * n'existe plus fausserait la première comparaison suivante. */
export async function clearHistory(userId?: string): Promise<void> {
  await removeKey(historyKey(userId));
}

/** Ajoute une entrée et renvoie l'historique à jour, le plus récent en tête. */
export async function appendHistoryEntry(userId: string | undefined, entry: HistoryEntry): Promise<HistoryEntry[]> {
  const current = await loadHistory(userId);
  const next = [entry, ...current];
  await saveJson(historyKey(userId), next);
  return next;
}

export type ProgressStatus = 'amelioration' | 'stable' | 'a_travailler';

export type ZoneProgress = {
  muscleGroup: string;
  status: ProgressStatus;
  previousSeverity?: number;
  currentSeverity?: number;
  /** N'apparaissait pas comme problème lors de l'analyse précédente. */
  isNew: boolean;
  /** Était un problème avant et ne l'est plus : la meilleure des nouvelles. */
  isResolved: boolean;
};

/** En-deçà de cet écart de gravité, on considère la zone stable plutôt que de
 * lire une amélioration ou une dégradation dans du bruit de mesure. */
const SEVERITY_NOISE_MARGIN = 2;

/**
 * Compare deux analyses, muscle par muscle, pour dire si chaque problème
 * s'améliore, stagne, ou nécessite de poursuivre l'effort.
 *
 * Fonction pure : aucune donnée n'est inventée ici, seulement comparée. Une
 * zone résolue (problème avant, absente maintenant) compte comme une
 * amélioration ; une zone nouvelle compte comme « à travailler ».
 */
export function compareAnalyses(previous: HistoryEntry, current: HistoryEntry): ZoneProgress[] {
  const prevMap = new Map(previous.problems.map((p) => [p.muscleGroup, p]));
  const currMap = new Map(current.problems.map((p) => [p.muscleGroup, p]));
  const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);

  const results: ZoneProgress[] = [];
  for (const key of allKeys) {
    const prev = prevMap.get(key);
    const curr = currMap.get(key);

    if (prev && !curr) {
      results.push({
        muscleGroup: key, status: 'amelioration',
        previousSeverity: prev.severityScore, currentSeverity: undefined,
        isNew: false, isResolved: true,
      });
      continue;
    }

    if (!prev && curr) {
      results.push({
        muscleGroup: key, status: 'a_travailler',
        previousSeverity: undefined, currentSeverity: curr.severityScore,
        isNew: true, isResolved: false,
      });
      continue;
    }

    if (prev && curr) {
      let status: ProgressStatus = 'stable';
      if (prev.severityScore !== undefined && curr.severityScore !== undefined) {
        if (curr.severityScore <= prev.severityScore - SEVERITY_NOISE_MARGIN) status = 'amelioration';
        else if (curr.severityScore >= prev.severityScore + SEVERITY_NOISE_MARGIN) status = 'a_travailler';
      }
      results.push({
        muscleGroup: key, status,
        previousSeverity: prev.severityScore, currentSeverity: curr.severityScore,
        isNew: false, isResolved: false,
      });
    }
  }

  // Les zones qui ont le plus besoin d'attention en premier.
  const order: Record<ProgressStatus, number> = { a_travailler: 0, stable: 1, amelioration: 2 };
  return results.sort((a, b) => order[a.status] - order[b.status]);
}

/** Prochaine date de suivi recommandée : 15 jours après une analyse. */
export const FOLLOW_UP_INTERVAL_DAYS = 15;

export function nextCheckInDate(fromDate: number, days: number = FOLLOW_UP_INTERVAL_DAYS): number {
  return fromDate + days * 24 * 60 * 60 * 1000;
}

/**
 * Le suivi à 15 jours n'est pas une simple suggestion : tant que l'échéance
 * est dépassée, l'app doit bloquer l'accès à l'onglet Corps derrière un écran
 * obligatoire de reprise de photo, plutôt que de continuer à afficher une
 * analyse potentiellement périmée comme si elle était toujours d'actualité.
 */
export function isFollowUpDue(
  latest: HistoryEntry | undefined,
  now: number = Date.now(),
  snoozedUntil: number = 0,
): boolean {
  if (!latest) return false;
  if (snoozedUntil > now) return false;
  return now >= nextCheckInDate(latest.date);
}

/**
 * REPORT EXCEPTIONNEL DU SUIVI
 * ----------------------------
 * Le suivi est obligatoire, et il le reste. Mais tant que l'échéance n'est pas
 * honorée, l'application entière est verrouillée derrière l'écran de reprise
 * de photo : si l'analyse échoue de façon répétée (service IA indisponible,
 * photo refusée par les filtres), la personne se retrouverait enfermée dehors
 * sans aucun recours, y compris pour consulter sa nutrition du jour.
 *
 * Ce report de 24 h est la soupape : il ne dispense jamais du suivi, il évite
 * seulement qu'une panne côté IA rende l'application inutilisable.
 */
export const SNOOZE_HOURS = 24;

const snoozeKey = (userId?: string) => `bodyai.followup.snooze.${userId || GUEST_BUCKET}`;

export async function loadFollowUpSnooze(userId?: string): Promise<number> {
  const value = await loadJson<number>(snoozeKey(userId));
  return typeof value === 'number' ? value : 0;
}

export async function snoozeFollowUp(userId?: string, hours: number = SNOOZE_HOURS): Promise<number> {
  const until = Date.now() + hours * 60 * 60 * 1000;
  await saveJson(snoozeKey(userId), until);
  return until;
}

/** Appelé dès qu'une analyse aboutit : le report n'a plus de raison d'être. */
export async function clearFollowUpSnooze(userId?: string): Promise<void> {
  await removeKey(snoozeKey(userId));
}
