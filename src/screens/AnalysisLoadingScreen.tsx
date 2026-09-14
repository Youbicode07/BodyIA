import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LoadingPulse } from '../components/LoadingPulse';
import { analyzeBodyPhoto } from '../services/aiBodyAnalysis';
import { photoToBase64 } from '../services/imagePrep';
import { useOnboarding } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { appendHistoryEntry, toHistoryEntry } from '../services/analysisHistory';
import { scheduleFollowUpReminder } from '../services/followUpNotifications';
import { colors, spacing, font, gradients } from '../theme/colors';

const messages = [
  'Lecture de ta silhouette...',
  'Repérage des épaules et des hanches...',
  'Analyse muscle par muscle...',
  'Identification des zones prioritaires...',
  'Construction de ton programme...',
];

export function AnalysisLoadingScreen({ navigation }: any) {
  const { answers, updateAnswers } = useOnboarding();
  const { user } = useUser();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 1100);

    (async () => {
      try {
        const base64 = answers.bodyPhotoUri ? await photoToBase64(answers.bodyPhotoUri) : '';
        // Le profil de l'onboarding est transmis à l'IA : c'est ce qui rend
        // l'analyse réellement personnalisée plutôt qu'une lecture d'image
        // indépendante de la personne qui l'a prise.
        const result = await analyzeBodyPhoto(base64, answers);
        // L'analyse est faite : le marqueur « étape passée » n'a plus lieu d'être.
        updateAnswers({ analysis: result, analysisSkipped: false });

        // Le suivi dans le temps ne veut dire quelque chose que pour une
        // VRAIE analyse : archiver un repli générique fausserait toute
        // comparaison de progression future.
        if (!result.isFallback) {
          await appendHistoryEntry(user?.id, toHistoryEntry(result, answers.bodyPhotoUri));
          // Best-effort : si la permission n'a pas été accordée, la fonction
          // ne programme simplement rien, sans faire échouer l'analyse.
          await scheduleFollowUpReminder().catch(() => undefined);
        }
      } catch (err) {
        console.warn('Échec de la lecture/analyse de la photo du corps.', err);
      } finally {
        clearInterval(interval);
        navigation.replace('AnalysisResult');
      }
    })();

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <LoadingPulse icon="body" colorsGradient={gradients.brand} />
      <Text style={styles.message}>{messages[messageIndex]}</Text>
      <Text style={styles.sub}>11 groupes musculaires analysés — environ 15 s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  message: { ...font.h3, marginTop: spacing.xl, color: colors.text, textAlign: 'center' },
  sub: { ...font.caption, marginTop: spacing.xs, color: colors.subtext },
});
