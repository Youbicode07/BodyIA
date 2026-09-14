import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { FOLLOW_UP_INTERVAL_DAYS } from './analysisHistory';

/**
 * RAPPEL DE SUIVI À 15 JOURS
 * ===========================
 *
 * Une seule notification programmée, identifiée par une clé fixe : reprogrammer
 * un rappel annule et remplace automatiquement le précédent, il ne peut donc
 * jamais y en avoir deux en attente en même temps.
 *
 * Limite honnête à connaître : les notifications LOCALES programmées
 * fonctionnent dans Expo Go, mais leur fiabilité sur une échéance aussi
 * longue qu'un vrai délai de 15 jours (l'app peut être fermée, le téléphone
 * redémarré...) n'est réellement garantie que dans une build de développement
 * ou de production — exactement la même limite que les autres fonctionnalités
 * natives de ce projet (connexion Google).
 */

const REMINDER_ID = 'bodyai-followup-checkin';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

/**
 * Programme le rappel de suivi, `days` après maintenant. Remplace tout rappel
 * déjà programmé. Renvoie false si l'autorisation n'a pas été accordée : dans
 * ce cas, on ne programme rien plutôt que d'échouer silencieusement.
 */
export async function scheduleFollowUpReminder(
  days: number = FOLLOW_UP_INTERVAL_DAYS,
): Promise<boolean> {
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return false;

  // Idempotent : peut être appelé même si l'écran d'autorisation n'a jamais
  // été visité (ex. permission déjà accordée lors d'une session précédente).
  await ensureAndroidChannel();
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'C\'est le moment de ton suivi',
      body: `Reprends une photo dans les mêmes conditions qu'il y a ${days} jours pour suivre ton évolution.`,
      data: { type: 'followup-checkin' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: days * 24 * 60 * 60,
      ...(Platform.OS === 'android' ? { channelId: 'followup' } : {}),
    },
  });
  return true;
}

export async function cancelFollowUpReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
}

/** Crée le canal Android requis pour qu'une notification programmée s'affiche
 * correctement (obligatoire depuis Android 8). Sans effet sur iOS. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('followup', {
    name: 'Suivi de progression',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export { IS_EXPO_GO as NOTIFICATIONS_LIMITED_IN_EXPO_GO };
