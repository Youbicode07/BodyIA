import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { GradientButton } from '../components/GradientButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { RulerPicker } from '../components/RulerPicker';
import { useOnboarding, WorkoutLocation } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { colors, spacing, radius, font } from '../theme/colors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GOALS: { value: 'lose' | 'maintain' | 'gain'; label: string; icon: string }[] = [
  { value: 'lose', label: 'Perdre du poids', icon: 'trending-down' },
  { value: 'maintain', label: 'Maintenir', icon: 'remove' },
  { value: 'gain', label: 'Prendre du muscle', icon: 'trending-up' },
];

const PLACES: { value: WorkoutLocation; label: string; icon: string }[] = [
  { value: 'gym', label: 'Salle de sport', icon: 'barbell' },
  { value: 'home', label: 'À la maison', icon: 'home' },
];

/**
 * Modification du profil.
 *
 * Répond au besoin d'avoir la main sur ses informations : le questionnaire ne
 * se remplit qu'une fois, mais un poids, un objectif ou un lieu d'entraînement
 * changent. Tout est modifiable ici sans devoir tout recommencer.
 */
export function ProfileEditScreen({ navigation }: any) {
  const { answers, updateAnswers } = useOnboarding();
  const { user, signIn, updateUser } = useUser();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [heightCm, setHeightCm] = useState(answers.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState(answers.weightKg ?? 70);
  const [targetWeightKg, setTargetWeightKg] = useState(
    Math.round(answers.targetWeightKg ?? answers.weightKg ?? 70),
  );
  const [goal, setGoal] = useState(answers.goal);
  const [place, setPlace] = useState(answers.workoutLocation);
  const [calories, setCalories] = useState(answers.dailyCalorieGoal ?? 2000);

  const save = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      Alert.alert('E-mail invalide', "Vérifie l'adresse saisie, ou laisse le champ vide.");
      return;
    }
    if (!user && cleanName.length < 2) {
      Alert.alert('Nom manquant', 'Indique au moins ton prénom pour créer ton profil.');
      return;
    }

    // Pas encore de compte : on le crée à la volée plutôt que de renvoyer
    // l'utilisateur vers un autre écran.
    if (user) {
      await updateUser({ name: cleanName || user.name, email: cleanEmail || undefined });
    } else if (cleanName) {
      await signIn({ name: cleanName, email: cleanEmail || undefined, provider: 'email' });
    }

    updateAnswers({
      heightCm,
      weightKg,
      targetWeightKg,
      goal,
      workoutLocation: place,
      dailyCalorieGoal: calories,
    });

    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgSoft }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Mes informations"
          subtitle="Modifiable à tout moment"
          onBack={() => navigation.goBack()}
        />

        <FadeInUp>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Identité</Text>

            <Text style={styles.fieldLabel}>Prénom ou pseudo</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ton prénom"
              placeholderTextColor={colors.faint}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>
              E-mail <Text style={styles.optional}>(facultatif)</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="ton@email.com"
              placeholderTextColor={colors.faint}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
            />
          </Card>
        </FadeInUp>

        <FadeInUp delay={70}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Mesures</Text>
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
              label="Poids actuel"
              unit="kg"
              value={weightKg}
              onChange={setWeightKg}
              min={30}
              max={250}
              accent={colors.gym}
            />
            <RulerPicker
              label="Poids visé"
              unit="kg"
              value={targetWeightKg}
              onChange={setTargetWeightKg}
              min={30}
              max={250}
              accent={colors.fats}
            />
          </Card>
        </FadeInUp>

        <FadeInUp delay={140}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Objectif</Text>
            <View style={styles.chipRow}>
              {GOALS.map((g) => {
                const active = goal === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => setGoal(g.value)}
                    style={[styles.chip, active && { borderColor: colors.brand, backgroundColor: `${colors.brand}12` }]}
                  >
                    <Ionicons
                      name={g.icon as any}
                      size={16}
                      color={active ? colors.brand : colors.subtext}
                    />
                    <Text style={[styles.chipText, active && { color: colors.brand }]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.cardTitle, { marginTop: spacing.md }]}>Lieu d'entraînement</Text>
            <View style={styles.chipRow}>
              {PLACES.map((p) => {
                const active = place === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setPlace(p.value)}
                    style={[styles.chip, active && { borderColor: colors.gym, backgroundColor: `${colors.gym}12` }]}
                  >
                    <Ionicons
                      name={p.icon as any}
                      size={16}
                      color={active ? colors.gym : colors.subtext}
                    />
                    <Text style={[styles.chipText, active && { color: colors.gym }]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </FadeInUp>

        <FadeInUp delay={210}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Objectif calorique</Text>
            <RulerPicker
              label="Par jour"
              unit="kcal"
              value={calories}
              onChange={setCalories}
              min={1200}
              max={4500}
              step={10}
              accent={colors.calories}
            />
            <Text style={styles.hint}>
              Le plan nutrition recalcule tes macros à partir de cette valeur.
            </Text>
          </Card>
        </FadeInUp>

        <GradientButton
          label="Enregistrer"
          icon="checkmark"
          onPress={save}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  cardTitle: { ...font.h3, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  fieldLabel: { ...font.tiny, color: colors.faint, textTransform: 'uppercase', marginBottom: 5 },
  optional: { color: colors.faint, textTransform: 'none' },
  input: {
    backgroundColor: colors.bgSoft, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    ...font.body, color: colors.text,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.cardBorder,
  },
  chipText: { ...font.caption, fontWeight: '700', color: colors.subtext },
  hint: { ...font.tiny, fontWeight: '500', color: colors.faint, textAlign: 'center', marginTop: spacing.sm },
});
