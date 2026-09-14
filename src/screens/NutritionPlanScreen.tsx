import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { ScreenHeader } from '../components/ScreenHeader';
import { useOnboarding } from '../context/OnboardingContext';
import { buildNutritionPlan } from '../services/nutritionPlan';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

export function NutritionPlanScreen({ navigation }: any) {
  const { answers } = useOnboarding();
  const plan = useMemo(() => buildNutritionPlan(answers), [answers]);

  const macros = [
    { label: 'Protéines', value: plan.protein_g, color: colors.protein, icon: 'fitness' as const, kcal: plan.protein_g * 4 },
    { label: 'Glucides', value: plan.carbs_g, color: colors.carbs, icon: 'leaf' as const, kcal: plan.carbs_g * 4 },
    { label: 'Lipides', value: plan.fats_g, color: colors.fats, icon: 'water' as const, kcal: plan.fats_g * 9 },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cet écran est à la fois un onglet et une destination du parcours :
          la flèche retour n'a de sens que dans le second cas. */}
      <ScreenHeader
        title="Ton plan nutrition"
        subtitle={`${plan.goalLabel} · calculé sur ton profil`}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      {plan.isEstimated ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={16} color={colors.warning} />
          <Text style={styles.noticeText}>
            Certaines données de profil manquent : le plan utilise des moyennes. Complète taille, poids et
            date de naissance pour un calcul exact.
          </Text>
        </View>
      ) : null}

      {/* Objectif calorique */}
      <FadeInUp>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>Ton objectif quotidien</Text>
          <Text style={styles.heroValue}>{plan.targetCalories}</Text>
          <Text style={styles.heroUnit}>kcal / jour</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{plan.adjustmentLabel}</Text>
          </View>
        </LinearGradient>
      </FadeInUp>

      {/* Comment ce chiffre est obtenu */}
      <FadeInUp delay={70}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>D'où vient ce chiffre ?</Text>
          <View style={styles.calcRow}>
            <View style={styles.calcStep}>
              <Text style={styles.calcValue}>{plan.bmr}</Text>
              <Text style={styles.calcLabel}>Métabolisme{'\n'}de base</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.faint} />
            <View style={styles.calcStep}>
              <Text style={styles.calcValue}>{plan.tdee}</Text>
              <Text style={styles.calcLabel}>Dépense{'\n'}avec activité</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.faint} />
            <View style={styles.calcStep}>
              <Text style={[styles.calcValue, { color: colors.brand }]}>{plan.targetCalories}</Text>
              <Text style={styles.calcLabel}>Objectif{'\n'}ajusté</Text>
            </View>
          </View>
          {plan.weeklyChangeKg !== 0 ? (
            <Text style={styles.calcNote}>
              À ce rythme : environ {plan.weeklyChangeKg > 0 ? '+' : ''}
              {plan.weeklyChangeKg} kg par semaine.
            </Text>
          ) : null}
        </Card>
      </FadeInUp>

      {/* Répartition des macros */}
      <FadeInUp delay={130}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Tes macronutriments</Text>
          {macros.map((m) => {
            const pct = Math.round((m.kcal / plan.targetCalories) * 100);
            return (
              <View key={m.label} style={styles.macroRow}>
                <View style={[styles.macroIcon, { backgroundColor: `${m.color}14` }]}>
                  <Ionicons name={m.icon} size={16} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.macroTop}>
                    <Text style={styles.macroLabel}>{m.label}</Text>
                    <Text style={styles.macroValue}>{m.value} g</Text>
                  </View>
                  <View style={styles.macroTrack}>
                    <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                  </View>
                  <Text style={styles.macroPct}>{pct} % des calories</Text>
                </View>
              </View>
            );
          })}
          <View style={styles.waterRow}>
            <Ionicons name="water" size={15} color={colors.fats} />
            <Text style={styles.waterText}>Hydratation : {plan.water_l} L d'eau par jour</Text>
          </View>
        </Card>
      </FadeInUp>

      {/* Répartition sur la journée */}
      <Text style={styles.sectionTitle}>Ta journée type</Text>
      {plan.meals.map((meal, i) => (
        <FadeInUp key={meal.key} delay={180 + i * 60}>
          <Card style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <View style={styles.mealIcon}>
                <Ionicons name={meal.icon as any} size={17} color={colors.brand} />
              </View>
              <Text style={styles.mealLabel}>{meal.label}</Text>
              <Text style={styles.mealKcal}>{meal.calories} kcal</Text>
            </View>

            <View style={styles.mealMacros}>
              <View style={[styles.mealTag, { backgroundColor: `${colors.protein}14` }]}>
                <Text style={[styles.mealTagText, { color: colors.protein }]}>P {meal.protein_g}g</Text>
              </View>
              <View style={[styles.mealTag, { backgroundColor: `${colors.carbs}14` }]}>
                <Text style={[styles.mealTagText, { color: colors.carbs }]}>G {meal.carbs_g}g</Text>
              </View>
              <View style={[styles.mealTag, { backgroundColor: `${colors.fats}14` }]}>
                <Text style={[styles.mealTagText, { color: colors.fats }]}>L {meal.fats_g}g</Text>
              </View>
            </View>

            {meal.examples.map((ex, j) => (
              <View key={j} style={styles.exampleRow}>
                <Ionicons name="ellipse" size={5} color={colors.faint} />
                <Text style={styles.exampleText}>{ex}</Text>
              </View>
            ))}
          </Card>
        </FadeInUp>
      ))}

      {/* Conseils */}
      <Text style={styles.sectionTitle}>Les règles qui comptent</Text>
      {plan.tips.map((tip, i) => (
        <FadeInUp key={i} delay={i * 55}>
          <Card style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name={tip.icon as any} size={17} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          </Card>
        </FadeInUp>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSoft },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF7E6', borderRadius: radius.md, padding: spacing.sm + 2,
    marginBottom: spacing.md, borderWidth: 1, borderColor: '#FFE7BA',
  },
  noticeText: { flex: 1, ...font.tiny, fontWeight: '500', color: '#805A00', lineHeight: 16 },

  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  heroLabel: { ...font.caption, color: 'rgba(255,255,255,0.85)' },
  heroValue: { ...font.display, fontSize: 48, color: colors.white, marginTop: 2 },
  heroUnit: { ...font.caption, color: 'rgba(255,255,255,0.85)' },
  heroBadge: {
    marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  heroBadgeText: { ...font.tiny, color: colors.white },

  card: { marginBottom: spacing.md },
  cardTitle: { ...font.h3, color: colors.text, marginBottom: spacing.md },

  calcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calcStep: { alignItems: 'center', flex: 1 },
  calcValue: { ...font.h3, color: colors.text },
  calcLabel: { ...font.tiny, fontWeight: '500', color: colors.subtext, textAlign: 'center', marginTop: 2 },
  calcNote: {
    ...font.caption, color: colors.subtext, marginTop: spacing.md,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },

  macroRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  macroIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  macroLabel: { ...font.bodyBold, fontSize: 14, color: colors.text },
  macroValue: { ...font.bodyBold, fontSize: 14, color: colors.text },
  macroTrack: { height: 6, borderRadius: 3, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 3 },
  macroPct: { ...font.tiny, fontWeight: '500', color: colors.faint, marginTop: 4 },
  waterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },
  waterText: { ...font.caption, color: colors.subtext },

  sectionTitle: { ...font.h2, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },

  mealCard: { marginBottom: spacing.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  mealIcon: {
    width: 32, height: 32, borderRadius: 11, backgroundColor: `${colors.brand}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  mealLabel: { ...font.h3, fontSize: 15, color: colors.text, flex: 1 },
  mealKcal: { ...font.bodyBold, fontSize: 14, color: colors.brand },
  mealMacros: { flexDirection: 'row', gap: 5, marginBottom: spacing.sm },
  mealTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  mealTagText: { ...font.tiny, fontSize: 10 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  exampleText: { ...font.caption, color: colors.subtext, flex: 1 },

  tipCard: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tipIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: `${colors.success}14`,
    alignItems: 'center', justifyContent: 'center',
  },
  tipTitle: { ...font.bodyBold, fontSize: 14, color: colors.text },
  tipText: { ...font.caption, color: colors.subtext, marginTop: 2, lineHeight: 19 },
});
