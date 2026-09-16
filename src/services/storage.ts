import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sauvegarde locale sur le téléphone.
 *
 * Jusqu'ici l'app ne gardait ses données que dans la mémoire de React : à la
 * fermeture, le profil, les réponses d'inscription et l'analyse corporelle
 * étaient perdus. C'est ce qui rendait impossible d'afficher quoi que ce soit
 * de durable dans l'écran Profil.
 *
 * Toutes les lectures et écritures sont tolérantes aux pannes : un stockage
 * illisible ou plein ne doit jamais empêcher l'app de démarrer.
 *
 * CLOISONNEMENT PAR COMPTE
 * ------------------------
 * Le programme, le journal de séances et l'historique d'analyses étaient déjà
 * rangés par compte. Les RÉPONSES D'INSCRIPTION, elles, ne l'étaient pas :
 * elles vivaient sous une clé unique, partagée par tout le monde. Deux comptes
 * sur le même téléphone se marchaient donc dessus — le poids de l'un
 * s'affichait chez l'autre. `onboardingKey()` répare cela, et
 * `migrateLegacyOnboarding()` récupère les réponses de l'ancienne clé unique
 * pour le premier compte qui se connecte, afin que personne ne perde son
 * questionnaire lors de la mise à jour.
 */

export const STORAGE_KEYS = {
  /** Compte actuellement connecté sur cet appareil. */
  user: 'bodyai.user',
  /** Ancienne clé unique, conservée uniquement pour la migration. */
  onboardingLegacy: 'bodyai.onboarding',
} as const;

/** Compartiment utilisé tant qu'aucun compte n'est connecté. */
export const GUEST_BUCKET = 'guest';

/** Clé des réponses d'inscription, propre à chaque compte. */
export const onboardingKey = (userId?: string) => `bodyai.onboarding.${userId || GUEST_BUCKET}`;

/** Clé de l'abonnement, propre à chaque compte. */
export const subscriptionKey = (userId?: string) => `bodyai.subscription.${userId || GUEST_BUCKET}`;

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    // Donnée corrompue (mise à jour du format, écriture interrompue...) :
    // on repart à zéro plutôt que de bloquer l'application.
    console.warn(`[BodyAI] Lecture impossible de "${key}" :`, err);
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[BodyAI] Écriture impossible de "${key}" :`, err);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.warn(`[BodyAI] Suppression impossible de "${key}" :`, err);
  }
}

/**
 * Récupère les réponses de l'ancienne clé unique vers celle du compte.
 *
 * Ne s'exécute qu'une fois par compte : dès que le compte possède ses propres
 * réponses, l'ancienne clé est ignorée. Elle n'est pas supprimée — plusieurs
 * comptes peuvent se connecter successivement sur le même téléphone, et le
 * premier à passer ne doit pas priver les suivants de cette reprise. Sans ce
 * mécanisme, quelqu'un qui avait déjà rempli son questionnaire avant la mise à
 * jour se le verrait redemander.
 */
export async function migrateLegacyOnboarding(userId: string): Promise<void> {
  try {
    const target = onboardingKey(userId);
    const [already, legacy] = await Promise.all([
      AsyncStorage.getItem(target),
      AsyncStorage.getItem(STORAGE_KEYS.onboardingLegacy),
    ]);
    if (already || !legacy) return;
    await AsyncStorage.setItem(target, legacy);
  } catch (err) {
    console.warn('[BodyAI] Migration des réponses impossible :', err);
  }
}

/**
 * Transfère les données créées avant connexion vers le compte qui vient de se
 * connecter.
 *
 * Quelqu'un peut commencer le questionnaire sans compte (mode invité) puis se
 * connecter : ses réponses doivent le suivre, pas disparaître.
 */
export async function adoptGuestData(userId: string): Promise<void> {
  if (!userId || userId === GUEST_BUCKET) return;
  const pairs: [string, string][] = [
    [onboardingKey(GUEST_BUCKET), onboardingKey(userId)],
    [`bodyai.history.${GUEST_BUCKET}`, `bodyai.history.${userId}`],
    [`bodyai.program.${GUEST_BUCKET}`, `bodyai.program.${userId}`],
    [`bodyai.workoutlog.${GUEST_BUCKET}`, `bodyai.workoutlog.${userId}`],
    [`bodyai.followup.snooze.${GUEST_BUCKET}`, `bodyai.followup.snooze.${userId}`],
    [`bodyai.meals.${GUEST_BUCKET}`, `bodyai.meals.${userId}`],
  ];
  for (const [from, to] of pairs) {
    try {
      const [guestValue, existing] = await Promise.all([
        AsyncStorage.getItem(from),
        AsyncStorage.getItem(to),
      ]);
      // Le compte a déjà ses propres données : elles font foi, on ne les
      // écrase jamais avec celles d'une session invité plus ancienne.
      if (!guestValue || existing) continue;
      await AsyncStorage.setItem(to, guestValue);
      await AsyncStorage.removeItem(from);
    } catch (err) {
      console.warn(`[BodyAI] Reprise des données invité impossible (${from}) :`, err);
    }
  }
}
