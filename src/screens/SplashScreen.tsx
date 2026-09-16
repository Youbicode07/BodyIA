import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../context/UserContext';
import { useOnboarding } from '../context/OnboardingContext';
import { colors, font, radius, spacing, gradients } from '../theme/colors';

/**
 * ÉCRAN D'OUVERTURE — ET AIGUILLAGE DE SESSION
 * ============================================
 *
 * C'est ici que se règle le défaut le plus visible de l'application : le
 * questionnaire d'inscription était redemandé À CHAQUE OUVERTURE, même à
 * quelqu'un qui l'avait déjà rempli et qui était connecté. L'écran partait
 * systématiquement vers « Welcome » après 1,6 seconde, sans jamais regarder
 * s'il y avait une session.
 *
 * Désormais l'écran attend que le compte ET les réponses soient relus depuis
 * le téléphone (c'est rapide : quelques dizaines de millisecondes), puis
 * tranche :
 *
 *   • questionnaire déjà terminé   -> tableau de bord, directement ;
 *   • connecté mais pas terminé    -> reprise du questionnaire ;
 *   • personne                     -> écran d'accueil.
 *
 * L'animation garde une durée plancher pour ne pas produire un clignotement
 * désagréable quand la lecture est instantanée.
 */

const MIN_SPLASH_MS = 1200;

export function SplashScreen({ navigation }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const { user, isReady: userReady } = useUser();
  const { isReady: onboardingReady, isComplete } = useOnboarding();
  const startedAt = useRef(Date.now());
  const routed = useRef(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  useEffect(() => {
    if (!userReady || !onboardingReady || routed.current) return;

    const destination = isComplete
      ? 'MainTabs'
      : user
        ? 'OnboardingStep'
        : 'Welcome';

    const elapsed = Date.now() - startedAt.current;
    const timer = setTimeout(
      () => {
        routed.current = true;
        navigation.replace(destination, destination === 'OnboardingStep' ? { index: 0 } : undefined);
      },
      Math.max(0, MIN_SPLASH_MS - elapsed),
    );
    return () => clearTimeout(timer);
  }, [userReady, onboardingReady, isComplete, user, navigation]);

  return (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <Animated.View
        style={{
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      >
        <View style={styles.logoBox}>
          <Ionicons name="body" size={46} color={colors.white} />
        </View>
        <Text style={styles.logo}>BodyAI</Text>
        <Text style={styles.tagline}>Ton coach intelligent</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBox: {
    width: 104, height: 104, borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logo: { ...font.display, color: colors.white, textAlign: 'center', marginTop: spacing.md },
  tagline: { ...font.caption, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 2 },
});
