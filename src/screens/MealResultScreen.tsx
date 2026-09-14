import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { useNutrition } from '../context/NutritionContext';
import { MealAnalysisResult } from '../services/aiMealAnalysis';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const CONFIDENCE_COLOR: Record<string, string> = {
  haute: colors.success,
  moyenne: colors.carbs,
  faible: colors.danger,
};

/** Couleur de la note nutritionnelle : rouge en bas de barème, vert en haut. */
function scoreColor(score: number): string {
  if (score >= 8) return colors.success;
  if (score >= 6) return colors.brandAlt;
  if (score >= 4) return colors.warning;
  return colors.danger;
}

function scoreLabel(score: number): string {
  if (score >= 8) return 'Excellent choix';
  if (score >= 6) return 'Correct';
  if (score >= 4) return 'À équilibrer';
  return 'Occasionnel';
}

export function MealResultScreen({ route, navigation }: any) {
  const { photoUri, result } = route.params as { photoUri: string; result: MealAnalysisResult };
  const { addMeal } = useNutrition();
  const { width } = useWindowDimensions();

  const confidenceColor = CONFIDENCE_COLOR[result.confidence ?? 'moyenne'] ?? colors.carbs;
  const score = result.healthScore ?? 0;
  const ingredients = result.ingredients ?? [];

  const confirmAdd = () => {
    addMeal({
      foodName: result.foodName,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fats_g: result.fats_g,
      confidence: result.confidence,
      photoUri,
    });
    navigation.navigate('MainTabs', { screen: 'Coach' });
  };

  const macros = [
    { label: 'Protéines', value: result.protein_g, color: colors.protein, icon: 'fitness' as const },
    { label: 'Glucides', value: result.carbs_g, color: colors.carbs, icon: 'leaf' as const },
    { label: 'Lipides', value: result.fats_g, color: colors.fats, icon: 'water' as const },
  ];

  // Seconde ligne : les valeurs qui font vraiment la différence entre deux
  // plats à calories égales.
  const details = [
    { label: 'Fibres', value: result.fiber_g, unit: 'g', icon: 'nutrition-outline' as const },
    { label: 'Sucres', value: result.sugar_g, unit: 'g', icon: 'cube-outline' as const },
    { label: 'Sodium', value: result.sodium_mg, unit: 'mg', icon: 'flask-outline' as const },
  ].filter((d) => d.value !== undefined);

  const maxIngredientKcal = Math.max(1, ...ingredients.map((i) => i.calories));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.photoWrap, { height: Math.round(width * 0.72) }]}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        <LinearGradient colors={['rgba(14,16,22,0.6)', 'transparent']} style={styles.topFade} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.white} />
        </Pressable>
        <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}E6` }]}>
          <Ionicons name="sparkles" size={12} color={colors.white} />
          <Text style={styles.confidenceText}>Confiance {result.confidence}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{result.foodName}</Text>

        {result.cookingMethod ? (
          <View style={styles.methodChip}>
            <Ionicons name="flame-outline" size={12} color={colors.gym} />
            <Text style={styles.methodText}>{result.cookingMethod}</Text>
          </View>
        ) : null}

        {result.isFallback ? (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={15} color={colors.warning} />
            <Text style={styles.warningText}>
              Estimation générique : l'IA n'a pas pu analyser cette photo.
            </Text>
          </View>
        ) : null}

        <FadeInUp>
          <LinearGradient
            colors={gradients.fire}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.caloriesCard}
          >
            <Ionicons name="flame" size={26} color={colors.white} />
            <Text style={styles.caloriesValue}>{result.calories}</Text>
            <Text style={styles.caloriesLabel}>calories estimées</Text>
          </LinearGradient>
        </FadeInUp>

        {/* Note nutritionnelle : deux plats à calories égales n'ont pas la
            même valeur, c'est ce que cette jauge rend visible. */}
        {score > 0 ? (
          <FadeInUp delay={60}>
            <Card style={styles.scoreCard}>
              <View style={styles.scoreHeader}>
                <Text style={styles.sectionTitle}>Qualité nutritionnelle</Text>
                <Text style={[styles.scoreValue, { color: scoreColor(score) }]}>{score}/10</Text>
              </View>
              <View style={styles.scoreBar}>
                {Array.from({ length: 10 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.scoreSegment,
                      { backgroundColor: i < score ? scoreColor(score) : colors.progressTrack },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.scoreLabel, { color: scoreColor(score) }]}>
                {scoreLabel(score)}
              </Text>
            </Card>
          </FadeInUp>
        ) : null}

        <View style={styles.macroRow}>
          {macros.map((m, i) => (
            <FadeInUp key={m.label} delay={80 + i * 60} style={{ flex: 1 }}>
              <Card style={styles.macroCard}>
                <View style={[styles.macroIcon, { backgroundColor: `${m.color}14` }]}>
                  <Ionicons name={m.icon} size={16} color={m.color} />
                </View>
                <Text style={styles.macroValue}>{m.value}g</Text>
                <Text style={styles.macroLabel}>{m.label}</Text>
              </Card>
            </FadeInUp>
          ))}
        </View>

        {details.length > 0 ? (
          <FadeInUp delay={140}>
            <Card style={styles.detailCard}>
              {details.map((d, i) => (
                <View
                  key={d.label}
                  style={[styles.detailRow, i === details.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Ionicons name={d.icon} size={16} color={colors.subtext} />
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailValue}>
                    {d.value} {d.unit}
                  </Text>
                </View>
              ))}
            </Card>
          </FadeInUp>
        ) : null}

        {/* Détail aliment par aliment : c'est ce qui rend l'estimation
            vérifiable au lieu d'être un chiffre à croire sur parole. */}
        {ingredients.length > 0 ? (
          <FadeInUp delay={180}>
            <Card style={styles.block}>
              <Text style={styles.sectionTitle}>Ce que l'IA a identifié</Text>
              {ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                    {ing.quantity ? (
                      <Text style={styles.ingredientQty}>{ing.quantity}</Text>
                    ) : null}
                    <View style={styles.ingredientTrack}>
                      <View
                        style={[
                          styles.ingredientFill,
                          { width: `${Math.round((ing.calories / maxIngredientKcal) * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.ingredientKcal}>{ing.calories} kcal</Text>
                </View>
              ))}
              {result.portionNote ? (
                <View style={styles.portionNote}>
                  <Ionicons name="resize-outline" size={13} color={colors.subtext} />
                  <Text style={styles.portionText}>{result.portionNote}</Text>
                </View>
              ) : null}
            </Card>
          </FadeInUp>
        ) : null}

        {result.advice ? (
          <FadeInUp delay={220}>
            <Card style={styles.block}>
              <View style={styles.adviceHeader}>
                <View style={[styles.adviceIcon, { backgroundColor: `${colors.brand}14` }]}>
                  <Ionicons name="restaurant-outline" size={15} color={colors.brand} />
                </View>
                <Text style={styles.sectionTitle}>L'avis du nutritionniste</Text>
              </View>
              <Text style={styles.adviceText}>{result.advice}</Text>

              {result.improvement ? (
                <View style={styles.improvement}>
                  <Ionicons name="arrow-up-circle" size={15} color={colors.gym} />
                  <Text style={styles.improvementText}>{result.improvement}</Text>
                </View>
              ) : null}
            </Card>
          </FadeInUp>
        ) : null}

        <GradientButton
          label="Ajouter à mon journal"
          icon="checkmark"
          onPress={confirmAdd}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSoft },
  photoWrap: { overflow: 'hidden', backgroundColor: colors.bgDark },
  photo: { width: '100%', height: '100%' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  backBtn: {
    position: 'absolute', top: spacing.xl, left: spacing.md,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  confidenceBadge: {
    position: 'absolute', bottom: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill,
  },
  confidenceText: { ...font.tiny, color: colors.white },

  body: {
    padding: spacing.lg, marginTop: -spacing.lg, backgroundColor: colors.bgSoft,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  title: { ...font.h1, color: colors.text, textTransform: 'capitalize' },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: spacing.sm, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, backgroundColor: `${colors.gym}12`,
  },
  methodText: { ...font.tiny, color: colors.gym, textTransform: 'capitalize' },

  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF7E6', borderRadius: radius.md, padding: spacing.sm + 2,
    marginTop: spacing.md, borderWidth: 1, borderColor: '#FFE7BA',
  },
  warningText: { flex: 1, ...font.caption, color: '#805A00', fontWeight: '600' },

  caloriesCard: {
    alignItems: 'center', paddingVertical: spacing.lg, borderRadius: radius.lg,
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  caloriesValue: { ...font.display, color: colors.white, marginTop: 4 },
  caloriesLabel: { ...font.caption, color: 'rgba(255,255,255,0.9)' },

  sectionTitle: { ...font.h3, fontSize: 15, color: colors.text },
  scoreCard: { marginBottom: spacing.sm, gap: spacing.sm },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreValue: { ...font.h3 },
  scoreBar: { flexDirection: 'row', gap: 3 },
  scoreSegment: { flex: 1, height: 7, borderRadius: 4 },
  scoreLabel: { ...font.tiny },

  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroCard: { alignItems: 'center', paddingVertical: spacing.md, gap: 5 },
  macroIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  macroValue: { ...font.h3, color: colors.text },
  macroLabel: { ...font.tiny, fontWeight: '500', color: colors.subtext },

  detailCard: { marginTop: spacing.sm },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  detailLabel: { flex: 1, ...font.caption, color: colors.subtext },
  detailValue: { ...font.bodyBold, fontSize: 14, color: colors.text },

  block: { marginTop: spacing.sm, gap: spacing.sm },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ingredientName: { ...font.bodyBold, fontSize: 14, color: colors.text },
  ingredientQty: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 1 },
  ingredientTrack: {
    height: 4, borderRadius: 2, backgroundColor: colors.progressTrack, marginTop: 6, overflow: 'hidden',
  },
  ingredientFill: { height: '100%', borderRadius: 2, backgroundColor: colors.brand },
  ingredientKcal: { ...font.tiny, color: colors.subtext, marginTop: 2 },

  portionNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },
  portionText: { flex: 1, ...font.tiny, fontWeight: '500', color: colors.subtext, lineHeight: 16 },

  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adviceIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  adviceText: { ...font.body, color: colors.text, lineHeight: 21 },
  improvement: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: `${colors.gym}0F`, borderRadius: radius.sm, padding: spacing.sm + 2,
  },
  improvementText: { flex: 1, ...font.caption, color: colors.text, lineHeight: 19 },
});
