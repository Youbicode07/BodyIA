import { AppState } from 'react-native';
import { API_CONFIGURED, ApiError, dataApi, loadToken } from './api';
import { loadJson, saveJson } from './storage';

/**
 * SYNCHRONISATION AVEC LE SERVEUR
 * ===============================
 *
 * L'application reste utilisable hors ligne — c'est non négociable sur un
 * téléphone : on ouvre une app de sport dans une salle au sous-sol, dans le
 * métro, en avion. Le stockage local n'est donc pas un cache optionnel, c'est
 * le chemin normal. Le serveur est ce qui rend les données durables et
 * transférables d'un appareil à l'autre.
 *
 * Mécanique, volontairement simple pour rester prévisible :
 *
 *   ÉCRITURE  l'app écrit en local, tout de suite, puis dépose l'opération
 *             dans une file d'attente persistante (« boîte d'envoi »).
 *   ENVOI     la file est vidée dès qu'une connexion et une session existent.
 *             Une coupure en plein envoi ne perd rien : l'opération reste en
 *             file et repartira.
 *   LECTURE   à la connexion et au lancement, on récupère l'état du serveur.
 *
 * Doublons : chaque élément porte l'identifiant généré par l'application, et le
 * serveur ignore un identifiant déjà connu. Un envoi rejoué après une coupure
 * ne crée donc jamais deux fois le même repas ou la même analyse.
 *
 * Conflits : la date de modification tranche, le plus récent gagne. C'est
 * grossier mais honnête, et adapté à la réalité — un utilisateur, un téléphone
 * à la fois.
 */

const OUTBOX_KEY = 'bodyai.outbox';
const MAX_OUTBOX = 200;

export type PendingOp =
  | { kind: 'profile'; answers: unknown; updatedAt: number }
  | { kind: 'program'; program: unknown }
  | { kind: 'analysis'; analysis: any }
  | { kind: 'meal'; meal: any }
  | { kind: 'mealDelete'; id: string }
  | { kind: 'workout'; workout: any }
  | { kind: 'reset' };

export type SyncSnapshot = {
  answers: Record<string, unknown> | null;
  answersUpdatedAt: number;
  program: unknown | null;
  analyses: any[];
  meals: any[];
  workouts: any[];
};

/** État de la dernière tentative, affiché dans le profil. */
export type SyncState = {
  /** Un serveur est configuré ET une session existe. */
  enabled: boolean;
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
};

let outbox: PendingOp[] | null = null;
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<(state: SyncState) => void>();
let state: SyncState = {
  enabled: false,
  pending: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false,
};

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function subscribeSync(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export const getSyncState = () => state;

async function readOutbox(): Promise<PendingOp[]> {
  if (outbox) return outbox;
  const saved = await loadJson<PendingOp[]>(OUTBOX_KEY);
  outbox = Array.isArray(saved) ? saved : [];
  emit({ pending: outbox.length });
  return outbox;
}

async function writeOutbox(next: PendingOp[]): Promise<void> {
  // Bornée : si le serveur est injoignable pendant des semaines, la file ne
  // doit pas remplir le stockage du téléphone. On sacrifie les plus anciennes,
  // jamais les plus récentes — ce sont elles qui reflètent l'état actuel.
  outbox = next.slice(-MAX_OUTBOX);
  emit({ pending: outbox.length });
  await saveJson(OUTBOX_KEY, outbox);
}

/** Un seul envoi de profil et de programme a du sens : le dernier. */
function collapse(ops: PendingOp[]): PendingOp[] {
  const lastProfile = ops.map((o, i) => (o.kind === 'profile' ? i : -1)).filter((i) => i >= 0).pop();
  const lastProgram = ops.map((o, i) => (o.kind === 'program' ? i : -1)).filter((i) => i >= 0).pop();
  return ops.filter((op, i) => {
    if (op.kind === 'profile') return i === lastProfile;
    if (op.kind === 'program') return i === lastProgram;
    return true;
  });
}

/** Dépose une opération et programme un envoi. */
export async function enqueue(op: PendingOp): Promise<void> {
  if (!API_CONFIGURED) return; // aucun serveur : l'app vit en local, sans file
  const current = await readOutbox();
  await writeOutbox(collapse([...current, op]));
  scheduleFlush();
}

/**
 * Envoi groupé, légèrement différé.
 *
 * Modifier son poids déclenche plusieurs écritures successives ; envoyer à
 * chaque frappe saturerait le réseau pour rien. 800 ms suffisent à regrouper
 * une rafale sans que l'utilisateur perçoive un délai.
 */
function scheduleFlush(delay = 800) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush().catch(() => undefined);
  }, delay);
}

