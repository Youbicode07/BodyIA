import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { LoadingPulse } from '../components/LoadingPulse';
import { analyzeMealPhoto } from '../services/aiMealAnalysis';
import { buildMealContext } from '../services/progressContext';
import { useNutrition } from '../context/NutritionContext';
import { useOnboarding } from '../context/OnboardingContext';
import { photoToBase64 } from '../services/imagePrep';
import { colors, spacing, font } from '../theme/colors';

export function MealAnalyzingScreen({ route, navigation }: any) {
  const { photoUri } = route.params;
  const { mealsToday } = useNutrition();
  const { answers } = useOnboarding();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base64 = await photoToBase64(photoUri);
        // Le conseil nutritionnel s'appuie sur la journée réelle (objectif,
        // déjà consommé, régime) au lieu d'être une généralité.
        const result = await analyzeMealPhoto(base64, buildMealContext(answers, mealsToday));
        if (!cancelled) navigation.replace('MealResult', { photoUri, result });
      } catch (err) {
        console.warn('Échec de la lecture/analyse de la photo du repas.', err);
        if (!cancelled) {
          Alert.alert(
            'Analyse impossible',
            "Nous n'avons pas pu lire ou analyser cette photo. Réessaie avec une autre photo.",
          );
          navigation.goBack();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <LoadingPulse icon="restaurant" colorsGradient={[colors.calories, '#FF9F0A']} />
      <Text style={styles.message}>Identification de ton repas...</Text>
      <Text style={styles.sub}>Estimation des calories et macros</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  message: { ...font.h3, marginTop: spacing.xl, color: colors.text },
  sub: { ...font.caption, marginTop: spacing.xs, color: colors.subtext },
});
