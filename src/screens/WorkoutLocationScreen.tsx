import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkipStepButton } from '../components/SkipStepButton';
import { FadeInUp } from '../components/FadeInUp';
import { useOnboarding, WorkoutLocation } from '../context/OnboardingContext';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const OPTIONS: {
  value: WorkoutLocation;
  title: string;
  text: string;
  icon: string;
  gradient: [string, string];
  equipment: string[];
}[] = [
  {
    value: 'gym',
    title: 'Salle de sport',
    text: 'Accès complet aux machines',
    icon: 'weight-lifter',
    gradient: gradients.gym,
    equipment: ['Barres', 'Haltères', 'Machines', 'Poulies'],
  },
  {
    value: 'home',
    title: 'À la maison',
    text: 'Sans matériel ou presque',
    icon: 'home-variant',
    gradient: gradients.fresh,
    equipment: ['Poids du corps', 'Élastiques'],
  },
];

export function WorkoutLocationScreen({ navigation }: any) {
  const { updateAnswers } = useOnboarding();
  const [choice, setChoice] = useState<WorkoutLocation | null>(null);
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(orbitRotation, { toValue: 1, duration: 14000, useNativeDriver: true }),
    );
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ]),
    );
    orbit.start();
    breathing.start();
    floating.start();
    return () => {
      orbit.stop();
      breathing.stop();
      floating.stop();
    };
  }, [float, orbitRotation, pulse]);

  const orbitSpin = orbitRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const reverseOrbitSpin = orbitRotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const cardFloat = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] });

  const goNext = () => {
    if (!choice) return;
    updateAnswers({ workoutLocation: choice, workoutLocationSkipped: false });
    navigation.navigate('ProgramGenerating');
  };

  // Sortie explicite, comme pour la photo : le choix du lieu ne doit jamais
  // bloquer quelqu'un qui s'entraîne parfois en salle, parfois à la maison.
  const skipChoice = () =>
    Alert.alert(
      'Passer cette étape ?',
      `Sans lieu choisi, ton programme te proposera les exercices de salle ET
de maison pour chaque muscle : tu pourras basculer de l'un à l'autre à
tout moment sur l'écran du programme.`,
      [
        { text: 'Choisir un lieu', style: 'cancel' },
        {
          text: 'Passer',
          onPress: () => {
            updateAnswers({ workoutLocation: undefined, workoutLocationSkipped: true });
            navigation.navigate('ProgramGenerating');
          },
        },
      ],
    );

  return (
    /**
     * ScrollView avec flexGrow: 1 : mise en page inchangee tant que le contenu
     * tient a l'ecran, defilement des qu'il deborde (petit telephone, ou zoom
     * texte systeme active pour l'accessibilite). Sans cela le bouton de
     * validation sortait de l'ecran, sans aucun moyen de l'atteindre.
     */
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Où t'entraînes-tu ?"
        subtitle="Ton programme sera adapté au matériel disponible"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.hologram}>
        <Animated.View style={[styles.backgroundGlow, { transform: [{ scale: glowScale }] }]} />
        <Animated.View style={[styles.backgroundOrbit, { transform: [{ rotate: orbitSpin }] }]} />
        <Animated.View style={[styles.backgroundOrbitSmall, { transform: [{ rotate: reverseOrbitSpin }] }]} />
        {OPTIONS.map((opt, i) => {
          const selected = choice === opt.value;
          return (
            <FadeInUp key={opt.value} delay={i * 100} style={i === 0 ? styles.optionLeft : styles.optionRight}>
              <Animated.View style={{ transform: [{ translateY: i === 0 ? cardFloat : Animated.multiply(cardFloat, -1) }] }}>
              <Pressable
                onPress={() => setChoice(opt.value)}
                style={[styles.orbitOption, selected && styles.orbitOptionSelected]}
              >
                <LinearGradient colors={opt.gradient} style={styles.orbitIcon}>
                  <MaterialCommunityIcons name={opt.icon as any} size={29} color={colors.white} />
                </LinearGradient>
                <Text style={[styles.orbitTitle, selected && styles.orbitTitleSelected]}>{opt.title}</Text>
                <Text style={styles.orbitText}>{opt.text}</Text>
                <View style={[styles.orbitCheck, selected && styles.orbitCheckSelected]}>
                  {selected ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
                </View>
              </Pressable>
              </Animated.View>
            </FadeInUp>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <GradientButton label="Continuer" icon="arrow-forward" onPress={goNext} disabled={!choice} />

      <SkipStepButton onPress={skipChoice} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  hologram: { flex: 1, minHeight: 390, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  backgroundGlow: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: colors.brand, opacity: 0.13,
  },
  backgroundOrbit: {
    position: 'absolute', width: '94%', height: 280, borderRadius: 32,
    borderWidth: 1, borderColor: `${colors.brandAlt}55`,
  },
  backgroundOrbitSmall: {
    position: 'absolute', width: '76%', height: 220, borderRadius: 28,
    borderWidth: 1, borderColor: `${colors.brand}66`, borderStyle: 'dashed',
  },
  optionLeft: { position: 'absolute', left: 0, top: 132, zIndex: 3 },
  optionRight: { position: 'absolute', right: 0, top: 132, zIndex: 3 },
  orbitOption: {
    width: 152, minHeight: 174, borderRadius: 18, padding: spacing.sm,
    alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    zIndex: 4,
  },
  orbitOptionSelected: {
    backgroundColor: colors.brand, borderColor: colors.brandAlt,
    shadowColor: colors.brandAlt, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8,
  },
  orbitIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  orbitTitle: { ...font.bodyBold, color: colors.text, textAlign: 'center' },
  orbitTitleSelected: { color: colors.white },
  orbitText: { ...font.tiny, color: colors.subtext, textAlign: 'center', marginTop: 4, lineHeight: 14 },
  orbitCheck: {
    position: 'absolute', top: 9, right: 9, width: 20, height: 20, borderRadius: 10,
    borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center',
  },
  orbitCheckSelected: { backgroundColor: colors.brandAlt, borderColor: colors.white },
});
