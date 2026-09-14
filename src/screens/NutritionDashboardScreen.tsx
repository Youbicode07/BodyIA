import React, { useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CalorieRing } from '../components/CalorieRing';
import { MacroRing } from '../components/MacroRing';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useNutrition } from '../context/NutritionContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { buildNutritionPlan } from '../services/nutritionPlan';
import { muscleLabel } from '../data/muscleGroups';
import { colors, spacing, radius, font, gradients, shadow } from '../theme/colors';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const todayLabel = () =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function NutritionDashboardScreen({ navigation }: any) {
  const { meals, totals } = useNutrition();
  const { answers } = useOnboarding();
  const { user } = useUser();

  // Objectifs issus du plan personnalisé (profil + objectif), plutôt qu'une
  // valeur fixe identique pour tout le monde.
  const plan = useMemo(() => buildNutritionPlan(answers), [answers]);
  const dailyGoalCalories = plan.targetCalories;
  const proteinGoal = plan.protein_g;
  const carbsGoal = plan.carbs_g;
  const fatsGoal = plan.fats_g;
  const caloriePercent =
    dailyGoalCalories > 0 ? Math.round((totals.calories / dailyGoalCalories) * 100) : 0;
  const priorityZones = (answers.analysis?.zones ?? []).filter(
    (zone) => zone.status === 'priority' && zone.visible !== false && !zone.isGeneric,
  );
  const focusLabel = priorityZones[0]?.muscleGroup
    ? muscleLabel(priorityZones[0].muscleGroup)
    : answers.analysis
      ? 'Corps entier'
      : 'Ton programme';
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>SUIVI NUTRITION</Text>
          <Text style={styles.greeting}>{greeting()}{user?.name ? `, ${user.name}` : ''}</Text>
          <Text style={styles.date}>{todayLabel()}</Text>
        </View>
      </View>

      {/* Le pourcentage affiché ici était écrit en dur (42 %), au-dessus d'un
          « 0 séance terminée » tout aussi figé. Il mesure maintenant ce qu'il
          annonce : la part de l'objectif calorique réellement consommée. */}
      <FadeInUp>
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.progressKicker}>APPORT DU JOUR</Text>
              <Text style={styles.progressTitle}>
                {caloriePercent >= 100
                  ? 'Objectif calorique atteint'
                  : caloriePercent >= 60
                    ? 'Tu es sur ton rythme'
                    : 'Journée à compléter'}
              </Text>
            </View>
            <Text style={styles.progressPercent}>{caloriePercent}%</Text>
          </View>
          <View style={styles.longTrack}>
            <View style={[styles.longFill, { width: `${Math.min(100, caloriePercent)}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              {meals.length} repas enregistré{meals.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.progressMetaText}>
              Objectif : {dailyGoalCalories} kcal
            </Text>
          </View>
        </View>
      </FadeInUp>

      <Text style={styles.sectionKicker}>PROCHAINES ACTIONS</Text>
      <FadeInUp delay={90}>
        <Pressable onPress={() => navigation.navigate('NutritionPlan')} style={styles.actionRow}>
          <View style={[styles.actionNumber, { backgroundColor: `${colors.gym}22` }]}>
            <Text style={[styles.actionNumberText, { color: colors.gymAlt }]}>01</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Mon plan nutrition</Text>
            <Text style={styles.actionSub}>Focus : {focusLabel}</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={25} color={colors.gymAlt} />
        </Pressable>
      </FadeInUp>
      <FadeInUp delay={150}>
        <Pressable
          onPress={() => navigation.navigate('MainTabs', { screen: 'Corps' })}
          style={styles.actionRow}
        >
          <View style={[styles.actionNumber, { backgroundColor: `${colors.danger}22` }]}>
            <Text style={[styles.actionNumberText, { color: colors.danger }]}>02</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Vérifier ton corps</Text>
            <Text style={styles.actionSub}>{priorityZones.length} zone{priorityZones.length > 1 ? 's' : ''} à suivre</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={25} color={colors.danger} />
        </Pressable>
      </FadeInUp>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionKicker}>02 / PERFORMANCE</Text>
          <Text style={styles.sectionTitle}>État du jour</Text>
          <Text style={styles.sectionSub}>Nutrition et énergie</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('MealCapture')} style={styles.miniScan}>
          <Ionicons name="camera" size={15} color={colors.white} />
        </Pressable>
      </View>

      <FadeInUp delay={140}>
        <Card style={styles.ringCard}>
          <CalorieRing consumed={totals.calories} goal={dailyGoalCalories} />

          <View style={styles.divider} />

          <View style={styles.macroRow}>
            <MacroRing label="Protéines" value={totals.protein_g} goal={proteinGoal} color={colors.protein} icon="fitness" />
            <MacroRing label="Glucides" value={totals.carbs_g} goal={carbsGoal} color={colors.carbs} icon="leaf" />
            <MacroRing label="Lipides" value={totals.fats_g} goal={fatsGoal} color={colors.fats} icon="water" />
          </View>
        </Card>
      </FadeInUp>

      <FadeInUp delay={220}>
        <Pressable onPress={() => navigation.navigate('MealCapture')}>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.scanButton, shadow.floating]}
          >
            <View style={styles.scanIcon}>
              <Ionicons name="camera" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>Scanner un repas</Text>
              <Text style={styles.scanSub}>Calories et macros en 1 photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        </Pressable>
      </FadeInUp>

      <FadeInUp delay={300}>
        <Pressable onPress={() => navigation.navigate('NutritionPlan')}>
          <Card style={styles.planCard}>
            <View style={styles.planIcon}>
              <Ionicons name="clipboard" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>Mon plan nutrition</Text>
              <Text style={styles.planSub}>Objectif, macros, journée type et conseils</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </Card>
        </Pressable>
      </FadeInUp>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Repas enregistrés</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{meals.length}</Text>
        </View>
      </View>

      {meals.length === 0 ? (
        <Card style={styles.emptyCard}>
          <EmptyIllustration kind="meal" width={150} color={colors.calories} />
          <Text style={styles.empty}>Aucun repas enregistré</Text>
          <Text style={styles.emptySub}>Prends ton prochain repas en photo pour le suivre ici.</Text>
        </Card>
      ) : (
        meals.map((m, i) => (
          <FadeInUp key={m.id} delay={i * 60}>
            <Card style={styles.mealRow} padded={false}>
              <View style={styles.mealInner}>
                {m.photoUri ? (
                  <Image source={{ uri: m.photoUri }} style={styles.mealPhoto} />
                ) : (
                  <View style={[styles.mealPhoto, styles.mealPhotoPlaceholder]}>
                    <Ionicons name="fast-food-outline" size={22} color={colors.faint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName} numberOfLines={1}>{m.foodName}</Text>
                  <View style={styles.mealMacrosRow}>
                    <View style={[styles.macroTag, { backgroundColor: `${colors.calories}14` }]}>
                      <Text style={[styles.macroTagText, { color: colors.calories }]}>{m.calories} kcal</Text>
                    </View>
                    <View style={[styles.macroTag, { backgroundColor: `${colors.protein}14` }]}>
                      <Text style={[styles.macroTagText, { color: colors.protein }]}>P {m.protein_g}g</Text>
                    </View>
                    <View style={[styles.macroTag, { backgroundColor: `${colors.carbs}14` }]}>
                      <Text style={[styles.macroTagText, { color: colors.carbs }]}>G {m.carbs_g}g</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          </FadeInUp>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { ...font.tiny, color: colors.brandAlt, letterSpacing: 1.8, marginBottom: 5 },
  greeting: { ...font.h1, color: colors.text },
  date: { ...font.caption, color: colors.faint, marginTop: 3, textTransform: 'capitalize' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill,
    borderWidth: 1, borderColor: `${colors.brand}66`, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: `${colors.brand}12`,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  statusText: { ...font.tiny, fontSize: 9, color: colors.brand, letterSpacing: 0.8 },

  progressCard: {
    backgroundColor: colors.card, borderRadius: 6, padding: spacing.md,
    marginBottom: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.brandAlt,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressKicker: { ...font.tiny, color: colors.faint, letterSpacing: 1.2 },
  progressTitle: { ...font.h3, color: colors.text, marginTop: 5 },
  progressPercent: { ...font.h1, fontSize: 26, color: colors.brandAlt },
  longTrack: { height: 9, backgroundColor: colors.progressTrack, borderRadius: 5, overflow: 'hidden', marginTop: spacing.md },
  longFill: { height: '100%', backgroundColor: colors.brandAlt, borderRadius: 5 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressMetaText: { ...font.tiny, fontWeight: '500', color: colors.faint },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card,
    borderRadius: 6, padding: spacing.sm + 2, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  actionNumber: { width: 42, height: 42, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  actionNumberText: { ...font.bodyBold, fontSize: 13 },
  actionTitle: { ...font.bodyBold, color: colors.text, fontSize: 14 },
  actionSub: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 3 },

  coachHero: {
    minHeight: 218, borderRadius: 8, padding: spacing.lg, marginBottom: spacing.md,
    overflow: 'hidden', position: 'relative', backgroundColor: '#101B2D',
    borderWidth: 1, borderColor: '#344B6B',
  },
  heroOrb: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    right: -120, bottom: -150, borderWidth: 1, borderColor: colors.brandAlt,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  heroIndex: { ...font.tiny, color: colors.brandAlt, letterSpacing: 1.4 },
  heroTitle: { ...font.h1, fontSize: 25, color: colors.white },
  heroText: { ...font.caption, color: colors.subtext, marginTop: 7, maxWidth: 270, lineHeight: 18 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  progressTrack: { height: 5, flex: 1, backgroundColor: '#2A3A54', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: colors.brandAlt, borderRadius: 3 },
  progressLabel: { ...font.tiny, color: colors.brandAlt, fontSize: 10 },
  heroAction: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.brandAlt, borderRadius: 5, paddingHorizontal: 13, paddingVertical: 9,
    marginTop: spacing.md, minWidth: 154, justifyContent: 'center',
  },
  heroActionText: { ...font.tiny, fontSize: 10, color: colors.bgDark, letterSpacing: 0.6 },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  quickFlex: { flex: 1 },
  quickCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickTitle: { ...font.bodyBold, fontSize: 13, color: colors.text },
  quickSub: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 3 },

  ringCard: {
    alignItems: 'center', paddingVertical: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  divider: { height: 1, backgroundColor: colors.cardBorder, alignSelf: 'stretch', marginVertical: spacing.md },
  macroRow: { flexDirection: 'row', width: '100%' },

  scanButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: `${colors.brandAlt}88`,
  },
  scanIcon: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanTitle: { ...font.bodyBold, fontSize: 16, color: colors.white },
  scanSub: { ...font.caption, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.cardBorder },
  planIcon: {
    width: 44, height: 44, borderRadius: 15, backgroundColor: `${colors.success}14`,
    alignItems: 'center', justifyContent: 'center',
  },
  planTitle: { ...font.bodyBold, fontSize: 15, color: colors.text },
  planSub: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: spacing.sm },
  sectionTitle: { ...font.h2, fontSize: 19, color: colors.text },
  sectionKicker: { ...font.tiny, color: colors.brandAlt, letterSpacing: 1.3, marginBottom: 3 },
  sectionSub: { ...font.tiny, fontWeight: '500', color: colors.faint, marginTop: 3 },
  miniScan: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  countPill: { backgroundColor: colors.card, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  countText: { ...font.tiny, color: colors.subtext },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, borderWidth: 1, borderColor: colors.cardBorder },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  empty: { ...font.bodyBold, color: colors.text },
  emptySub: { ...font.caption, color: colors.subtext, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg },

  mealRow: { marginBottom: spacing.sm },
  mealInner: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm + 2, gap: spacing.sm },
  mealPhoto: { width: 58, height: 58, borderRadius: radius.sm },
  mealPhotoPlaceholder: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  mealName: { ...font.bodyBold, color: colors.text, textTransform: 'capitalize' },
  mealMacrosRow: { flexDirection: 'row', gap: 5, marginTop: 6, flexWrap: 'wrap' },
  macroTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  macroTagText: { ...font.tiny, fontSize: 10 },
});
