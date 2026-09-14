import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { FadeInUp } from '../components/FadeInUp';
import { GymScene } from '../components/GymScene';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const { width } = Dimensions.get('window');

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; gradient: [string, string]; title: string; text: string }[] = [
  {
    icon: 'body',
    gradient: gradients.muscle,
    title: 'Analyse corporelle IA',
    text: 'Tes 11 groupes musculaires évalués sur photo',
  },
  {
    icon: 'barbell',
    gradient: gradients.brand,
    title: 'Programme sur-mesure',
    text: 'Salle ou maison, avec le matériel adapté',
  },
  {
    icon: 'flame',
    gradient: gradients.fire,
    title: 'Calories en 1 photo',
    text: 'Scanne ton repas, obtiens tes macros',
  },
];

export function WelcomeScreen({ navigation }: any) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <View style={styles.container}>
      {/* Halo décoratif en fond */}
      <LinearGradient
        colors={['rgba(56,189,248,0.22)', 'rgba(17,24,39,0)']}
        style={styles.halo}
      />

      <View style={styles.hero}>
        <LinearGradient
          colors={['#0C1930', '#164A69', '#0EA5A5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroGlow} />
          <Animated.View style={{ transform: [{ translateY }] }}>
            <GymScene scene="gym" width={width - spacing.lg * 2 - 24} />
          </Animated.View>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={14} color={colors.white} />
            <Text style={styles.heroBadgeText}>COACHING IA · ACTIF</Text>
          </View>
        </LinearGradient>
      </View>

      <FadeInUp delay={100}>
        <Text style={styles.title}>Transforme ton corps</Text>
        <Text style={styles.titleAccent}>avec l'intelligence artificielle</Text>
        <Text style={styles.subtitle}>
          Une photo suffit. L'IA analyse ta morphologie et construit ton programme.
        </Text>
      </FadeInUp>

      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <FadeInUp key={i} delay={220 + i * 90}>
            <View style={styles.featureRow}>
              <LinearGradient colors={f.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIcon}>
                <Ionicons name={f.icon} size={20} color={colors.white} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            </View>
          </FadeInUp>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <FadeInUp delay={520}>
        <GradientButton
          label="Commencer"
          icon="arrow-forward"
          onPress={() => navigation.navigate('OnboardingStep', { index: 0 })}
        />
        <Text style={styles.footnote}>Analyse gratuite · Aucune carte requise</Text>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xxl },
  halo: { position: 'absolute', top: -width * 0.4, left: -width * 0.2, width: width * 1.4, height: width * 1.1, borderRadius: width },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  heroCard: {
    width: '100%',
    height: 188,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brandAlt,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  heroGlow: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width,
    backgroundColor: 'rgba(225,255,255,0.13)',
  },
  heroBadge: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#071323',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: { ...font.tiny, color: colors.white, fontSize: 9 },
  title: { ...font.display, color: colors.brandAlt, textAlign: 'center' },
  titleAccent: { ...font.display, color: colors.text, textAlign: 'center', fontSize: 24, marginTop: 2 },
  subtitle: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, marginBottom: spacing.lg, paddingHorizontal: spacing.md, lineHeight: 21,
  },
  features: { gap: spacing.sm },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { ...font.bodyBold, color: colors.text },
  featureText: { ...font.caption, color: colors.subtext, marginTop: 1 },
  footnote: { ...font.tiny, fontWeight: '500', color: colors.subtext, textAlign: 'center', marginTop: spacing.sm },
});
