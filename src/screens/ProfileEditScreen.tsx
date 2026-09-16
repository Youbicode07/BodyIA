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
import { useOnboarding, ExperienceLevel, WorkoutLocation } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { useCoach } from '../context/CoachContext';
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

const LEVELS: { value: ExperienceLevel; label: string; icon: string }[] = [
  { value: 'debutant', label: 'Débutant', icon: 'leaf' },
  { value: 'intermediaire', label: 'Intermédiaire', icon: 'flame' },
  { value: 'avance', label: 'Avancé', icon: 'trophy' },
];

const GENDERS: { value: 'male' | 'female' | 'other'; label: string; icon: string }[] = [
  { value: 'male', label: 'Homme', icon: 'man' },
  { value: 'female', label: 'Femme', icon: 'woman' },
  { value: 'other', label: 'Autre', icon: 'person' },
];

const FREQUENCIES: { value: '0-2' | '3-5' | '6+'; label: string }[] = [
  { value: '0-2', label: '0 à 2 / sem.' },
  { value: '3-5', label: '3 à 5 / sem.' },
  { value: '6+', label: '6+ / sem.' },
];

const DIETS: { value: 'classic' | 'pescatarian' | 'vegetarian' | 'vegan'; label: string }[] = [
  { value: 'classic', label: 'Classique' },
  { value: 'pescatarian', label: 'Pescétarien' },
  { value: 'vegetarian', label: 'Végétarien' },
  { value: 'vegan', label: 'Végan' },
];

