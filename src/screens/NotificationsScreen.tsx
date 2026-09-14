import React from 'react';
import { PromptScreen } from '../components/PromptScreen';
import { ensureAndroidChannel, requestNotificationPermission } from '../services/followUpNotifications';
import { gradients } from '../theme/colors';

/**
 * Jusqu'ici, les deux boutons de cet écran faisaient exactement la même
 * chose : passer à l'écran suivant, sans jamais demander la moindre
 * autorisation au système. Le rappel de suivi à 15 jours a besoin d'une
 * vraie autorisation pour pouvoir s'afficher — c'est ce que "Autoriser"
 * déclenche maintenant réellement.
 */
export function NotificationsScreen({ navigation }: any) {
  const next = () => navigation.navigate('Auth');

  const enable = async () => {
    await ensureAndroidChannel();
    await requestNotificationPermission();
    // Qu'elle soit accordée ou refusée, on continue : le rappel de suivi sera
    // simplement reproposé plus tard si l'autorisation n'a pas été donnée.
    next();
  };

  return (
    <PromptScreen
      icon="notifications"
      gradient={gradients.muscle}
      title="Reste sur la bonne voie"
      subtitle="Un rappel tous les 15 jours pour suivre ta progression, jamais de spam."
      bullets={[
        'Rappel pour reprendre une photo de suivi',
        'Bilan de ton évolution zone par zone',
        'Rappel de repas non enregistré',
      ]}
      primaryLabel="Autoriser les notifications"
      onPrimary={enable}
      secondaryLabel="Ne pas autoriser"
      onSecondary={next}
    />
  );
}
