import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '../components/GradientButton';
import { FadeInUp } from '../components/FadeInUp';
import { GymScene } from '../components/GymScene';
import { useOnboarding } from '../context/OnboardingContext';
import { colors, spacing, radius, font } from '../theme/colors';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }[] = [
  { icon: 'calendar-outline', color: colors.success, text: 'Un suivi progressif, semaine après semaine' },
  { icon: 'chatbubble-ellipses-outline', color: colors.brand, text: 'Des conseils adaptés à tes habitudes réelles' },
  { icon: 'shield-checkmark-outline', color: colors.fats, text: 'Tes données restent privées et contrôlables' },
];

export function TrustScreen({ navigation }: any) {
  const { answers } = useOnboarding();
  const goal = answers.goal === 'lose' ? 'perte de poids' : answers.goal === 'gain' ? 'prise de muscle' : 'progression équilibrée';
  const frequency = answers.workoutsPerWeek ? `${answers.workoutsPerWeek} séances par semaine` : 'un rythme adapté à toi';
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }} />

      <FadeInUp>
        <View style={styles.illustration}>
          <GymScene scene="scan" width={260} />
        </View>

        <View style={styles.rating}>
          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Ionicons key={i} name="star" size={15} color={colors.carbs} />
            ))}
          </View>
          <Text style={styles.ratingText}>4,8 · plus de 100 000 avis</Text>
        </View>

        <Text style={styles.title}>Ton coaching est prêt</Text>
        <Text style={styles.subtitle}>
          Ton profil est configuré pour une {goal}, avec {frequency}. Il ne reste qu'à lancer ton accompagnement.
        </Text>
      </FadeInUp>

      <View style={styles.points}>
        {POINTS.map((p, i) => (
          <FadeInUp key={i} delay={100 + i * 80}>
            <View style={styles.pointRow}>
              <View style={[styles.pointIcon, { backgroundColor: `${p.color}14` }]}>
                <Ionicons name={p.icon} size={17} color={p.color} />
              </View>
              <Text style={styles.pointText}>{p.text}</Text>
            </View>
          </FadeInUp>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <GradientButton
        label="J'ai compris, continuer"
        icon="arrow-forward"
        onPress={() => navigation.navigate('PhotoCapture')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  illustration: { alignItems: 'center', marginBottom: spacing.md },
  rating: { alignItems: 'center', marginBottom: spacing.lg },
  stars: { flexDirection: 'row', gap: 3, marginBottom: 6 },
  ratingText: { ...font.caption, color: colors.subtext },
  title: { ...font.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 21, paddingHorizontal: spacing.sm,
  },
  points: { marginTop: spacing.xl, gap: spacing.sm },
  pointRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  pointIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pointText: { ...font.caption, color: colors.text, flex: 1, fontWeight: '600' },
});
