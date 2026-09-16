import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { onboardingSteps } from '../data/onboardingSteps';
import { ChoiceCard } from '../components/ChoiceCard';
import { GradientButton } from '../components/GradientButton';
import { ProgressBar } from '../components/ProgressBar';
import { FadeInUp } from '../components/FadeInUp';
import { RulerPicker } from '../components/RulerPicker';
import { WheelPicker } from '../components/WheelPicker';
import { OnboardingMedia } from '../components/OnboardingMedia';
import { useOnboarding } from '../context/OnboardingContext';
import { colors, spacing, radius, font } from '../theme/colors';
import { useResponsive } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Lecture immédiate de l'IMC : donne du sens aux deux réglages. */
function bmiVerdict(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Corpulence mince', color: colors.fats };
  if (bmi < 25) return { label: 'Corpulence normale', color: colors.success };
  if (bmi < 30) return { label: 'Surpoids léger', color: colors.warning };
  return { label: 'Surpoids', color: colors.danger };
}

function OnboardingVisual({ stepId }: { stepId: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  return (
    <Animated.View style={[styles.visual, { transform: [{ scale }] }]}>
      <OnboardingMedia stepId={stepId} />
    </Animated.View>
  );
}

// Écran générique qui rend N'IMPORTE QUELLE étape définie dans onboardingSteps.ts :
// choix simple, choix multiple, écran d'info, taille/poids, date de naissance, slider.
export function OnboardingStepScreen({ route, navigation }: any) {
  const { index } = route.params;
  const step = onboardingSteps[index];
  const { answers, updateAnswers } = useOnboarding();
  const { height: screenHeight } = useWindowDimensions();
  const { horizontalPadding, verticalScale, moderateScale } = useResponsive();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<string[]>([]);
  // Valeurs numériques : plus aucune saisie texte sur ces étapes, donc plus de
  // conversion hasardeuse ni de champ vide à gérer.
  const [heightCm, setHeightCm] = useState(answers.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState(answers.weightKg ?? 70);

  const currentYear = new Date().getFullYear();
  // La molette va jusqu'à l'année en cours : une date de naissance récente
  // (jeune utilisateur) doit rester saisissable, pas seulement jusqu'à 2016.
  const years = useMemo(
    () => Array.from({ length: currentYear - 1930 + 1 }, (_, i) => 1930 + i),
    [currentYear],
  );
  const speedConfig = answers.goal === 'lose'
    ? { min: 0.1, max: 1, step: 0.1, unit: 'kg/semaine', title: 'À quel rythme veux-tu progresser vers ta perte de poids ?', subtitle: 'Un rythme régulier protège ton énergie et facilite la constance.' }
    : answers.goal === 'gain'
      ? { min: 0.1, max: 0.5, step: 0.1, unit: 'niveau / semaine', title: 'À quel rythme veux-tu construire du muscle ?', subtitle: 'La progression musculaire se construit avec patience et régularité.' }
      : { min: 0.1, max: 0.4, step: 0.1, unit: 'niveau / semaine', title: 'À quel rythme veux-tu entretenir ta forme ?', subtitle: 'Le bon rythme est celui que tu peux tenir dans la durée.' };

  useEffect(() => {
    if (step.id !== 'speed') return;
    setSliderValue((current) => Math.min(speedConfig.max, Math.max(speedConfig.min, current)));
  }, [speedConfig.max, speedConfig.min, step.id]);
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  const [dayIndex, setDayIndex] = useState(0);
  const [monthIndex, setMonthIndex] = useState(0);
  const [yearIndex, setYearIndex] = useState(() => Math.max(0, years.indexOf(2000)));

  // Le poids objectif part du poids actuel déjà déclaré par l'utilisateur
  // plutôt que d'une valeur arbitraire : c'est un point de départ cohérent
  // avec ce qu'il a lui-même renseigné, pas une estimation à l'aveugle.
  const [sliderValue, setSliderValue] = useState(() =>
    step.answerKey === 'targetWeightKg' && answers.weightKg
      ? answers.weightKg
      : step.sliderDefault ?? 0,
  );

  const isMulti = step.type === 'multi-choice';

  const birthYear = years[yearIndex] ?? 2000;

  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const verdict = bmiVerdict(bmi);

  // Sur un petit écran, la molette de date doit rester entièrement visible.
  const compact = screenHeight < 700;
  const previousProfile = [
    answers.experienceLevel
      ? `niveau ${answers.experienceLevel === 'debutant' ? 'débutant' : answers.experienceLevel === 'intermediaire' ? 'intermédiaire' : 'avancé'}`
      : null,
    answers.workoutsPerWeek ? `${answers.workoutsPerWeek} séances par semaine` : null,
    answers.workoutLocation === 'gym' ? 'entraînement à la salle' : answers.workoutLocation === 'home' ? 'entraînement à la maison' : null,
  ].filter(Boolean).join(' · ');
  const selectedGoal = answers.goal === 'lose'
    ? {
        label: 'Perdre du poids',
        detail: 'Réduire progressivement ton poids tout en gardant ton énergie et ta force.',
        icon: 'trending-down' as const,
      }
    : answers.goal === 'gain'
      ? {
          label: 'Prendre du muscle',
          detail: 'Construire ta force et ta masse musculaire avec un entraînement progressif.',
          icon: 'barbell' as const,
        }
      : {
          label: 'Maintenir ma forme',
          detail: 'Entretenir ta condition physique et rester régulier dans la durée.',
          icon: 'fitness' as const,
        };

  const toggleOption = (value: string) => {
    if (isMulti) {
      setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    } else {
      setSelected([value]);
    }
  };

  const goToNext = () => {
    const nextIndex = index + 1;
    if (nextIndex < onboardingSteps.length) {
      navigation.push('OnboardingStep', { index: nextIndex });
    } else {
      navigation.navigate('Trust');
    }
  };

  const handleContinue = () => {
    switch (step.type) {
      case 'choice':
      case 'multi-choice':
        if (step.answerKey) updateAnswers({ [step.answerKey]: isMulti ? selected : selected[0] } as any);
        break;
      case 'height-weight':
        updateAnswers({ heightCm, weightKg });
        break;
      case 'date': {
        const month = String(monthIndex + 1).padStart(2, '0');
        const day = String(days[dayIndex] ?? 1).padStart(2, '0');
        updateAnswers({ birthDate: `${birthYear}-${month}-${day}` });
        break;
      }
      case 'slider':
        if (step.answerKey) updateAnswers({ [step.answerKey]: sliderValue } as any);
        break;
    }
    goToNext();
  };

  const canContinue = () => {
    if (step.type === 'choice' || step.type === 'multi-choice') return selected.length > 0;
    return true; // info / height-weight / date / slider ont toujours des valeurs par défaut
  };

  return (
    <View style={styles.screen}>
      <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.container,
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: verticalScale(spacing.xl),
          paddingBottom: verticalScale(spacing.lg),
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar progress={(index + 1) / (onboardingSteps.length + 1)} />
        </View>
        <Text style={styles.stepCount}>
          {index + 1}/{onboardingSteps.length}
        </Text>
      </View>

      <View style={{ height: verticalScale(154), marginBottom: spacing.sm }}>
        <OnboardingVisual stepId={step.id} />
      </View>
      <Text style={styles.eyebrow}>TON PLAN SE CONSTRUIT</Text>
      <Text style={[styles.title, { fontSize: moderateScale(28) }]}>
        {step.id === 'speed' ? speedConfig.title : step.title}
      </Text>
      {step.subtitle || step.id === 'speed' ? (
        <Text style={styles.subtitle}>
          {step.id === 'speed'
            ? speedConfig.subtitle
            : step.id === 'realisticTarget'
              ? `Ton coach IA va t'aider à te transformer et à atteindre ton objectif grâce aux réponses que tu as déjà données${previousProfile ? ` : ${previousProfile}` : ''}.`
              : step.subtitle}
        </Text>
      ) : null}

      {step.id === 'realisticTarget' ? (
        <FadeInUp delay={120}>
          <View style={styles.goalCard}>
            <View style={styles.goalIcon}>
              <Ionicons name={selectedGoal.icon} size={25} color={colors.white} />
            </View>
            <View style={styles.goalContent}>
              <Text style={styles.goalLabel}>TON OBJECTIF</Text>
              <Text style={styles.goalTitle}>{selectedGoal.label}</Text>
              <Text style={styles.goalDetail}>{selectedGoal.detail}</Text>
            </View>
          </View>
          <View style={styles.coachMessage}>
            <Ionicons name="sparkles" size={18} color={colors.brandAlt} />
            <Text style={styles.coachMessageText}>
              Ton coach IA utilise cet objectif et tes réponses précédentes pour construire un accompagnement adapté à ton rythme.
            </Text>
          </View>
        </FadeInUp>
      ) : null}

      {(step.type === 'choice' || step.type === 'multi-choice') && (
        <View style={styles.options}>
          {step.options?.map((opt, i) => (
            <FadeInUp key={opt.value} delay={i * 45}>
              <ChoiceCard
                label={opt.label}
                sublabel={opt.sublabel}
                selected={selected.includes(opt.value)}
                onPress={() => toggleOption(opt.value)}
              />
            </FadeInUp>
          ))}
        </View>
      )}

      {step.type === 'height-weight' && (
        <FadeInUp>
          <RulerPicker
            label="Taille"
            unit="cm"
            value={heightCm}
            onChange={setHeightCm}
            min={120}
            max={230}
            accent={colors.brand}
          />
          <RulerPicker
            label="Poids"
            unit="kg"
            value={weightKg}
            onChange={setWeightKg}
            min={30}
            max={250}
            accent={colors.gym}
          />

          {/* Retour immédiat : la combinaison taille/poids prend un sens
              concret pendant le réglage, ce qui rend une erreur évidente. */}
          <View style={[styles.readout, { borderColor: `${verdict.color}33`, backgroundColor: `${verdict.color}0F` }]}>
            <View style={[styles.readoutDot, { backgroundColor: verdict.color }]} />
            <Text style={styles.readoutLabel}>IMC {bmi.toFixed(1)}</Text>
            <Text style={[styles.readoutValue, { color: verdict.color }]}>{verdict.label}</Text>
          </View>
        </FadeInUp>
      )}

      {step.type === 'date' && (
        <FadeInUp>
          <View style={[styles.wheels, compact && { transform: [{ scale: 0.9 }] }]}>
            <WheelPicker
              label="Jour"
              values={days}
              index={dayIndex}
              onChange={setDayIndex}
              accent={colors.brand}
            />
            <WheelPicker
              label="Mois"
              values={MONTHS}
              index={monthIndex}
              onChange={setMonthIndex}
              accent={colors.brand}
            />
            <WheelPicker
              label="Année"
              values={years}
              index={yearIndex}
              onChange={setYearIndex}
              accent={colors.brand}
            />
          </View>
        </FadeInUp>
      )}

      {step.type === 'slider' && (
        <View style={{ marginTop: spacing.lg }}>
          {step.answerKey === 'targetWeightKg' && answers.weightKg ? (
            <Text style={styles.sliderReference}>Poids actuel : {answers.weightKg} kg</Text>
          ) : null}
          <Text style={styles.sliderValue}>
            {sliderValue.toFixed(1)} {step.id === 'speed' ? speedConfig.unit : step.sliderUnit}
          </Text>
          <Slider
            minimumValue={step.id === 'speed'
              ? speedConfig.min
              : step.answerKey === 'targetWeightKg' && answers.weightKg
              ? Math.max(40, answers.weightKg - 40)
              : step.sliderMin}
            maximumValue={step.id === 'speed' ? speedConfig.max : step.sliderMax}
            step={step.id === 'speed' ? speedConfig.step : step.sliderStep}
            value={sliderValue}
            onValueChange={setSliderValue}
            minimumTrackTintColor={colors.brand}
            maximumTrackTintColor={colors.progressTrack}
            thumbTintColor={colors.brand}
          />
        </View>
      )}

      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <GradientButton
          label="Continuer"
          icon="arrow-forward"
          onPress={handleContinue}
          disabled={!canContinue()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  footer: {
    backgroundColor: colors.bg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${colors.cardBorder}66`,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  backButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCount: { ...font.tiny, color: colors.subtext },
  visual: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  visualGlow: {
    position: 'absolute', width: 150, height: 110, borderRadius: 75,
    backgroundColor: `${colors.brand}12`,
  },
  visualBadge: {
    position: 'absolute', right: 28, bottom: 8, flexDirection: 'row', gap: 4,
    alignItems: 'center', backgroundColor: colors.text, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  visualBadgeText: { ...font.tiny, color: colors.white, fontSize: 9 },
  eyebrow: { ...font.tiny, color: colors.brand, marginBottom: spacing.xs },
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.body, color: colors.subtext, marginTop: spacing.xs, lineHeight: 21 },
  options: { marginTop: spacing.lg, marginHorizontal: -2, paddingHorizontal: 2 },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  goalIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  goalContent: { flex: 1 },
  goalLabel: { ...font.tiny, color: colors.brandAlt, marginBottom: 3 },
  goalTitle: { ...font.h2, color: colors.text, fontSize: 20 },
  goalDetail: { ...font.caption, color: colors.subtext, marginTop: 4, lineHeight: 18 },
  coachMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  coachMessageText: { ...font.caption, color: colors.text, flex: 1, lineHeight: 18 },

  readout: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radius.md, borderWidth: 1,
  },
  readoutDot: { width: 8, height: 8, borderRadius: 4 },
  readoutLabel: { ...font.bodyBold, fontSize: 14, color: colors.text },
  readoutValue: { ...font.caption, fontWeight: '700', marginLeft: 'auto', color: colors.subtext },

  wheels: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sliderReference: { ...font.caption, color: colors.subtext, textAlign: 'center', marginBottom: spacing.xs },
  sliderValue: { ...font.display, color: colors.brand, textAlign: 'center', marginBottom: spacing.md },
});
