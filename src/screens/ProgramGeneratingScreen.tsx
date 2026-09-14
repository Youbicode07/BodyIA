import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LoadingPulse } from '../components/LoadingPulse';
import { useOnboarding } from '../context/OnboardingContext';
import { useCoach } from '../context/CoachContext';
import { EXERCISES_PER_MUSCLE, targetMusclesOf } from '../services/coachProgram';
import { colors, spacing, font } from '../theme/colors';

/**
 * Le programme est réellement (re)construit ici, pas seulement animé.
 *
 * L'analyse a lieu avant le choix du lieu d'entraînement : le programme créé à
 * ce moment-là repose donc sur une salle supposée. Une fois le lieu connu, il
 * faut le reconstruire, sinon quelqu'un qui s'entraîne chez lui recevrait des
 * exercices sur machines qu'il n'a pas.
 */
export function ProgramGeneratingScreen({ navigation }: any) {
  const { answers } = useOnboarding();
  const { regenerateProgram } = useCoach();
  const hasAnalysis = Boolean(answers.analysis);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Sans analyse, il n'y a rien à générer : l'animation mentirait sur ce
      // qui se passe réellement. L'écran suivant explique pourquoi aucun
      // programme n'est disponible.
      if (!hasAnalysis) {
        navigation.replace('ProgramReady');
        return;
      }

      const started = Date.now();
      try {
        await regenerateProgram();
      } catch (err) {
        console.warn('[BodyAI] Construction du programme impossible :', err);
      }
      // La construction est quasi instantanée : on laisse l'écran visible le
      // temps de le lire, sans pour autant faire attendre inutilement.
      const remaining = Math.max(0, 1400 - (Date.now() - started));
      setTimeout(() => {
        if (alive) navigation.replace('ProgramReady');
      }, remaining);
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!hasAnalysis) return null;

  // Une séance par muscle analysé : le programme ne couvre rien d'autre.
  const targets = targetMusclesOf(answers.analysis);

  return (
    <View style={styles.container}>
      <LoadingPulse icon="barbell" colorsGradient={[colors.gym, colors.gymAlt]} />
      <Text style={styles.message}>Construction de ton programme...</Text>
      <Text style={styles.sub}>
        {targets.length} muscle{targets.length > 1 ? 's' : ''} ciblé{targets.length > 1 ? 's' : ''} ·{' '}
        {EXERCISES_PER_MUSCLE} exercices chacun
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: { ...font.h3, marginTop: spacing.lg, color: colors.text, textAlign: 'center' },
  sub: { ...font.caption, marginTop: spacing.xs, color: colors.subtext, textAlign: 'center' },
});