/** Année de naissance : suffit à calculer l'âge, sans clavier de date. */
const CURRENT_YEAR = new Date().getFullYear();

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
  const { regenerateProgram, program } = useCoach();
  const [saving, setSaving] = useState(false);

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
  const [level, setLevel] = useState(answers.experienceLevel);
  const [gender, setGender] = useState(answers.gender);
  const [frequency, setFrequency] = useState(answers.workoutsPerWeek);
  const [diet, setDiet] = useState(answers.diet);
  const [birthYear, setBirthYear] = useState(
    answers.birthDate ? Number(answers.birthDate.slice(0, 4)) || CURRENT_YEAR - 25 : CURRENT_YEAR - 25,
  );

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

    setSaving(true);
    try {
      // Pas encore de compte : on le crée à la volée plutôt que de renvoyer
      // l'utilisateur vers un autre écran.
      if (user) {
        await updateUser({ name: cleanName || user.name, email: cleanEmail || undefined });
      } else if (cleanName) {
        await signIn({ name: cleanName, email: cleanEmail || undefined, provider: 'email' });
      }

      // La date de naissance conserve le jour et le mois déjà renseignés :
      // seule l'année est modifiable ici, et écraser le reste ferait perdre
      // une information que l'utilisateur avait donnée à l'inscription.
      const previousBirth = answers.birthDate;
      const monthDay = previousBirth && previousBirth.length >= 10 ? previousBirth.slice(4) : '-01-01';

      const patch = {
        heightCm,
        weightKg,
        targetWeightKg,
        goal,
        workoutLocation: place,
        dailyCalorieGoal: calories,
        experienceLevel: level,
        gender,
        workoutsPerWeek: frequency,
        diet,
        birthDate: `${birthYear}${monthDay}`,
      };

      // L'enregistrement sur le téléphone est déclenché par ce seul appel :
      // le contexte écrit les réponses sous la clé du compte courant.
      updateAnswers(patch);

      /**
       * Le programme doit SUIVRE la modification.
       *
       * Sans cela, changer de lieu d'entraînement ou de niveau ne changeait
       * rien aux séances affichées : l'utilisateur voyait « salle » dans son
       * profil et continuait à recevoir des exercices au poids du corps. Le
       * patch est passé en surcharge parce que le contexte d'inscription n'a
       * pas encore propagé la nouvelle valeur au moment de cet appel.
       */
      const placeChanged = place !== answers.workoutLocation;
      const levelChanged = level !== answers.experienceLevel;
      const goalChanged = goal !== answers.goal;
      const frequencyChanged = frequency !== answers.workoutsPerWeek;
      if (program && (placeChanged || levelChanged || goalChanged || frequencyChanged)) {
        await regenerateProgram(patch);
      }
    } finally {
      setSaving(false);
    }

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

        <FadeInUp delay={50}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Sexe</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => {
                const active = gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => setGender(g.value)}
                    style={[styles.chip, active && { borderColor: colors.brand, backgroundColor: `${colors.brand}12` }]}
                  >
                    <Ionicons name={g.icon as any} size={16} color={active ? colors.brand : colors.subtext} />
                    <Text style={[styles.chipText, active && { color: colors.brand }]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Seule l'année est demandée : elle suffit à calculer l'âge, que
                l'IA utilise pour adapter ses recommandations, et elle évite un
                sélecteur de date pénible sur un petit écran. */}
            <Text style={[styles.cardTitle, { marginTop: spacing.md }]}>Année de naissance</Text>
            <RulerPicker
              label="Né(e) en"
              unit=""
              value={birthYear}
              onChange={setBirthYear}
              min={CURRENT_YEAR - 90}
              max={CURRENT_YEAR - 12}
              accent={colors.brandAlt}
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

            <Text style={[styles.cardTitle, { marginTop: spacing.md }]}>Niveau</Text>
            <View style={styles.chipRow}>
              {LEVELS.map((l) => {
                const active = level === l.value;
                return (
                  <Pressable
                    key={l.value}
                    onPress={() => setLevel(l.value)}
                    style={[styles.chip, active && { borderColor: colors.brandAlt, backgroundColor: `${colors.brandAlt}12` }]}
                  >
                    <Ionicons
                      name={l.icon as any}
                      size={16}
                      color={active ? colors.brandAlt : colors.subtext}
                    />
                    <Text style={[styles.chipText, active && { color: colors.brandAlt }]}>{l.label}</Text>
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

        <FadeInUp delay={180}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Fréquence d'entraînement</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => {
                const active = frequency === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setFrequency(f.value)}
                    style={[styles.chip, active && { borderColor: colors.gym, backgroundColor: `${colors.gym}12` }]}
                  >
                    <Text style={[styles.chipText, active && { color: colors.gym }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Le régime filtre les conseils nutritionnels de l'IA : proposer
                du poulet à quelqu'un de végan disqualifie tout le conseil. */}
            <Text style={[styles.cardTitle, { marginTop: spacing.md }]}>Régime alimentaire</Text>
            <View style={styles.chipRow}>
              {DIETS.map((d) => {
                const active = diet === d.value;
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => setDiet(d.value)}
                    style={[styles.chip, active && { borderColor: colors.carbs, backgroundColor: `${colors.carbs}12` }]}
                  >
                    <Text style={[styles.chipText, active && { color: colors.carbs }]}>{d.label}</Text>
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

        {/* Évolution du poids : chaque enregistrement laisse une trace, ce qui
            transforme une valeur isolée en progression lisible. */}
        {(answers.weightHistory?.length ?? 0) > 1 ? (
          <FadeInUp delay={250}>
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Évolution du poids</Text>
              {answers.weightHistory!.slice(-5).reverse().map((entry) => (
                <View key={entry.date} style={styles.weightRow}>
                  <Text style={styles.weightDate}>
                    {new Date(entry.date).toLocaleDateString('fr-FR')}
                  </Text>
                  <Text style={styles.weightValue}>{entry.weightKg} kg</Text>
                </View>
              ))}
            </Card>
          </FadeInUp>
        ) : null}

        <GradientButton
          label={saving ? 'Enregistrement…' : 'Enregistrer'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
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
  weightRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  weightDate: { ...font.caption, color: colors.subtext },
  weightValue: { ...font.bodyBold, color: colors.text },
});
