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
 */

export const STORAGE_KEYS = {
  user: 'bodyai.user',
  onboarding: 'bodyai.onboarding',
} as const;

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