async function sendOne(op: PendingOp): Promise<void> {
  switch (op.kind) {
    case 'profile':
      await dataApi.putProfile(op.answers, op.updatedAt);
      return;
    case 'program':
      await dataApi.putProgram(op.program);
      return;
    case 'analysis':
      await dataApi.postAnalysis(op.analysis);
      return;
    case 'meal':
      await dataApi.postMeal(op.meal);
      return;
    case 'mealDelete':
      await dataApi.deleteMeal(op.id);
      return;
    case 'workout':
      await dataApi.postWorkout(op.workout);
      return;
    case 'reset':
      await dataApi.reset(true);
      return;
  }
}

/**
 * Vide la file.
 *
 * Trois issues par opération :
 *   • succès          -> retirée ;
 *   • serveur absent  -> on s'arrête et on garde TOUT : réessai plus tard ;
 *   • refus définitif -> retirée, car la rejouer échouerait indéfiniment et
 *                        bloquerait toutes celles qui suivent.
 */
export async function flush(): Promise<boolean> {
  if (!API_CONFIGURED || flushing) return false;
  const token = await loadToken();
  if (!token) {
    emit({ enabled: false });
    return false;
  }

  const queue = await readOutbox();
  if (!queue.length) {
    emit({ enabled: true, lastError: null });
    return true;
  }

  flushing = true;
  emit({ syncing: true, enabled: true });

  let remaining = [...queue];
  let lastError: string | null = null;

  try {
    while (remaining.length) {
      const op = remaining[0];
      try {
        await sendOne(op);
        remaining = remaining.slice(1);
        await writeOutbox(remaining);
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : null;

        if (apiErr?.isOffline) {
          lastError = 'Hors ligne : les modifications partiront à la reconnexion.';
          break;
        }
        if (apiErr?.isAuthError) {
          lastError = 'Session expirée : reconnecte-toi pour synchroniser.';
          emit({ enabled: false });
          break;
        }
        // 400/404/500 : rejouer ne changera rien. On abandonne CETTE opération
        // pour ne pas bloquer la file entière derrière elle.
        console.warn('[BodyAI] Opération abandonnée à la synchronisation :', op.kind, apiErr?.message);
        remaining = remaining.slice(1);
        await writeOutbox(remaining);
        lastError = apiErr?.message ?? 'Une modification n\'a pas pu être enregistrée.';
      }
    }
  } finally {
    flushing = false;
    emit({
      syncing: false,
      lastError,
      lastSyncAt: lastError ? state.lastSyncAt : Date.now(),
    });
  }

  return !lastError;
}

/** Récupère l'état complet du serveur. Renvoie null si indisponible. */
export async function pullAll(): Promise<SyncSnapshot | null> {
  if (!API_CONFIGURED) return null;
  const token = await loadToken();
  if (!token) return null;

  try {
    emit({ syncing: true, enabled: true });

    // En parallèle : cinq allers-retours en série sur un serveur endormi
    // (offre gratuite) feraient attendre plusieurs secondes au lancement.
    const [profile, program, analyses, meals, workouts] = await Promise.all([
      dataApi.getProfile(),
      dataApi.getProgram(),
      dataApi.getAnalyses(),
      dataApi.getMeals(),
      dataApi.getWorkouts(),
    ]);

    emit({ syncing: false, lastSyncAt: Date.now(), lastError: null });

    return {
      answers: profile.answers,
      answersUpdatedAt: profile.updatedAt ?? 0,
      program: program.program,
      analyses: analyses.analyses ?? [],
      meals: meals.meals ?? [],
      workouts: workouts.workouts ?? [],
    };
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.isAuthError
          ? 'Session expirée : reconnecte-toi.'
          : err.message
        : String(err);
    emit({ syncing: false, lastError: message, enabled: !(err instanceof ApiError && err.isAuthError) });
    return null;
  }
}

/** Appelé à la connexion : envoie ce qui attend, puis relit le serveur. */
export async function syncNow(): Promise<SyncSnapshot | null> {
  await flush();
  return pullAll();
}

/**
 * Relance l'envoi quand l'application revient au premier plan.
 *
 * Le cas réel qu'il couvre : on enregistre une séance dans une salle sans
 * réseau, on verrouille le téléphone, on ressort. Sans ce déclencheur, la file
 * ne repartirait qu'à la prochaine modification — c'est-à-dire peut-être
 * jamais. Appelé une seule fois, au démarrage de l'application.
 */
export function startAutoFlush(): () => void {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') scheduleFlush(300);
  });
  // Un premier essai au lancement : l'application a pu être fermée alors que
  // des modifications attendaient encore.
  scheduleFlush(1500);
  return () => subscription.remove();
}

/** Vide la file sans rien envoyer (déconnexion, changement de compte). */
export async function clearOutbox(): Promise<void> {
  await writeOutbox([]);
  emit({ enabled: false, lastError: null, lastSyncAt: null });
}
